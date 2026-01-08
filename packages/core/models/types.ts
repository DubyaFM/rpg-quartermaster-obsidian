// Type definitions for Quartermaster - Platform-agnostic core types
// These types should not import from Obsidian or any other platform

export interface PartyMember {
	// Identity
	id: string;  // Unique identifier (UUID)
	name: string;
	linkedFile?: string;

	// Character progression
	level?: number;  // Character level (1-20)
	xp?: number;  // Experience points

	// Ability scores (for encumbrance calculation)
	strength?: number;  // STR score (1-30)
	dexterity?: number;  // DEX score
	constitution?: number;  // CON score
	intelligence?: number;  // INT score
	wisdom?: number;  // WIS score
	charisma?: number;  // CHA score

	// Physical attributes
	size?: CreatureSize;  // Size (affects carrying capacity)
	speed?: number;  // Base walking speed (feet)
	maxHp?: number;  // Maximum hit points
	passivePerception?: number;  // Passive Perception (GM reference)

	// Modifiers
	bonuses?: CharacterBonus[];  // Modifiers from items/feats/spells

	// Data source tracking
	dataSource?: {
		type: 'manual' | 'obsidian_frontmatter' | 'api';
		linkedFile?: string;  // Path to character sheet
		apiEndpoint?: string;  // For future D&D Beyond integration
	};
}

export type CreatureSize = 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';

export interface CharacterBonus {
	id: string;
	source: string;  // "Belt of Giant Strength", "Longstrider spell"
	type: 'ability_score' | 'speed' | 'carrying_capacity';
	target: string;  // "strength", "speed", "carrying_capacity"
	value: number;  // +2, +10, etc.
	duration?: 'permanent' | 'temporary';
}

/**
 * Currency type - Dynamic denomination support
 *
 * Previously hardcoded to D&D 5e (cp, sp, gp, pp), now supports any currency system.
 * Keys are denomination abbreviations from the active CurrencyConfig (e.g., "gp", "cr").
 *
 * **IMPORTANT**: Always validate using CurrencyManager.validate() before operations.
 * The index signature allows any string key, but only keys defined in the active
 * currency system configuration are valid. Invalid keys will be stripped by validation.
 *
 * @example D&D 5e: { cp: 10, sp: 5, gp: 100, pp: 2 }
 * @example Star Wars: { cr: 500 }
 * @example Custom: { bar: 10, coin: 50 }
 */
export interface Currency {
	[key: string]: number;
}

/**
 * Item Cost type - Dynamic denomination support
 *
 * Represents the cost of an item in the active currency system.
 * Uses the same dynamic key structure as Currency.
 *
 * **IMPORTANT**: Always use CurrencyManager.createZeroedCost() to initialize,
 * and CurrencyManager.validate() to clean user input or loaded data.
 *
 * @see Currency for usage examples and validation requirements
 */
export interface ItemCost {
	[key: string]: number;
}

/**
 * Type guard to check if an object is a valid ItemCost structure
 * Note: This only validates the shape, not denomination keys.
 * Use CurrencyManager.validate() for full validation against active config.
 */
export function isItemCost(obj: unknown): obj is ItemCost {
	if (!obj || typeof obj !== 'object') return false;
	return Object.values(obj).every(v => typeof v === 'number');
}

/**
 * Type guard to check if an object is a valid Currency structure
 * Note: This only validates the shape, not denomination keys.
 * Use CurrencyManager.validate() for full validation against active config.
 */
export function isCurrency(obj: unknown): obj is Currency {
	if (!obj || typeof obj !== 'object') return false;
	return Object.values(obj).every(v => typeof v === 'number');
}

export interface ItemFolderConfig {
	path: string;
	excludeSubfolders: boolean;
}

export interface RPGShopkeepSettings {
	partyInventoryFile: string;
	transactionLogFile: string;
	itemsFolders: ItemFolderConfig[];
	shopsFolder: string;
	// UUID System Settings
	storeCrossPlatformIds: boolean;  // Store UUIDs in files for cross-platform sync
	strongholdsFolder: string;  // Folder for stronghold files
	strongholdStashesFolder: string;  // Folder for stronghold stash files
	// Stronghold Feature Settings
	enableStrongholdFeatures: boolean;  // Enable stronghold management features
	facilitiesConfigFolder: string;  // Folder for facility config files
	ordersConfigFolder: string;  // Folder for order config files
	eventTablesFolder: string;  // Folder for event table config files
	partyMembers: PartyMember[];  // DEPRECATED: Will be removed after migration to file-based storage
	partyMemberFolder: string;  // Folder where party member files are stored
	partyMembersMigrated: boolean;  // Track if migration from settings to files is complete
	enablePlayerTracking: boolean;
	availableSources: string[];
	enabledSources: string[];
	defaultCurrency: string;
	autoSaveShops: boolean;
	useSRDDatabase: boolean;
	// Party Settings
	partyFunds?: Currency;
	// Magic Item Settings
	magicItemMarkupPercent: number;
	partyLevel: number;
	magicItemRarityModifiers: {
		poor: number;
		modest: number;
		comfortable: number;
		wealthy: number;
		aristocratic: number;
	};
	// Custom Config Settings (Phase 2)
	customConfigFolderPath: string;  // Empty string = use plugin defaults
	useCustomShopConfig: boolean;
	useCustomServicesConfig: boolean;
	useCustomShopkeepConfig: boolean;
	useCustomFactionsConfig: boolean;
	useCustomLootTablesConfig: boolean;
	// Named Template Settings (per shop type)
	shopTemplatePreferences: {
		[shopType: string]: string;  // template name or "default"
	};
	// Calendar Settings (Phase 3+)
	calendarState?: CalendarState;  // Current day counter and active calendar
	upkeepConfig?: UpkeepConfig;  // Party upkeep settings
	shopRestockConfig?: ShopRestockConfig;  // Auto-restock settings
	showCalendarInUI?: boolean;  // Show calendar widget in modals
	dateFormat?: 'full' | 'compact' | 'both';  // How to display dates
	// NPC Settings
	npcsFolder: string;  // Folder for NPC files
	hirelingsFolder: string;  // Folder for hireling tracking files
	partyMembersFolder: string;  // Folder for party member files
	createNPCLinks: boolean;  // Auto-create NPC files when generating shops
	trackHirelingLoyalty: boolean;  // Enable loyalty/morale mechanics for hirelings
	autoPayHirelings: boolean;  // Auto-deduct hireling wages from party funds
	// Factions & Locations
	locationsFolder: string;  // Folder for location files
	factionsFolder: string;  // Folder for faction files
	// Job Board Settings (Phase 1)
	jobsFolder: string;  // Folder for job/quest files
	jobNotificationLogPath: string;  // Path to job notifications log file
	autoExpireJobs: boolean;  // Auto-expire Posted jobs when availability duration passes
	notifyOnJobDeadlines: boolean;  // Show GM notifications for job deadline warnings
	notifyOnJobExpirations: boolean;  // Show GM notifications for auto-expirations
	// Player View Settings
	playerViewShowReputationImpacts: boolean;  // Show reputation impacts in player view
	playerViewShowPrerequisites: boolean;  // Show prerequisites in player view
	playerViewShowExactTimeRemaining: boolean;  // Show exact time remaining vs generic urgency
	// Project Settings
	projectTemplatesPath?: string;  // Where template YAML files are stored
	projectInstancesPath?: string;  // Where instance markdown files are stored
	projectProgressionSummary?: boolean;  // Show progression summary modal after time advancement (default: true)
	activityLogPath: string; // Path to activity log markdown file
	// Inventory Management Settings
	partyInventoryPath?: string;  // Path to Party Inventory.md file (default: 'Party Inventory.md')
	enableEncumbranceTracking?: boolean;  // Track carrying capacity and speed penalties (default: false)
	trackManualInventoryEdits?: boolean;  // Log manual markdown edits to activity log (default: true)
}

export const DEFAULT_SETTINGS: RPGShopkeepSettings = {
	partyInventoryFile: 'Party-Inventory.md',
	transactionLogFile: 'Transaction-Log.md',
	itemsFolders: [],
	shopsFolder: 'Shops',
	// UUID System Settings
	storeCrossPlatformIds: false,
	strongholdsFolder: 'Strongholds',
	strongholdStashesFolder: 'Stronghold-Stashes',
	// Stronghold Feature Settings
	enableStrongholdFeatures: false,
	facilitiesConfigFolder: 'config/facilities',
	ordersConfigFolder: 'config/orders',
	eventTablesFolder: 'config/events',
	partyMembers: [],  // DEPRECATED: Will be cleared after migration
	partyMemberFolder: 'party-members',
	partyMembersMigrated: false,
	enablePlayerTracking: false,
	availableSources: [],
	enabledSources: [],
	defaultCurrency: 'gp',
	autoSaveShops: false,
	useSRDDatabase: true,
	partyFunds: { cp: 0, sp: 0, gp: 0, pp: 0 },
	magicItemMarkupPercent: 50,
	partyLevel: 5,
	magicItemRarityModifiers: {
		poor: 0.1,
		modest: 0.3,
		comfortable: 0.6,
		wealthy: 0.8,
		aristocratic: 1.0
	},
	// Custom Config Settings (Phase 2)
	customConfigFolderPath: '',  // Empty = use plugin defaults
	useCustomShopConfig: false,
	useCustomServicesConfig: false,
	useCustomShopkeepConfig: false,
	useCustomFactionsConfig: false,
	useCustomLootTablesConfig: false,
	// Named Template Settings (per shop type)
	shopTemplatePreferences: {
		blacksmith: 'default',
		alchemist: 'default',
		magic: 'default',
		general: 'default',
		tavern: 'default',
		marketplace: 'default',
		inn: 'default',
		temple: 'default',
		travel: 'default'
	},
	// NPC Settings
	npcsFolder: 'NPCs',
	hirelingsFolder: 'Hirelings',
	partyMembersFolder: 'Party Members',
	createNPCLinks: true,
	trackHirelingLoyalty: true,
	autoPayHirelings: false,
	// Factions & Locations
	locationsFolder: 'Locations',
	factionsFolder: 'Factions',
	// Job Board Settings (Phase 1)
	jobsFolder: 'Jobs',
	jobNotificationLogPath: 'Job-Board-Notifications.md',
	autoExpireJobs: true,
	notifyOnJobDeadlines: true,
	notifyOnJobExpirations: true,
	// Player View Settings
	playerViewShowReputationImpacts: true,
	playerViewShowPrerequisites: true,
	playerViewShowExactTimeRemaining: true,
	// Project Settings
	projectTemplatesPath: 'config/projectTemplates',
	projectInstancesPath: 'Projects',
	projectProgressionSummary: true,
	activityLogPath: 'activity-log.md',
	// Inventory Management Settings
	partyInventoryPath: 'Party Inventory.md',
	enableEncumbranceTracking: false,
	trackManualInventoryEdits: true
};

// Platform-agnostic file reference
export interface FileReference {
	path: string;
	name: string;
	[key: string]: any;  // Allow platform-specific properties
}

export interface Item {
	id?: string;  // UUID for cross-platform tracking
	name: string;
	cost: ItemCost;
	type: string;
	rarity: string;
	description: string;
	source: string | string[];
	file: FileReference;
	category: string;
	weight?: number;  // Weight in pounds (lb)
	// Variant-related fields
	isVariant?: boolean;  // True if this is a generic variant item (e.g., "Armor of Cold Resistance")
	variantAliases?: string[];  // All possible variants from frontmatter aliases
	baseItemName?: string;  // The base non-magical item name (e.g., "Chain Mail" for "Chain Mail of Cold Resistance")
	isConsumable?: boolean;  // True for consumable items (potions, scrolls) - affects magic item pricing
}

export interface ShopItem extends Item {
	originalCost: ItemCost;
	costOverride?: ItemCost;
	stock: number;
	// Variant dropdown support
	availableVariants?: Item[];  // Pre-resolved variants with calculated costs
	selectedVariantIndex?: number;  // Index of currently selected variant (defaults to 0)
}

export interface PurchasedItem extends Item {
	quantity: number;
	totalCost: ItemCost;
	purchasedBy?: string;
	isSale?: boolean;  // true if this is a sale (player selling to shop), false/undefined for purchase
}

export interface Shopkeep {
	name: string;
	species: string;
	gender: string;
	disposition: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful';
	quirk: string;
	bargainDC: number;
}

export interface ServiceItem {
	name: string;
	cost: string;
	quality: string;
	description: string;
	availability?: string;
}

export interface Order {
	item: Item;
	itemName: string;
	shopName: string;
	shopkeeper?: string;
	price: ItemCost;
	orderDate: string;  // ISO date string
	completionDate: string;  // ISO date string
	craftingDays: number;
	status: 'pending' | 'completed' | 'cancelled';
}

export interface Shop {
	id?: string;  // UUID for cross-platform tracking
	name: string;
	type: string;
	wealthLevel: 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic';
	shopkeepNpcId?: string;  // UUID reference to NPC shopkeeper
	baseStock: ShopItem[];  // Guaranteed items from baseStockConfig (SRD-only)
	specialStock: ShopItem[];  // Randomly generated items from shopConfig (vault + SRD)
	inventory?: ShopItem[];  // @deprecated - Legacy field for backward compatibility
	services?: ServiceItem[];  // For service providers (inns, temples, travel)
	location?: string;
	faction?: string;
	lastRestocked?: string;  // ISO date string (backward compatibility)
	lastRestockedDay?: number;  // Calendar day counter when shop was last restocked
	orders?: Order[];  // Active orders placed with this shop
	fundsOnHand?: ItemCost;  // Shop's available funds for buying from players (updated by transactions)
	templateUsed?: string;  // Name of template used to generate this shop (for persistence)

	// NPC Shopkeep (new system)
	shopkeepNPC?: string;  // Wikilink to NPC file (e.g., "[[Aldric Ironforge]]")
	shopkeepData?: any;  // Cached NPCProfile, loaded at runtime, NOT saved to file

	// Legacy shopkeep fields (for backward compatibility during migration)
	shopkeep?: Shopkeep;  // @deprecated - Use shopkeepNPC instead
	npcLink?: string;  // @deprecated - Use shopkeepNPC instead
}

export interface FundsOnHandDice {
	count: number;      // Number of dice to roll
	sides: number;      // Die type (4, 6, 8, 10, 12, 20, 100)
	bonus: number;      // Flat bonus to add
	currency: 'cp' | 'sp' | 'gp' | 'pp';  // Currency type
}

export interface SpecificItem {
	itemName: string;
	spawnChance: number;  // 0-100
	stockRange: { min: number; max: number };
}

export interface ShopGenerationConfig {
	type: string;
	wealthLevel: 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic';

	// Legacy structure (for backward compatibility)
	maxItems?: {
		common: number;
		uncommon: number;
		rare: number;
		veryRare: number;
		legendary: number;
	};
	rarityChances?: {
		common: number;
		uncommon: number;
		rare: number;
		veryRare: number;
		legendary: number;
	};
	itemTypeChances?: Record<string, Record<string, number>>;  // Legacy type chances

	// New structure (Phase 5)
	basicItemTypes?: Record<string, number>;  // { weapon: 100, armor: 100, tool: 30 }

	// Magic items
	magicItemCountWeights?: {
		[count: string]: number;  // { "0": 70, "1": 20, "2": 10 }
	};

	defaultMagicItemModifier?: number;  // 0.0 to 1.0

	overrideMagicItemChances?: {
		common?: number;
		uncommon?: number;
		rare?: number;
		veryRare?: number;
		legendary?: number;
	};

	fundsOnHandDice?: FundsOnHandDice;  // Configuration for rolling shop's starting funds
	specificItems?: SpecificItem[];  // Guaranteed items with spawn chances
	totalItemRange?: { min: number; max: number };  // Override total item count

	// Template customization fields (optional)
	templateName?: string;  // Name of custom template (if any)
	isCustomTemplate?: boolean;  // Flag indicating this uses a custom template
}

export interface Faction {
	name: string;
	description: string;
	alignment: string;
}

export interface FactionReputation {
	factionName: string;
	reputationLevel: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'allied';
}

// ============================================================================
// Renown System Types
// ============================================================================

/**
 * Renown rank definition - threshold, title, and optional perk
 */
export interface RenownRank {
	threshold: number;  // Score needed to reach this rank
	title: string;  // e.g., "Agent", "Hero of the City", "Enemy"
	perk?: string;  // Optional perk description (structured perks deferred)
}

/**
 * Renown Component - can be attached to Locations, Factions, or NPCs
 * Stored in entity frontmatter when enabled
 */
export interface RenownComponent {
	// Opt-in tracking
	enabled: boolean;

	// Party score (default tracking)
	partyScore: number;  // Can be negative

	// Individual overrides
	individualScores?: {
		[playerName: string]: number;
	};

	// Rank ladder (entity-specific)
	rankLadder: RenownRank[];

	// Metadata
	lastUpdated?: string;  // ISO 8601 timestamp
	notes?: string;  // GM notes about reputation
}

// ============================================================================
// Location Entity
// ============================================================================

/**
 * Location entity - represents places in the campaign world
 * Relationships (residents, businesses, jobs, factions) are dynamic tables in file body
 */
export interface Location {
	// Identity
	locationId: string;  // UUID for cross-platform sync
	name: string;

	// Hierarchy
	parentLocation?: string;  // Link to parent location file ([[Parent Location]])

	// Geography
	region?: 'temperate' | 'polar' | 'tropical';  // Climate region for solar time calculations

	// State
	status?: string;  // e.g., "Prosperous", "Plagued", "War-torn"
	description?: string;

	// Renown Component (optional)
	renownTracking?: RenownComponent;

	// Metadata
	created: string;  // ISO 8601 timestamp
	lastUpdated?: string;

	// Note: Relationships (residents, businesses, activeJobs, factionsPresent)
	// are NOT stored in frontmatter - they are dynamic tables in file body
}

// ============================================================================
// Enhanced Faction Entity
// ============================================================================
// Note: This replaces the basic Faction interface above for new faction files
// Old static YAML factions still use basic Faction interface for backwards compatibility

/**
 * Faction entity - represents organizations in the campaign
 * Roster and presence are dynamic tables in file body, NOT in frontmatter
 */
export interface FactionEntity extends Faction {
	// Additional fields for faction files (beyond basic YAML factions)
	factionId?: string;  // UUID for dynamic factions

	// Renown Component (optional)
	renownTracking?: RenownComponent;

	// Metadata
	created?: string;  // ISO 8601 timestamp
	lastUpdated?: string;

	// Note: Roster and presence are NOT in frontmatter
	// - Roster: Dynamic table in body, populated by scanning NPCs with factionRole field
	// - Presence: Dynamic table in body, populated by scanning locations with this faction
}

// ============================================================================
// Renown History Entry (for activity log)
// ============================================================================

/**
 * Renown history entry for activity/transaction log
 */
export interface RenownHistoryEntry {
	timestamp: string;  // ISO 8601 timestamp
	entityType: 'faction' | 'location' | 'npc';
	entityName: string;
	entityLink?: string;  // [[Entity Name]]

	// Change details
	previousScore: number;
	newScore: number;
	change: number;  // Convenience field (newScore - previousScore)

	// Source of change
	source: 'manual' | 'event' | 'other';
	sourceDescription?: string;  // e.g., "Manual adjustment via reputation modal"
	sourceLink?: string;  // Optional link to source

	// Rank change (if applicable)
	previousRank?: string;
	newRank?: string;
	rankedUp?: boolean;  // True if crossed threshold upward
	rankedDown?: boolean;  // True if crossed threshold downward

	// Calendar integration (if available)
	calendarDay?: number;
	formattedDate?: string;

	// Individual player tracking (if change was player-specific)
	playerName?: string;
}

export interface TransactionContext {
	id?: string;  // UUID for cross-platform tracking
	shopId?: string;  // UUID reference to shop
	npcId?: string;  // UUID reference to NPC
	transactionType: 'purchase' | 'sale' | 'trade' | 'loot' | 'reward';
	sourceReference?: string;  // Shop name, NPC name, or file link
	shopkeeperName?: string;  // Name of shopkeeper (for trade/purchase/sale)
	description?: string;
	linkedFile?: string;  // Path to linked file (quest, NPC, etc.)
	lootSource?: string;  // Description of loot source (e.g., "Goblin ambush")
	rewardType?: 'quest' | 'npc_gift' | 'faction_payment';
	rewardTier?: string;  // For rewards (minor, moderate, major)
	crTier?: string;  // For loot generation (0-4, 5-10, 11-16, 17+)
	lootType?: 'individual' | 'hoard';
	// Calendar system fields (added when calendar is available)
	calendarDay?: number;  // Absolute day counter when transaction occurred
	formattedDate?: string;  // Human-readable formatted date
}

/**
 * Transaction record for shop purchases/sales and other party financial activities
 * Used by transaction log and Porter Service for campaign export/import
 */
export interface Transaction {
	/** Unique identifier for this transaction */
	id: string;
	/** Timestamp when transaction occurred (Unix milliseconds) */
	timestamp: number;
	/** Type of transaction */
	type: 'purchase' | 'sale' | 'trade' | 'loot' | 'reward' | 'adjustment';
	/** Source/location of transaction (shop name, NPC name, etc.) */
	source: string;
	/** Items involved in transaction */
	items: PurchasedItem[];
	/** Total cost of transaction */
	cost: ItemCost;
	/** Additional context about the transaction */
	context?: TransactionContext;
}

export interface ShopTemplate {
	name: string;
	type: string;
	wealthLevel: 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic';
	location?: string;
	description?: string;
	faction?: string;
}

/**
 * Tracks why items were excluded during vault scan
 * Used by ItemVaultHandler to count exclusion reasons
 */
export interface DiagnosticsTracker {
	/** Total markdown files scanned */
	scanned: number;

	/** Files with no frontmatter block */
	noFrontmatter: number;

	/** Files not matching item detection criteria */
	notDetected: number;

	/** Items with invalid/missing cost field */
	invalidCost: number;

	/** Items filtered by disabled source */
	sourceFiltered: number;

	/** Files that threw parse errors */
	parseErrors: number;

	/** Items successfully parsed and cached */
	success: number;
}

/**
 * Extended diagnostics with examples and timestamp
 * Stored by ItemVaultHandler after each scan
 * Displayed in Health Check UI
 */
export interface DiagnosticsInfo extends DiagnosticsTracker {
	/** When this scan was performed */
	timestamp: number;

	/** Example file paths for each exclusion type (max 5 each) */
	examples?: {
		noFrontmatter?: string[];
		notDetected?: string[];
		invalidCost?: string[];
		sourceFiltered?: string[];
		parseErrors?: string[];
	};
}

// ============================================================================
// Calendar System Types (Phase 3+)
// ============================================================================

/**
 * Calendar Month Definition
 * Extended to support intercalary days (days outside normal month/week cycle)
 */
export interface CalendarMonth {
	name: string;
	days: number;
	order: number;
	type?: 'standard' | 'intercalary';  // Intercalary days don't advance weekday cycle
}

/**
 * Calendar Holiday Definition
 */
export interface CalendarHoliday {
	name: string;
	description?: string;
	// Holiday can be defined by dayOfYear OR by month+day
	dayOfYear?: number;  // 0-indexed day of year
	month?: number;  // 0-indexed month
	day?: number;  // 1-indexed day of month
	notifyOnArrival?: boolean;
}

/**
 * Calendar Era Definition
 * Defines historical periods with custom year formatting
 */
export interface Era {
	name: string;  // Full name: "Dalereckoning", "Before Dalereckoning"
	abbrev: string;  // Abbreviation: "DR", "BD"
	startYear: number;  // Year this era begins (inclusive)
	endYear?: number;  // Year this era ends (exclusive), undefined for current era
	direction: 1 | -1;  // 1 = count forward, -1 = count backward
}

/**
 * Calendar Leap Rule Definition
 * Defines complex leap year calculations (e.g., Gregorian: every 4, not 100, yes 400)
 */
export interface LeapRule {
	interval: number;  // Base interval (e.g., 4 for "every 4 years")
	offset?: number;  // Year offset for calculation (default: 0)
	targetMonth?: number;  // 0-indexed month to add leap day to (undefined = end of year)
	exclude?: LeapRule[];  // Nested rules for exceptions (e.g., "not every 100 years")
}

/**
 * Calendar Season Definition
 * Defines seasonal periods with sunrise/sunset times
 */
export interface Season {
	name: string;  // e.g., "Spring", "Summer", "Harvest Season"
	startMonth: number;  // 0-indexed month when season begins
	startDay: number;  // 1-indexed day of month when season begins
	sunrise: number;  // Minutes from midnight (0-1439)
	sunset: number;  // Minutes from midnight (0-1439)
	region?: string;  // Optional region tag for latitude-specific times
}

/**
 * Calendar Definition
 * Defines a calendar system (e.g., Harptos, Gregorian, custom)
 * Extended to support eras, complex leap rules, and seasons
 */
export interface CalendarDefinition {
	id: string;
	name: string;
	description?: string;
	weekdays: string[];
	months: CalendarMonth[];
	holidays: CalendarHoliday[];
	startingYear?: number;
	yearSuffix?: string;  // e.g., "DR", "AD" (deprecated in favor of eras)
	// Phase 1 Extensions
	eras?: Era[];  // Era definitions for year display
	leapRules?: LeapRule[];  // Complex leap year rules
	seasons?: Season[];  // Seasonal definitions with solar times
}

/**
 * Calendar Origin Date
 * Maps Day 0 to a specific calendar date
 */
export interface CalendarOrigin {
	year: number;
	month: number;  // 0-indexed
	day: number;  // 1-indexed
	description?: string;
}

/**
 * Calendar Clock
 * Hybrid time storage: absolute day counter + time-of-day offset
 * Separates macro (day) from micro (time) for efficient simulation
 */
export interface CalendarClock {
	currentDay: number;  // Absolute day counter (0-indexed) - macro anchor
	timeOfDay: number;  // Minutes from midnight (0-1439) - micro offset
}

/**
 * Calendar State
 * Current calendar state persisted in settings
 * Extended to support time-of-day tracking via CalendarClock
 */
export interface CalendarState {
	currentDay: number;  // Absolute day counter (0-indexed)
	timeOfDay?: number;  // Minutes from midnight (0-1439) - optional for backward compatibility
	activeCalendarId: string;  // Which calendar definition to use
	originDate?: CalendarOrigin;  // Maps Day 0 to calendar date
	lastAdvanced?: string;  // ISO timestamp of last advancement
	totalAdvancementCount?: number;  // Total times advanced (for stats)
}

/**
 * CalendarDate - Core date representation from CalendarDriver
 *
 * Represents the fundamental components of a calendar date:
 * - Day, month, year position
 * - Day of week (if weekdays defined)
 * - Absolute day reference
 *
 * This is the primary output of CalendarDriver.getDate().
 * For human-readable formatting, use FormattedDate.
 */
export interface CalendarDate {
	/** The absolute day counter (0-indexed) */
	absoluteDay: number;

	/** Day of month (1-indexed, 1-31 typical) */
	dayOfMonth: number;

	/** Month index (0-indexed) */
	monthIndex: number;

	/** Month name from calendar definition */
	monthName: string;

	/** Year number (calculated from origin or startingYear) */
	year: number;

	/** Day of week name (empty string if no weekdays defined) */
	dayOfWeek: string;

	/** Day of week index (0-indexed, -1 if no weekdays) */
	dayOfWeekIndex: number;

	/** Day of year (0-indexed) */
	dayOfYear: number;

	/** Year suffix from calendar definition (e.g., "DR", "AD") */
	yearSuffix: string;

	/** Whether this day falls in a simple counter (no months) calendar */
	isSimpleCounter: boolean;

	/** Whether this day is an intercalary day (outside normal month/week cycle) */
	isIntercalary: boolean;
}

/**
 * Formatted Date
 * Human-readable date representation
 */
export interface FormattedDate {
	dayOfWeek: string;
	dayOfMonth: number;  // 1-indexed
	monthName: string;
	year: number;
	yearSuffix?: string;
	formatted: string;  // Full formatted string
	compact: string;  // Compact formatted string
	absoluteDay: number;  // Original day counter
}

/**
 * Time Advanced Event
 * Payload emitted when time is advanced
 */
export interface TimeAdvancedEvent {
	previousDay: number;
	newDay: number;
	daysPassed: number;
	formattedDate?: FormattedDate;
}

/**
 * Upkeep Configuration - Daily party expenses
 */
export interface UpkeepConfig {
	// Party-wide defaults (used if no individual settings)
	partyWideSettings: {
		useRations: boolean;
		useLifestyleExpenses: boolean;
		lifestyleLevel: 'wretched' | 'squalid' | 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic';
	};

	// Per-player overrides (optional)
	individualSettings?: {
		[playerName: string]: {
			useRations: boolean;
			useLifestyleExpenses: boolean;
			lifestyleLevel: 'wretched' | 'squalid' | 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic';
		};
	};
}

/**
 * Shop Restock Configuration
 */
export interface ShopRestockConfig {
	enabled: boolean;  // Whether auto-restocking is active
	defaultInterval: number;  // Default days between restocks (e.g., 7)

	// Per-shop-type overrides
	intervalByType?: {
		[shopType: string]: number;  // { "blacksmith": 14, "alchemist": 7 }
	};

	// Restock behavior
	fullRestock: boolean;  // true = regenerate entire inventory, false = replenish stock
	notifyOnRestock: boolean;  // Show notice when shops restock
}

/**
 * Lifestyle cost definition loaded from lifestyleCosts.yaml
 */
export interface LifestyleCostDefinition {
	name: string;
	costPerDay: ItemCost;
	description: string;
}

/**
 * Upkeep cost configuration loaded from YAML
 * Defines D&D 5e lifestyle costs and ration prices
 */
export interface UpkeepCostConfig {
	lifestyleLevels: {
		wretched: LifestyleCostDefinition;
		squalid: LifestyleCostDefinition;
		poor: LifestyleCostDefinition;
		modest: LifestyleCostDefinition;
		comfortable: LifestyleCostDefinition;
		wealthy: LifestyleCostDefinition;
		aristocratic: LifestyleCostDefinition;
	};
	rations: {
		costPerDay: ItemCost;
		description: string;
	};
}

// ============================================================================
// Projects & Downtime System Types
// ============================================================================

/**
 * Cost strategy - How to calculate project cost
 */
export interface ProjectCostStrategy {
	type: 'none' | 'fixed' | 'variable';

	// If type = 'fixed'
	fixedCost?: ItemCost;  // e.g., { gp: 50, sp: 0, cp: 0, pp: 0 }

	// If type = 'variable'
	guidanceText?: string;  // Guidance string for GM to decide (NOT parsed)
	// Example: "Cantrip: 15gp, Level 1: 25gp, Level 2: 50gp, Level 3: 150gp"
}

/**
 * Duration strategy - How to calculate project time
 */
export interface ProjectDurationStrategy {
	type: 'fixed' | 'variable';

	// If type = 'fixed'
	fixedDays?: number;  // e.g., 7 days

	// If type = 'variable'
	guidanceText?: string;  // Guidance string for GM to decide (NOT parsed)
	// Example: "Cantrip: 1 day, Level 1-2: 3 days, Level 3-5: 7 days"
}

/**
 * Success criteria strategy - How to determine success
 */
export interface ProjectSuccessCriteriaStrategy {
	type: 'fixed' | 'variable';

	// If type = 'fixed'
	fixedCriteria?: string;  // e.g., "Must roll DC 15 Athletics check each day"

	// If type = 'variable'
	guidanceText?: string;  // Guidance string for GM to decide (NOT parsed)
	// Example: "DC = 10 + Spell Level (Arcana check)"
}

/**
 * Project Template - Reusable blueprint for downtime activities
 */
export interface ProjectTemplate {
	/**
	 * Unique identifier for the template
	 * Format: "template-{uuid}" where uuid is RFC 4122 v4 compliant
	 * Example: "template-550e8400-e29b-41d4-a716-446655440000"
	 */
	id: string;
	name: string;  // "Scribe Spell Scroll", "Pit Fighting", "Research Artifact"
	description?: string;  // Optional detailed description

	// Outcome configuration
	outcomeType: 'item' | 'currency' | 'information' | 'other';

	// Cost configuration
	currencyCostStrategy: ProjectCostStrategy;
	consumesMaterials: boolean;  // Whether materials are required

	// Time configuration
	durationStrategy: ProjectDurationStrategy;

	// Success configuration
	automaticSuccess: boolean;  // If true, no checks required
	successCriteriaStrategy?: ProjectSuccessCriteriaStrategy;  // Only if !automaticSuccess

	// Metadata
	createdBy?: string;  // GM name
	createdDate?: number;  // Calendar day created
}

/**
 * Consumed material - Material used for project
 */
export interface ConsumedMaterial {
	itemName: string;  // Name of consumed item
	quantity: number;  // Amount consumed
	itemPath?: string;  // Path to item file in vault (for linking)
	markedForConsumption: boolean;  // Whether item was explicitly selected
}

/**
 * Project outcome - What happens when project completes
 */
export interface ProjectOutcome {
	type: 'item' | 'currency' | 'information' | 'other';

	// If type = 'item'
	itemName?: string;  // Name of item to create/add
	itemQuantity?: number;  // Quantity (default: 1)

	// If type = 'currency'
	currencyAmount?: ItemCost;  // Amount of currency to add

	// If type = 'information'
	informationTitle?: string;  // Title of information note
	informationContent?: string;  // Content to add to journal

	// If type = 'other'
	customOutcome?: string;  // Custom description for GM
}

/**
 * Project Instance - Specific project in progress
 */
export interface ProjectInstance {
	/**
	 * Unique identifier for the instance
	 * Format: "project-{uuid}" where uuid is RFC 4122 v4 compliant
	 * Example: "project-550e8400-e29b-41d4-a716-446655440000"
	 */
	id: string;
	/**
	 * Reference to the template this instance was created from
	 * Format: "template-{uuid}"
	 */
	templateId: string;

	// Instance-specific data
	name: string;  // Can override template name (e.g., "Scribing Fireball")
	assignedTo: string[];  // Array of party member names (supports multi-player collaboration)

	// State tracking
	status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

	// Time tracking
	startDay?: number;  // Calendar day project started
	totalDays: number;  // Total days required (resolved from template)
	remainingDays: number;  // Days left to complete
	lastWorkedDay?: number;  // Last day work was performed
	daysWorkedByPlayer: { [playerName: string]: number };  // Track days each player contributed

	// Cost (already paid)
	currencyCost: ItemCost;  // Actual currency cost paid
	materialsCost?: ConsumedMaterial[];  // Materials consumed (tracked in project, NOT inventory)

	// Success tracking (if required)
	successCriteria?: string;  // Resolved criteria for this instance
	successfulDays?: number;  // Days where success check passed
	failedDays?: number;  // Days where success check failed
	totalSuccessesRequired?: number;  // Optional: auto-complete when threshold met
	timeLimit?: number;  // Optional: warn GM when time limit reached

	// Outcome configuration (resolved from template)
	outcome: ProjectOutcome;

	// Metadata
	createdDate: number;  // Calendar day instance created
	completedDate?: number;  // Calendar day completed (if status = 'completed')
	notes?: string;  // GM notes
}

/**
 * Project progress update - Result of time advancement
 */
export interface ProjectProgressUpdate {
	instanceId: string;
	previousRemainingDays: number;
	newRemainingDays: number;
	daysWorked: number;  // How many days of progress made (may be 0 if failed checks)
	completed: boolean;  // Whether project finished
	outcome?: ProjectOutcome;  // Only if completed
}

/**
 * Project progress input - Data collected from UI before time advances
 * Used by ProjectProgressListener to process projects with user input
 */
export interface ProjectProgressInput {
	// Time allocation per project (for multi-project time budgeting)
	// Maps instance ID to number of days allocated
	allocations: Map<string, number>;

	// Success/failure results for projects with success checks
	// Maps instance ID to boolean (true = passed, false = failed)
	// If undefined for a project, assumes automatic success
	successResults?: Map<string, boolean>;
}

/**
 * Project template summary - For browsing/listing
 */
export interface ProjectTemplateSummary {
	id: string;
	name: string;
	outcomeType: string;
	estimatedCost: string;  // Human-readable cost estimate
	estimatedDuration: string;  // Human-readable duration estimate
}

/**
 * Project instance summary - For browsing/listing
 */
export interface ProjectInstanceSummary {
	id: string;
	name: string;
	assignedTo: string[];  // Multiple players for collaboration
	status: string;
	remainingDays: number;
	totalDays: number;
	progressPercentage: number;  // (totalDays - remainingDays) / totalDays * 100
}

// ============================================================================
// Inventory Management System Types (Phase 1)
// ============================================================================

/**
 * Container types
 */
export type ContainerType = 'player' | 'item' | 'custom' | 'vehicle' | 'stronghold';

/**
 * Inventory Container - Represents a container that holds items
 */
export interface InventoryContainer {
	id: string;  // Unique identifier (UUID)
	name: string;  // "Backpack", "Bag of Holding", "Wagon"
	type: ContainerType;  // Container classification
	maxCapacity: number;  // Max weight in pounds (0 = unlimited)
	currentWeight: number;  // Calculated from contents
	weightMultiplier: number;  // 0.0 for Bag of Holding (weightless), 1.0 normal

	ownerId?: string;  // PartyMember.id (null = party shared)
	parentContainerId?: string;  // For nested containers
	locationId?: string;  // For stronghold containers

	description?: string;  // Optional notes
	icon?: string;  // Icon identifier for UI
	isDefault?: boolean;  // Auto-created default container

	createdAt: string;  // ISO 8601 timestamp
	updatedAt: string;  // ISO 8601 timestamp
}

/**
 * Inventory Item - Represents an item instance in a container
 */
export interface InventoryItem {
	id: string;  // Unique identifier (UUID)
	itemId: string;  // Reference to Item (file path or item name)
	containerId: string;  // Parent container
	quantity: number;  // Stack size
	weight: number;  // Cached weight (from calculator)

	// Optional metadata
	condition?: string;  // "Excellent", "Damaged", "Broken"
	degradationRate?: number;  // 0-100 (0=pristine, 100=destroyed)
	perishable?: boolean;  // Is this item perishable?
	expiresAt?: string;  // Expiration date (ISO 8601)
	isFavorite?: boolean;  // Pinned to top of lists
	notes?: string;  // Custom notes

	acquiredAt: string;  // When added to inventory
	acquiredFrom?: string;  // "Shop: Blacksmith", "Loot: Dragon Hoard"
}

/**
 * Encumbrance levels
 */
export type EncumbranceLevel = 'normal' | 'encumbered' | 'heavily_encumbered' | 'overloaded';

/**
 * Player Encumbrance - Encumbrance state for a player
 */
export interface PlayerEncumbrance {
	playerId: string;  // PartyMember.id
	carryingCapacity: number;  // STR × 15 (or static value)
	currentLoad: number;  // Total weight carried
	encumbranceLevel: EncumbranceLevel;  // Calculated status
	speedModifier: number;  // Speed penalty (feet)
	hasDisadvantage: boolean;  // Heavy encumbrance penalty

	calculatedAt: string;  // ISO 8601 timestamp (for caching)
}

/**
 * Party Inventory V2 - New container-based inventory system
 */
export interface PartyInventoryV2 {
	version: number;  // Schema version (2)
	containers: InventoryContainer[];  // All containers
	items: InventoryItem[];  // All items
	encumbrance: PlayerEncumbrance[];  // Player encumbrance states

	currency: Currency;  // Party funds (existing type)

	updatedAt: string;  // Last modification timestamp
}

/**
 * Inventory action types
 */
export type InventoryAction = 'add' | 'remove' | 'transfer' | 'consume' | 'lost' | 'found' | 'sold' | 'purchased';

/**
 * Inventory Activity Entry - Activity log entry
 */
export interface InventoryActivityEntry {
	id: string;  // Unique identifier (UUID)
	timestamp: string;  // ISO 8601 timestamp
	action: InventoryAction;  // Type of action

	playerId?: string;  // Actor (null = DM/system)
	itemId: string;  // Item affected
	itemName: string;  // Item name (cached for display)
	quantity: number;  // How many

	fromContainerId?: string;  // Source container (for transfers)
	toContainerId?: string;  // Destination container

	notes?: string;  // Optional context
	relatedDate?: string;  // Calendar date (for integration)
}

/**
 * Container Template - Pre-configured container template
 */
export interface ContainerTemplate {
	id: string;
	name: string;
	type: ContainerType;
	maxCapacity: number;
	weightMultiplier: number;
	description: string;
	icon?: string;
}

// ============================================================================
// Event System Types
// ============================================================================

// Re-export all event system types from eventTypes.ts
export type {
	EventContext,
	EventDefinition,
	FixedDateEvent,
	IntervalEvent,
	ChainEventState,
	ChainEvent,
	ConditionalEvent,
	AnyEventDefinition,
	ActiveEvent,
	EffectRegistry
} from './eventTypes';

// Re-export all effect types from effectTypes.ts
export type {
	EconomicEffects,
	EnvironmentalEffects,
	UIEffects,
	CombinedEffects,
	ResolvedEffects,
	EffectCategory
} from './effectTypes';

export {
	EFFECT_KEY_REGISTRY,
	EFFECT_CATEGORIES,
	getAllEffectKeys,
	isValidEffectKey,
	getEffectCategory
} from './effectTypes';

// Re-export all world state persistence types from worldStateTypes.ts
export type {
	ChainStateVector,
	GMOverride,
	ModuleToggle,
	WorldState
} from './worldStateTypes';
export { WorldStateStoragePaths } from './worldStateTypes';
