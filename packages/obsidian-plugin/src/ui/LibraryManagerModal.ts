import { App, Modal, Notice, Setting } from 'obsidian';
import type QuartermasterPlugin from '../main';

interface Library {
	id: string;
	name: string;
	description?: string;
	worldIds: string[];
	itemCount: number;
	isEnabledForActiveCampaign: boolean;
	usedByCampaigns: string[]; // Campaign names using this library
}

/**
 * Modal for managing item libraries and their campaign linkages
 */
export class LibraryManagerModal extends Modal {
	private plugin: QuartermasterPlugin;
	private libraries: Library[] = [];
	private activeCampaignId: string | null = null;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Library Manager' });

		// Load active campaign
		const campaignManager = this.plugin.adapterFactory.getCampaignManager();
		const activeCampaign = await campaignManager.getActiveCampaign();
		this.activeCampaignId = activeCampaign?.id || null;

		if (!activeCampaign) {
			contentEl.createEl('p', {
				text: 'No active campaign. Please create or switch to a campaign first.',
				cls: 'mod-warning'
			});
			return;
		}

		// Info banner
		const infoBanner = contentEl.createDiv('library-manager-info');
		infoBanner.style.padding = '12px';
		infoBanner.style.backgroundColor = 'var(--background-secondary)';
		infoBanner.style.borderRadius = '6px';
		infoBanner.style.marginBottom = '16px';

		infoBanner.createEl('strong', { text: 'Active Campaign: ' });
		infoBanner.createSpan({ text: activeCampaign.name });

		// Load libraries
		await this.loadLibraries(activeCampaign);

		// Render library list
		this.renderLibraryList(contentEl);

		// Action buttons
		this.renderActionButtons(contentEl);
	}

	/**
	 * Load all libraries with metadata
	 */
	private async loadLibraries(activeCampaign: any): Promise<void> {
		// Get all campaigns to see which use each library
		const campaignManager = this.plugin.adapterFactory.getCampaignManager();
		const allCampaigns = await campaignManager.listCampaigns();

		// For now, we have two built-in libraries: SRD and a placeholder for user items
		// In a full implementation, this would scan the vault for library definitions

		const srdLibrary: Library = {
			id: 'srd',
			name: 'SRD (System Reference Document)',
			description: 'D&D 5e System Reference Document items',
			worldIds: ['generic-fantasy', 'dnd5e'],
			itemCount: 542, // Hardcoded for now - would scan actual SRD data
			isEnabledForActiveCampaign: this.plugin.settings.useSRDDatabase,
			usedByCampaigns: allCampaigns
				.filter(c => {
					// Campaign uses SRD if useSRDDatabase is true in its settings
					// For now, assuming all campaigns share global settings
					return this.plugin.settings.useSRDDatabase;
				})
				.map(c => c.name)
		};

		// Count user vault items
		const itemHandler = new (await import('../adapters/ItemVaultHandler')).ItemVaultHandler(
			this.app,
			this.plugin.settings
		);
		const userItems = await itemHandler.getAvailableItems();

		const vaultLibrary: Library = {
			id: 'vault',
			name: 'Vault Items',
			description: 'Custom items from your Obsidian vault',
			worldIds: [], // User-defined - would be read from library metadata file
			itemCount: userItems.length,
			isEnabledForActiveCampaign: this.plugin.settings.itemsFolders.length > 0,
			usedByCampaigns: allCampaigns
				.filter(c => {
					// Campaign uses vault if it has item folders configured
					return this.plugin.settings.itemsFolders.length > 0;
				})
				.map(c => c.name)
		};

		this.libraries = [srdLibrary, vaultLibrary];
	}

	/**
	 * Render the library list
	 */
	private renderLibraryList(containerEl: HTMLElement): void {
		const listContainer = containerEl.createDiv('library-list-container');

		if (this.libraries.length === 0) {
			listContainer.createEl('p', {
				text: 'No libraries found. Import a library or create a new one.',
				cls: 'setting-item-description'
			});
			return;
		}

		for (const library of this.libraries) {
			this.renderLibraryCard(listContainer, library);
		}
	}

	/**
	 * Render a single library card
	 */
	private renderLibraryCard(containerEl: HTMLElement, library: Library): void {
		const card = containerEl.createDiv('library-card');
		card.style.border = '1px solid var(--background-modifier-border)';
		card.style.borderRadius = '8px';
		card.style.padding = '16px';
		card.style.marginBottom = '12px';
		card.style.backgroundColor = library.isEnabledForActiveCampaign
			? 'var(--background-secondary)'
			: 'var(--background-primary)';

		// Header row
		const headerRow = card.createDiv('library-card-header');
		headerRow.style.display = 'flex';
		headerRow.style.justifyContent = 'space-between';
		headerRow.style.alignItems = 'center';
		headerRow.style.marginBottom = '8px';

		const titleDiv = headerRow.createDiv();
		titleDiv.createEl('h3', { text: library.name, attr: { style: 'margin: 0;' } });

		const statusDiv = headerRow.createDiv();
		if (library.isEnabledForActiveCampaign) {
			statusDiv.createSpan({
				text: '✓ Enabled',
				attr: { style: 'color: var(--text-success); font-weight: 500;' }
			});
		} else {
			statusDiv.createSpan({
				text: '○ Disabled',
				attr: { style: 'color: var(--text-muted);' }
			});
		}

		// Description
		if (library.description) {
			card.createEl('p', {
				text: library.description,
				cls: 'setting-item-description',
				attr: { style: 'margin: 8px 0;' }
			});
		}

		// Stats row
		const statsRow = card.createDiv('library-stats');
		statsRow.style.display = 'flex';
		statsRow.style.gap = '16px';
		statsRow.style.marginBottom = '12px';
		statsRow.style.fontSize = '0.9em';
		statsRow.style.color = 'var(--text-muted)';

		const itemCount = statsRow.createSpan();
		itemCount.createEl('strong', { text: 'Items: ' });
		itemCount.createSpan({ text: library.itemCount.toString() });

		if (library.worldIds.length > 0) {
			const worlds = statsRow.createSpan();
			worlds.createEl('strong', { text: 'Worlds: ' });
			worlds.createSpan({ text: library.worldIds.join(', ') });
		}

		const campaigns = statsRow.createSpan();
		campaigns.createEl('strong', { text: 'Used by: ' });
		campaigns.createSpan({
			text:
				library.usedByCampaigns.length > 0
					? `${library.usedByCampaigns.length} campaign(s)`
					: 'No campaigns'
		});

		// Action buttons row
		const actionsRow = card.createDiv('library-actions');
		actionsRow.style.display = 'flex';
		actionsRow.style.gap = '8px';
		actionsRow.style.marginTop = '12px';

		// Toggle enable/disable button
		const toggleBtn = actionsRow.createEl('button', {
			text: library.isEnabledForActiveCampaign ? 'Disable' : 'Enable'
		});
		toggleBtn.onclick = async () => {
			await this.toggleLibraryForCampaign(library);
		};

		// Export button
		const exportBtn = actionsRow.createEl('button', { text: 'Export' });
		exportBtn.onclick = () => {
			this.exportLibrary(library);
		};

		// Details button
		const detailsBtn = actionsRow.createEl('button', { text: 'Details' });
		detailsBtn.onclick = () => {
			this.showLibraryDetails(library);
		};
	}

	/**
	 * Render action buttons at bottom of modal
	 */
	private renderActionButtons(containerEl: HTMLElement): void {
		const actionsDiv = containerEl.createDiv('library-manager-actions');
		actionsDiv.style.display = 'flex';
		actionsDiv.style.gap = '12px';
		actionsDiv.style.marginTop = '24px';
		actionsDiv.style.justifyContent = 'flex-end';

		const importBtn = actionsDiv.createEl('button', { text: 'Import Library' });
		importBtn.onclick = () => {
			new Notice('Import library feature coming soon!');
		};

		const createBtn = actionsDiv.createEl('button', { text: 'Create New', cls: 'mod-cta' });
		createBtn.onclick = () => {
			new Notice('Create library feature coming soon!');
		};
	}

	/**
	 * Toggle library enable/disable for active campaign
	 */
	private async toggleLibraryForCampaign(library: Library): Promise<void> {
		if (!this.activeCampaignId) {
			new Notice('No active campaign');
			return;
		}

		// For now, this toggles global settings
		// In a full implementation, this would modify campaign-specific library linkages

		if (library.id === 'srd') {
			this.plugin.settings.useSRDDatabase = !library.isEnabledForActiveCampaign;
			await this.plugin.saveSettings();
			new Notice(
				`SRD library ${this.plugin.settings.useSRDDatabase ? 'enabled' : 'disabled'} for all campaigns`
			);
		} else if (library.id === 'vault') {
			// Vault library is enabled if itemsFolders is non-empty
			// This is a placeholder - in reality, you'd manage campaign-specific folder lists
			new Notice(
				'Vault library management requires configuring item folders in Settings > Item Management'
			);
		}

		// Refresh display
		this.onOpen();
	}

	/**
	 * Export library definition to file
	 */
	private exportLibrary(library: Library): void {
		const exportData = {
			id: library.id,
			name: library.name,
			description: library.description,
			worldIds: library.worldIds,
			version: '1.0.0',
			exportedAt: new Date().toISOString()
		};

		const json = JSON.stringify(exportData, null, 2);

		// Create a download link
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `library-${library.id}.json`;
		a.click();
		URL.revokeObjectURL(url);

		new Notice(`Exported ${library.name}`);
	}

	/**
	 * Show detailed information about a library
	 */
	private showLibraryDetails(library: Library): void {
		const modal = new (class extends Modal {
			library: Library;

			constructor(app: App, library: Library) {
				super(app);
				this.library = library;
			}

			onOpen() {
				const { contentEl } = this;
				contentEl.empty();

				contentEl.createEl('h2', { text: this.library.name });

				if (this.library.description) {
					contentEl.createEl('p', { text: this.library.description });
				}

				const detailsList = contentEl.createEl('ul');

				detailsList.createEl('li').createSpan({
					text: `ID: ${this.library.id}`
				});

				detailsList.createEl('li').createSpan({
					text: `Items: ${this.library.itemCount}`
				});

				detailsList.createEl('li').createSpan({
					text: `Worlds: ${this.library.worldIds.length > 0 ? this.library.worldIds.join(', ') : 'None'}`
				});

				detailsList.createEl('li').createSpan({
					text: `Used by campaigns: ${this.library.usedByCampaigns.length > 0 ? this.library.usedByCampaigns.join(', ') : 'None'}`
				});

				detailsList.createEl('li').createSpan({
					text: `Status: ${this.library.isEnabledForActiveCampaign ? 'Enabled' : 'Disabled'} for active campaign`
				});

				const closeBtn = contentEl.createEl('button', { text: 'Close' });
				closeBtn.style.marginTop = '16px';
				closeBtn.onclick = () => this.close();
			}
		})(this.app, library);

		modal.open();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
