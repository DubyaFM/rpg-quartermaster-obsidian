/**
 * Adapter Factory - Campaign-scoped adapter lifecycle management
 *
 * Defines the contract for creating and disposing campaign-specific adapters.
 * Platform implementations (Obsidian, Backend, Mobile) provide concrete factories.
 */

import { IDataAdapter } from './IDataAdapter';
import { IConfigAdapter } from './IConfigAdapter';
import { ISettingsAdapter } from './ISettingsAdapter';
import { ICampaignContext } from './ICampaignContext';
import { IWorldStateAdapter } from './IWorldStateAdapter';
import { IEventDefinitionAdapter } from './IEventDefinitionAdapter';

/**
 * Abstract factory for creating campaign-scoped adapters
 *
 * Platform implementations must provide concrete factory classes
 * that implement this interface to enable campaign switching.
 *
 * Lifecycle:
 * 1. User selects campaign -> createAdapters(campaignId)
 * 2. User works with campaign -> adapters handle I/O
 * 3. User switches campaigns -> disposeAdapters(bundle) -> createAdapters(newCampaignId)
 */
export interface IAdapterFactory {
	/**
	 * Create a full set of adapters for the given campaign
	 *
	 * This method:
	 * - Loads campaign configuration from storage
	 * - Instantiates all required adapters with campaign context
	 * - Initializes caches, event listeners, etc.
	 *
	 * @param campaignId - Campaign to initialize adapters for (format: "campaign-{uuid}")
	 * @returns Adapter bundle ready for use
	 * @throws Error if campaign not found or initialization fails
	 */
	createAdapters(campaignId: string): Promise<AdapterBundle>;

	/**
	 * Dispose of adapters and release resources
	 *
	 * Called before switching campaigns to ensure clean teardown.
	 * Must close file handles, database connections, clear caches, etc.
	 *
	 * @param bundle - Adapter bundle to dispose (returned by createAdapters)
	 */
	disposeAdapters(bundle: AdapterBundle): Promise<void>;

	/**
	 * Get list of available campaigns for switching
	 *
	 * Used to populate campaign selector UI
	 *
	 * @returns Array of campaign metadata (id, name, worldId, etc.)
	 */
	listCampaigns(): Promise<CampaignMetadata[]>;

	/**
	 * Get the currently active campaign ID
	 *
	 * @returns ID of active campaign, or null if none selected
	 */
	getActiveCampaignId(): Promise<string | null>;

	/**
	 * Get world state adapter for the active campaign
	 *
	 * Used by CalendarService and WorldEventService to load/save world state.
	 *
	 * @returns World state adapter for active campaign
	 * @throws Error if no active campaign or adapters not initialized
	 */
	getWorldStateAdapter(): IWorldStateAdapter;

	/**
	 * Get event definition adapter for the active campaign
	 *
	 * Used by WorldEventService to load event definitions.
	 *
	 * @returns Event definition adapter for active campaign
	 * @throws Error if no active campaign or adapters not initialized
	 */
	getEventDefinitionAdapter(): IEventDefinitionAdapter;
}

/**
 * Bundle of all adapters needed for a campaign session
 *
 * Returned by createAdapters() to ensure consistent initialization.
 * All core adapters are required. Platform-specific adapters are optional.
 */
export interface AdapterBundle {
	// ==================== CORE ADAPTERS (Required) ====================

	/**
	 * Data adapter for shop/party/transaction operations
	 * Campaign-scoped: all operations apply to this campaign only
	 */
	dataAdapter: IDataAdapter;

	/**
	 * Config adapter for YAML/JSON configuration loading
	 * Campaign-scoped: loads configs from campaign-specific paths (Obsidian) or tables (Backend)
	 */
	configAdapter: IConfigAdapter;

	/**
	 * Settings adapter for plugin/app settings persistence
	 * May be campaign-scoped (Phase 2+) or global (Phase 1)
	 */
	settingsAdapter: ISettingsAdapter;

	/**
	 * Campaign context for business logic configuration
	 * Provides campaign ID, active libraries, world ID, etc.
	 */
	campaignContext: ICampaignContext;

	/**
	 * World state adapter for calendar and event system state persistence
	 * Campaign-scoped: manages world state (time, active events, chain states) for this campaign
	 */
	worldStateAdapter: IWorldStateAdapter;

	/**
	 * Event definition adapter for loading event definitions
	 * Campaign-scoped: loads event definitions from platform-specific storage (YAML files, database)
	 */
	eventDefinitionAdapter: IEventDefinitionAdapter;

	// ==================== PLATFORM-SPECIFIC ADAPTERS (Optional) ====================

	/**
	 * Path resolver for Obsidian vault file operations
	 * OBSIDIAN ONLY: Maps functional keys to file paths
	 * @optional Only present in ObsidianAdapterBundle
	 */
	pathResolver?: any; // IPathResolver (defined in obsidian-plugin package)

	/**
	 * Database connection for backend SQLite operations
	 * BACKEND ONLY: Knex instance for this campaign's database
	 * @optional Only present in BackendAdapterBundle
	 */
	dbConnection?: any; // Knex instance (defined in backend package)
}

/**
 * Campaign metadata for listing/selection
 *
 * Lightweight representation used in UI campaign selectors
 */
export interface CampaignMetadata {
	/**
	 * Unique campaign identifier
	 * Format: "campaign-{uuid-v4}"
	 */
	id: string;

	/**
	 * Human-readable campaign name
	 * Example: "Curse of Strahd - Group A"
	 */
	name: string;

	/**
	 * World/setting this campaign belongs to
	 * Used for World View aggregation
	 * Format: "world-{slug}" (e.g., "world-forgotten-realms")
	 */
	worldId: string;

	/**
	 * Campaign creation timestamp (Unix milliseconds)
	 */
	createdAt: number;

	/**
	 * Last access timestamp (Unix milliseconds)
	 * Used for sorting "recently used" campaigns
	 * @optional May be undefined for newly created campaigns
	 */
	lastAccessedAt?: number;

	/**
	 * Whether this campaign is currently active
	 * Only one campaign should be active at a time per user session
	 */
	isActive: boolean;

	/**
	 * Optional campaign description
	 * User-provided summary of the campaign
	 */
	description?: string;
}
