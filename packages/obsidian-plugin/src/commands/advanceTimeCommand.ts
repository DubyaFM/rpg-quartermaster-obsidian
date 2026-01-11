/**
 * Advance Time Command
 *
 * Obsidian command palette integration for time advancement.
 * Opens the TimeAdvancementModal for user interaction.
 *
 * **Phase 7 - TKT-CAL-054**
 */

import { App } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { TimeAdvancementModal } from '../ui/TimeAdvancementModal';

/**
 * Register the "Advance Time by..." command
 * Called from main.ts during plugin initialization
 */
export function registerAdvanceTimeCommand(plugin: QuartermasterPlugin): void {
	plugin.addCommand({
		id: 'advance-time-modal',
		name: 'Advance Time by...',
		callback: () => {
			new TimeAdvancementModal(plugin.app, plugin).open();
		}
	});
}
