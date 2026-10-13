/**
 * Plugin settings.
 *
 * Small enough that explicit `Setting` rows are clearer than a row table, but
 * the interface is validated the same way the other plugins in this vault do it:
 * a stored value of the wrong type falls back to the default rather than
 * reaching the DOM.
 */

import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { FNS_PLUGIN_ID, getFastNoteSync } from "./fns";
import type FastNoteSyncTogglePlugin from "./main";

/** Persisted plugin settings. */
export interface ToggleSettings {
	/** Show the switch in a page's header bar at all. */
	showHeaderButton: boolean;
	/** Which pages get it. */
	headerInMarkdown: boolean;
	headerInCanvas: boolean;
	headerInExcalidraw: boolean;
	/** Also show it in the status bar. */
	showStatusBar: boolean;
	/** Announce the new state after every switch. */
	showNotice: boolean;
	/** Use Fast Note Sync's heavier save (drops and reconnects its websocket). */
	reloadServices: boolean;
}

/**
 * The pages that can carry the header switch.
 *
 * `viewType` values are Obsidian's own strings: `markdown` is the Markdown
 * view, `canvas` is the core Canvas view, and `excalidraw` is what the
 * Excalidraw plugin registers its drawing view under. A page whose type is not
 * in this table simply gets no switch -- there is nothing to guess.
 */
export const HEADER_VIEW_TYPES: ReadonlyArray<{
	key: "headerInMarkdown" | "headerInCanvas" | "headerInExcalidraw";
	type: string;
	label: string;
}> = [
	{ key: "headerInMarkdown", type: "markdown", label: "Markdown 笔记" },
	{ key: "headerInCanvas", type: "canvas", label: "Canvas 画布" },
	{ key: "headerInExcalidraw", type: "excalidraw", label: "Excalidraw 图纸" },
];

/**
 * Collects the view types the settings currently allow.
 *
 * @param settings - Current settings.
 * @returns The view types that should carry a switch.
 */
export function enabledHeaderViews(settings: ToggleSettings): Set<string> {
	const out = new Set<string>();
	for (const row of HEADER_VIEW_TYPES) {
		if (settings[row.key]) out.add(row.type);
	}
	return out;
}

/** Settings used on first install and for any unusable stored value. */
export const DEFAULT_SETTINGS: ToggleSettings = {
	showHeaderButton: true,
	headerInMarkdown: true,
	headerInCanvas: true,
	headerInExcalidraw: true,
	showStatusBar: false,
	showNotice: true,
	reloadServices: false,
};

/**
 * Merges stored data over the defaults, rejecting unusable values.
 *
 * Built from the default key set rather than by `Object.assign`, which drops
 * unknown keys. That matters: a key left behind by an older version would
 * otherwise be carried forever, and a stale value silently outranking a changed
 * default is a bug this vault has already been bitten by once.
 *
 * @param stored - Raw value from `loadData()`.
 * @returns Complete, valid settings.
 */
export function normalizeSettings(
	stored: Partial<ToggleSettings> | null
): ToggleSettings {
	const raw = (stored ?? {}) as Record<string, unknown>;
	const fallback = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
	const out: Record<string, unknown> = { ...fallback };

	for (const key of Object.keys(DEFAULT_SETTINGS)) {
		if (!(key in raw)) continue;
		const value = raw[key];
		out[key] = typeof value === "boolean" ? value : fallback[key];
	}

	return out as unknown as ToggleSettings;
}

/** Settings tab shown under Settings -> Community plugins -> this plugin. */
export class ToggleSettingTab extends PluginSettingTab {
	private readonly plugin: FastNoteSyncTogglePlugin;

	constructor(app: App, plugin: FastNoteSyncTogglePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const found = getFastNoteSync(this.app) !== null;
		containerEl.createDiv({
			cls: "fns-toggle-note",
			text: found
				? "已找到 Fast Note Sync。下面的开关只改它的「只读同步模式」，不会改动它的其它设置。"
				: `没有找到 Fast Note Sync（${FNS_PLUGIN_ID}）。请先安装并启用它，本插件才能起作用。`,
		});

		new Setting(containerEl)
			.setName("立即切换一次")
			.setDesc("等同于命令面板里的「切换只读同步模式」。")
			.addButton((button) =>
				button
					.setButtonText("切换")
					.setDisabled(!found)
					.onClick(async () => {
						await this.plugin.toggle();
						this.display();
					})
			);

		new Setting(containerEl)
			.setName("在页面顶部显示开关")
			.setDesc(
				"在页面右上角的按钮栏里放一个开关：锁 = 只读同步已开启，开锁 = 已关闭。" +
					"点击即可切换，鼠标悬停会显示当前状态。"
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showHeaderButton).onChange(async (value) => {
					this.plugin.settings.showHeaderButton = value;
					await this.plugin.saveSettings();
					this.plugin.refresh();
					this.display();
				})
			);

		if (this.plugin.settings.showHeaderButton) {
			for (const row of HEADER_VIEW_TYPES) {
				new Setting(containerEl)
					.setName(`↳ 在${row.label}里显示`)
					.setClass("fns-toggle-sub")
					.addToggle((toggle) =>
						toggle.setValue(this.plugin.settings[row.key]).onChange(async (value) => {
							this.plugin.settings[row.key] = value;
							await this.plugin.saveSettings();
							this.plugin.refresh();
						})
					);
			}
		}

		new Setting(containerEl)
			.setName("在状态栏也显示")
			.setDesc("状态栏在窗口底部，会显示成「只读同步：开 / 关」，点击同样可以切换。")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
					this.plugin.settings.showStatusBar = value;
					await this.plugin.saveSettings();
					this.plugin.refresh();
				})
			);

		new Setting(containerEl)
			.setName("切换时弹出提示")
			.setDesc("每次切换后用通知说明新的状态。关掉后切换是静默的。")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.showNotice).onChange(async (value) => {
					this.plugin.settings.showNotice = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("切换后重载同步服务")
			.setDesc(
				"默认关闭。只读同步的开关在 Fast Note Sync 里是「每次上传前现读」的，" +
					"所以只保存设置就已经生效；打开这一项会调用它自己的重载流程，" +
					"代价是每次切换都会断开并重连 websocket。"
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.reloadServices).onChange(async (value) => {
					this.plugin.settings.reloadServices = value;
					await this.plugin.saveSettings();
					new Notice(
						value
							? "已改为跟随 Fast Note Sync 的重载流程。"
							: "已改为只保存设置（更快）。"
					);
				})
			);
	}
}
