/**
 * Add Event Command
 *
 * Obsidian command for opening the Add Event Modal.
 * Allows GMs to quickly create campaign events from the command palette.
 *
 * **Phase 7 - TKT-CAL-056**
 */

import { App } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { AddEventModal } from '../ui/AddEventModal';

/**
 * Opens the Add Event Modal to create a new campaign event
 *
 * @param app Obsidian app instance
 * @param plugin Quartermaster plugin instance
 */
export function addEventCommand(app: App, plugin: QuartermasterPlugin): void {
	const modal = new AddEventModal(app, plugin);
	modal.open();
}
