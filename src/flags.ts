/**
 * The Fast Note Sync modes this plugin can switch.
 *
 * Both modes are read live by Fast Note Sync at the point of use, so writing
 * the flag and saving is all that is needed -- see `fns.ts`.
 *
 * Everything that differs between the two modes lives in this table: the
 * settings key they act on, their icons, their wording, and their command names.
 * Adding a third mode should mean adding a row here and nothing else.
 *
 * `readonly` and `manual` are separate settings in Fast Note Sync but related
 * in effect: both stop automatic uploads. Read-only goes further and refuses
 * uploads even when triggered by hand.
 */

/** A settings key this plugin's own settings pane can toggle on and off. */
export type FlagEnableKey = "enableReadonly" | "enableManual";

/** One Fast Note Sync mode. */
export interface FlagSpec {
	/** Stable id, used in map keys and command ids. */
	id: string;
	/** The key on Fast Note Sync's own settings object. */
	key: string;
	/** Which of this plugin's settings decides whether the mode is exposed. */
	settingsKey: FlagEnableKey;
	/** Name used in the settings pane and in tooltips. */
	label: string;
	/** One-line explanation, for the settings pane. */
	description: string;
	/** Icon while the mode is on. */
	onIcon: string;
	/** Icon while the mode is off. */
	offIcon: string;
	/** Tooltip while the mode is on. */
	onTip: string;
	/** Tooltip while the mode is off. */
	offTip: string;
	/** Notice shown after switching it on. */
	onNotice: string;
	/** Notice shown after switching it off. */
	offNotice: string;
	/** Command palette entries. */
	toggleCommand: string;
	onCommand: string;
	offCommand: string;
}

/**
 * Every mode the plugin knows how to switch, in the order they should appear.
 */
export const FLAGS: readonly FlagSpec[] = [
	{
		id: "readonly",
		key: "readonlySyncEnabled",
		settingsKey: "enableReadonly",
		label: "只读同步",
		description: "开启后本设备只接收服务端更新，不上传任何本地修改。",
		onIcon: "lock",
		offIcon: "unlock",
		onTip: "只读同步模式已开启（只收不发）—— 点击关闭",
		offTip: "只读同步模式已关闭（会正常上传）—— 点击开启",
		onNotice: "已开启只读同步模式：本设备只接收服务端更新，不再上传本地修改。",
		offNotice: "已关闭只读同步模式：本地修改会重新上传。",
		toggleCommand: "切换只读同步模式（开 / 关）",
		onCommand: "开启只读同步模式",
		offCommand: "关闭只读同步模式",
	},
	{
		id: "manual",
		key: "manualSyncEnabled",
		settingsKey: "enableManual",
		label: "手动同步",
		description:
			"开启后不再在启动或文件修改时自动触发同步，只能手动触发。" +
			"Fast Note Sync 自己对这个选项的提示是「请谨慎开启，会严重影响使用体验」。",
		onIcon: "pause",
		offIcon: "zap",
		onTip: "手动同步模式已开启（自动同步已暂停）—— 点击关闭",
		offTip: "手动同步模式已关闭（会自动触发同步）—— 点击开启",
		onNotice:
			"已开启手动同步模式：启动与文件修改都不再自动触发同步，只能手动触发。",
		offNotice: "已关闭手动同步模式：恢复自动触发同步。",
		toggleCommand: "切换手动同步模式（开 / 关）",
		onCommand: "开启手动同步模式",
		offCommand: "关闭手动同步模式",
	},
];

/**
 * Looks a mode up by its id.
 *
 * @param id - The flag id.
 * @returns The mode, or undefined.
 */
export function flagById(id: string): FlagSpec | undefined {
	return FLAGS.find((flag) => flag.id === id);
}
