/**
 * Settings taxonomy for campaign-scoped configuration
 *
 * Phase 2 Implementation: Split settings into Global vs Campaign-scoped
 *
 * - Global Settings: UI preferences, defaults for new campaigns, feature flags
 * - Campaign Settings: Paths, economic modifiers, party state, enabled features
 *
 * Migration Strategy: See SETTINGS_MIGRATION_MAP for old → new mapping
 */

import type { Currency, CalendarState, UpkeepConfig, ShopRestockConfig, PartyMember } from './types';

/**
 * Global Settings (App-level, shared across all campaigns)
 *
 * Stored in: data.json.globalSettings (Obsidian) or app_settings table (Backend)
 * Scope: Applies to all campaigns unless overridden
 */
export interface GlobalSettings {
  // ─── UI Preferences ────────────────────────────────────────────
  /** UI theme preference */
  theme?: 'light' | 'dark' | 'auto';

  /** Default currency denomination for new campaigns */
  defaultCurrency: string; // 'gp', 'cr', etc.

  /** Date format preference */
  dateFormat?: 'full' | 'compact' | 'both';

  /** Show calendar widget in UI by default */
  showCalendarInUI?: boolean;

  // ─── Feature Flags ────────────────────────────────────────────
  /** Enable experimental features */
  enableExperimentalFeatures?: boolean;

  /** Enable debug logging to console */
  enableDebugLogging?: boolean;

  /** Use SRD database for items */
  useSRDDatabase: boolean;

  /** Store cross-platform UUIDs in files */
  storeCrossPlatformIds: boolean;

  // ─── Defaults for New Campaigns ────────────────────────────────
  /** Default shop types to enable */
  defaultShopTypes?: string[];

  /** Default libraries to activate */
  defaultLibraries?: string[];

  /** Default sources to enable */
  defaultEnabledSources?: string[];

  /** Auto-save shops by default */
  autoSaveShops: boolean;

  // ─── Custom Config Paths (Global) ────────────────────────────────
  /** Custom config folder override (empty = use defaults) */
  customConfigFolderPath: string;

  /** Use custom shop config */
  useCustomShopConfig: boolean;

  /** Use custom services config */
  useCustomServicesConfig: boolean;

  /** Use custom shopkeep config */
  useCustomShopkeepConfig: boolean;

  /** Use custom factions config */
  useCustomFactionsConfig: boolean;

  /** Use custom loot tables config */
  useCustomLootTablesConfig: boolean;

  // ─── Plugin Metadata ────────────────────────────────────────────
  /** Plugin version for migration tracking */
  pluginVersion?: string;

  /** Last migration version applied */
  lastMigrationVersion?: string;

  /** Settings migration complete (Phase 2 migration flag) */
  settingsMigrationComplete?: boolean;
}

/**
 * Campaign Settings (Per-campaign, stored in CampaignProfile.settings)
 *
 * Stored in: data.json.campaigns[].settings (Obsidian) or campaign_settings table (Backend)
 * Scope: Applies only to the specific campaign
 */
export interface CampaignSettings {
  // ─── Path Mappings (Obsidian Only) ────────────────────────────────
  /**
   * File/folder paths for campaign data
   * NOTE: This duplicates pathMappings in CampaignProfile for backward compatibility
   * during Phase 2 migration. Will be consolidated in Phase 3.
   */
  pathMappings?: CampaignPathMappings;

  // ─── Economic Settings ────────────────────────────────────────────
  /** Inflation/deflation modifier (1.0 = normal, 1.2 = 20% inflation) */
  inflationModifier?: number;

  /** Currency system ID (world-level setting) */
  currencySystemId?: string;

  /** Magic item markup percentage (0-200) */
  magicItemMarkupPercent: number;

  /** Magic item rarity modifiers by settlement wealth */
  magicItemRarityModifiers: {
    poor: number;
    modest: number;
    comfortable: number;
    wealthy: number;
    aristocratic: number;
  };

  // ─── Calendar Settings ────────────────────────────────────────────
  /** Calendar system ID (world-level setting) */
  calendarSystemId?: string;

  /** Current in-game date/time state */
  calendarState?: CalendarState;

  /** Party upkeep configuration */
  upkeepConfig?: UpkeepConfig;

  /** Shop restock configuration */
  shopRestockConfig?: ShopRestockConfig;

  // ─── Party Settings ────────────────────────────────────────────────
  /** Party funds (current gold/currency) */
  partyFunds?: Currency;

  /** Average party level (for magic item generation) */
  partyLevel: number;

  /** Party members (DEPRECATED: migrated to file-based storage) */
  partyMembers?: PartyMember[];

  /** Flag: party members migrated to files */
  partyMembersMigrated?: boolean;

  /** Enable player tracking features */
  enablePlayerTracking: boolean;

  // ─── Feature Toggles (Campaign-Specific) ────────────────────────────
  /** Enable magic items in this campaign */
  enableMagicItems?: boolean;

  /** Enable crafting system */
  enableCrafting?: boolean;

  /** Enable hirelings system */
  enableHirelings?: boolean;

  /** Enable stronghold management features */
  enableStrongholdFeatures: boolean;

  /** Auto-expire jobs when duration passes */
  autoExpireJobs: boolean;

  /** Notify GM on job deadlines */
  notifyOnJobDeadlines: boolean;

  /** Notify GM on job expirations */
  notifyOnJobExpirations: boolean;

  /** Enable encumbrance tracking */
  enableEncumbranceTracking?: boolean;

  /** Track manual inventory edits in activity log */
  trackManualInventoryEdits?: boolean;

  // ─── NPC & World Settings ────────────────────────────────────────────
  /** Auto-create NPC files when generating shops */
  createNPCLinks: boolean;

  /** Track hireling loyalty/morale mechanics */
  trackHirelingLoyalty: boolean;

  /** Auto-deduct hireling wages from party funds */
  autoPayHirelings: boolean;

  // ─── Player View Settings ────────────────────────────────────────────
  /** Show reputation impacts in player view */
  playerViewShowReputationImpacts: boolean;

  /** Show prerequisites in player view */
  playerViewShowPrerequisites: boolean;

  /** Show exact time remaining vs generic urgency */
  playerViewShowExactTimeRemaining: boolean;

  /** Show progression summary modal after time advancement */
  projectProgressionSummary?: boolean;

  // ─── Library & Sources ────────────────────────────────────────────
  /** Active library IDs for this campaign */
  activeLibraryIds: string[];

  /** Available item sources */
  availableSources: string[];

  /** Enabled item sources */
  enabledSources: string[];

  // ─── Named Template Preferences ────────────────────────────────────────────
  /** Shop template preferences by shop type */
  shopTemplatePreferences: {
    [shopType: string]: string; // template name or "default"
  };
}

/**
 * Campaign path mappings (Obsidian-specific)
 *
 * Maps data types to file/folder paths in the vault
 */
export interface CampaignPathMappings {
  // Core paths (required)
  shops: string;
  party: string;
  transactions: string;

  // Optional paths
  npcs?: string;
  locations?: string;
  factions?: string;
  jobs?: string;
  projects?: string;
  projectTemplates?: string;
  activityLog?: string;
  calendar?: string;
  items?: string;
  libraries?: string;
  strongholds?: string;
  strongholdStashes?: string;
  facilities?: string;
  orders?: string;
  eventTables?: string;
  hirelings?: string;
  partyMembers?: string;
  jobNotificationLog?: string;
}

/**
 * Item folder configuration (from existing RPGShopkeepSettings)
 */
export interface ItemFolderConfig {
  name: string;
  path: string;
  enabled: boolean;
  priority: number;
}

/**
 * Migration map: Old RPGShopkeepSettings → New GlobalSettings + CampaignSettings
 *
 * Used by SettingsMigration to split existing settings
 */
export const SETTINGS_MIGRATION_MAP = {
  // ─── Global Settings ────────────────────────────────────────────
  global: {
    defaultCurrency: 'defaultCurrency',
    useSRDDatabase: 'useSRDDatabase',
    storeCrossPlatformIds: 'storeCrossPlatformIds',
    autoSaveShops: 'autoSaveShops',
    customConfigFolderPath: 'customConfigFolderPath',
    useCustomShopConfig: 'useCustomShopConfig',
    useCustomServicesConfig: 'useCustomServicesConfig',
    useCustomShopkeepConfig: 'useCustomShopkeepConfig',
    useCustomFactionsConfig: 'useCustomFactionsConfig',
    useCustomLootTablesConfig: 'useCustomLootTablesConfig',
    dateFormat: 'dateFormat',
    showCalendarInUI: 'showCalendarInUI',
  },

  // ─── Campaign Settings ────────────────────────────────────────────
  campaign: {
    // Paths → pathMappings
    partyInventoryFile: 'pathMappings.party',
    transactionLogFile: 'pathMappings.transactions',
    shopsFolder: 'pathMappings.shops',
    npcsFolder: 'pathMappings.npcs',
    locationsFolder: 'pathMappings.locations',
    factionsFolder: 'pathMappings.factions',
    jobsFolder: 'pathMappings.jobs',
    strongholdsFolder: 'pathMappings.strongholds',
    strongholdStashesFolder: 'pathMappings.strongholdStashes',
    facilitiesConfigFolder: 'pathMappings.facilities',
    ordersConfigFolder: 'pathMappings.orders',
    eventTablesFolder: 'pathMappings.eventTables',
    hirelingsFolder: 'pathMappings.hirelings',
    partyMembersFolder: 'pathMappings.partyMembers',
    jobNotificationLogPath: 'pathMappings.jobNotificationLog',
    partyInventoryPath: 'pathMappings.party', // Alias for partyInventoryFile
    projectTemplatesPath: 'pathMappings.projectTemplates',
    projectInstancesPath: 'pathMappings.projects',
    activityLogPath: 'pathMappings.activityLog',

    // Economic settings
    magicItemMarkupPercent: 'magicItemMarkupPercent',
    magicItemRarityModifiers: 'magicItemRarityModifiers',

    // Party settings
    partyFunds: 'partyFunds',
    partyLevel: 'partyLevel',
    partyMembers: 'partyMembers',
    partyMembersMigrated: 'partyMembersMigrated',
    enablePlayerTracking: 'enablePlayerTracking',

    // Calendar settings
    calendarState: 'calendarState',
    upkeepConfig: 'upkeepConfig',
    shopRestockConfig: 'shopRestockConfig',

    // Feature toggles
    enableStrongholdFeatures: 'enableStrongholdFeatures',
    autoExpireJobs: 'autoExpireJobs',
    notifyOnJobDeadlines: 'notifyOnJobDeadlines',
    notifyOnJobExpirations: 'notifyOnJobExpirations',
    enableEncumbranceTracking: 'enableEncumbranceTracking',
    trackManualInventoryEdits: 'trackManualInventoryEdits',

    // NPC settings
    createNPCLinks: 'createNPCLinks',
    trackHirelingLoyalty: 'trackHirelingLoyalty',
    autoPayHirelings: 'autoPayHirelings',

    // Player view settings
    playerViewShowReputationImpacts: 'playerViewShowReputationImpacts',
    playerViewShowPrerequisites: 'playerViewShowPrerequisites',
    playerViewShowExactTimeRemaining: 'playerViewShowExactTimeRemaining',
    projectProgressionSummary: 'projectProgressionSummary',

    // Library & sources
    availableSources: 'availableSources',
    enabledSources: 'enabledSources',

    // Template preferences
    shopTemplatePreferences: 'shopTemplatePreferences',
  },

  // ─── Ignored (Moved to CampaignProfile.pathMappings in Phase 1) ────────────────────────────────────────────
  ignored: [
    'itemsFolders', // Migrated to pathMappings.items in Phase 1
    'partyMemberFolder', // Migrated to pathMappings.partyMembers in Phase 1
  ],
} as const;

/**
 * Default global settings values
 */
export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  defaultCurrency: 'gp',
  useSRDDatabase: true,
  storeCrossPlatformIds: false,
  autoSaveShops: true,
  customConfigFolderPath: '',
  useCustomShopConfig: false,
  useCustomServicesConfig: false,
  useCustomShopkeepConfig: false,
  useCustomFactionsConfig: false,
  useCustomLootTablesConfig: false,
  enableDebugLogging: false,
  enableExperimentalFeatures: false,
  dateFormat: 'full',
  showCalendarInUI: true,
};

/**
 * Default campaign settings values
 */
export const DEFAULT_CAMPAIGN_SETTINGS: Partial<CampaignSettings> = {
  magicItemMarkupPercent: 50,
  magicItemRarityModifiers: {
    poor: 0,
    modest: 0,
    comfortable: 0,
    wealthy: 0,
    aristocratic: 0,
  },
  partyLevel: 1,
  enablePlayerTracking: false,
  enableStrongholdFeatures: false,
  autoExpireJobs: true,
  notifyOnJobDeadlines: true,
  notifyOnJobExpirations: true,
  createNPCLinks: true,
  trackHirelingLoyalty: true,
  autoPayHirelings: false,
  playerViewShowReputationImpacts: true,
  playerViewShowPrerequisites: true,
  playerViewShowExactTimeRemaining: false,
  projectProgressionSummary: true,
  enableEncumbranceTracking: false,
  trackManualInventoryEdits: true,
  activeLibraryIds: ['srd'],
  availableSources: [],
  enabledSources: [],
  shopTemplatePreferences: {},
};
