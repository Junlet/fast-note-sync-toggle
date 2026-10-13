/**
 * The bridge to Fast Note Sync.
 *
 * Everything here talks to another plugin's internals through the (undocumented
 * but long-standing) `app.plugins.plugins` registry -- the same route Fast Note
 * Sync itself uses to reach other plugins. Nothing is imported from it, so this
 * plugin still loads, and still works, when Fast Note Sync is absent or disabled.
 *
 * The `FastNoteSync` shape below is deliberately *structural*: it claims only
 * the three members that are actually read, and every lookup re-validates them
 * at runtime. A renovation of Fast Note Sync's settings object should make the
 * toggle report itself as unavailable rather than make this plugin throw.
 */

import type { App } from "obsidian";

/** Fast Note Sync's plugin id, exactly as its manifest declares it. */
export const FNS_PLUGIN_ID = "fast-note-sync";

/**
 * The slice of Fast Note Sync this plugin drives.
 *
 * `readonlySyncEnabled` is read live by Fast Note Sync at every upload site, so
 * writing it and saving is enough to take effect; the flag is never cached into
 * a service at startup.
 */
export interface FastNoteSync {
	settings: { readonlySyncEnabled: boolean };
	saveSettings(): Promise<void>;
	/** Saves *and* tears down/reconnects the sync services. */
	saveAndReloadServices?(setItem?: string): Promise<void>;
}

/** What the toggle currently sees. */
export type SyncMode = "on" | "off" | "missing";

/** The plugin registry hanging off the app, which the typings do not describe. */
interface AppWithPlugins {
	plugins?: { plugins?: Record<string, unknown> };
}

/**
 * Finds Fast Note Sync, if it is installed, enabled and still looks like itself.
 *
 * @param app - The Obsidian app.
 * @returns The plugin, or null when it cannot be safely driven.
 */
export function getFastNoteSync(app: App): FastNoteSync | null {
	const registry = (app as unknown as AppWithPlugins).plugins?.plugins;
	const candidate = registry?.[FNS_PLUGIN_ID];
	if (!candidate || typeof candidate !== "object") return null;

	const plugin = candidate as Partial<FastNoteSync>;
	if (!plugin.settings || typeof plugin.settings !== "object") return null;
	if (typeof plugin.settings.readonlySyncEnabled !== "boolean") return null;
	if (typeof plugin.saveSettings !== "function") return null;

	return plugin as FastNoteSync;
}

/**
 * Reads the current mode.
 *
 * @param app - The Obsidian app.
 * @returns `"missing"` when Fast Note Sync cannot be driven.
 */
export function readMode(app: App): SyncMode {
	const plugin = getFastNoteSync(app);
	if (!plugin) return "missing";
	return plugin.settings.readonlySyncEnabled ? "on" : "off";
}

/**
 * Writes the flag and persists it.
 *
 * Saving plainly is enough: Fast Note Sync reads `readonlySyncEnabled` live at
 * every upload site, so nothing has to be rebuilt. `saveAndReloadServices()`
 * does the same save but then also drops and reconnects its websocket, which is
 * why it is opt-in rather than the default for a button meant to be flicked.
 *
 * @param app - The Obsidian app.
 * @param on - The value to store.
 * @param reloadServices - Use Fast Note Sync's own heavier save path.
 * @returns The mode afterwards, or `"missing"`.
 */
export async function writeMode(
	app: App,
	on: boolean,
	reloadServices: boolean
): Promise<SyncMode> {
	const plugin = getFastNoteSync(app);
	if (!plugin) return "missing";

	plugin.settings.readonlySyncEnabled = on;

	if (reloadServices && typeof plugin.saveAndReloadServices === "function") {
		await plugin.saveAndReloadServices();
	} else {
		await plugin.saveSettings();
	}

	return on ? "on" : "off";
}
