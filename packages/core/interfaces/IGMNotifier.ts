/**
 * GM notification interface
 *
 * Abstracts notification system for job board events
 * Implemented by adapter layer (ObsidianGMNotifier)
 *
 * @module IGMNotifier
 * @packageDocumentation
 */

/**
 * Interface for GM notification system
 *
 * Provides methods for notifying the GM about job events
 * (expirations, deadlines, etc.)
 *
 * Phase 1: Notifications integrated with daily summary modal
 * (being implemented separately)
 *
 * Implementation: ObsidianGMNotifier (adapter layer)
 */
export interface IGMNotifier {
	/**
	 * Show notification to GM
	 *
	 * Phase 1: Should integrate with daily summary modal
	 * (not ephemeral Obsidian Notice per user decision)
	 *
	 * @param message Notification message
	 * @param title Optional notification title
	 * @returns void
	 */
	notifyGM(message: string, title?: string): void;

	/**
	 * Log notification to persistent storage
	 *
	 * Used for recording job events that occur during time advancement
	 * (e.g., job expirations, deadline warnings)
	 *
	 * @param message Message to log
	 * @param jobPath Job file path (identifier)
	 * @returns void
	 */
	logNotification(message: string, jobPath: string): Promise<void>;
}
