/**
 * Obsidian Adapter Factory - Campaign-scoped adapter lifecycle management
 *
 * Manages creation and disposal of campaign-specific adapters for Obsidian vault.
 * Implements the IAdapterFactory contract for campaign switching.
 *
 * **Phase 1 Update**: Now uses CampaignManager + ObsidianCampaignPersistence
 * for proper campaign lifecycle management instead of direct data.json access.
 */

import { App } from 'obsidian';
import { IAdapterFactory, AdapterBundle, CampaignMetadata } from '@quartermaster/core/interfaces/IAdapterFactory';
import { ObsidianCampaignContext, CampaignProfile } from '../adapters/ObsidianCampaignContext';
import { ObsidianPathResolver } from '../adapters/ObsidianPathResolver';
import { ObsidianDataAdapter } from '../adapters/ObsidianDataAdapter';
import { ObsidianSettingsAdapter } from '../adapters/ObsidianSettingsAdapter';
import { ObsidianConfigAdapter } from '../adapters/ObsidianConfigAdapter';
import { ObsidianWorldStateAdapter } from '../adapters/ObsidianWorldStateAdapter';
import { ObsidianEventDefinitionAdapter } from '../adapters/ObsidianEventDefinitionAdapter';
import { CampaignManager } from '@quartermaster/core/services/CampaignManager';
import { ObsidianCampaignPersistence } from './ObsidianCampaignPersistence';
import type QuartermasterPlugin from '../main';

/**
 * Obsidian-specific adapter factory
 *
 * Lifecycle:
 * 1. Plugin loads -> factory.initialize() -> factory.getActiveCampaignId() -> factory.createAdapters(id)
 * 2. User switches campaign -> factory.disposeAdapters(old) -> factory.createAdapters(new)
 * 3. Plugin unloads -> factory.disposeAdapters(current)
 *
 * Phase 1 Changes:
 * - Uses CampaignManager for CRUD operations
 * - Uses ObsidianCampaignPersistence for data.json I/O
 * - Automatic migration from legacy settings on first load
 */
export class ObsidianAdapterFactory implements IAdapterFactory {
	private campaignManager: CampaignManager;
	private persistence: ObsidianCampaignPersistence;
	private initialized: boolean = false;
	private activeBundle: AdapterBundle | null = null;

	constructor(
		private app: App,
		private plugin: QuartermasterPlugin
	) {
		// Create persistence layer
		this.persistence = new ObsidianCampaignPersistence(plugin);

		// Create campaign manager with persistence
		this.campaignManager = new CampaignManager(this.persistence);
	}

	// ==================== INITIALIZATION ====================

	/**
	 * Initialize the factory
	 *
	 * Must be called before using other methods.
	 * Handles:
	 * - Loading campaigns from persistence
	 * - Migrating legacy settings to default campaign (if needed)
	 * - Ensuring at least one campaign exists
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return; // Already initialized
		}

		console.log('[ObsidianAdapterFactory] Initializing...');

		// Initialize campaign manager (loads from persistence)
		await this.campaignManager.initialize();

		// Check if migration is needed
		const migrated = await this.persistence.migrateToDefaultCampaign();
		if (migrated) {
			console.log('[ObsidianAdapterFactory] Migrated legacy settings to default campaign');

			// Reload campaigns after migration
			this.campaignManager = new CampaignManager(this.persistence);
			await this.campaignManager.initialize();
		}

		// Ensure at least one campaign exists
		const campaignCount = await this.campaignManager.getCampaignCount();
		if (campaignCount === 0) {
			console.log('[ObsidianAdapterFactory] No campaigns found, creating default');
			await this.createDefaultCampaign();
		}

		this.initialized = true;
		console.log('[ObsidianAdapterFactory] Initialization complete');
	}

	/**
	 * Ensure factory is initialized
	 * Throws error if not initialized
	 */
	private ensureInitialized(): void {
		if (!this.initialized) {
			throw new Error('ObsidianAdapterFactory not initialized. Call initialize() first.');
		}
	}

	// ==================== CORE FACTORY METHODS ====================

	async createAdapters(campaignId: string): Promise<AdapterBundle> {
		this.ensureInitialized();

		console.log(`[ObsidianAdapterFactory] Creating adapters for campaign: ${campaignId}`);

		// Load campaign profile from campaign manager
		const profile = await this.campaignManager.getCampaign(campaignId);

		if (!profile) {
			throw new Error(`Campaign not found: ${campaignId}`);
		}

		// Create campaign context
		const campaignContext = new ObsidianCampaignContext(profile, this.plugin);

		// Update last accessed timestamp via campaign manager
		await this.campaignManager.updateCampaign(campaignId, {
			lastAccessedAt: Date.now()
		});

		// Create path resolver with campaign-specific mappings
		// Convert core Record<string, string> to CampaignPathMappings with defaults
		const pathMappings = profile.pathMappings || {};
		const pathResolver = new ObsidianPathResolver(
			{
				shops: pathMappings.shops || 'Shops/',
				party: pathMappings.party || 'Party/',
				transactions: pathMappings.transactions || 'Transactions/',
				npcs: pathMappings.npcs,
				locations: pathMappings.locations,
				factions: pathMappings.factions,
				jobs: pathMappings.jobs,
				projects: pathMappings.projects,
				'activity-log': pathMappings['activity-log'],
				calendar: pathMappings.calendar,
				items: pathMappings.items,
				libraries: pathMappings.libraries
			},
			this.app.vault
		);

		// Create settings adapter with campaign context
		// Phase 2: Settings adapter now uses campaign context instead of global settings
		const settingsAdapter = new ObsidianSettingsAdapter(
			this.plugin,
			campaignContext
		);

		// Create config adapter
		const configAdapter = new ObsidianConfigAdapter(this.app, this.plugin);

		// Create data adapter with all dependencies
		const dataAdapter = new ObsidianDataAdapter(
			this.app,
			campaignContext,
			pathResolver,
			configAdapter,
			settingsAdapter,
			this.plugin
		);

		// Create calendar and event system adapters
		const worldStateAdapter = new ObsidianWorldStateAdapter(this.app);
		const eventDefinitionAdapter = new ObsidianEventDefinitionAdapter(this.app, this.plugin.manifest.dir);

		const bundle: AdapterBundle = {
			campaignContext,
			pathResolver,
			dataAdapter,
			configAdapter,
			settingsAdapter,
			worldStateAdapter,
			eventDefinitionAdapter,
		};

		// Cache the active bundle for getter methods
		this.activeBundle = bundle;

		console.log(`[ObsidianAdapterFactory] Adapters created successfully for: ${profile.name}`);

		return bundle;
	}

	async disposeAdapters(bundle: AdapterBundle): Promise<void> {
		console.log(`[ObsidianAdapterFactory] Disposing adapters for campaign: ${bundle.campaignContext.getCampaignId()}`);

		// Call teardown on adapters that support it
		if (bundle.dataAdapter?.teardown) {
			try {
				await bundle.dataAdapter.teardown();
			} catch (error) {
				console.error('[ObsidianAdapterFactory] Error during dataAdapter teardown:', error);
				// Continue cleanup even if teardown fails
			}
		}

		// Config and Settings adapters don't have teardown methods (stateless)
		// No cleanup needed

		// Clear references to help garbage collection
		(bundle as any).dataAdapter = null;
		(bundle as any).configAdapter = null;
		(bundle as any).settingsAdapter = null;
		(bundle as any).campaignContext = null;
		(bundle as any).pathResolver = null;
		(bundle as any).worldStateAdapter = null;
		(bundle as any).eventDefinitionAdapter = null;

		// Clear active bundle cache if this is the active bundle
		if (this.activeBundle === bundle) {
			this.activeBundle = null;
		}

		console.log('[ObsidianAdapterFactory] Adapters disposed successfully');
	}

	async listCampaigns(): Promise<CampaignMetadata[]> {
		this.ensureInitialized();

		const campaigns = await this.campaignManager.listCampaigns();

		// Map profiles to metadata
		return campaigns.map(profile => ({
			id: profile.id,
			name: profile.name,
			worldId: profile.worldId,
			createdAt: profile.createdAt,
			lastAccessedAt: profile.lastAccessedAt,
			isActive: profile.isActive,
			description: profile.description
		}));
	}

	async getActiveCampaignId(): Promise<string | null> {
		this.ensureInitialized();

		const activeCampaign = await this.campaignManager.getActiveCampaign();

		if (activeCampaign) {
			return activeCampaign.id;
		}

		// No active campaign - activate the first one
		const campaigns = await this.campaignManager.listCampaigns();
		if (campaigns.length > 0) {
			await this.campaignManager.setActiveCampaign(campaigns[0].id);
			return campaigns[0].id;
		}

		// No campaigns exist - this should not happen after initialize()
		console.error('[ObsidianAdapterFactory] No campaigns found in getActiveCampaignId');
		return null;
	}

	// ==================== CAMPAIGN MANAGEMENT METHODS ====================

	/**
	 * Create a new campaign
	 *
	 * @param profile - Partial campaign data (id, createdAt auto-generated)
	 * @returns Complete campaign profile
	 */
	async createCampaign(profile: Partial<CampaignProfile>): Promise<CampaignProfile> {
		this.ensureInitialized();

		return await this.campaignManager.createCampaign(profile);
	}

	/**
	 * Update an existing campaign
	 *
	 * @param id - Campaign ID to update
	 * @param updates - Partial campaign data to merge
	 */
	async updateCampaign(id: string, updates: Partial<CampaignProfile>): Promise<void> {
		this.ensureInitialized();

		await this.campaignManager.updateCampaign(id, updates);
	}

	/**
	 * Delete a campaign
	 *
	 * @param id - Campaign ID to delete
	 * @throws Error if campaign is active
	 */
	async deleteCampaign(id: string): Promise<void> {
		this.ensureInitialized();

		await this.campaignManager.deleteCampaign(id);
	}

	/**
	 * Get a specific campaign
	 *
	 * @param id - Campaign ID
	 * @returns Campaign profile or null if not found
	 */
	async getCampaign(id: string): Promise<CampaignProfile | null> {
		this.ensureInitialized();

		return await this.campaignManager.getCampaign(id);
	}

	/**
	 * Set active campaign
	 *
	 * Marks the specified campaign as active and deactivates all others.
	 * Used during campaign switching to persist UI state.
	 *
	 * @param campaignId - Campaign ID to activate
	 */
	async setActiveCampaign(campaignId: string): Promise<void> {
		this.ensureInitialized();

		await this.campaignManager.setActiveCampaign(campaignId);
	}

	/**
	 * Get campaigns by world ID
	 *
	 * @param worldId - World ID to filter by
	 * @returns Array of campaigns belonging to this world
	 */
	async getCampaignsByWorld(worldId: string): Promise<CampaignProfile[]> {
		this.ensureInitialized();

		return await this.campaignManager.getCampaignsByWorld(worldId);
	}

	/**
	 * Check if a campaign name is already in use
	 *
	 * @param name - Campaign name to check
	 * @param excludeId - Optional campaign ID to exclude from check
	 * @returns True if name is already used
	 */
	async isNameTaken(name: string, excludeId?: string): Promise<boolean> {
		this.ensureInitialized();

		return await this.campaignManager.isNameTaken(name, excludeId);
	}

	// ==================== HELPER METHODS ====================

	/**
	 * Create default campaign from existing plugin settings
	 *
	 * Enables seamless migration for users upgrading from pre-campaign-switching versions.
	 * Wraps existing settings into a default campaign profile.
	 */
	private async createDefaultCampaign(): Promise<void> {
		const settings = this.plugin.settings;

		const defaultProfile: Partial<CampaignProfile> = {
			id: 'campaign_default',
			name: 'Default Campaign',
			worldId: 'world-custom',
			description: 'Automatically created from plugin settings',
			pathMappings: {
				shops: settings.shopsFolder || 'Shops/',
				party: settings.partyInventoryFile || 'Party Inventory.md',
				transactions: settings.transactionLogFile || 'Transaction Log.md',
				// Optional paths - use defaults if not in settings
				npcs: 'NPCs/',
				locations: 'Locations/',
				factions: 'Factions/',
				jobs: 'Jobs/',
				projects: 'Projects/',
				'activity-log': 'activity-log.md',
				calendar: 'calendar-state.json',
				items: settings.itemsFolders?.[0]?.path || 'Items/',
				libraries: 'Libraries/'
			},
			activeLibraryIds: [],
			isActive: true
		};

		await this.campaignManager.createCampaign(defaultProfile);

		console.log('[ObsidianAdapterFactory] Default campaign created from plugin settings');
	}

	/**
	 * Get the campaign manager instance
	 *
	 * Useful for direct access to campaign operations from UI layer.
	 *
	 * @returns CampaignManager instance
	 */
	getCampaignManager(): CampaignManager {
		this.ensureInitialized();

		return this.campaignManager;
	}

	/**
	 * Get the persistence layer instance
	 *
	 * Useful for advanced operations or debugging.
	 *
	 * @returns ObsidianCampaignPersistence instance
	 */
	getPersistence(): ObsidianCampaignPersistence {
		return this.persistence;
	}

	/**
	 * Get world state adapter for the active campaign
	 *
	 * @returns World state adapter for active campaign
	 * @throws Error if no active campaign or adapters not initialized
	 */
	getWorldStateAdapter() {
		if (!this.activeBundle) {
			throw new Error('No active campaign bundle. Call createAdapters() first.');
		}
		return this.activeBundle.worldStateAdapter;
	}

	/**
	 * Get event definition adapter for the active campaign
	 *
	 * @returns Event definition adapter for active campaign
	 * @throws Error if no active campaign or adapters not initialized
	 */
	getEventDefinitionAdapter() {
		if (!this.activeBundle) {
			throw new Error('No active campaign bundle. Call createAdapters() first.');
		}
		return this.activeBundle.eventDefinitionAdapter;
	}
}
