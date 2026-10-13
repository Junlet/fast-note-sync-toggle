/**
 * Fast Note Sync Toggle
 * =====================
 *
 * Fast Note Sync has two modes that suppress automatic uploading, and both live
 * three levels deep in its settings pane:
 *
 *   - read-only sync:  only receive from the server, never upload;
 *   - manual sync:     never sync on startup or on file change, only by hand.
 *
 * This plugin puts each of them on a command and on a switch in the page header,
 * and keeps every switch showing the truth. Which modes are exposed is itself a
 * setting, so the header does not have to carry a button nobody uses.
 *
 * WHY THE STATE IS POLLED
 * -----------------------
 * Either flag can also be changed from Fast Note Sync's own settings pane, and
 * that plugin tells nobody when it does. Hooking its `saveSettings` would mean
 * monkey-patching another plugin's prototype, which is exactly the kind of thing
 * that breaks on their next release. Reading two booleans once a second costs
 * nothing measurable, and the DOM is only touched when something actually
 * changed -- so the switches cannot go stale.
 */

import {
	Notice,
	Platform,
	Plugin,
	setIcon,
	type View,
	type WorkspaceLeaf,
} from "obsidian";
import { FNS_PLUGIN_ID, getFastNoteSync, readFlag, writeFlag } from "./fns";
import { FLAGS, type FlagSpec } from "./flags";
import {
	DEFAULT_SETTINGS,
	ToggleSettingTab,
	enabledHeaderViews,
	isFlagEnabled,
	normalizeSettings,
	type ToggleSettings,
} from "./settings";

/** Icon shown when Fast Note Sync cannot be found. */
const ICON_MISSING = "help-circle";

/** Class put on header actions, so the stylesheet can reach them. */
const HEADER_CLASS = "fns-mode-toggle";
/** Class put on status bar items. */
const STATUS_CLASS = "fns-mode-status";

/**
 * A view that can carry a header action.
 *
 * Duck-typed rather than checked with `instanceof ItemView`: the typings put
 * `addAction` on `ItemView`, but Canvas and Excalidraw views are Obsidian's own
 * (and another plugin's) classes, and the only thing that actually matters is
 * that the two methods exist.
 */
interface ActionableView extends View {
	addAction(
		icon: string,
		title: string,
		callback: (evt: MouseEvent) => unknown
	): HTMLElement;
}

/**
 * Narrows a view to one this plugin can decorate.
 *
 * @param view - Any workspace view.
 * @returns The view, or null when it cannot take a header action.
 */
function asActionableView(view: View): ActionableView | null {
	const candidate = view as Partial<ActionableView>;
	if (typeof candidate.getViewType !== "function") return null;
	if (typeof candidate.addAction !== "function") return null;
	return candidate as ActionableView;
}

export default class FastNoteSyncTogglePlugin extends Plugin {
	settings: ToggleSettings = DEFAULT_SETTINGS;

	/** Header actions, one map of mode id to element per view. */
	private readonly headerButtons = new Map<View, Map<string, HTMLElement>>();

	/** Status bar items, one per mode. */
	private readonly statusItems = new Map<string, HTMLElement>();

	/** Signature of the last painted state, so an unchanged poll is free. */
	private painted: string | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ToggleSettingTab(this.app, this));

		// Every mode gets all three commands; `checkCallback` hides the ones
		// that do not apply, so switching a mode off also removes its commands
		// from the palette.
		for (const flag of FLAGS) {
			this.addCommand({
				id: `toggle-${flag.id}-sync`,
				name: flag.toggleCommand,
				checkCallback: (checking) => this.runCommand(checking, flag, null),
			});
			// Explicit on/off commands as well, because a hotkey that always
			// turns a mode *on* is more useful than one that flips whatever it
			// happened to be.
			this.addCommand({
				id: `enable-${flag.id}-sync`,
				name: flag.onCommand,
				checkCallback: (checking) => this.runCommand(checking, flag, true),
			});
			this.addCommand({
				id: `disable-${flag.id}-sync`,
				name: flag.offCommand,
				checkCallback: (checking) => this.runCommand(checking, flag, false),
			});
		}

		this.app.workspace.onLayoutReady(() => this.refresh());
		this.registerEvent(this.app.workspace.on("layout-change", () => this.refresh()));
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", () => this.refresh())
		);
		this.registerInterval(window.setInterval(() => this.sync(), 1000));

		console.log("[fast-note-sync-toggle] 已加载");
	}

	onunload(): void {
		this.removeHeaderButtons();
		for (const el of this.statusItems.values()) el.remove();
		this.statusItems.clear();
	}

	// -- state -------------------------------------------------------------

	/** The modes the settings currently expose. */
	private enabledFlags(): FlagSpec[] {
		return FLAGS.filter((flag) => isFlagEnabled(this.settings, flag));
	}

	/**
	 * Adds, removes or repaints the switches.
	 *
	 * Called on load, on workspace changes, and from the settings tab, so a
	 * changed option takes effect immediately.
	 */
	refresh(): void {
		const wanted = this.settings.showHeaderButton;
		const viewTypes = enabledHeaderViews(this.settings);
		const flags = this.enabledFlags();
		const ids = new Set(flags.map((flag) => flag.id));

		// Drop actions that have been detached, switched off, or whose page type
		// is no longer allowed.
		for (const [view, buttons] of this.headerButtons) {
			for (const [id, el] of buttons) {
				const keep =
					el.isConnected &&
					wanted &&
					viewTypes.has(view.getViewType()) &&
					ids.has(id);
				if (keep) continue;
				el.remove();
				buttons.delete(id);
			}
			if (buttons.size === 0) this.headerButtons.delete(view);
		}

		if (wanted) {
			this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
				const view = leaf.view;
				if (!viewTypes.has(view.getViewType())) return;

				const actionable = asActionableView(view);
				if (!actionable) return;

				let buttons = this.headerButtons.get(view);
				if (!buttons) {
					buttons = new Map<string, HTMLElement>();
					this.headerButtons.set(view, buttons);
				}

				// `addAction` *prepends*, so walking the table backwards leaves
				// the first mode leftmost in the header.
				for (let i = flags.length - 1; i >= 0; i--) {
					const flag = flags[i];
					if (buttons.has(flag.id)) continue;
					try {
						const el = actionable.addAction(flag.offIcon, "", () =>
							void this.toggleFlag(flag)
						);
						el.addClass(HEADER_CLASS);
						buttons.set(flag.id, el);
					} catch (error) {
						// Obsidian's addAction prepends into `view.actionsEl`,
						// which only exists on views that have a header. A view
						// without one throws here rather than returning nothing.
						console.error(
							`[fast-note-sync-toggle] 无法在 ${view.getViewType()} 视图上加按钮`,
							error
						);
						return;
					}
				}
			});
		}

		// Freshly added elements have never been painted.
		this.painted = null;
		this.sync();
	}

	/** Repaints only when something actually changed. */
	private sync(): void {
		this.ensureStatusItems();

		const flags = this.enabledFlags();
		const signature =
			flags
				.map((flag) => `${flag.id}:${readFlag(this.app, flag.key) ?? "na"}`)
				.join("|") + `#${Platform.isMobile ? "m" : "d"}`;
		if (signature === this.painted) return;
		this.painted = signature;

		for (const flag of flags) {
			const state = readFlag(this.app, flag.key);
			const on = state === true;
			const missing = state === null;
			const icon = missing ? ICON_MISSING : on ? flag.onIcon : flag.offIcon;
			const tip = missing
				? `没有找到 ${FNS_PLUGIN_ID} 插件，或它的设置里没有这一项 —— 点击查看说明`
				: on
					? flag.onTip
					: flag.offTip;

			for (const buttons of this.headerButtons.values()) {
				const el = buttons.get(flag.id);
				if (!el) continue;
				setIcon(el, icon);
				el.setAttribute("aria-label", tip);
				el.toggleClass("is-active", on);
				el.toggleClass("is-missing", missing);
			}

			const status = this.statusItems.get(flag.id);
			if (!status) continue;
			status.setText(`${flag.label}：${missing ? "不可用" : on ? "开" : "关"}`);
			status.setAttribute("aria-label", tip);
			status.toggleClass("is-active", on);
			status.toggleClass("is-missing", missing);
		}
	}

	// -- switching ---------------------------------------------------------

	/**
	 * Flips one mode and reports the result.
	 *
	 * @param flag - The mode to flip.
	 */
	async toggleFlag(flag: FlagSpec): Promise<void> {
		const current = readFlag(this.app, flag.key);
		if (current === null) {
			new Notice(this.unavailableText(flag));
			return;
		}
		await this.apply(flag, !current);
	}

	/**
	 * What to say when a mode cannot be driven.
	 *
	 * @param flag - The mode.
	 * @returns A sentence naming the missing piece.
	 */
	private unavailableText(flag: FlagSpec): string {
		return getFastNoteSync(this.app)
			? `Fast Note Sync 的设置里没有找到「${flag.label}」这一项，可能是它改了设置结构。`
			: `没有找到 Fast Note Sync（${FNS_PLUGIN_ID}）。请先安装并启用它。`;
	}

	/**
	 * Sets an explicit mode, or reports whether the command applies.
	 *
	 * @param checking - True while Obsidian is only deciding whether to list it.
	 * @param flag - The mode.
	 * @param target - The value to force, or null to flip.
	 * @returns Whether the command is available right now.
	 */
	private runCommand(
		checking: boolean,
		flag: FlagSpec,
		target: boolean | null
	): boolean {
		if (!isFlagEnabled(this.settings, flag)) return false;

		const current = readFlag(this.app, flag.key);
		if (current === null) return false;
		// Already in the requested state: hiding it keeps the palette honest.
		if (target !== null && current === target) return false;

		if (!checking) void this.apply(flag, target ?? !current);
		return true;
	}

	/**
	 * Writes a mode, repaints and optionally announces it.
	 *
	 * @param flag - The mode.
	 * @param on - The value to set.
	 */
	private async apply(flag: FlagSpec, on: boolean): Promise<void> {
		const written = await writeFlag(
			this.app,
			flag.key,
			on,
			this.settings.reloadServices
		);
		if (written === null) {
			new Notice(this.unavailableText(flag));
			return;
		}

		this.painted = null;
		this.sync();

		if (this.settings.showNotice) {
			new Notice(on ? flag.onNotice : flag.offNotice);
		}
	}

	// -- chrome ------------------------------------------------------------

	/** Removes every header action this plugin added. */
	private removeHeaderButtons(): void {
		for (const buttons of this.headerButtons.values()) {
			for (const el of buttons.values()) el.remove();
		}
		this.headerButtons.clear();
	}

	/** Creates or removes the status bar items to match the settings. */
	private ensureStatusItems(): void {
		// Obsidian hides the whole status bar on mobile -- its own stylesheet has
		// `.is-mobile .status-bar { display: none }` -- so items added there
		// would exist in the DOM and never be seen. Skipping them keeps the
		// setting honest on iPad and phones while leaving the stored value
		// alone, so a vault synced from a desktop keeps its choice.
		const wanted = this.settings.showStatusBar && !Platform.isMobile;
		const flags = this.enabledFlags();
		const ids = new Set(flags.map((flag) => flag.id));

		for (const [id, el] of this.statusItems) {
			if (wanted && ids.has(id)) continue;
			el.remove();
			this.statusItems.delete(id);
		}
		if (!wanted) return;

		for (const flag of flags) {
			if (this.statusItems.has(flag.id)) continue;
			const el = this.addStatusBarItem();
			el.addClass(STATUS_CLASS);
			el.onClickEvent(() => void this.toggleFlag(flag));
			this.statusItems.set(flag.id, el);
			// Force the next paint; the element is brand new.
			this.painted = null;
		}
	}

	// -- persistence -------------------------------------------------------

	/** Loads persisted settings, falling back to defaults. */
	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(await this.loadData());
	}

	/** Persists the current settings. */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
