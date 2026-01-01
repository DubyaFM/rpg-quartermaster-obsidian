/**
 * Campaign-scoped configuration context
 * Provides business-level campaign settings to core services
 *
 * Platform-agnostic - contains NO file paths or storage implementation details
 *
 * This interface allows core services to access campaign-specific configuration
 * without knowing the underlying storage mechanism (Obsidian data.json, SQLite, etc.)
 */
export interface ICampaignContext {
	// ==================== IDENTITY ====================

	/**
	 * Get the unique identifier for this campaign
	 * Format: "campaign-{uuid-v4}"
	 * @returns Campaign ID (immutable, set at creation)
	 */
	getCampaignId(): string;

	/**
	 * Get the human-readable name of this campaign
	 * @returns Campaign name (e.g., "Curse of Strahd - Group A")
	 */
	getCampaignName(): string;

	/**
	 * Get the world/setting ID this campaign belongs to
	 * Used for World View aggregation and library linkage
	 * @returns World ID (e.g., "world-forgotten-realms", "world-eberron")
	 */
	getWorldId(): string;

	// ==================== LIBRARY MANAGEMENT ====================

	/**
	 * Get list of library UUIDs currently enabled for this campaign
	 * Libraries are searched when generating shops, loot, etc.
	 * @returns Array of library IDs (e.g., ["library-srd", "library-homebrew-magic-items"])
	 */
	getActiveLibraryIds(): string[];

	/**
	 * Check if a specific library is enabled for this campaign
	 * @param libraryId - Library UUID to check
	 * @returns True if library is in active search scope
	 */
	isLibraryEnabled(libraryId: string): boolean;

	// ==================== ECONOMIC CONFIGURATION (FUTURE) ====================

	/**
	 * Get inflation/deflation modifier for this campaign
	 * Used to adjust prices from base templates
	 * @returns Multiplier (1.0 = no change, 1.2 = 20% inflation, 0.8 = 20% deflation)
	 * @optional Phase 2+ feature
	 */
	getInflationModifier?(): number;

	/**
	 * Get the currency system ID for this campaign
	 * Determines which denominations are valid (cp/sp/gp/pp vs. credits, etc.)
	 * @returns Currency system identifier (e.g., "dnd5e-standard", "star-wars-credits")
	 * @optional Phase 2+ feature
	 */
	getCurrencySystemId?(): string;

	// ==================== CALENDAR CONFIGURATION (FUTURE) ====================

	/**
	 * Get the calendar system ID for this campaign
	 * Determines date format and progression rules
	 * @returns Calendar system identifier (e.g., "gregorian", "faerun-harptos")
	 * @optional Phase 2+ feature
	 */
	getCalendarSystemId?(): string;

	/**
	 * Get the current in-game date for this campaign
	 * @returns ISO date string or campaign-specific format
	 * @optional Phase 2+ feature
	 */
	getCurrentGameDate?(): string;

	// ==================== FEATURE FLAGS (FUTURE) ====================

	/**
	 * Check if a specific feature is enabled for this campaign
	 * Used for opt-in experimental features or campaign-specific rules
	 * @param feature - Feature identifier (e.g., "homebrew-crafting", "variant-encumbrance")
	 * @returns True if feature is enabled
	 * @optional Phase 3+ feature
	 */
	isFeatureEnabled?(feature: string): boolean;
}
