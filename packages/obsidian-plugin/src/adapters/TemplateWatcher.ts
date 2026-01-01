/**
 * TemplateWatcher - Monitors template file changes and invalidates caches
 * Watches facility, order, and event table template folders for changes
 */

import { App, TAbstractFile, TFile, EventRef } from 'obsidian';
import { FacilityFileHandler } from './FacilityFileHandler';
import { OrderFileHandler } from './OrderFileHandler';
import { EventTableFileHandler } from './EventTableFileHandler';

export class TemplateWatcher {
	private watchedFolders: Set<string> = new Set();
	private eventRefs: EventRef[] = [];
	private changeCallbacks: Array<() => void> = [];

	constructor(
		private app: App,
		private facilityHandler: FacilityFileHandler,
		private orderHandler: OrderFileHandler,
		private eventTableHandler: EventTableFileHandler
	) {}

	/**
	 * Start watching configured template folders
	 */
	startWatching(folders: {
		facilities?: string;
		orders?: string;
		eventTables?: string;
	}): void {
		// Clear existing watches
		this.stopWatching();

		// Add folders to watch set
		if (folders.facilities) {
			this.watchedFolders.add(folders.facilities);
		}
		if (folders.orders) {
			this.watchedFolders.add(folders.orders);
		}
		if (folders.eventTables) {
			this.watchedFolders.add(folders.eventTables);
		}

		// Register vault event listeners
		this.eventRefs.push(
			this.app.vault.on('create', (file: TAbstractFile) => {
				this.handleFileChange(file, 'create', folders);
			})
		);

		this.eventRefs.push(
			this.app.vault.on('modify', (file: TAbstractFile) => {
				this.handleFileChange(file, 'modify', folders);
			})
		);

		this.eventRefs.push(
			this.app.vault.on('delete', (file: TAbstractFile) => {
				this.handleFileChange(file, 'delete', folders);
			})
		);

		this.eventRefs.push(
			this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
				this.handleFileChange(file, 'rename', folders, oldPath);
			})
		);
	}

	/**
	 * Stop watching and unregister event listeners
	 */
	stopWatching(): void {
		// Unregister all event listeners
		for (const ref of this.eventRefs) {
			this.app.vault.offref(ref);
		}
		this.eventRefs = [];
		this.watchedFolders.clear();
	}

	/**
	 * Add a callback to be notified when templates change
	 */
	onTemplateChange(callback: () => void): void {
		this.changeCallbacks.push(callback);
	}

	/**
	 * Clear all change callbacks
	 */
	clearCallbacks(): void {
		this.changeCallbacks = [];
	}

	/**
	 * Handle file change events
	 */
	private handleFileChange(
		file: TAbstractFile,
		eventType: 'create' | 'modify' | 'delete' | 'rename',
		folders: {
			facilities?: string;
			orders?: string;
			eventTables?: string;
		},
		oldPath?: string
	): void {
		// Only process files (not folders)
		if (!(file instanceof TFile)) {
			return;
		}

		// Only process YAML files
		if (file.extension !== 'yaml') {
			return;
		}

		// Check if file is in a watched folder
		let isWatched = false;
		let handlerType: 'facility' | 'order' | 'eventTable' | null = null;

		if (folders.facilities && file.path.startsWith(folders.facilities)) {
			isWatched = true;
			handlerType = 'facility';
		} else if (folders.orders && file.path.startsWith(folders.orders)) {
			isWatched = true;
			handlerType = 'order';
		} else if (folders.eventTables && file.path.startsWith(folders.eventTables)) {
			isWatched = true;
			handlerType = 'eventTable';
		}

		// Also check old path for rename events
		if (!isWatched && oldPath) {
			if (folders.facilities && oldPath.startsWith(folders.facilities)) {
				isWatched = true;
				handlerType = 'facility';
			} else if (folders.orders && oldPath.startsWith(folders.orders)) {
				isWatched = true;
				handlerType = 'order';
			} else if (folders.eventTables && oldPath.startsWith(folders.eventTables)) {
				isWatched = true;
				handlerType = 'eventTable';
			}
		}

		if (!isWatched || !handlerType) {
			return;
		}

		// Invalidate appropriate cache
		switch (handlerType) {
			case 'facility':
				this.facilityHandler.invalidateCache();
				console.log(`[TemplateWatcher] Invalidated facility cache due to ${eventType}: ${file.path}`);
				break;
			case 'order':
				this.orderHandler.invalidateCache();
				console.log(`[TemplateWatcher] Invalidated order cache due to ${eventType}: ${file.path}`);
				break;
			case 'eventTable':
				this.eventTableHandler.invalidateCache();
				console.log(`[TemplateWatcher] Invalidated event table cache due to ${eventType}: ${file.path}`);
				break;
		}

		// Notify all registered callbacks
		for (const callback of this.changeCallbacks) {
			try {
				callback();
			} catch (error) {
				console.error('[TemplateWatcher] Error in change callback:', error);
			}
		}
	}

	/**
	 * Get list of watched folders
	 */
	getWatchedFolders(): string[] {
		return Array.from(this.watchedFolders);
	}

	/**
	 * Check if watching is active
	 */
	isWatching(): boolean {
		return this.eventRefs.length > 0;
	}
}
