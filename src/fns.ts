/**
 * The bridge to Fast Note Sync.
 *
 * Everything here talks to another plugin's internals through the (undocumented
 * but long-standing) `app.plugins.plugins` registry -- the same route Fast Note
 * Sync itself uses to reach other plugins. Nothing is imported from it, so this
 * plugin still loads, and still works, when Fast Note Sync is absent or disabled.
 *
 * The shape below is deliberately *structural*: it claims only the members that
 * are actually used, and every lookup re-validates them at runtime. A renovation
 * of Fast Note Sync's settings object should make these switches report
 * themselves as unavailable rather than make this plugin throw.
 */

import type { App } from "obsidian";

/** Fast Note Sync's plugin id, exactly as its manifest declares it. */
export const FNS_PLUGIN_ID = "fast-note-sync";

/**
 * The slice of Fast Note Sync this plugin drives.
 *
 * The two modes are read live by Fast Note Sync at every point of use -- its
 * source has no place that caches them into a service at startup -- so writing
 * the flag and saving is enough to take effect.
 */
export interface FastNoteSync {
	settings: Record<string, unknown>;
	saveSettings(): Promise<void>;
	/** Saves *and* tears down/reconnects the sync services. */
	saveAndReloadServices?(setItem?: string): Promise<void>;
}

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
	if (typeof plugin.saveSettings !== "function") return null;

	return plugin as FastNoteSync;
}

/**
 * Reads one boolean mode.
 *
 * @param app - The Obsidian app.
 * @param key - The key on Fast Note Sync's settings.
 * @returns Its value, or null when the plugin or the key is unusable.
 */
export function readFlag(app: App, key: string): boolean | null {
	const plugin = getFastNoteSync(app);
	if (!plugin) return null;
	const value = plugin.settings[key];
	return typeof value === "boolean" ? value : null;
}

/**
 * Writes one boolean mode and persists it.
 *
 * Saving plainly is enough: Fast Note Sync reads these flags live, so nothing
 * has to be rebuilt. `saveAndReloadServices()` does the same save but then also
 * drops and reconnects its websocket, which is why it is opt-in rather than the
 * default for a button meant to be flicked.
 *
 * @param app - The Obsidian app.
 * @param key - The key on Fast Note Sync's settings.
 * @param on - The value to store.
 * @param reloadServices - Use Fast Note Sync's own heavier save path.
 * @returns The value written, or null when nothing was written.
 */
export async function writeFlag(
	app: App,
	key: string,
	on: boolean,
	reloadServices: boolean
): Promise<boolean | null> {
	const plugin = getFastNoteSync(app);
	if (!plugin) return null;

	// Refuse to *create* the key. If it is missing, Fast Note Sync has renamed
	// or dropped it, and writing a fresh one would silently do nothing while
	// looking like it worked.
	if (typeof plugin.settings[key] !== "boolean") return null;

	plugin.settings[key] = on;

	if (reloadServices && typeof plugin.saveAndReloadServices === "function") {
		await plugin.saveAndReloadServices();
	} else {
		await plugin.saveSettings();
	}

	return on;
}
