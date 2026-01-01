/**
 * Path Resolver Interface - Obsidian-specific path mapping
 *
 * PLATFORM-SPECIFIC: Only used by ObsidianDataAdapter
 *
 * Maps functional keys (shops, party, transactions, etc.) to vault file/folder paths.
 * Enables campaign-specific directory structures without hardcoding paths.
 */

/**
 * Functional path keys for campaign data
 *
 * Each key represents a logical data category that maps to a vault location.
 * Campaigns can have different path mappings for the same keys.
 */
export type CampaignPathKey =
	| 'shops'           // Shop markdown files
	| 'party'           // Party inventory file
	| 'transactions'    // Transaction log file/folder
	| 'npcs'            // NPC markdown files
	| 'locations'       // Location markdown files
	| 'factions'        // Faction markdown files
	| 'jobs'            // Job board markdown files
	| 'projects'        // Project markdown files
	| 'activity-log'    // Activity log file
	| 'calendar'        // Calendar/date tracking file
	| 'items'           // Custom item vault
	| 'libraries';      // Library storage location

/**
 * Path resolution service for Obsidian vault operations
 *
 * Responsibilities:
 * - Translate functional keys to absolute vault paths
 * - Auto-create missing directories (Lazy Creation policy)
 * - Provide consistent path handling across adapters
 *
 * Does NOT:
 * - Validate path conflicts (done at UI layer during setup)
 * - Perform file I/O (delegates to Obsidian Vault API)
 * - Store campaign metadata (delegates to ICampaignContext)
 */
export interface IPathResolver {
	/**
	 * Returns the absolute vault path for a functional area
	 *
	 * Example: resolveRoot('shops') -> "Campaigns/CurseOfStrahd/Merchants/"
	 *
	 * IMPORTANT: Auto-creates directory if missing (Lazy Creation policy).
	 * GMs should never be blocked by missing folders.
	 *
	 * @param key - Functional path key to resolve
	 * @returns Absolute vault path with trailing slash
	 * @throws Error if key not configured in campaign profile
	 */
	resolveRoot(key: CampaignPathKey): Promise<string>;

	/**
	 * Resolves a full file path for a specific entity
	 *
	 * Example: resolveEntityPath('shops', 'blacksmith.md') ->
	 *          "Campaigns/CurseOfStrahd/Merchants/blacksmith.md"
	 *
	 * Auto-creates parent directory if missing (Lazy Creation).
	 *
	 * @param key - Functional path key (determines parent directory)
	 * @param filename - Entity filename (e.g., "blacksmith.md", "party-inventory.md")
	 * @returns Absolute vault path to the specific file
	 * @throws Error if key not configured in campaign profile
	 */
	resolveEntityPath(key: CampaignPathKey, filename: string): Promise<string>;

	/**
	 * Get raw path mapping for advanced use cases
	 *
	 * Returns the configured path without auto-creation or validation.
	 * Useful for checking configuration before attempting operations.
	 *
	 * @param key - Functional path key to query
	 * @returns Raw path string, or undefined if key not configured
	 */
	getRawPath(key: CampaignPathKey): string | undefined;

	/**
	 * Check if a functional key is configured
	 *
	 * @param key - Functional path key to check
	 * @returns True if path mapping exists for this key
	 */
	hasPath(key: CampaignPathKey): boolean;
}

/**
 * Campaign path mappings structure
 *
 * Stored in campaign profile (data.json).
 * Maps functional keys to vault paths.
 */
export interface CampaignPathMappings {
	shops: string;
	party: string;
	transactions: string;
	npcs?: string;          // Optional: defaults to root if not specified
	locations?: string;     // Optional
	factions?: string;      // Optional
	jobs?: string;          // Optional
	projects?: string;      // Optional
	'activity-log'?: string;// Optional
	calendar?: string;      // Optional
	items?: string;         // Optional: custom item vault
	libraries?: string;     // Optional: library storage
}
