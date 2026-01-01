// Quartermaster Plugin - Main Entry Point (UI Layer Only)
import { Plugin, App, Notice, addIcon } from 'obsidian';
import { RPGShopkeepSettings, DEFAULT_SETTINGS, PartyMember } from '@quartermaster/core/models/types';
import { ObsidianDataAdapter } from './adapters';
import { SimpleRandomizer } from '@quartermaster/core/utils/SimpleRandomizer';
import { IDataAdapter, IRandomizer } from '@quartermaster/core/interfaces';
import { EventBus } from '@quartermaster/core/services/EventBus';
import { ObsidianAdapterFactory } from './services/ObsidianAdapterFactory';
import { AdapterBundle } from '@quartermaster/core/interfaces/IAdapterFactory';

// Import adapters
import { JobFileHandler } from './adapters/JobFileHandler';
import { ObsidianGMNotifier } from './adapters/ObsidianGMNotifier';

// Import services
import { JobBoardManager } from '@quartermaster/core/services/JobBoardManager';
import { UUIDRegistry } from './services/UUIDRegistry';
import { InventoryMarkdownParser } from './parsers/InventoryMarkdownParser';
import { InventoryMarkdownEditor } from './editors/InventoryMarkdownEditor';
import { CurrencyManager } from '@quartermaster/core/services/CurrencyManager';

// Import modals (will be refactored in separate files)
import { ActionMenuModal } from './ui/ActionMenuModal';
import { ShopInterfaceModal } from './ui/ShopInterfaceModal';
import { RPGShopkeepSettingTab } from './ui/SettingsTab';
import { AdvanceTimeModal } from './ui/AdvanceTimeModal';
import { HireNPCModal } from './ui/HireNPCModal';
import { HirelingManagementModal } from './ui/HirelingManagementModal';
import { LocationModal } from './ui/LocationModal';
import { FactionModal } from './ui/FactionModal';
import { JobBoardModal } from './ui/JobBoardModal';
import { CreateJobModal } from './ui/CreateJobModal';
import { ExportPlayerJobBoardModal } from './ui/ExportPlayerJobBoardModal';
import { ProjectBrowserModal } from './ui/ProjectBrowserModal';
import { ProjectTemplateModal } from './ui/ProjectTemplateModal';
import { NewProjectModal } from './ui/NewProjectModal';
import { ActivityLogModal } from './ui/ActivityLogModal';
import { ManagePartyMembersModal } from './ui/ManagePartyMembersModal';
import { CampaignSelector } from './ui/CampaignSelector';

export default class QuartermasterPlugin extends Plugin {
	settings: RPGShopkeepSettings;
	dataAdapter: IDataAdapter;
	randomizer: IRandomizer;

	// Adapter factory and bundle
	adapterFactory: ObsidianAdapterFactory;
	currentAdapters: AdapterBundle | null = null;

	// Campaign UI
	campaignSelector: CampaignSelector | null = null;

	// Job Board components
	jobFileHandler: JobFileHandler;
	gmNotifier: ObsidianGMNotifier;
	jobBoardManager: JobBoardManager;
	eventBus: EventBus;

	// UUID System
	uuidRegistry: UUIDRegistry;

	// Inventory management
	inventoryParser: InventoryMarkdownParser;
	inventoryEditor: InventoryMarkdownEditor;
	currencyManager: CurrencyManager;
	parseTimeout: NodeJS.Timeout | null = null;
	pluginData: {
		containers: any[];
		items: any[];
		currency: { [playerId: string]: any };
	} = { containers: [], items: [], currency: {} };

	async onload() {
		await this.loadSettings();

		// Register custom icons
		this.registerCustomIcons();

		// Initialize adapter factory
		this.adapterFactory = new ObsidianAdapterFactory(this.app, this);

		// IMPORTANT: Initialize factory (loads campaigns, handles migration)
		await this.adapterFactory.initialize();

		// Load active campaign or create default
		let activeCampaignId = await this.adapterFactory.getActiveCampaignId();
		if (!activeCampaignId) {
			console.error('[Quartermaster] No active campaign ID after initialization - this should not happen');
			activeCampaignId = 'campaign_default';
		}

		// Create adapters for active campaign
		this.currentAdapters = await this.adapterFactory.createAdapters(activeCampaignId);

		// Backward compatibility: expose dataAdapter for existing code
		this.dataAdapter = this.currentAdapters.dataAdapter;

		// REQUIRED: Migrate settings-based party members to files (single source of truth)
		await this.migratePartyMembersToFiles();
		this.randomizer = new SimpleRandomizer();

		// Initialize UUID registry
		this.uuidRegistry = new UUIDRegistry(() => this.settings);

		// Initialize calendar system
		if (this.dataAdapter.initializeCalendar) {
			try {
				await this.dataAdapter.initializeCalendar();
				console.log('[Quartermaster] Calendar system initialized');
			} catch (error) {
				console.error('[Quartermaster] Failed to initialize calendar system:', error);
				// Don't block plugin load - calendar is optional
			}
		}

		// Initialize renown configuration
		if (this.dataAdapter.initializeRenownConfig) {
			try {
				await this.dataAdapter.initializeRenownConfig();
				console.log('[Quartermaster] Renown config system initialized');
			} catch (error) {
				console.error('[Quartermaster] Failed to initialize renown config:', error);
				// Don't block plugin load - renown config is optional
			}
		}

		// Initialize job board system
		this.initializeJobBoard();

		// Initialize project system
		if (this.dataAdapter instanceof ObsidianDataAdapter && this.dataAdapter.initializeProjects) {
			try {
				await this.dataAdapter.initializeProjects();
				console.log('[Quartermaster] Project system initialized');
			} catch (error) {
				console.error('[Quartermaster] Failed to initialize project system:', error);
				// Don't block plugin load - projects are optional
			}
		}

		// Initialize activity log system
		if (this.dataAdapter instanceof ObsidianDataAdapter && this.dataAdapter.initializeActivityLog) {
			try {
				await this.dataAdapter.initializeActivityLog();
				console.log('[Quartermaster] Activity log system initialized');
			} catch (error) {
				console.error('[Quartermaster] Failed to initialize activity log system:', error);
				// Don't block plugin load - activity log is optional
			}
		}

		// Initialize campaign selector UI (Phase 3)
		this.campaignSelector = new CampaignSelector(this.app, this);
		console.log('[Quartermaster] Campaign selector initialized');

		// Initialize currency manager and inventory system
		try {
			const currencyConfig = this.dataAdapter.getCurrencyConfig();
			this.currencyManager = new CurrencyManager(currencyConfig);
		} catch (error) {
			console.warn('[Quartermaster] Failed to load currency config, using defaults:', error);
			// Use adapter's default config
			const currencyConfig = this.dataAdapter.getCurrencyConfig();
			this.currencyManager = new CurrencyManager(currencyConfig);
		}

		// Initialize inventory parser and editor
		this.inventoryParser = new InventoryMarkdownParser(this.app, this.currencyManager);
		this.inventoryEditor = new InventoryMarkdownEditor(
			this.app,
			this.currencyManager,
			this.settings.partyInventoryPath || 'Party Inventory.md'
		);

		// Register code block processors for inventory rendering
		// quartermaster-player code block processor
		this.registerMarkdownCodeBlockProcessor('quartermaster-player', async (source, el, ctx) => {
			// Extract player ID from source
			const idMatch = source.match(/id:\s*(\S+)/);
			if (!idMatch) {
				el.createEl('p', { text: 'Error: Missing player ID', cls: 'quartermaster-error' });
				return;
			}

			const playerId = idMatch[1];

			// Try to get player info (may not be in party members system yet)
			let playerName = playerId;
			try {
				const players = await this.dataAdapter.getPartyMembers();
				const player = players.find(p => p.id === playerId);
				if (player) playerName = player.name;
			} catch (error) {
				// Player not found, use ID as name
			}

			// Render player header
			el.createEl('h2', { text: playerName });

			// TODO: Calculate and render encumbrance when enabled
			// For now, just show player name
		});

		// quartermaster-container code block processor
		this.registerMarkdownCodeBlockProcessor('quartermaster-container', async (source, el, ctx) => {
			// Extract container properties
			const nameMatch = source.match(/name:\s*(.+)/);
			const capacityMatch = source.match(/capacity:\s*(\d+)/);

			if (!nameMatch) {
				el.createEl('p', { text: 'Error: Missing container name', cls: 'quartermaster-error' });
				return;
			}

			const name = nameMatch[1];
			const capacity = capacityMatch ? parseInt(capacityMatch[1], 10) : 0;

			// Render container header
			el.createEl('h3', { text: name });

			// TODO: Calculate current weight and render capacity bar
			// For now, just show name
		});

		// quartermaster-shared code block processor
		this.registerMarkdownCodeBlockProcessor('quartermaster-shared', async (source, el, ctx) => {
			el.createEl('h2', { text: 'Shared Inventory' });
		});

		// Watch for Party Inventory file changes
		this.registerEvent(
			this.app.metadataCache.on('changed', async (file) => {
				const inventoryPath = this.settings.partyInventoryPath || 'Party Inventory.md';
				if (file.path === inventoryPath) {
					// Debounce parsing
					if (this.parseTimeout) {
						clearTimeout(this.parseTimeout);
					}
					this.parseTimeout = setTimeout(async () => {
						await this.parseAndUpdatePluginData(file);
					}, 500);
				}
			})
		);

		// Run startup health check if item folders configured
		if (this.settings.itemsFolders && this.settings.itemsFolders.length > 0) {
			this.runStartupHealthCheck();
		}

		// Add ribbon icon with custom quill-q icon
		this.addRibbonIcon('quill-q', 'Quartermaster: Action Menu', () => {
			new ActionMenuModal(this.app, this).open();
		});

		// Add command for main Action Menu
		this.addCommand({
			id: 'open-action-menu',
			name: 'Open Action Menu',
			callback: () => {
				new ActionMenuModal(this.app, this).open();
			}
		});

		// Keep legacy shop interface command for backward compatibility
		this.addCommand({
			id: 'open-shop-interface',
			name: 'Open Shop Interface',
			callback: () => {
				new ShopInterfaceModal(this.app, this).open();
			}
		});

		// Add calendar command
		this.addCommand({
			id: 'advance-time',
			name: 'Advance Time',
			callback: () => {
				new AdvanceTimeModal(this.app, this).open();
			}
		});

		// Add hireling commands
		this.addCommand({
			id: 'hire-npc',
			name: 'Hire NPC',
			callback: () => {
				new HireNPCModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'manage-hirelings',
			name: 'Manage Hirelings',
			callback: () => {
				new HirelingManagementModal(this.app, this).open();
			}
		});

		// Add location commands
		this.addCommand({
			id: 'create-location',
			name: 'Create Location',
			callback: () => {
				new LocationModal(this.app, this).open();
			}
		});

		// Add faction commands
		this.addCommand({
			id: 'create-faction',
			name: 'Create Faction',
			callback: () => {
				new FactionModal(this.app, this).open();
			}
		});

		// Add job board commands
		this.addCommand({
			id: 'open-job-board',
			name: 'Open Job Board',
			callback: () => {
				new JobBoardModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'create-job',
			name: 'Create New Job',
			callback: () => {
				new CreateJobModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'export-player-job-board',
			name: 'Export Player Job Board',
			callback: () => {
				new ExportPlayerJobBoardModal(this.app, this).open();
			}
		});

		// Add project commands
		this.addCommand({
			id: 'project-browser',
			name: 'Project Browser',
			callback: () => {
				new ProjectBrowserModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'create-project-template',
			name: 'Create Project Template',
			callback: () => {
				new ProjectTemplateModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'start-new-project',
			name: 'Start New Project',
			callback: () => {
				new NewProjectModal(this.app, this).open();
			}
		});

		// Add activity log command
		this.addCommand({
			id: 'open-activity-log',
			name: 'Open Activity Log',
			callback: () => {
				if (this.dataAdapter instanceof ObsidianDataAdapter && this.dataAdapter.activityLogHandler) {
					new ActivityLogModal(this.app, this.dataAdapter.activityLogHandler).open();
				} else {
					new Notice('Activity log not initialized');
				}
			}
		});

		// Add party member management command
		this.addCommand({
			id: 'manage-party-members',
			name: 'Manage Party Members',
			callback: () => {
				new ManagePartyMembersModal(this.app, this).open();
			}
		});

		// Campaign Management Commands (Phase 3 - TKT-CS-029)
		this.addCommand({
			id: 'switch-campaign',
			name: 'Switch Campaign',
			callback: () => {
				// Trigger campaign selector menu
				if (this.campaignSelector) {
					const statusBarEl = this.campaignSelector['statusBarItem'];
					if (statusBarEl) {
						// Simulate click to open menu
						statusBarEl.click();
					}
				}
			}
		});

		this.addCommand({
			id: 'create-campaign',
			name: 'Create New Campaign',
			callback: async () => {
				// Dynamic import to avoid circular dependencies
				const { SetupWizardModal } = await import('./ui/SetupWizardModal');
				new SetupWizardModal(this.app, this, () => {
					// Refresh campaign selector after creation
					if (this.campaignSelector) {
						this.campaignSelector.refreshDisplay();
					}
				}).open();
			}
		});

		this.addCommand({
			id: 'manage-campaigns',
			name: 'Manage Campaigns',
			callback: async () => {
				// Dynamic import to avoid circular dependencies
				const { CampaignManagerModal } = await import('./ui/CampaignManagerModal');
				new CampaignManagerModal(this.app, this, () => {
					// Refresh campaign selector after changes
					if (this.campaignSelector) {
						this.campaignSelector.refreshDisplay();
					}
				}).open();
			}
		});

		this.addCommand({
			id: 'manage-libraries',
			name: 'Manage Libraries',
			callback: async () => {
				// Dynamic import to avoid circular dependencies
				const { LibraryManagerModal } = await import('./ui/LibraryManagerModal');
				new LibraryManagerModal(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'world-view-dashboard',
			name: 'World View',
			callback: async () => {
				// Dynamic import to avoid circular dependencies
				const { WorldViewDashboard } = await import('./ui/WorldViewDashboard');
				new WorldViewDashboard(this.app, this).open();
			}
		});

		this.addCommand({
			id: 'clone-current-campaign',
			name: 'Clone Current Campaign',
			callback: async () => {
				try {
					const activeCampaignId = await this.adapterFactory.getActiveCampaignId();
					if (!activeCampaignId) {
						new Notice('No active campaign to clone');
						return;
					}

					// Dynamic import
					const { CampaignManagerModal } = await import('./ui/CampaignManagerModal');
					new CampaignManagerModal(this.app, this, () => {
						// Refresh campaign selector
						if (this.campaignSelector) {
							this.campaignSelector.refreshDisplay();
						}
					}, activeCampaignId).open(); // Pass campaignId to trigger clone flow
				} catch (error) {
					console.error('[Quartermaster] Failed to clone campaign:', error);
					new Notice(`Failed to clone campaign: ${error.message}`);
				}
			}
		});

		// Add settings tab
		this.addSettingTab(new RPGShopkeepSettingTab(this.app, this));
	}

	/**
	 * Register custom SVG icons for the plugin
	 */
	private registerCustomIcons() {
		try {
			// Register quill-q icon - Q with quill nib design (removed width/height for proper scaling)
			const quillIconSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2.5C17.2467 2.5 21.5 6.75329 21.5 12C21.5 14.2629 20.7075 16.3399 19.3867 17.9717L19.9551 18.54L21.1699 18.6621C21.5322 18.6983 21.8468 18.9281 21.9902 19.2627L23.0508 21.7373C23.2119 22.1131 23.128 22.5497 22.8389 22.8389C22.5497 23.128 22.1131 23.2119 21.7373 23.0508L19.2627 21.9902C18.9281 21.8468 18.6983 21.5322 18.6621 21.1699L18.54 19.9551L17.9717 19.3867C16.3399 20.7075 14.2629 21.5 12 21.5C6.75329 21.5 2.5 17.2467 2.5 12C2.5 6.75329 6.75329 2.5 12 2.5ZM12 4.5C7.85786 4.5 4.5 7.85786 4.5 12C4.5 16.1421 7.85786 19.5 12 19.5C13.7102 19.5 15.2852 18.9256 16.5469 17.9619L14.793 16.207C14.4024 15.8165 14.4024 15.1835 14.793 14.793C15.1835 14.4024 15.8165 14.4024 16.207 14.793L17.9619 16.5469C18.9256 15.2852 19.5 13.7102 19.5 12C19.5 7.85786 16.1421 4.5 12 4.5Z" fill="currentColor"/></svg>`;

			addIcon('quill-q', quillIconSvg);
			console.log('[Quartermaster] Custom icons registered successfully');
		} catch (error) {
			console.error('[Quartermaster] Failed to register custom icons:', error);
			// Plugin will fallback to built-in icons if this fails
		}
	}

	/**
	 * Run health check on plugin startup
	 * Validates vault items and rebuilds cache in background
	 */
	private async runStartupHealthCheck() {
		try {
			if (this.dataAdapter.rebuildItemCache) {
				const itemCount = await this.dataAdapter.rebuildItemCache();
				console.log(`[Quartermaster] Startup health check: ${itemCount} items indexed`);
			}
		} catch (error) {
			console.error('[Quartermaster] Startup health check failed:', error);
			// Don't block plugin load - just log the error
		}
	}

	/**
	 * Initialize job board system
	 */
	private initializeJobBoard() {
		try {
			// Get EventBus from dataAdapter
			this.eventBus = this.dataAdapter.getEventBus();

			// Initialize job file handler
			this.jobFileHandler = new JobFileHandler(
				this.app,
				this.settings.jobsFolder
			);

			// Initialize GM notifier
			this.gmNotifier = new ObsidianGMNotifier(
				this.app,
				this.settings.jobNotificationLogPath
			);

			// Initialize job board manager
			this.jobBoardManager = new JobBoardManager(
				this.eventBus,
				this.jobFileHandler,
				this.gmNotifier,
				{
					autoExpireJobs: this.settings.autoExpireJobs,
					notifyOnDeadlines: this.settings.notifyOnJobDeadlines,
					notifyOnExpirations: this.settings.notifyOnJobExpirations
				}
			);

			// Start listening to calendar events
			this.jobBoardManager.initialize();

			console.log('[Quartermaster] Job board system initialized');
		} catch (error) {
			console.error('[Quartermaster] Failed to initialize job board system:', error);
			// Don't block plugin load - job board is optional
		}
	}

	/**
	 * Parse Party Inventory file and update plugin data
	 */
	async parseAndUpdatePluginData(file: any): Promise<void> {
		try {
			const result = await this.inventoryParser.parseInventoryFile(file);
			this.pluginData = result;
			console.log('[Quartermaster] Inventory data updated:', result);
		} catch (error) {
			console.error('[Quartermaster] Failed to parse inventory file:', error);
			new Notice('Failed to parse Party Inventory file - check console for details');
		}
	}

	/**
	 * Switch to a different campaign
	 * Disposes current adapters and creates new ones for the target campaign
	 *
	 * @param campaignId - ID of campaign to switch to
	 */
	async switchCampaign(campaignId: string): Promise<void> {
		console.log(`[Quartermaster] Switching to campaign: ${campaignId}`);

		// Dispose current adapters
		if (this.currentAdapters) {
			await this.adapterFactory.disposeAdapters(this.currentAdapters);
		}

		// Create new adapters
		this.currentAdapters = await this.adapterFactory.createAdapters(campaignId);
		this.dataAdapter = this.currentAdapters.dataAdapter;

		// Mark campaign as active
		await this.adapterFactory.setActiveCampaign(campaignId);

		// Trigger UI refresh event
		this.app.workspace.trigger('quartermaster:campaign-changed');

		console.log(`[Quartermaster] Campaign switch complete`);
	}

	onunload() {
		// Clean up campaign selector
		if (this.campaignSelector) {
			this.campaignSelector.destroy();
			this.campaignSelector = null;
		}

		// Clean up adapter resources
		if (this.currentAdapters) {
			this.adapterFactory.disposeAdapters(this.currentAdapters);
		}

		// Cleanup job board manager
		if (this.jobBoardManager) {
			this.jobBoardManager.shutdown();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Migrate party members from settings to file-based storage
	 * CRITICAL: Ensures single source of truth (markdown files only)
	 */
	private async migratePartyMembersToFiles(): Promise<void> {
		// Check if migration already done
		if (this.settings.partyMembersMigrated) return;

		// Check if there are party members in settings
		if (this.settings.partyMembers && this.settings.partyMembers.length > 0) {
			console.log(`[Quartermaster] Migrating ${this.settings.partyMembers.length} party members to files...`);

			const folderPath = this.settings.partyMemberFolder || 'party-members';

			for (const member of this.settings.partyMembers) {
				try {
					// Ensure member has all required fields
					const fullMember: PartyMember = {
						id: member.id || this.uuidRegistry.generatePartyMemberId(),
						name: member.name || 'Unknown',
						strength: member.strength || 10,
						dexterity: member.dexterity || 10,
						constitution: member.constitution || 10,
						intelligence: member.intelligence || 10,
						wisdom: member.wisdom || 10,
						charisma: member.charisma || 10,
						size: member.size || 'Medium',
						level: member.level || 1,
						bonuses: member.bonuses || [],
						dataSource: member.dataSource || { type: 'obsidian_frontmatter', linkedFile: '' }
					};

					await this.dataAdapter.savePartyMember(fullMember);
				} catch (error) {
					console.error(`[Quartermaster] Failed to migrate party member ${member.name}:`, error);
				}
			}

			// Mark migration complete
			this.settings.partyMembersMigrated = true;
			// CRITICAL: Clear old data to eliminate dual source of truth
			this.settings.partyMembers = [];
			await this.saveSettings();

			new Notice(`Migrated ${this.settings.partyMembers.length} party members to files`);
			console.log(`[Quartermaster] Party member migration complete`);
		} else {
			// No members to migrate, just mark as done
			this.settings.partyMembersMigrated = true;
			await this.saveSettings();
		}
	}
}
