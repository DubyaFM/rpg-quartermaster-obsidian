// Platform-agnostic data adapter interface
// Defines the contract for all file I/O and data operations

import {
	Shop,
	Item,
	PurchasedItem,
	ItemCost,
	RPGShopkeepSettings,
	ShopGenerationConfig,
	Faction,
	TransactionContext,
	Transaction,
	FormattedDate,
	Currency,
	Location,
	FactionEntity,
	RenownHistoryEntry,
	PartyMember,
	InventoryContainer,
	InventoryItem,
	PlayerEncumbrance,
	PartyInventoryV2,
	InventoryActivityEntry
} from '../models/types';
import { NPCProfile, NPCRole } from '../models/npc';
import { HirelingEmployment, HirelingType, PaymentSchedule } from '../models/hireling';
import { ResidentEntry, BusinessEntry, FactionPresenceEntry } from '../services/LocationService';
import { RosterEntry, PresenceEntry } from '../services/FactionService';
import { Stronghold, FacilityTemplate, CustomOrder, CustomEventTable, Hireling } from '../models/stronghold';
import type { ActivityEvent, ActivityLogQuery, ActivityLogResult } from '../models/ActivityLog';
import type { CurrencyConfig } from '../models/currency-config';

// Platform-agnostic representation of party inventory
export interface PartyInventory {
	currency: ItemCost;
	items: Array<{
		name: string;
		quantity: number;
		cost: ItemCost;
		linkedFile?: string;
	}>;
}

// Service definition (inns, temples, etc.)
export interface Service {
	name: string;
	cost: string;
	quality: string;
	description: string;
	availability?: string;
}

// Loot table definition
export interface LootTable {
	name: string;
	crTier: string;
	type: 'individual' | 'hoard';
	currency: {
		min: number;
		max: number;
		type: 'copper' | 'silver' | 'gold' | 'platinum';
	};
	items: {
		rarity: string;
		count: number;
		chance: number;
	}[];
}

export interface IDataAdapter {
	// Shop operations
	getShop(path: string): Promise<Shop>;
	saveShop(shop: Shop, path: string): Promise<void>;
	updateShop(path: string, updates: Partial<Shop>): Promise<void>;
	listShops(): Promise<string[]>;

	/**
	 * Get all shops in the campaign
	 * Required by PorterService for campaign export
	 * @returns Array of all Shop objects
	 */
	getAllShops(): Promise<Shop[]>;

	/**
	 * Get all transaction records in the campaign
	 * Required by PorterService for campaign export
	 * @returns Array of all Transaction objects
	 */
	getAllTransactions(): Promise<Transaction[]>;

	// UUID-based entity lookup
	/**
	 * Get shop by UUID.
	 * Returns null if shop not found.
	 */
	getShopById(id: string): Promise<Shop | null>;

	/**
	 * Get item by UUID.
	 * Returns null if item not found.
	 */
	getItemById(id: string): Promise<Item | null>;

	/**
	 * Get NPC by UUID.
	 * Returns null if NPC not found.
	 */
	getNPCById(npcId: string): Promise<NPCProfile | null>;

	// Party operations
	getPartyInventory(): Promise<PartyInventory>;
	updatePartyInventory(items: PurchasedItem[], costInCopper: number): Promise<void>;

	/**
	 * Add items to party inventory without gold deduction
	 * Used for rewards, loot, and other non-purchase item additions
	 */
	addItemsToPartyInventory?(items: PurchasedItem[]): Promise<void>;

	// Transaction log
	logTransaction(
		items: PurchasedItem[],
		cost: ItemCost,
		source: string,
		context?: TransactionContext
	): Promise<void>;

	// Item vault
	getAvailableItems(): Promise<Item[]>;
	indexSources(): Promise<string[]>;
	getVariantFamily(parentItem: Item): Promise<Item[]>;

	// Configuration
	getShopConfig(type: string, wealthLevel: string): Promise<ShopGenerationConfig>;
	getBaseStockConfig?(): Promise<any>;  // Optional - deprecated
	getServices(shopType: string): Promise<Service[]>;
	getFactions(): Promise<Faction[]>;
	getLootTables(): Promise<LootTable[]>;
	getCurrencyConfig(): CurrencyConfig;

	// Settings
	getSettings(): Promise<RPGShopkeepSettings>;
	saveSettings(settings: RPGShopkeepSettings): Promise<void>;

	// Party Inventory Items (for sell feature)
	getPartyInventoryItems(): Promise<any[]>;

	// Cache management
	/**
	 * Manually rebuild item cache (platform-specific implementation)
	 * @returns Number of items cached
	 */
	rebuildItemCache?(): Promise<number>;

	/**
	 * Get cache status and diagnostics (platform-specific implementation)
	 */
	getCacheInfo?(): {
		cached: boolean;
		itemCount: number;
		ageMs: number;
		diagnostics?: any; // Platform-specific type
	};

	// Custom templates (deprecated - old format)
	/**
	 * @deprecated Use getAvailableTemplates() instead
	 * Get all custom templates (old format)
	 * @returns Object with shop type -> wealth level -> template
	 */
	getAllCustomTemplates?(): Promise<any>;

	/**
	 * @deprecated Use loadTemplateByName() instead
	 * Get a specific custom template (old format)
	 * @param shopType Shop type
	 * @param wealthLevel Wealth level
	 * @returns Template data or null
	 */
	getCustomTemplate?(shopType: string, wealthLevel: string): Promise<any>;

	/**
	 * @deprecated Use saveNamedTemplate() instead
	 * Save a custom template (old format)
	 * @param shopType Shop type
	 * @param wealthLevel Wealth level
	 * @param template Template data
	 */
	saveCustomTemplate?(shopType: string, wealthLevel: string, template: any): Promise<void>;

	/**
	 * @deprecated Use deleteNamedTemplate() instead
	 * Delete a custom template (old format)
	 * @param shopType Shop type
	 * @param wealthLevel Wealth level
	 */
	deleteCustomTemplate?(shopType: string, wealthLevel: string): Promise<void>;

	/**
	 * Get base shop configuration for a given type and wealth level
	 * @param type Shop type
	 * @param wealthLevel Wealth level
	 * @returns Base shop configuration
	 */
	getBaseShopConfig?(type: string, wealthLevel: string): Promise<any>;

	// Calendar system (optional - requires plugin)
	/**
	 * Initialize calendar system
	 * Must be called after construction to load calendar definitions and state
	 * Optional - only available when plugin is initialized
	 */
	initializeCalendar?(): Promise<void>;

	/**
	 * Initialize renown configuration system
	 * Loads rank ladders from renownLadders.yaml
	 * Optional - only available when plugin is initialized
	 */
	initializeRenownConfig?(): Promise<void>;

	/**
	 * Get current calendar day counter
	 * Optional - only available when calendar system is initialized
	 */
	getCurrentDay?(): number;

	/**
	 * Get current formatted calendar date
	 * Optional - only available when calendar system is initialized
	 */
	getCurrentDate?(): FormattedDate;

	/**
	 * Advance time by specified number of days
	 * Emits TimeAdvanced event to EventBus
	 * Optional - only available when calendar system is initialized
	 */
	advanceTime?(days: number): Promise<void>;

	/**
	 * Get CalendarService for direct access to calendar operations
	 * UI components can use this for advanced calendar operations
	 * Optional - only available when calendar system is initialized
	 */
	getCalendarService?(): any;

	/**
	 * Get UpkeepManager for upkeep cost calculations
	 * This is a passive service (NOT event listener)
	 * UI calls this to calculate and apply upkeep costs
	 * Optional - only available when calendar system is initialized
	 */
	getUpkeepManager?(): any;

	/**
	 * Get EventNotifier for event/holiday notifications
	 * Can be used to set custom notification callback
	 * Optional - only available when calendar system is initialized
	 */
	getEventNotifier?(): any;

	/**
	 * Get EventBus for subscribing to custom events
	 * Advanced usage - UI can subscribe to calendar events
	 * Optional - only available when calendar system is initialized
	 */
	getEventBus?(): any;

	/**
	 * Get RenownConfigService for accessing rank ladder configurations
	 * Optional - only available when renown config system is initialized
	 */
	getRenownConfigService?(): any;

	// ===== NPC Methods (Optional - Obsidian Plugin Specific) =====

	/**
	 * Get an NPC by file path
	 */
	getNPC?(path: string): Promise<NPCProfile>;

	/**
	 * Get an NPC by wikilink reference
	 */
	getNPCByLink?(link: string): Promise<NPCProfile | null>;

	/**
	 * Save a new NPC to the vault
	 */
	saveNPC?(npc: NPCProfile): Promise<string>;

	/**
	 * Update an existing NPC file
	 */
	updateNPC?(path: string, updates: Partial<NPCProfile>): Promise<void>;

	/**
	 * List all NPC files
	 */
	listNPCs?(): Promise<string[]>;

	/**
	 * Get all NPCs with a specific role
	 */
	getNPCsByRole?(role: NPCRole): Promise<NPCProfile[]>;

	/**
	 * Find NPC file path by name
	 */
	findNPCPath?(name: string): Promise<string | null>;

	/**
	 * Get the NPC registry for advanced queries
	 */
	getNPCRegistry?(): any;

	/**
	 * Preload all NPCs into registry cache
	 */
	preloadNPCs?(): Promise<void>;

	/**
	 * Get shopkeep configuration for NPC generation
	 */
	getShopkeepConfig?(): Promise<any>;

	// ===== Hireling Methods (Optional - Obsidian Plugin Specific) =====

	/**
	 * Load all hirelings from the tracking file
	 */
	loadHirelings?(): Promise<HirelingEmployment[]>;

	/**
	 * Save all hirelings to the tracking file
	 */
	saveHirelings?(hirelings: HirelingEmployment[]): Promise<void>;

	/**
	 * Add a new hireling to the tracking file
	 */
	addHireling?(hireling: HirelingEmployment): Promise<void>;

	/**
	 * Update an existing hireling in the tracking file
	 */
	updateHireling?(hirelingId: string, updates: Partial<HirelingEmployment>): Promise<void>;

	/**
	 * Remove a hireling from the tracking file
	 */
	removeHireling?(hirelingId: string): Promise<void>;

	/**
	 * Get a specific hireling by ID
	 */
	getHireling?(hirelingId: string): Promise<HirelingEmployment | null>;

	/**
	 * Get all active hirelings
	 */
	getActiveHirelings?(): Promise<HirelingEmployment[]>;

	/**
	 * Process payment for a hireling
	 */
	processHirelingPayment?(hirelingId: string, currentDate?: string): Promise<{
		hireling: HirelingEmployment;
		amountPaid: Currency;
		loyaltyChange: number;
	}>;

	/**
	 * Get all hirelings that need payment today
	 */
	getHirelingsDuePayment?(currentDate?: string): Promise<HirelingEmployment[]>;

	/**
	 * Calculate total weekly cost for all active hirelings
	 */
	calculateHirelingsWeeklyCost?(): Promise<Currency>;

	/**
	 * Create a new hireling employment record
	 */
	createHirelingRecord?(
		npcLink: string,
		type: HirelingType,
		employer: string,
		options?: {
			wages?: Currency;
			paymentSchedule?: PaymentSchedule;
			duties?: string[];
			restrictions?: string[];
			startingLoyalty?: number;
		}
	): HirelingEmployment;

	/**
	 * Get default wages for a hireling type
	 */
	getDefaultHirelingWages?(type: HirelingType, schedule: PaymentSchedule): Currency;

	// ===== Location Methods (Optional - Obsidian Plugin Specific) =====

	/**
	 * Get a location by file path
	 */
	getLocation?(path: string): Promise<Location>;

	/**
	 * Save a new location to the vault
	 * @returns Path to created file
	 */
	saveLocation?(location: Location): Promise<string>;

	/**
	 * Update an existing location file
	 */
	updateLocation?(path: string, updates: Partial<Location>): Promise<void>;

	/**
	 * List all location files
	 */
	listLocations?(): Promise<string[]>;

	/**
	 * Find location file path by name
	 */
	findLocationPath?(name: string): Promise<string | null>;

	/**
	 * Scan vault for NPCs residing at this location
	 * (NPCs with location link matching locationName)
	 */
	scanLocationResidents?(locationName: string): Promise<ResidentEntry[]>;

	/**
	 * Scan vault for shops at this location
	 * (Shops with location field matching locationName)
	 */
	scanLocationBusinesses?(locationName: string): Promise<BusinessEntry[]>;

	/**
	 * Scan vault for factions present at this location
	 * (Factions with presence entries for this location)
	 */
	scanLocationFactions?(locationName: string): Promise<FactionPresenceEntry[]>;

	// ===== Faction Methods (Optional - Obsidian Plugin Specific) =====

	/**
	 * Get a faction by file path
	 */
	getFaction?(path: string): Promise<FactionEntity>;

	/**
	 * Save a new faction to the vault
	 * @returns Path to created file
	 */
	saveFaction?(faction: FactionEntity): Promise<string>;

	/**
	 * Update an existing faction file
	 */
	updateFaction?(path: string, updates: Partial<FactionEntity>): Promise<void>;

	/**
	 * List all faction files
	 */
	listFactionFiles?(): Promise<string[]>;

	/**
	 * Find faction file path by name
	 */
	findFactionPath?(name: string): Promise<string | null>;

	/**
	 * Scan vault for NPCs in this faction's roster
	 * (NPCs with factionRole field referencing this faction)
	 */
	scanFactionRoster?(factionName: string): Promise<RosterEntry[]>;

	/**
	 * Scan vault for locations where this faction is present
	 * (Locations with faction presence entries for this faction)
	 */
	scanFactionPresence?(factionName: string): Promise<PresenceEntry[]>;

	// ===== Renown Methods (Optional - Obsidian Plugin Specific) =====

	/**
	 * Log a renown change to the activity log
	 */
	logRenownChange?(entry: RenownHistoryEntry): Promise<void>;

	// ===== Stronghold Methods (Optional - Obsidian Plugin Specific) =====

	/**
	 * Load a stronghold by file path (Obsidian-specific)
	 */
	loadStronghold?(filePath: string): Promise<Stronghold | null>;

	/**
	 * Get a stronghold by ID (Backend-specific)
	 * @param id - Stronghold ID
	 * @returns Stronghold or null if not found
	 */
	getStronghold?(id: string): Promise<Stronghold | null>;

	/**
	 * Save a stronghold to file
	 */
	saveStronghold?(stronghold: Stronghold): Promise<void>;

	/**
	 * List all stronghold file paths (Obsidian returns paths, Backend returns Stronghold[])
	 */
	listStrongholds?(): Promise<string[] | Stronghold[]>;

	/**
	 * Delete a stronghold file
	 */
	deleteStronghold?(filePath: string): Promise<void>;

	/**
	 * Load all facility templates from config
	 */
	loadFacilityTemplates?(): Promise<FacilityTemplate[]>;

	/**
	 * Save a facility template to config
	 */
	saveFacilityTemplate?(template: FacilityTemplate): Promise<void>;

	/**
	 * Load all custom orders from config
	 */
	loadOrders?(): Promise<CustomOrder[]>;

	/**
	 * Save a custom order to config
	 */
	saveOrder?(order: CustomOrder): Promise<void>;

	/**
	 * Load all event tables from config
	 */
	loadEventTables?(): Promise<CustomEventTable[]>;

	/**
	 * Save an event table to config
	 */
	saveEventTable?(table: CustomEventTable): Promise<void>;

	/**
	 * Load all stronghold hirelings
	 */
	loadStrongholdHirelings?(): Promise<Hireling[]>;

	/**
	 * Save stronghold hirelings
	 */
	saveStrongholdHirelings?(hirelings: Hireling[]): Promise<void>;

	/**
	 * Get stronghold service instance (Obsidian-specific)
	 */
	getStrongholdService?(): any;

	/**
	 * Get facility service instance (Obsidian-specific)
	 */
	getFacilityService?(): any;

	// ===== Activity Log Methods =====

	/**
	 * Log an activity event
	 * @param event - The activity event to log
	 * @returns Promise resolving when event is persisted
	 */
	logActivity?(event: ActivityEvent): Promise<void>;

	/**
	 * Retrieve activity log events with optional filtering
	 * @param query - Query parameters for filtering and pagination
	 * @returns Promise resolving to paginated activity log results
	 */
	getActivityLog?(query: ActivityLogQuery): Promise<ActivityLogResult>;

	/**
	 * Search activity log by text query
	 * @param campaignId - Campaign ID to search within
	 * @param searchText - Text to search for in event descriptions
	 * @param limit - Maximum number of results (default: 50)
	 * @param offset - Pagination offset (default: 0)
	 * @returns Promise resolving to matching events
	 */
	searchActivityLog?(
		campaignId: string,
		searchText: string,
		limit?: number,
		offset?: number
	): Promise<ActivityLogResult>;

	/**
	 * Get activity log events within a date range
	 * @param campaignId - Campaign ID to query
	 * @param startDate - Start timestamp (Unix milliseconds)
	 * @param endDate - End timestamp (Unix milliseconds)
	 * @param limit - Maximum number of results (default: 100)
	 * @param offset - Pagination offset (default: 0)
	 * @returns Promise resolving to events in date range
	 */
	getActivityLogByDateRange?(
		campaignId: string,
		startDate: number,
		endDate: number,
		limit?: number,
		offset?: number
	): Promise<ActivityLogResult>;

	/**
	 * Update notes on an existing activity event
	 * @param eventId - UUID of the event to update
	 * @param notes - New notes text (empty string to clear notes)
	 * @param timestamp - Timestamp of the update
	 * @returns Promise resolving when notes are updated
	 */
	updateActivityNotes?(
		eventId: string,
		notes: string,
		timestamp: number
	): Promise<void>;

	// ===== Inventory Management V2 Methods (Phase 1) =====

	/**
	 * Get a container by ID
	 * @param id - Container UUID
	 * @returns Container or null if not found
	 */
	getContainer(id: string): Promise<InventoryContainer | null>;

	/**
	 * Save a new container
	 * @param container - Container to save
	 */
	saveContainer(container: InventoryContainer): Promise<void>;

	/**
	 * Update an existing container
	 * @param container - Updated container data
	 */
	updateContainer(container: InventoryContainer): Promise<void>;

	/**
	 * Delete a container
	 * @param id - Container UUID
	 */
	deleteContainer(id: string): Promise<void>;

	/**
	 * Get all containers
	 * @returns Array of all containers
	 */
	getAllContainers(): Promise<InventoryContainer[]>;

	/**
	 * Get the full party inventory V2 (containers, items, encumbrance)
	 * @returns Complete party inventory
	 */
	getPartyInventoryV2(): Promise<PartyInventoryV2>;

	/**
	 * Save the full party inventory V2
	 * @param inventory - Complete inventory to save
	 */
	savePartyInventoryV2(inventory: PartyInventoryV2): Promise<void>;

	/**
	 * Get an inventory item by ID
	 * @param id - Item UUID
	 * @returns Inventory item or null if not found
	 */
	getInventoryItem(id: string): Promise<InventoryItem | null>;

	/**
	 * Get all items in a specific container
	 * @param containerId - Container UUID
	 * @returns Array of items in the container
	 */
	getItemsInContainer(containerId: string): Promise<InventoryItem[]>;

	/**
	 * Save a new inventory item
	 * @param item - Item to save
	 */
	saveInventoryItem(item: InventoryItem): Promise<void>;

	/**
	 * Update an existing inventory item
	 * @param item - Updated item data
	 */
	updateInventoryItem(item: InventoryItem): Promise<void>;

	/**
	 * Delete an inventory item
	 * @param id - Item UUID
	 */
	deleteInventoryItem(id: string): Promise<void>;

	/**
	 * Get player encumbrance data
	 * @param playerId - Player UUID
	 * @returns Encumbrance data or null if not found
	 */
	getPlayerEncumbrance(playerId: string): Promise<PlayerEncumbrance | null>;

	/**
	 * Save player encumbrance data
	 * @param encumbrance - Encumbrance data to save
	 */
	savePlayerEncumbrance(encumbrance: PlayerEncumbrance): Promise<void>;

	/**
	 * Save an inventory activity entry
	 * @param entry - Activity entry to save
	 */
	saveInventoryActivity(entry: InventoryActivityEntry): Promise<void>;

	/**
	 * Get inventory activity log with optional filtering
	 * @param filter - Optional filters (playerId, itemId, limit, offset)
	 * @returns Array of activity entries
	 */
	getInventoryActivity(filter?: {
		playerId?: string;
		itemId?: string;
		limit?: number;
		offset?: number;
	}): Promise<InventoryActivityEntry[]>;

	/**
	 * Get all party members
	 * @returns Array of party members
	 */
	getPartyMembers(): Promise<PartyMember[]>;

	/**
	 * Save a new party member
	 * @param member - Party member to save
	 */
	savePartyMember(member: PartyMember): Promise<void>;

	/**
	 * Update an existing party member
	 * @param member - Updated party member data
	 */
	updatePartyMember(member: PartyMember): Promise<void>;

	/**
	 * Delete a party member
	 * @param id - Party member UUID
	 */
	deletePartyMember(id: string): Promise<void>;

	// ===== Lifecycle Management (Campaign Switching) =====

	/**
	 * Initialize adapter resources
	 *
	 * Called by AdapterFactory after construction to setup:
	 * - File watchers and event listeners
	 * - Cache warming
	 * - Database connections
	 * - Initial data loading
	 *
	 * OPTIONAL: Only implement if adapter needs initialization beyond constructor
	 *
	 * @returns Promise resolving when initialization complete
	 */
	initialize?(): Promise<void>;

	/**
	 * Teardown adapter resources and cleanup
	 *
	 * REQUIRED: Must be implemented by all adapters for campaign switching.
	 *
	 * Called by AdapterFactory before switching campaigns to ensure clean state.
	 * Must release all resources to prevent memory leaks and file handle exhaustion.
	 *
	 * Responsibilities:
	 * - Close file handles and database connections
	 * - Clear caches and in-memory state
	 * - Remove event listeners and file watchers
	 * - Abort in-flight async operations (use AbortController)
	 * - Flush pending writes to disk/database
	 *
	 * Example (Obsidian):
	 * ```typescript
	 * async teardown(): Promise<void> {
	 *   // Stop file watcher
	 *   this.fileWatcher?.close();
	 *
	 *   // Clear caches
	 *   this.itemCache.clear();
	 *
	 *   // Remove event listeners
	 *   this.app.vault.off('modify', this.onFileModified);
	 * }
	 * ```
	 *
	 * Example (Backend):
	 * ```typescript
	 * async teardown(): Promise<void> {
	 *   // Abort pending requests
	 *   this.abortController.abort();
	 *
	 *   // Close database connection
	 *   await this.db.destroy();
	 * }
	 * ```
	 *
	 * @returns Promise resolving when teardown complete
	 * @throws Error if teardown fails (adapter may be in invalid state)
	 */
	teardown(): Promise<void>;
}

// Re-export inventory V2 types for backend adapters
export type {
	PartyInventoryV2,
	InventoryContainer,
	InventoryItem,
	PlayerEncumbrance,
	InventoryActivityEntry
};
