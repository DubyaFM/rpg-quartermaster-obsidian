// Main Obsidian data adapter - composes all handlers
import { App, Plugin } from 'obsidian';
import { IDataAdapter, PartyInventory, Service, LootTable } from '@quartermaster/core/interfaces/IDataAdapter';
import {
	Shop,
	ShopItem,
	Item,
	PurchasedItem,
	ItemCost,
	RPGShopkeepSettings,
	ShopGenerationConfig,
	Faction,
	TransactionContext,
Transaction,
	FormattedDate,
	PartyMember,
	InventoryContainer,
	InventoryItem
} from '@quartermaster/core/models/types';
import { ShopFileHandler } from './ShopFileHandler';
import { PartyInventoryHandler } from './PartyInventoryHandler';
import { TransactionLogHandler } from './TransactionLogHandler';
import { ItemVaultHandler } from './ItemVaultHandler';
import { PartyInventoryReader, PartyInventoryItem } from './PartyInventoryReader';
import { ConfigService } from '@quartermaster/core/services/ConfigService';
import { IConfigAdapter } from '@quartermaster/core/interfaces/IConfigAdapter';
import { ISettingsAdapter } from '@quartermaster/core/interfaces/ISettingsAdapter';
import { ICampaignContext } from '@quartermaster/core/interfaces/ICampaignContext';
import { IPathResolver } from '../interfaces/IPathResolver';
import { ObsidianConfigAdapter } from './ObsidianConfigAdapter';
import { ConfigLoader } from './ConfigLoader';
import { ObsidianSettingsAdapter } from './ObsidianSettingsAdapter';
import { ObsidianCalendarStateAdapter } from './ObsidianCalendarStateAdapter';
import { EventBus } from '@quartermaster/core/services/EventBus';
import { CalendarService } from '@quartermaster/core/services/CalendarService';
import { DateFormatter } from '@quartermaster/core/services/DateFormatter';
import { CalendarDefinitionManager } from '@quartermaster/core/services/CalendarDefinitionManager';
import { EventNotifier } from '@quartermaster/core/services/listeners/EventNotifier';
import { UpkeepManager } from '@quartermaster/core/services/UpkeepManager';
import { NPCFileHandler } from './NPCFileHandler';
import { NPCRegistry } from '@quartermaster/core/services/NPCRegistry';
import { NPCProfile, NPCRole } from '@quartermaster/core/models/npc';
import { HirelingFileHandler } from './HirelingFileHandler';
import { HirelingManager } from '@quartermaster/core/services/HirelingManager';
import { HirelingEmployment, HirelingType, PaymentSchedule } from '@quartermaster/core/models/hireling';
import { Currency, Location, FactionEntity, RenownHistoryEntry, ProjectTemplate, ProjectInstance } from '@quartermaster/core/models/types';
import { LocationFileHandler } from './LocationFileHandler';
import { FactionFileHandler } from './FactionFileHandler';
import { ResidentEntry, BusinessEntry, FactionPresenceEntry } from '@quartermaster/core/services/LocationService';
import { RosterEntry, PresenceEntry } from '@quartermaster/core/services/FactionService';
import { RenownConfigService } from '@quartermaster/core/services/RenownConfigService';
// Stronghold imports
import { StrongholdFileHandler } from './StrongholdFileHandler';
import { FacilityFileHandler } from './FacilityFileHandler';
import { OrderFileHandler } from './OrderFileHandler';
import { EventTableFileHandler } from './EventTableFileHandler';
import { StrongholdHirelingFileHandler } from './StrongholdHirelingFileHandler';
import { TemplateWatcher } from './TemplateWatcher';
import { StrongholdService } from '@quartermaster/core/services/StrongholdService';
import { FacilityService } from '@quartermaster/core/services/FacilityService';
import { OrderService } from '@quartermaster/core/services/OrderService';
import { StrongholdHirelingService } from '@quartermaster/core/services/StrongholdHirelingService';
import { EventTableService } from '@quartermaster/core/services/EventTableService';
import { Stronghold, Hireling as StrongholdHireling, FacilityTemplate, CustomOrder, CustomEventTable } from '@quartermaster/core/models/stronghold';
// Project imports
import { ObsidianProjectConfigAdapter } from './ObsidianProjectConfigAdapter';
import { ObsidianProjectStateAdapter } from './ObsidianProjectStateAdapter';
import { ProjectTemplateService } from '@quartermaster/core/services/ProjectTemplateService';
import { ProjectInstanceService } from '@quartermaster/core/services/ProjectInstanceService';
import { ProjectProgressService } from '@quartermaster/core/services/ProjectProgressService';
import { ProjectOutcomeProcessor } from '@quartermaster/core/services/ProjectOutcomeProcessor';
import { ProjectProgressListener } from '@quartermaster/core/services/listeners/ProjectProgressListener';
import { ObsidianActivityLogHandler } from './ObsidianActivityLogHandler';
import { ActivityLogService } from '@quartermaster/core/services/ActivityLogService';
import type { ActivityEvent, ActivityLogQuery, ActivityLogResult } from '@quartermaster/core/models/ActivityLog';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';
import { getDefaultCurrencyConfig } from '@quartermaster/core/data/defaultCurrencyConfig';
import { PartyMemberFileHandler } from './PartyMemberFileHandler';

export class ObsidianDataAdapter implements IDataAdapter {
	private shopHandler: ShopFileHandler;
	private inventoryHandler: PartyInventoryHandler;
	private transactionHandler: TransactionLogHandler;
	private itemHandler: ItemVaultHandler;
	private inventoryReader: PartyInventoryReader;
	private npcHandler: NPCFileHandler;
	private npcRegistry: NPCRegistry;
	private hirelingHandler: HirelingFileHandler;
	private hirelingManager: HirelingManager;
	private locationHandler: LocationFileHandler;
	private factionHandler: FactionFileHandler;
	private partyMemberHandler: PartyMemberFileHandler;

	// Stronghold handlers and services
	private strongholdHandler: StrongholdFileHandler;
	private facilityHandler: FacilityFileHandler;
	private orderHandler: OrderFileHandler;
	private eventTableHandler: EventTableFileHandler;
	private strongholdHirelingHandler: StrongholdHirelingFileHandler;
	private templateWatcher: TemplateWatcher;
	private strongholdService: StrongholdService;
	private facilityService: FacilityService;
	private orderService: OrderService;
	private strongholdHirelingService: StrongholdHirelingService;
	private eventTableService: EventTableService;

	// New architecture: ConfigService with adapters
	private configService: ConfigService;
	private renownConfigService: RenownConfigService | null = null;

	// Calendar system services
	private eventBus: EventBus | null = null;
	private calendarService: CalendarService | null = null;
	private dateFormatter: DateFormatter | null = null;
	private calendarDefinitionManager: CalendarDefinitionManager | null = null;
	private eventNotifier: EventNotifier | null = null;
	private upkeepManager: UpkeepManager | null = null;

	// Project system services
	private projectConfigAdapter: ObsidianProjectConfigAdapter | null = null;
	private projectStateAdapter: ObsidianProjectStateAdapter | null = null;
	private projectTemplateService: ProjectTemplateService | null = null;
	private projectInstanceService: ProjectInstanceService | null = null;
	private projectProgressService: ProjectProgressService | null = null;
	private projectOutcomeProcessor: ProjectOutcomeProcessor | null = null;
	private projectProgressListener: ProjectProgressListener | null = null;

	// Activity Log Handler
	private activityLogHandlerInstance?: ObsidianActivityLogHandler;
	private activityLogService?: ActivityLogService;

	// Currency configuration
	private currencyConfig: CurrencyConfig;

	constructor(
		private app: App,
		private campaignContext: ICampaignContext,
		private pathResolver: IPathResolver,
		private configAdapter: IConfigAdapter,
		private settingsAdapter: ISettingsAdapter,
		private plugin?: Plugin
	) {
		// Get settings from adapter for use in initialization
		const settings = this.settingsAdapter.getSettings();

		// Initialize currency config with fallback to default
		this.currencyConfig = getDefaultCurrencyConfig();

		this.shopHandler = new ShopFileHandler(app, plugin);
		this.inventoryHandler = new PartyInventoryHandler(app, settings.partyInventoryFile, this.currencyConfig);
		this.transactionHandler = new TransactionLogHandler(app, settings.transactionLogFile, this.currencyConfig, this.plugin);
		this.itemHandler = new ItemVaultHandler(app, settings, plugin);
		this.itemHandler.setupCacheInvalidation();
		this.inventoryReader = new PartyInventoryReader(app, this.currencyConfig);
		this.npcHandler = new NPCFileHandler(app);
		this.npcRegistry = new NPCRegistry();
		this.hirelingHandler = new HirelingFileHandler(app);
		this.hirelingManager = new HirelingManager(this.currencyConfig);
		this.locationHandler = new LocationFileHandler(app);
		this.factionHandler = new FactionFileHandler(app);
		this.partyMemberHandler = new PartyMemberFileHandler(app);

		// Initialize stronghold system handlers and services
		this.strongholdHandler = new StrongholdFileHandler(app);
		this.facilityHandler = new FacilityFileHandler(app);
		this.orderHandler = new OrderFileHandler(app);
		this.eventTableHandler = new EventTableFileHandler(app);
		this.strongholdHirelingHandler = new StrongholdHirelingFileHandler(app);
		this.templateWatcher = new TemplateWatcher(app, this.facilityHandler, this.orderHandler, this.eventTableHandler);
		this.strongholdService = new StrongholdService(this.currencyConfig);
		this.facilityService = new FacilityService();
		this.orderService = new OrderService(this.currencyConfig);
		this.strongholdHirelingService = new StrongholdHirelingService();
		this.eventTableService = new EventTableService();

		// Start template watching if stronghold features are enabled
		if (settings.enableStrongholdFeatures) {
			this.templateWatcher.startWatching({
				facilities: settings.facilitiesConfigFolder || 'config/facilities',
				orders: settings.ordersConfigFolder || 'config/orders',
				eventTables: settings.eventTablesFolder || 'config/event-tables'
			});
		}

		// Initialize config system with injected adapter
		this.configService = new ConfigService(this.configAdapter, this.settingsAdapter);

		// Initialize renown config service
		// Note: loadRenownLadders is Obsidian-specific, not yet in IConfigAdapter interface
		this.renownConfigService = new RenownConfigService(
			async () => await (this.configAdapter as any).loadRenownLadders?.() || {}
		);

		// Initialize calendar system (plugin required)
		if (plugin) {
			// Note: Calendar system initialization requires ObsidianConfigAdapter methods
			this.initializeCalendarSystem(this.configAdapter as any);

			// Initialize project system (plugin required)
			this.initializeProjectSystem();

			// Initialize activity log handler
			const logPath = settings.activityLogPath || 'activity-log.md';
			this.activityLogHandlerInstance = new ObsidianActivityLogHandler(app, logPath);

			// Initialize activity log service with campaign context
			this.activityLogService = new ActivityLogService(this, this.campaignContext);

			// Pass activity log service to stronghold services
			this.orderService.setActivityLogService(this.activityLogService);
		}
	}

	/**
	 * Initialize calendar system services
	 * Only called when plugin is available
	 */
	private initializeCalendarSystem(configAdapter: ObsidianConfigAdapter): void {
		if (!this.plugin) return;

		// Create EventBus (central event dispatcher)
		this.eventBus = new EventBus();

		// Create DateFormatter (stateless utility)
		this.dateFormatter = new DateFormatter();

		// Create CalendarDefinitionManager
		this.calendarDefinitionManager = new CalendarDefinitionManager(configAdapter);

		// Create CalendarStateAdapter
		const calendarStateAdapter = new ObsidianCalendarStateAdapter(this.settingsAdapter);

		// Create CalendarService (requires async initialization)
		this.calendarService = new CalendarService(
			this.eventBus,
			this.calendarDefinitionManager,
			this.dateFormatter,
			calendarStateAdapter
		);

		// Create EventNotifier (event listener)
		// Uses eventBus, calendarDefinitionManager, dateFormatter
		// Notification callback will be set when UI is ready
		this.eventNotifier = new EventNotifier(
			this.eventBus,
			this.calendarDefinitionManager,
			this.dateFormatter,
			(title: string, message: string) => {
				// Default notification callback (can be overridden by UI)
				console.log(`[EventNotifier] ${title}: ${message}`);
			}
		);

		// Create UpkeepManager (passive service, NOT event listener)
		this.upkeepManager = new UpkeepManager(
			async (items, costInCopper) => {
				await this.updatePartyInventory(items, costInCopper);
			},
			async (items, cost, source, context) => {
				await this.logTransaction(items, cost, source, context);
			},
			this.currencyConfig
		);
	}

	/**
	 * Initialize project system services
	 * Only called when plugin is available
	 */
	private initializeProjectSystem(): void {
		if (!this.plugin) return;

		// Create project adapters
		const settings = this.settingsAdapter.getSettings();
		const projectPath = settings.projectInstancesPath || 'projects';
		this.projectConfigAdapter = new ObsidianProjectConfigAdapter(this.app);
		this.projectStateAdapter = new ObsidianProjectStateAdapter(this.app, projectPath);

		// Create project services with UUID generators
		// Access UUIDRegistry through plugin instance
		const uuidRegistry = this.plugin ? (this.plugin as any).uuidRegistry : null;
		this.projectTemplateService = new ProjectTemplateService(
			this.projectConfigAdapter,
			uuidRegistry ? () => uuidRegistry.generateProjectTemplateId() : undefined
		);
		this.projectInstanceService = new ProjectInstanceService(
			this.projectStateAdapter,
			uuidRegistry ? () => uuidRegistry.generateProjectInstanceId() : undefined,
			this.activityLogService
		);
		this.projectProgressService = new ProjectProgressService();

		// Create outcome processor with dependency injection
		this.projectOutcomeProcessor = new ProjectOutcomeProcessor(
			// Inventory updater callback
			async (items, fundsInCopper) => {
				await this.updatePartyInventory(items, fundsInCopper);
			},
			// Note creator callback
			async (title, content) => {
				// Create note in vault (default to projects folder)
				const notePath = `${projectPath}/${title}.md`;
				try {
					await this.app.vault.create(notePath, content);
				} catch (error) {
					console.error(`Failed to create information note: ${error}`);
				}
			},
			// Notifier callback
			(message, title) => {
				console.log(`[ProjectOutcome] ${title || 'Project'}: ${message}`);
			},
			// Currency configuration
			this.currencyConfig
		);

		// Create project progress listener (requires eventBus)
		if (this.eventBus) {
			this.projectProgressListener = new ProjectProgressListener(
				this.eventBus,
				this.projectInstanceService,
				this.projectProgressService,
				this.projectOutcomeProcessor,
				this.currencyConfig,
				this.activityLogService,
				(message, title) => {
					console.log(`[ProjectProgress] ${title || 'Project'}: ${message}`);
				}
			);

			console.log('[ObsidianDataAdapter] Project system initialized');
		} else {
			console.warn('[ObsidianDataAdapter] EventBus not available, project progress listener not initialized');
		}
	}

	/**
	 * Async initialization for calendar services
	 * Must be called after constructor, before using calendar features
	 */
	async initializeCalendar(): Promise<void> {
		if (this.calendarService && this.calendarDefinitionManager) {
			// Load calendar definitions
			await this.calendarDefinitionManager.loadDefinitions();

			// Initialize calendar service (loads state)
			await this.calendarService.initialize();

			// Enable event notifier
			if (this.eventNotifier) {
				this.eventNotifier.enable();
			}
		}
	}

	/**
	 * Initialize renown configuration system
	 * Loads rank ladders from renownLadders.yaml
	 */
	async initializeRenownConfig(): Promise<void> {
		if (this.renownConfigService) {
			await this.renownConfigService.loadConfig();
		}
	}

	/**
	 * Initialize currency configuration system
	 * Loads currency configuration from currencies.yaml if available
	 * Falls back to D&D 5e default if loading fails
	 *
	 * Should be called after plugin initialization to load custom currency systems
	 * If not called, the adapter will use D&D 5e default currency configuration
	 */
	async initializeCurrencyConfig(): Promise<void> {
		if (!this.plugin) {
			console.warn('[ObsidianDataAdapter] Plugin not available, using default currency config');
			return;
		}

		try {
			const loader = new ConfigLoader(this.app, this.plugin);
			this.currencyConfig = await loader.loadCurrencyConfig();
			console.log(
				'[ObsidianDataAdapter] Loaded currency config:',
				this.currencyConfig.systems[this.currencyConfig.defaultSystem].name
			);
		} catch (error) {
			console.warn(
				'[ObsidianDataAdapter] Failed to load currency config, using D&D 5e default:',
				error
			);
			this.currencyConfig = getDefaultCurrencyConfig();
		}
	}

	/**
	 * Get the active currency configuration
	 * Returns the loaded currency config or D&D 5e default if loading failed
	 *
	 * @returns CurrencyConfig with all currency systems and default system
	 */
	getCurrencyConfig(): CurrencyConfig {
		return this.currencyConfig;
	}

	/**
	 * Async initialization for project services
	 * Must be called after constructor, before using project features
	 */
	async initializeProjects(): Promise<void> {
		if (this.projectTemplateService && this.projectInstanceService) {
			// Load templates
			await this.projectTemplateService.loadTemplates();

			// Load instances
			await this.projectInstanceService.loadInstances();

			// Enable project progress listener
			if (this.projectProgressListener) {
				this.projectProgressListener.enable();
			}

			console.log('[ObsidianDataAdapter] Project services loaded and enabled');
		}
	}

	// Shop operations
	async getShop(path: string): Promise<Shop> {
		const shop = await this.shopHandler.getShop(path);

		// Resolve NPC shopkeeper (UUID first, wikilink fallback)
		if (shop.shopkeepNpcId) {
			// Try UUID first (most reliable)
			try {
				const npc = await this.getNPCById(shop.shopkeepNpcId);
				if (npc) {
					shop.shopkeepData = npc;
				}
			} catch (error) {
				console.warn(`Failed to resolve NPC by UUID ${shop.shopkeepNpcId}:`, error);
			}
		}

		// Fallback to wikilink resolution (for manual edits)
		if (!shop.shopkeepData && shop.shopkeepNPC) {
			try {
				const npc = await this.getNPCByLink(shop.shopkeepNPC);
				if (npc) {
					shop.shopkeepData = npc;
					// Sync UUID for next time (auto-maintenance)
					shop.shopkeepNpcId = npc.npcId;
				}
			} catch (error) {
				console.warn(`Failed to resolve NPC by wikilink ${shop.shopkeepNPC}:`, error);
			}
		}

		// Re-resolve variant families for variant items in both base and special stock
		// (availableVariants are not saved to reduce file size)
		const allItems = await this.getAvailableItems();

		const resolveVariants = async (items: ShopItem[]) => {
			for (const item of items) {
				// Check if this is a variant item that needs variant family resolution
				if (item.isVariant && item.baseItemName && item.selectedVariantIndex !== undefined) {
					// Find the parent variant item
					const parent = allItems.find(i =>
						i.isVariant &&
						i.variantAliases &&
						i.variantAliases.some(alias => alias === item.name)
					);

					if (parent) {
						// Resolve all variants
						item.availableVariants = await this.itemHandler.getVariantFamily(parent);

						// Ensure selectedVariantIndex is valid
						if (item.selectedVariantIndex >= item.availableVariants.length) {
							item.selectedVariantIndex = 0;
						}
					}
				}
			}
		};

		await resolveVariants(shop.baseStock);
		await resolveVariants(shop.specialStock);

		// Legacy support: if inventory field exists, resolve variants there too
		if (shop.inventory) {
			await resolveVariants(shop.inventory);
		}

		return shop;
	}

	async saveShop(shop: Shop, path: string): Promise<void> {
		await this.shopHandler.saveShop(shop, path);
	}

	async updateShop(path: string, updates: Partial<Shop>): Promise<void> {
		await this.shopHandler.updateShop(path, updates);
	}

	async listShops(): Promise<string[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.shopHandler.listShops(settings.shopsFolder);
	}

	/**
	 * Get all shops in the campaign
	 * Required by PorterService for campaign export
	 */
	async getAllShops(): Promise<Shop[]> {
		const shopPaths = await this.listShops();
		const shops: Shop[] = [];

		for (const path of shopPaths) {
			try {
				const shop = await this.getShop(path);
				shops.push(shop);
			} catch (error) {
				console.warn(`[ObsidianDataAdapter] Failed to load shop ${path}:`, error);
				// Continue loading other shops
			}
		}

		return shops;
	}

	/**
	 * Get shop by UUID.
	 * Delegates to ShopFileHandler for UUID-based lookup.
	 * @param id Shop UUID
	 * @returns Shop if found, null otherwise
	 */
	async getShopById(id: string): Promise<Shop | null> {
		return this.shopHandler.getShopById(id);
	}

	// Party operations
	async getPartyInventory(): Promise<PartyInventory> {
		return this.inventoryHandler.getPartyInventory();
	}

	async updatePartyInventory(items: PurchasedItem[], costInCopper: number): Promise<void> {
		await this.inventoryHandler.updatePartyInventory(items, costInCopper);
	}

	/**
	 * Add items to party inventory without deducting cost (for rewards)
	 *
	 * @param items - Items to add to party inventory
	 */
	async addItemsToPartyInventory(items: PurchasedItem[]): Promise<void> {
		// Use updatePartyInventory with 0 cost to add items without deducting funds
		await this.inventoryHandler.updatePartyInventory(items, 0);
	}

	// Transaction log
	async logTransaction(
		items: PurchasedItem[],
		cost: ItemCost,
		source: string,
		context?: TransactionContext,
		shopId?: string,
		npcId?: string
	): Promise<void> {
		// Enrich context with calendar date if calendar system is initialized
		let enrichedContext = context;
		if (this.calendarService) {
			try {
				const currentDay = this.calendarService.getCurrentDay();
				const currentDate = this.calendarService.getCurrentDate();

				enrichedContext = {
					...context,
					calendarDay: currentDay,
					formattedDate: currentDate.formatted
				};
			} catch (error) {
				// Calendar not initialized yet - continue without date
				console.warn('[ObsidianDataAdapter] Calendar not initialized, logging transaction without calendar date');
			}
		}

		// Log to old transaction log (backward compatibility)
		await this.transactionHandler.logTransaction(items, cost, source, enrichedContext, shopId, npcId);

		// Also log to new activity log system
		if (this.activityLogService) {
			const transactionType = enrichedContext?.transactionType === 'sale' ? 'sale' : 'purchase';
			// Get player name from first item (if any items are assigned to a player)
			const playerName = items.find(item => item.purchasedBy)?.purchasedBy;

			await this.activityLogService.logShopTransaction({
				transactionType,
				shopName: source,
				shopId: shopId,
				items: items.map(item => ({
					itemName: item.name,
					itemId: item.file?.path,
					quantity: item.quantity || 1,
					unitCost: typeof item.cost === 'string' ? item.cost : String(item.cost),
					totalCost: typeof item.totalCost === 'string' ? item.totalCost : String(item.totalCost)
				})),
				totalCost: typeof cost === 'string' ? cost : String(cost),
				playerName: playerName,
				gameDate: enrichedContext?.formattedDate
			});
		}
	}

	/**
	 * Get all transaction records in the campaign
	 * Required by PorterService for campaign export
	 */
	async getAllTransactions(): Promise<Transaction[]> {
		return await this.transactionHandler.getAllTransactions();
	}

	// Item vault
	async getAvailableItems(): Promise<Item[]> {
		return this.itemHandler.getAvailableItems();
	}

	async indexSources(): Promise<string[]> {
		return this.itemHandler.indexSources();
	}

	/**
	 * Get item by UUID.
	 * Delegates to ItemVaultHandler for UUID-based lookup.
	 * @param id Item UUID
	 * @returns Item if found, null otherwise
	 */
	async getItemById(id: string): Promise<Item | null> {
		return this.itemHandler.getItemById(id);
	}

	// Configuration (now using ConfigService)
	async getShopConfig(type: string, wealthLevel: string): Promise<ShopGenerationConfig> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		return await this.configService.getShopConfigWithTemplate(type, wealthLevel);
	}

	async getBaseShopConfig(type: string, wealthLevel: string): Promise<ShopGenerationConfig> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		return await this.configService.getShopConfig(type, wealthLevel);
	}

	async getServices(shopType: string): Promise<Service[]> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		return await this.configService.getServices(shopType);
	}

	async getBaseStockConfig(): Promise<any> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		return await this.configService.getBaseStockConfig();
	}

	async getFactions(): Promise<Faction[]> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		return await this.configService.getFactions();
	}

	async getLootTables(): Promise<LootTable[]> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		return await this.configService.getLootTables();
	}

	// Custom Templates (UI layer methods)
	async getAllCustomTemplates(): Promise<any> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		return await this.configService.getAllCustomTemplates();
	}

	async getCustomTemplate(shopType: string, wealthLevel: string): Promise<any> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		return await this.configService.getCustomTemplate(shopType, wealthLevel);
	}

	async saveCustomTemplate(shopType: string, wealthLevel: string, template: any): Promise<void> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		await this.configService.saveCustomTemplate(shopType, wealthLevel, template);
	}

	async deleteCustomTemplate(shopType: string, wealthLevel: string): Promise<void> {
		if (!this.configService) {
			throw new Error('ConfigService not initialized - plugin required');
		}
		await this.configService.deleteCustomTemplate(shopType, wealthLevel);
	}

	// Settings (now using SettingsAdapter)
	async getSettings(): Promise<RPGShopkeepSettings> {
		return this.settingsAdapter.getSettings();
	}

	async saveSettings(settings: RPGShopkeepSettings): Promise<void> {
		await this.settingsAdapter.saveSettings(settings);
	}

	// Party Inventory
	async getPartyInventoryItems(): Promise<PartyInventoryItem[]> {
		const settings = this.settingsAdapter.getSettings();
		return await this.inventoryReader.getInventoryItems(settings.partyInventoryFile);
	}

	/**
	 * Manually rebuild the item cache
	 * Exposes ItemVaultHandler.rebuildCache() to UI layer
	 */
	async rebuildItemCache(): Promise<number> {
		return await this.itemHandler.rebuildCache();
	}

	/**
	 * Get current cache status and diagnostics
	 * Exposes ItemVaultHandler.getItemCacheInfo() to UI layer
	 */
	getCacheInfo(): {
		cached: boolean;
		itemCount: number;
		ageMs: number;
		diagnostics?: any;
	} {
		return this.itemHandler.getItemCacheInfo();
	}

	// Calendar system methods

	/**
	 * Get current day counter
	 */
	getCurrentDay(): number {
		if (!this.calendarService) {
			throw new Error('Calendar system not initialized - plugin required');
		}
		return this.calendarService.getCurrentDay();
	}

	/**
	 * Get current formatted date
	 */
	getCurrentDate(): FormattedDate {
		if (!this.calendarService) {
			throw new Error('Calendar system not initialized - plugin required');
		}
		return this.calendarService.getCurrentDate();
	}

	/**
	 * Advance time by specified number of days
	 * Emits TimeAdvanced event to EventBus
	 */
	async advanceTime(days: number): Promise<void> {
		if (!this.calendarService) {
			throw new Error('Calendar system not initialized - plugin required');
		}
		await this.calendarService.advanceTime(days);
	}

	/**
	 * Get CalendarService for direct access
	 * UI components can use this for advanced calendar operations
	 */
	getCalendarService(): CalendarService {
		if (!this.calendarService) {
			throw new Error('Calendar system not initialized - plugin required');
		}
		return this.calendarService;
	}

	/**
	 * Get UpkeepManager for upkeep cost calculations
	 * This is a passive service (NOT event listener)
	 * UI calls this to calculate and apply upkeep costs
	 */
	getUpkeepManager(): UpkeepManager {
		if (!this.upkeepManager) {
			throw new Error('Upkeep manager not initialized - plugin required');
		}
		return this.upkeepManager;
	}

	/**
	 * Get EventNotifier for event/holiday notifications
	 * Can be used to set custom notification callback
	 */
	getEventNotifier(): EventNotifier {
		if (!this.eventNotifier) {
			throw new Error('Event notifier not initialized - plugin required');
		}
		return this.eventNotifier;
	}

	/**
	 * Get EventBus for subscribing to custom events
	 * Advanced usage - UI can subscribe to calendar events
	 */
	getEventBus(): EventBus {
		if (!this.eventBus) {
			throw new Error('EventBus not initialized - plugin required');
		}
		return this.eventBus;
	}

	getRenownConfigService(): RenownConfigService {
		if (!this.renownConfigService) {
			throw new Error('RenownConfigService not initialized - plugin required');
		}
		return this.renownConfigService;
	}

	/**
	 * Get activity log handler for querying and managing activity logs
	 */
	get activityLogHandler(): ObsidianActivityLogHandler | undefined {
		return this.activityLogHandlerInstance;
	}

	/**
	 * Get all resolved variants for a parent variant item
	 * @param parentItem The variant parent item
	 * @returns Array of resolved variant items with calculated costs
	 */
	async getVariantFamily(parentItem: Item): Promise<Item[]> {
		return this.itemHandler.getVariantFamily(parentItem);
	}

	// ===== NPC Methods =====

	/**
	 * Get an NPC by file path
	 */
	async getNPC(path: string): Promise<NPCProfile> {
		const npc = await this.npcHandler.getNPC(path);
		this.npcRegistry.register(npc, path);

		// Resolve NPC relationships (UUID first, wikilink fallback)
		if (npc.relationships && npc.relationships.length > 0) {
			for (const rel of npc.relationships) {
				// Try UUID first (most reliable)
				if (rel.targetNpcId) {
					try {
						rel.resolvedNpc = await this.getNPCById(rel.targetNpcId);
					} catch (error) {
						console.warn(`Failed to resolve relationship by UUID ${rel.targetNpcId}:`, error);
					}
				}

				// Fallback to wikilink (for manual edits)
				if (!rel.resolvedNpc && rel.npcLink) {
					try {
						rel.resolvedNpc = await this.npcHandler.getNPCByLink(rel.npcLink);

						// Sync UUID if resolution successful (auto-maintenance)
						if (rel.resolvedNpc) {
							rel.targetNpcId = rel.resolvedNpc.npcId;
						}
					} catch (error) {
						console.warn(`Failed to resolve relationship by wikilink ${rel.npcLink}:`, error);
					}
				}
			}
		}

		return npc;
	}

	/**
	 * Get an NPC by wikilink reference (e.g., "[[NPC Name]]")
	 */
	async getNPCByLink(link: string): Promise<NPCProfile | null> {
		const npc = await this.npcHandler.getNPCByLink(link);
		if (npc) {
			this.npcRegistry.register(npc);
		}
		return npc;
	}

	/**
	 * Get NPC by UUID.
	 * Delegates to NPCFileHandler for UUID-based lookup.
	 * @param npcId UUID in format "npc-abc123..."
	 * @returns NPCProfile if found, null otherwise
	 */
	async getNPCById(npcId: string): Promise<NPCProfile | null> {
		const settings = this.settingsAdapter.getSettings();
		const npc = await this.npcHandler.getNPCById(npcId, settings.npcsFolder);
		if (npc) {
			this.npcRegistry.register(npc);
		}
		return npc;
	}

	/**
	 * Save a new NPC to the vault
	 */
	async saveNPC(npc: NPCProfile): Promise<string> {
		const settings = this.settingsAdapter.getSettings();
		const path = await this.npcHandler.saveNPC(npc, settings.npcsFolder);
		this.npcRegistry.register(npc, path);
		return path;
	}

	/**
	 * Update an existing NPC file
	 */
	async updateNPC(path: string, updates: Partial<NPCProfile>): Promise<void> {
		await this.npcHandler.updateNPC(path, updates);

		// Update registry cache
		const updatedNPC = await this.npcHandler.getNPC(path);
		this.npcRegistry.register(updatedNPC, path);
	}

	/**
	 * List all NPC files in the NPCs folder
	 */
	async listNPCs(): Promise<string[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.npcHandler.listNPCs(settings.npcsFolder);
	}

	/**
	 * Get all NPCs with a specific role
	 */
	async getNPCsByRole(role: NPCRole): Promise<NPCProfile[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.npcHandler.getNPCsByRole(settings.npcsFolder, role);
	}

	/**
	 * Find NPC file path by name
	 */
	async findNPCPath(name: string): Promise<string | null> {
		const settings = this.settingsAdapter.getSettings();
		return this.npcHandler.findNPCPath(name, settings.npcsFolder);
	}

	/**
	 * Get the NPC registry for advanced queries
	 */
	getNPCRegistry(): NPCRegistry {
		return this.npcRegistry;
	}

	/**
	 * Preload all NPCs into registry cache
	 */
	async preloadNPCs(): Promise<void> {
		const paths = await this.listNPCs();
		for (const path of paths) {
			try {
				const npc = await this.npcHandler.getNPC(path);
				this.npcRegistry.register(npc, path);
			} catch (error) {
				console.error(`Failed to preload NPC at ${path}:`, error);
			}
		}
	}

	// ===== Hireling Methods =====

	/**
	 * Load all hirelings from the tracking file
	 */
	async loadHirelings(): Promise<HirelingEmployment[]> {
		const settings = this.settingsAdapter.getSettings();
		const hirelings = await this.hirelingHandler.loadHirelings(settings.hirelingsFolder);

		// Resolve NPC links for each hireling
		for (const hireling of hirelings) {
			if (hireling.npc) {
				try {
					const npc = await this.getNPCByLink(hireling.npc);
					if (npc) {
						hireling.npcData = npc;
					}
				} catch (error) {
					console.warn(`Failed to load NPC for hireling ${hireling.hirelingId}:`, error);
				}
			}
		}

		return hirelings;
	}

	/**
	 * Save all hirelings to the tracking file
	 */
	async saveHirelings(hirelings: HirelingEmployment[]): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		await this.hirelingHandler.saveHirelings(hirelings, settings.hirelingsFolder);
	}

	/**
	 * Add a new hireling to the tracking file
	 */
	async addHireling(hireling: HirelingEmployment): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		await this.hirelingHandler.addHireling(hireling, settings.hirelingsFolder);
	}

	/**
	 * Update an existing hireling in the tracking file
	 */
	async updateHireling(hirelingId: string, updates: Partial<HirelingEmployment>): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		await this.hirelingHandler.updateHireling(hirelingId, updates, settings.hirelingsFolder);
	}

	/**
	 * Remove a hireling from the tracking file
	 */
	async removeHireling(hirelingId: string): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		await this.hirelingHandler.removeHireling(hirelingId, settings.hirelingsFolder);
	}

	/**
	 * Get a specific hireling by ID
	 */
	async getHireling(hirelingId: string): Promise<HirelingEmployment | null> {
		const settings = this.settingsAdapter.getSettings();
		const hireling = await this.hirelingHandler.getHireling(hirelingId, settings.hirelingsFolder);

		// Resolve NPC link
		if (hireling && hireling.npc) {
			try {
				const npc = await this.getNPCByLink(hireling.npc);
				if (npc) {
					hireling.npcData = npc;
				}
			} catch (error) {
				console.warn(`Failed to load NPC for hireling ${hirelingId}:`, error);
			}
		}

		return hireling;
	}

	/**
	 * Get all active hirelings
	 */
	async getActiveHirelings(): Promise<HirelingEmployment[]> {
		const settings = this.settingsAdapter.getSettings();
		const hirelings = await this.hirelingHandler.getActiveHirelings(settings.hirelingsFolder);

		// Resolve NPC links for active hirelings
		for (const hireling of hirelings) {
			if (hireling.npc) {
				try {
					const npc = await this.getNPCByLink(hireling.npc);
					if (npc) {
						hireling.npcData = npc;
					}
				} catch (error) {
					console.warn(`Failed to load NPC for hireling ${hireling.hirelingId}:`, error);
				}
			}
		}

		return hirelings;
	}

	/**
	 * Process payment for a hireling
	 * Updates loyalty and morale based on payment timing
	 */
	async processHirelingPayment(hirelingId: string, currentDate?: string): Promise<{
		hireling: HirelingEmployment;
		amountPaid: Currency;
		loyaltyChange: number;
	}> {
		const hireling = await this.getHireling(hirelingId);
		if (!hireling) {
			throw new Error(`Hireling ${hirelingId} not found`);
		}

		// Process payment via HirelingManager
		const result = this.hirelingManager.processPayment(hireling, currentDate);

		// Save updated hireling data
		await this.updateHireling(hirelingId, result.hireling);

		return result;
	}

	/**
	 * Get all hirelings that need payment today
	 */
	async getHirelingsDuePayment(currentDate?: string): Promise<HirelingEmployment[]> {
		const hirelings = await this.getActiveHirelings();
		return this.hirelingManager.getHirelingsDuePayment(hirelings, currentDate);
	}

	/**
	 * Calculate total weekly cost for all active hirelings
	 */
	async calculateHirelingsWeeklyCost(): Promise<Currency> {
		const hirelings = await this.getActiveHirelings();
		return this.hirelingManager.calculateWeeklyCost(hirelings);
	}

	/**
	 * Create a new hireling employment record
	 */
	createHirelingRecord(
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
	): HirelingEmployment {
		return this.hirelingManager.createHirelingRecord(npcLink, type, employer, options);
	}

	/**
	 * Get default wages for a hireling type
	 */
	getDefaultHirelingWages(type: HirelingType, schedule: PaymentSchedule): Currency {
		return this.hirelingManager.getDefaultWages(type, schedule);
	}

	// ===== Location Methods =====

	/**
	 * Get a location by file path
	 */
	async getLocation(path: string): Promise<Location> {
		return this.locationHandler.getLocation(path);
	}

	/**
	 * Save a new location to the vault
	 */
	async saveLocation(location: Location): Promise<string> {
		const settings = this.settingsAdapter.getSettings();
		return this.locationHandler.saveLocation(location, settings.locationsFolder);
	}

	/**
	 * Update an existing location file
	 */
	async updateLocation(path: string, updates: Partial<Location>): Promise<void> {
		await this.locationHandler.updateLocation(path, updates);
	}

	/**
	 * List all location files
	 */
	async listLocations(): Promise<string[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.locationHandler.listLocations(settings.locationsFolder);
	}

	/**
	 * Find location file path by name
	 */
	async findLocationPath(name: string): Promise<string | null> {
		const settings = this.settingsAdapter.getSettings();
		return this.locationHandler.findLocationPath(name, settings.locationsFolder);
	}

	/**
	 * Scan vault for NPCs residing at this location
	 */
	async scanLocationResidents(locationName: string): Promise<ResidentEntry[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.locationHandler.scanLocationResidents(locationName, settings.npcsFolder);
	}

	/**
	 * Scan vault for shops at this location
	 */
	async scanLocationBusinesses(locationName: string): Promise<BusinessEntry[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.locationHandler.scanLocationBusinesses(locationName, settings.shopsFolder);
	}

	/**
	 * Scan vault for factions present at this location
	 */
	async scanLocationFactions(locationName: string): Promise<FactionPresenceEntry[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.locationHandler.scanLocationFactions(locationName, settings.factionsFolder);
	}

	// ===== Faction Methods =====

	/**
	 * Get a faction by file path
	 */
	async getFaction(path: string): Promise<FactionEntity> {
		return this.factionHandler.getFaction(path);
	}

	/**
	 * Save a new faction to the vault
	 */
	async saveFaction(faction: FactionEntity): Promise<string> {
		const settings = this.settingsAdapter.getSettings();
		return this.factionHandler.saveFaction(faction, settings.factionsFolder);
	}

	/**
	 * Update an existing faction file
	 */
	async updateFaction(path: string, updates: Partial<FactionEntity>): Promise<void> {
		await this.factionHandler.updateFaction(path, updates);
	}

	/**
	 * List all faction files
	 */
	async listFactionFiles(): Promise<string[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.factionHandler.listFactions(settings.factionsFolder);
	}

	/**
	 * Find faction file path by name
	 */
	async findFactionPath(name: string): Promise<string | null> {
		const settings = this.settingsAdapter.getSettings();
		return this.factionHandler.findFactionPath(name, settings.factionsFolder);
	}

	/**
	 * Scan vault for NPCs in this faction's roster
	 */
	async scanFactionRoster(factionName: string): Promise<RosterEntry[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.factionHandler.scanFactionRoster(factionName, settings.npcsFolder);
	}

	/**
	 * Scan vault for locations where this faction is present
	 */
	async scanFactionPresence(factionName: string): Promise<PresenceEntry[]> {
		const settings = this.settingsAdapter.getSettings();
		return this.factionHandler.scanFactionPresence(factionName, settings.locationsFolder);
	}

	// ===== Renown Methods =====

	/**
	 * Log a renown change to the activity log
	 */
	async logRenownChange(entry: RenownHistoryEntry): Promise<void> {
		await this.transactionHandler.logRenownChange(entry);
	}

	// ===== Stronghold Methods =====

	/**
	 * Get stronghold services (for UI layer)
	 */
	getStrongholdServices() {
		return {
			strongholdService: this.strongholdService,
			facilityService: this.facilityService,
			orderService: this.orderService,
			strongholdHirelingService: this.strongholdHirelingService,
			eventTableService: this.eventTableService
		};
	}

	/**
	 * Load a stronghold from file
	 */
	async loadStronghold(filePath: string): Promise<Stronghold | null> {
		return this.strongholdHandler.loadStronghold(filePath);
	}

	/**
	 * Save a stronghold to file
	 */
	async saveStronghold(stronghold: Stronghold): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.strongholdsFolder || 'Strongholds';
		await this.strongholdHandler.saveStronghold(stronghold, folder);
	}

	/**
	 * List all stronghold files
	 */
	async listStrongholds(): Promise<string[]> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.strongholdsFolder || 'Strongholds';
		return this.strongholdHandler.listStrongholds(folder);
	}

	/**
	 * Delete a stronghold file
	 */
	async deleteStronghold(filePath: string): Promise<void> {
		await this.strongholdHandler.deleteStronghold(filePath);
	}

	/**
	 * Load facility templates
	 */
	async loadFacilityTemplates(): Promise<FacilityTemplate[]> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.facilitiesConfigFolder || 'config/facilities';
		const templates = await this.facilityHandler.loadFacilityTemplates(folder);
		this.facilityService.loadTemplates(templates);
		return templates;
	}

	/**
	 * Save facility template
	 */
	async saveFacilityTemplate(template: FacilityTemplate): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.facilitiesConfigFolder || 'config/facilities';
		await this.facilityHandler.saveFacilityTemplate(template, folder);
		this.facilityService.addTemplate(template);
	}

	/**
	 * Load custom orders
	 */
	async loadCustomOrders(): Promise<CustomOrder[]> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.ordersConfigFolder || 'config/orders';
		const orders = await this.orderHandler.loadCustomOrders(folder);
		this.orderService.loadOrders(orders);
		return orders;
	}

	/**
	 * Save custom order
	 */
	async saveCustomOrder(order: CustomOrder): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.ordersConfigFolder || 'config/orders';
		await this.orderHandler.saveCustomOrder(order, folder);
		this.orderService.addOrder(order);
	}

	/**
	 * Load event tables
	 */
	async loadEventTables(): Promise<CustomEventTable[]> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.eventTablesFolder || 'config/event-tables';
		const tables = await this.eventTableHandler.loadEventTables(folder);
		this.eventTableService.loadEventTables(tables);
		return tables;
	}

	/**
	 * Save event table
	 */
	async saveEventTable(table: CustomEventTable): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.eventTablesFolder || 'config/event-tables';
		await this.eventTableHandler.saveEventTable(table, folder);
		this.eventTableService.addTable(table);
	}

	/**
	 * Load stronghold hirelings
	 */
	async loadStrongholdHirelings(): Promise<StrongholdHireling[]> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.hirelingsFolder || 'Hirelings';
		return this.strongholdHirelingHandler.loadHirelings(folder);
	}

	/**
	 * Save stronghold hirelings
	 */
	async saveStrongholdHirelings(hirelings: StrongholdHireling[]): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.hirelingsFolder || 'Hirelings';
		await this.strongholdHirelingHandler.saveHirelings(hirelings, folder);
	}

	/**
	 * Add stronghold hireling
	 */
	async addStrongholdHireling(hireling: StrongholdHireling): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.hirelingsFolder || 'Hirelings';
		await this.strongholdHirelingHandler.addHireling(hireling, folder);
	}

	/**
	 * Update stronghold hireling
	 */
	async updateStrongholdHireling(hirelingId: string, updates: Partial<StrongholdHireling>): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.hirelingsFolder || 'Hirelings';
		await this.strongholdHirelingHandler.updateHireling(hirelingId, updates, folder);
	}

	/**
	 * Get stronghold hirelings for a specific stronghold
	 */
	async getHirelingsForStronghold(strongholdId: string): Promise<StrongholdHireling[]> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.hirelingsFolder || 'Hirelings';
		return this.strongholdHirelingHandler.getHirelingsForStronghold(strongholdId, folder);
	}

	/**
	 * Get unassigned stronghold hirelings
	 */
	async getUnassignedStrongholdHirelings(): Promise<StrongholdHireling[]> {
		const settings = this.settingsAdapter.getSettings();
		const folder = settings.hirelingsFolder || 'Hirelings';
		return this.strongholdHirelingHandler.getUnassignedHirelings(folder);
	}

	// ========================================
	// Project System Operations
	// ========================================

	/**
	 * Get project template service
	 * @returns ProjectTemplateService instance or null if not initialized
	 */
	getProjectTemplateService(): ProjectTemplateService | null {
		return this.projectTemplateService;
	}

	/**
	 * Get project instance service
	 * @returns ProjectInstanceService instance or null if not initialized
	 */
	getProjectInstanceService(): ProjectInstanceService | null {
		return this.projectInstanceService;
	}

	/**
	 * Get project progress service
	 * @returns ProjectProgressService instance or null if not initialized
	 */
	getProjectProgressService(): ProjectProgressService | null {
		return this.projectProgressService;
	}

	/**
	 * Get project outcome processor
	 * @returns ProjectOutcomeProcessor instance or null if not initialized
	 */
	getProjectOutcomeProcessor(): ProjectOutcomeProcessor | null {
		return this.projectOutcomeProcessor;
	}

	/**
	 * Get project progress listener
	 * @returns ProjectProgressListener instance or null if not initialized
	 */
	getProjectProgressListener(): ProjectProgressListener | null {
		return this.projectProgressListener;
	}

	/**
	 * Set notification callback for project system
	 * Allows UI to override default console.log notification behavior
	 *
	 * @param callback Notification callback function
	 */
	setProjectNotificationCallback(callback: (message: string, title?: string) => void): void {
		// Update outcome processor notification callback
		if (this.projectOutcomeProcessor) {
			(this.projectOutcomeProcessor as any).notifier = callback;
		}

		// Update progress listener notification callback
		if (this.projectProgressListener) {
			(this.projectProgressListener as any).notifyCallback = callback;
		}
	}

	// ========================================
	// Activity Log System Operations
	// ========================================

	/**
	 * Async initialization for activity log system
	 * Must be called after constructor, before using activity log features
	 */
	async initializeActivityLog(): Promise<void> {
		if (this.activityLogHandlerInstance) {
			await this.activityLogHandlerInstance.initialize();
			console.log('[ObsidianDataAdapter] Activity log system initialized');
		}
	}

	/**
	 * Log an activity event
	 * @param event - The activity event to log
	 */
	async logActivity(event: ActivityEvent): Promise<void> {
		if (!this.activityLogHandlerInstance) {
			throw new Error('Activity log handler not initialized');
		}
		await this.activityLogHandlerInstance.logActivity(event);
	}

	/**
	 * Get activity log events with optional filtering
	 * @param query - Query parameters for filtering and pagination
	 */
	async getActivityLog(query: ActivityLogQuery): Promise<ActivityLogResult> {
		if (!this.activityLogHandlerInstance) {
			return {
				events: [],
				total: 0,
				hasMore: false,
				offset: query.offset || 0,
				limit: query.limit || 50,
			};
		}
		return await this.activityLogHandlerInstance.getActivityLog(query);
	}

	/**
	 * Search activity log by text query
	 * @param campaignId - Campaign ID to search within
	 * @param searchText - Text to search for in event descriptions
	 * @param limit - Maximum number of results (default: 50)
	 * @param offset - Pagination offset (default: 0)
	 */
	async searchActivityLog(
		campaignId: string,
		searchText: string,
		limit = 50,
		offset = 0
	): Promise<ActivityLogResult> {
		if (!this.activityLogHandlerInstance) {
			return {
				events: [],
				total: 0,
				hasMore: false,
				offset,
				limit,
			};
		}
		return await this.activityLogHandlerInstance.searchActivityLog({
			campaignId,
			searchText,
			limit,
			offset,
		});
	}

	/**
	 * Get activity log events within a date range
	 * @param campaignId - Campaign ID to query
	 * @param startDate - Start timestamp (Unix milliseconds)
	 * @param endDate - End timestamp (Unix milliseconds)
	 * @param limit - Maximum number of results (default: 100)
	 * @param offset - Pagination offset (default: 0)
	 */
	async getActivityLogByDateRange(
		campaignId: string,
		startDate: number,
		endDate: number,
		limit = 100,
		offset = 0
	): Promise<ActivityLogResult> {
		if (!this.activityLogHandlerInstance) {
			return {
				events: [],
				total: 0,
				hasMore: false,
				offset,
				limit,
			};
		}
		return await this.activityLogHandlerInstance.getActivityLog({
			campaignId,
			startDate,
			endDate,
			limit,
			offset,
		});
	}

	/**
	 * Update notes on an existing activity event
	 */
	async updateActivityNotes(eventId: string, notes: string, timestamp: number): Promise<void> {
		if (!this.activityLogHandlerInstance) {
			console.warn('[ObsidianDataAdapter] Activity log handler not initialized');
			return;
		}
		await this.activityLogHandlerInstance.updateActivityNotes(eventId, notes, timestamp);
	}

	// ========================================
	// Party Member Operations
	// ========================================

	/**
	 * Get all party members
	 * @returns Array of party members
	 */
	async getPartyMembers(): Promise<PartyMember[]> {
		const settings = this.settingsAdapter.getSettings();
		const folderPath = settings.partyMembersFolder || 'Party Members';
		return await this.partyMemberHandler.getPartyMembers(folderPath);
	}

	/**
	 * Save a new party member
	 * @param member - Party member to save
	 */
	async savePartyMember(member: PartyMember): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folderPath = settings.partyMembersFolder || 'Party Members';

		// Timestamps are not part of PartyMember interface
		// They are handled by the file handler during save

		const path = await this.partyMemberHandler.savePartyMember(member, folderPath);

		// Update linkedFile to point to the created file
		await this.partyMemberHandler.updatePartyMember(path, { linkedFile: path });
	}

	/**
	 * Update an existing party member
	 * @param member - Updated party member data
	 */
	async updatePartyMember(member: PartyMember): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folderPath = settings.partyMembersFolder || 'Party Members';

		// Find the member's file by ID
		const path = await this.partyMemberHandler.findPartyMemberById(member.id, folderPath);
		if (!path) {
			throw new Error(`Party member not found: ${member.id}`);
		}

		// Update member (timestamps handled by file handler)
		await this.partyMemberHandler.updatePartyMember(path, member);
	}

	/**
	 * Delete a party member
	 * @param id - Party member UUID
	 */
	async deletePartyMember(id: string): Promise<void> {
		const settings = this.settingsAdapter.getSettings();
		const folderPath = settings.partyMembersFolder || 'Party Members';

		// Find the member's file by ID
		const path = await this.partyMemberHandler.findPartyMemberById(id, folderPath);
		if (!path) {
			throw new Error(`Party member not found: ${id}`);
		}

		await this.partyMemberHandler.deletePartyMember(path);
	}

	// ========================================
	// Container Operations (Inventory Management)
	// ========================================

	async getContainer(id: string): Promise<InventoryContainer | null> {
		const plugin = this.plugin as any;
		if (!plugin.pluginData?.containers) return null;
		return plugin.pluginData.containers.find((c: InventoryContainer) => c.id === id) || null;
	}

	async getAllContainers(): Promise<InventoryContainer[]> {
		const plugin = this.plugin as any;
		return plugin.pluginData?.containers || [];
	}

	async saveContainer(container: InventoryContainer): Promise<void> {
		const plugin = this.plugin as any;
		if (!plugin.pluginData) {
			plugin.pluginData = { containers: [], items: [], currency: {} };
		}

		// Add to data
		plugin.pluginData.containers.push(container);
		await plugin.saveData(plugin.pluginData);

		// Add to markdown
		await plugin.inventoryEditor.addContainerBlock(container);
	}

	async updateContainer(container: InventoryContainer): Promise<void> {
		const plugin = this.plugin as any;
		if (!plugin.pluginData?.containers) return;

		// Update in data
		const index = plugin.pluginData.containers.findIndex((c: InventoryContainer) => c.id === container.id);
		if (index !== -1) {
			plugin.pluginData.containers[index] = container;
			await plugin.saveData(plugin.pluginData);
		}

		// Note: Markdown updates handled by parser on next file change
	}

	async deleteContainer(id: string): Promise<void> {
		const plugin = this.plugin as any;
		if (!plugin.pluginData?.containers) return;

		// Remove from data
		plugin.pluginData.containers = plugin.pluginData.containers.filter((c: InventoryContainer) => c.id !== id);

		// Remove associated items
		if (plugin.pluginData.items) {
			plugin.pluginData.items = plugin.pluginData.items.filter((item: InventoryItem) => item.containerId !== id);
		}

		await plugin.saveData(plugin.pluginData);

		// Note: Markdown container block removal would need separate implementation
		// For now, let parser handle it on next file change
	}

	async getInventoryItem(id: string): Promise<InventoryItem | null> {
		const plugin = this.plugin as any;
		if (!plugin.pluginData?.items) return null;
		return plugin.pluginData.items.find((item: InventoryItem) => item.id === id) || null;
	}

	async getAllInventoryItems(): Promise<InventoryItem[]> {
		const plugin = this.plugin as any;
		return plugin.pluginData?.items || [];
	}

	async saveInventoryItem(item: InventoryItem): Promise<void> {
		const plugin = this.plugin as any;
		if (!plugin.pluginData) {
			plugin.pluginData = { containers: [], items: [], currency: {} };
		}

		// Add to data
		plugin.pluginData.items.push(item);
		await plugin.saveData(plugin.pluginData);

		// Add to markdown
		await plugin.inventoryEditor.addItem(item.containerId, item);
	}

	async updateInventoryItem(item: InventoryItem): Promise<void> {
		const plugin = this.plugin as any;
		if (!plugin.pluginData?.items) return;

		// Update in data
		const index = plugin.pluginData.items.findIndex((i: InventoryItem) => i.id === item.id);
		if (index !== -1) {
			plugin.pluginData.items[index] = item;
			await plugin.saveData(plugin.pluginData);
		}
	}

	async deleteInventoryItem(id: string): Promise<void> {
		const plugin = this.plugin as any;
		if (!plugin.pluginData?.items) return;

		// Find item to get its details before deletion
		const item = plugin.pluginData.items.find((i: InventoryItem) => i.id === id);
		if (!item) return;

		// Remove from data
		plugin.pluginData.items = plugin.pluginData.items.filter((i: InventoryItem) => i.id !== id);
		await plugin.saveData(plugin.pluginData);

		// Remove from markdown
		await plugin.inventoryEditor.removeItem(item.containerId, item.itemId);
	}

	async getEncumbrance(partyMemberId?: string): Promise<any> {
		// TODO: Implement encumbrance calculation using core calculators
		// For now, return placeholder
		return {
			totalWeight: 0,
			capacity: 0,
			level: 'normal',
			speedPenalty: 0
		};
	}

	async getItemsInContainer(containerId: string): Promise<InventoryItem[]> {
		const plugin = this.plugin as any;
		if (!plugin.pluginData?.items) return [];
		return plugin.pluginData.items.filter((item: InventoryItem) => item.containerId === containerId);
	}

	async getPlayerEncumbrance(playerId: string): Promise<any> {
		// TODO: Implement player-specific encumbrance calculation
		return this.getEncumbrance(playerId);
	}

	async savePlayerEncumbrance(encumbrance: any): Promise<void> {
		// Encumbrance is calculated, not stored - no-op
	}

	async getActivityLogEntries(filters?: any): Promise<any[]> {
		return [];
	}

	async saveActivityLogEntry(entry: any): Promise<void> {
		// No-op for Obsidian - activity logging happens through existing system
	}

	async getPartyInventoryV2(): Promise<any> {
		const plugin = this.plugin as any;
		return plugin.pluginData || { containers: [], items: [], currency: {} };
	}

	async savePartyInventoryV2(inventory: any): Promise<void> {
		const plugin = this.plugin as any;
		plugin.pluginData = inventory;
		await plugin.saveData(plugin.pluginData);
	}

	async saveInventoryActivity(activity: any): Promise<void> {
		// No-op for Obsidian - activity logging happens through existing system
	}

	async getInventoryActivity(filters?: any): Promise<any[]> {
		return [];
	}

	/**
	 * Teardown adapter resources for campaign switching
	 * Clears all caches and disposes of system resources
	 */
	async teardown(): Promise<void> {
		console.log('[ObsidianDataAdapter] Beginning teardown...');

		try {
			// Clear handler caches
			if (this.shopHandler) await (this.shopHandler as any)?.clearCache?.();
			if (this.itemHandler) await (this.itemHandler as any)?.clearCache?.();
			if (this.npcHandler) await (this.npcHandler as any)?.clearCache?.();
			if (this.hirelingHandler) await (this.hirelingHandler as any)?.clearCache?.();
			if (this.locationHandler) await (this.locationHandler as any)?.clearCache?.();
			if (this.factionHandler) await (this.factionHandler as any)?.clearCache?.();
			if (this.strongholdHandler) await (this.strongholdHandler as any)?.clearCache?.();
			if (this.facilityHandler) await (this.facilityHandler as any)?.clearCache?.();

			// Clear plugin data
			if (this.plugin && 'pluginData' in this.plugin) {
				const plugin = this.plugin as any; // Cast to access custom properties
				plugin.pluginData.containers = [];
				plugin.pluginData.items = [];
				plugin.pluginData.currency = {};
			}

			// Dispose calendar system
			if (this.calendarService) {
				await (this.calendarService as any)?.dispose?.();
			}

			// Dispose event notifier
			if (this.eventNotifier) {
				(this.eventNotifier as any)?.disable?.();
			}

			// Stop template watcher
			if (this.templateWatcher) {
				(this.templateWatcher as any)?.stopWatching?.();
			}

			// Dispose project progress listener
			if (this.projectProgressListener) {
				(this.projectProgressListener as any)?.disable?.();
			}

			// Dispose activity log
			if (this.activityLogHandlerInstance) {
				await (this.activityLogHandlerInstance as any)?.dispose?.();
			}

			console.log('[ObsidianDataAdapter] Teardown complete');
		} catch (error) {
			console.error('[ObsidianDataAdapter] Error during teardown:', error);
			// Don't throw - allow cleanup to continue
		}
	}

}
