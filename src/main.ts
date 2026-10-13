/**
 * Fast Note Sync Toggle
 * =====================
 *
 * Fast Note Sync's "read-only sync mode" decides whether this device may upload
 * local changes. It is genuinely useful to flick -- turn it on before editing on
 * a machine you do not trust to be authoritative, turn it off when you are done
 * -- but it lives three levels deep in that plugin's settings pane.
 *
 * This plugin puts it on a command and on a switch in the note header, and keeps
 * both of them showing the truth.
 *
 * WHY THE STATE IS POLLED
 * -----------------------
 * The flag can also be changed from Fast Note Sync's own settings pane, and that
 * plugin tells nobody when it does. Hooking its `saveSettings` would mean
 * monkey-patching another plugin's prototype, which is exactly the kind of thing
 * that breaks on their next release. Reading one boolean once a second costs
 * nothing measurable, and the DOM is only touched when the value actually
 * changed -- so the button cannot go stale.
 */

import {
	MarkdownView,
	Notice,
	Plugin,
	setIcon,
	type WorkspaceLeaf,
} from "obsidian";
import { FNS_PLUGIN_ID, readMode, writeMode, type SyncMode } from "./fns";
import {
	DEFAULT_SETTINGS,
	ToggleSettingTab,
	normalizeSettings,
	type ToggleSettings,
} from "./settings";

/** Icon shown while read-only sync is on. */
const ICON_ON = "lock";
/** Icon shown while it is off. */
const ICON_OFF = "unlock";
/** Icon shown when Fast Note Sync cannot be found. */
const ICON_MISSING = "help-circle";

/** Class put on the header action, so the stylesheet can reach it. */
const HEADER_CLASS = "fns-readonly-toggle";
/** Class put on the status bar item. */
const STATUS_CLASS = "fns-readonly-status";

/**
 * Human-readable state, for tooltips, the status bar and notices.
 *
 * @param mode - The current mode.
 * @returns A short Chinese label.
 */
function stateText(mode: SyncMode): string {
	if (mode === "on") return "只读同步：开";
	if (mode === "off") return "只读同步：关";
	return "只读同步：不可用";
}

/**
 * What clicking the switch would do, as a tooltip.
 *
 * @param mode - The current mode.
 * @returns A sentence describing the click.
 */
function tooltip(mode: SyncMode): string {
	if (mode === "on") return "只读同步模式已开启（只收不发）—— 点击关闭";
	if (mode === "off") return "只读同步模式已关闭（会正常上传）—— 点击开启";
	return `没有找到 ${FNS_PLUGIN_ID} 插件，点击查看说明`;
}

export default class FastNoteSyncTogglePlugin extends Plugin {
	settings: ToggleSettings = DEFAULT_SETTINGS;

	/** Header actions this plugin added, keyed by the view that owns them. */
	private readonly headerButtons = new Map<MarkdownView, HTMLElement>();

	/** The status bar item, when that option is on. */
	private statusBarEl: HTMLElement | null = null;

	/** The last mode painted, so an unchanged poll does not touch the DOM. */
	private painted: SyncMode | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ToggleSettingTab(this.app, this));

		this.addCommand({
			id: "toggle-readonly-sync",
			name: "切换只读同步模式（开 / 关）",
			callback: () => void this.toggle(),
		});
		// Two explicit commands as well, because a hotkey that always turns the
		// mode *on* is more useful than one that just flips whatever it was.
		this.addCommand({
			id: "enable-readonly-sync",
			name: "开启只读同步模式",
			checkCallback: (checking) => this.runExplicit(checking, true),
		});
		this.addCommand({
			id: "disable-readonly-sync",
			name: "关闭只读同步模式",
			checkCallback: (checking) => this.runExplicit(checking, false),
		});

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
		this.statusBarEl?.remove();
		this.statusBarEl = null;
	}

	// -- state -------------------------------------------------------------

	/**
	 * Adds, removes or repaints the switches.
	 *
	 * Called on load, on workspace changes, and from the settings tab, so a
	 * changed option takes effect immediately.
	 */
	refresh(): void {
		// Views that have been closed leave their action element detached.
		for (const [view, el] of this.headerButtons) {
			if (!el.isConnected) this.headerButtons.delete(view);
		}

		if (this.settings.showHeaderButton) {
			this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
				const view = leaf.view;
				if (!(view instanceof MarkdownView)) return;
				if (this.headerButtons.has(view)) return;
				const el = view.addAction(ICON_OFF, "", () => void this.toggle());
				el.addClass(HEADER_CLASS);
				this.headerButtons.set(view, el);
			});
		} else {
			this.removeHeaderButtons();
		}

		// Freshly added buttons have never been painted.
		this.painted = null;
		this.sync();
	}

	/** Repaints only when the mode actually changed. */
	private sync(): void {
		const mode = readMode(this.app);
		this.ensureStatusBar();
		if (mode === this.painted) return;
		this.painted = mode;

		const icon =
			mode === "on" ? ICON_ON : mode === "off" ? ICON_OFF : ICON_MISSING;
		const tip = tooltip(mode);

		for (const el of this.headerButtons.values()) {
			setIcon(el, icon);
			el.setAttribute("aria-label", tip);
			el.toggleClass("is-active", mode === "on");
			el.toggleClass("is-missing", mode === "missing");
		}

		if (this.statusBarEl) {
			this.statusBarEl.setText(stateText(mode));
			this.statusBarEl.setAttribute("aria-label", tip);
			this.statusBarEl.toggleClass("is-active", mode === "on");
			this.statusBarEl.toggleClass("is-missing", mode === "missing");
		}
	}

	// -- switching ---------------------------------------------------------

	/** Flips the mode and reports the result. */
	async toggle(): Promise<void> {
		const mode = readMode(this.app);
		if (mode === "missing") {
			new Notice(
				`没有找到 Fast Note Sync（${FNS_PLUGIN_ID}）。请先安装并启用它。`
			);
			return;
		}
		await this.apply(mode !== "on");
	}

	/**
	 * Sets an explicit mode, or reports whether the command applies.
	 *
	 * @param checking - True while Obsidian is only deciding whether to list it.
	 * @param on - The mode to set.
	 * @returns Whether the command is available right now.
	 */
	private runExplicit(checking: boolean, on: boolean): boolean {
		const mode = readMode(this.app);
		if (mode === "missing") return false;
		// Already in the requested state: hiding it keeps the palette honest.
		if (mode === (on ? "on" : "off")) return false;
		if (!checking) void this.apply(on);
		return true;
	}

	/**
	 * Writes the mode, repaints and optionally announces it.
	 *
	 * @param on - The mode to set.
	 */
	private async apply(on: boolean): Promise<void> {
		const result = await writeMode(this.app, on, this.settings.reloadServices);
		if (result === "missing") {
			new Notice(
				`没有找到 Fast Note Sync（${FNS_PLUGIN_ID}）。请先安装并启用它。`
			);
			return;
		}

		this.painted = null;
		this.sync();

		if (this.settings.showNotice) {
			new Notice(
				on
					? "已开启只读同步模式：本设备只接收服务端更新，不再上传本地修改。"
					: "已关闭只读同步模式：本地修改会重新上传。"
			);
		}
	}

	// -- chrome ------------------------------------------------------------

	/** Removes every header action this plugin added. */
	private removeHeaderButtons(): void {
		for (const el of this.headerButtons.values()) el.remove();
		this.headerButtons.clear();
	}

	/** Creates or removes the status bar item to match the setting. */
	private ensureStatusBar(): void {
		if (this.settings.showStatusBar && !this.statusBarEl) {
			const el = this.addStatusBarItem();
			el.addClass(STATUS_CLASS);
			el.onClickEvent(() => void this.toggle());
			// Force the next paint; the element is brand new.
			this.painted = null;
			this.statusBarEl = el;
		} else if (!this.settings.showStatusBar && this.statusBarEl) {
			this.statusBarEl.remove();
			this.statusBarEl = null;
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
