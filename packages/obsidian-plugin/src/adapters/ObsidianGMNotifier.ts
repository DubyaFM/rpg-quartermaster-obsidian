/**
 * Obsidian GM Notifier
 *
 * Implements IGMNotifier interface for Obsidian
 * Phase 1: Integrates with daily summary modal
 *
 * @module ObsidianGMNotifier
 * @packageDocumentation
 */

import { App, TFile } from 'obsidian';
import { IGMNotifier } from '@quartermaster/core/interfaces/IGMNotifier';

/**
 * Pending notification for daily summary modal
 */
export interface PendingNotification {
	/** Notification message */
	message: string;

	/** Optional title */
	title?: string;

	/** When notification was created (timestamp) */
	timestamp: number;

	/** Job file path (if job-related) */
	jobPath?: string;
}

/**
 * Obsidian GM Notifier
 *
 * Implements IGMNotifier for Obsidian platform
 * Phase 1: Stores notifications for daily summary modal integration
 */
export class ObsidianGMNotifier implements IGMNotifier {
	private pendingNotifications: PendingNotification[] = [];

	constructor(
		private app: App,
		private notificationLogPath: string
	) {}

	/**
	 * Show notification to GM
	 *
	 * Phase 1: Stores notification for daily summary modal
	 * (Daily summary modal will retrieve and display pending notifications)
	 *
	 * @param message Notification message
	 * @param title Optional notification title
	 */
	notifyGM(message: string, title?: string): void {
		// Store notification for daily summary modal
		this.pendingNotifications.push({
			message,
			title,
			timestamp: Date.now()
		});
	}

	/**
	 * Log notification to persistent storage
	 *
	 * Used for recording job events that occur during time advancement
	 * (e.g., job expirations, deadline warnings)
	 *
	 * Logs are appended to a markdown file in format:
	 * ```
	 * ## YYYY-MM-DD HH:MM:SS
	 * - [Job Path](jobPath) - Message
	 * ```
	 *
	 * @param message Message to log
	 * @param jobPath Job file path (identifier)
	 */
	async logNotification(message: string, jobPath: string): Promise<void> {
		try {
			// Format log entry
			const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
			const entry = `## ${timestamp}\n- [${jobPath}](${jobPath}) - ${message}\n\n`;

			// Get or create log file
			let logFile = this.app.vault.getAbstractFileByPath(this.notificationLogPath);

			if (!logFile || !(logFile instanceof TFile)) {
				// Create log file with header
				await this.ensureLogFileFolder();
				const header = `# Job Board Notifications\n\nAuto-generated log of job board events.\n\n`;
				await this.app.vault.create(this.notificationLogPath, header + entry);
			} else {
				// Append to existing log file
				const content = await this.app.vault.read(logFile);
				await this.app.vault.modify(logFile, content + entry);
			}
		} catch (error) {
			console.error('[ObsidianGMNotifier] Error logging notification:', error);
			// Don't throw - logging failures should not break the system
		}
	}

	/**
	 * Get pending notifications
	 *
	 * Used by daily summary modal to retrieve notifications
	 *
	 * @returns Array of pending notifications
	 */
	getPendingNotifications(): PendingNotification[] {
		return [...this.pendingNotifications];
	}

	/**
	 * Clear pending notifications
	 *
	 * Called by daily summary modal after displaying notifications
	 */
	clearPendingNotifications(): void {
		this.pendingNotifications = [];
	}

	/**
	 * Get pending notifications count
	 *
	 * Useful for UI indicators
	 *
	 * @returns Number of pending notifications
	 */
	getPendingCount(): number {
		return this.pendingNotifications.length;
	}

	/**
	 * Ensure notification log file's parent folder exists
	 */
	private async ensureLogFileFolder(): Promise<void> {
		const folderPath = this.notificationLogPath.substring(
			0,
			this.notificationLogPath.lastIndexOf('/')
		);

		if (folderPath === '') {
			// Log file is in root, no folder to create
			return;
		}

		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}
	}
}
