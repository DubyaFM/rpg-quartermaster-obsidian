/**
 * Campaign Manager Modal
 *
 * Provides CRUD operations for campaign management:
 * - List all campaigns in table view
 * - Edit campaign properties (name, description, world, libraries)
 * - Clone campaigns
 * - Delete campaigns (with confirmation)
 * - Set active campaign
 *
 * **Phase 3 - TKT-CS-025**
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import type QuartermasterPlugin from '../main';
import type { CampaignProfile } from '@quartermaster/core/services/CampaignManager';
import type { CampaignMetadata } from '@quartermaster/core/interfaces/IAdapterFactory';
import { CampaignSwitchLoader } from './CampaignSwitchLoader';

/**
 * World preset for world selector
 */
interface WorldPreset {
	id: string;
	name: string;
}

export class CampaignManagerModal extends Modal {
	private campaigns: CampaignMetadata[] = [];
	private campaignProfiles: Map<string, CampaignProfile> = new Map(); // Cache full profiles
	private onComplete?: () => void;
	private initialCampaignId?: string; // For triggering clone mode

	// World presets (same as SetupWizardModal)
	private readonly WORLD_PRESETS: WorldPreset[] = [
		{ id: 'world-generic-fantasy', name: 'Generic Fantasy' },
		{ id: 'world-forgotten-realms', name: 'Forgotten Realms' },
		{ id: 'world-eberron', name: 'Eberron' },
		{ id: 'world-homebrew', name: 'Custom Homebrew' }
	];

	constructor(
		app: App,
		private plugin: QuartermasterPlugin,
		onComplete?: () => void,
		initialCampaignId?: string
	) {
		super(app);
		this.onComplete = onComplete;
		this.initialCampaignId = initialCampaignId;
	}

	async onOpen() {
		await this.loadCampaigns();
		this.render();
	}

	onClose() {
		this.contentEl.empty();
	}

	/**
	 * Load campaigns from factory
	 */
	private async loadCampaigns(): Promise<void> {
		try {
			this.campaigns = await this.plugin.adapterFactory.listCampaigns();
		} catch (error) {
			console.error('[CampaignManagerModal] Failed to load campaigns:', error);
			new Notice('Failed to load campaigns');
			this.campaigns = [];
		}
	}

	/**
	 * Render the campaign manager UI
	 */
	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Modal header
		contentEl.createEl('h2', { text: 'Manage Campaigns' });

		if (this.campaigns.length === 0) {
			contentEl.createEl('p', {
				text: 'No campaigns found. Create one to get started!',
				cls: 'setting-item-description'
			});
			return;
		}

		// Campaign table
		const tableContainer = contentEl.createDiv({ cls: 'quartermaster-campaign-table' });
		const table = tableContainer.createEl('table');

		// Table header
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Active' });
		headerRow.createEl('th', { text: 'Name' });
		headerRow.createEl('th', { text: 'World' });
		headerRow.createEl('th', { text: 'Last Accessed' });
		headerRow.createEl('th', { text: 'Actions' });

		// Table body
		const tbody = table.createEl('tbody');

		// Sort campaigns: active first, then by last accessed
		const sortedCampaigns = [...this.campaigns].sort((a, b) => {
			if (a.isActive !== b.isActive) {
				return a.isActive ? -1 : 1;
			}
			const aTime = a.lastAccessedAt || a.createdAt;
			const bTime = b.lastAccessedAt || b.createdAt;
			return bTime - aTime;
		});

		sortedCampaigns.forEach(campaign => {
			this.renderCampaignRow(tbody, campaign);
		});
	}

	/**
	 * Render a single campaign row
	 */
	private renderCampaignRow(tbody: HTMLElement, campaign: CampaignMetadata): void {
		const row = tbody.createEl('tr');

		if (campaign.isActive) {
			row.addClass('is-active');
		}

		// Active indicator
		const activeCell = row.createEl('td', { cls: 'campaign-active-cell' });
		if (campaign.isActive) {
			activeCell.createSpan({ text: '●', cls: 'active-indicator' });
		} else {
			activeCell.createSpan({ text: '○', cls: 'inactive-indicator' });
		}

		// Name
		const nameCell = row.createEl('td', { cls: 'campaign-name-cell' });
		nameCell.createSpan({ text: campaign.name });
		if (campaign.description) {
			nameCell.createDiv({
				text: campaign.description,
				cls: 'campaign-description'
			});
		}

		// World
		const worldCell = row.createEl('td', { cls: 'campaign-world-cell' });
		const worldPreset = this.WORLD_PRESETS.find(w => w.id === campaign.worldId);
		worldCell.createSpan({ text: worldPreset?.name || campaign.worldId });

		// Last Accessed
		const lastAccessedCell = row.createEl('td', { cls: 'campaign-lastaccessed-cell' });
		const timestamp = campaign.lastAccessedAt || campaign.createdAt;
		lastAccessedCell.createSpan({ text: this.formatTimestamp(timestamp) });

		// Actions
		const actionsCell = row.createEl('td', { cls: 'campaign-actions-cell' });

		// Switch button (if not active)
		if (!campaign.isActive) {
			const switchBtn = actionsCell.createEl('button', {
				text: 'Switch',
				cls: 'mod-cta'
			});
			switchBtn.onclick = async () => {
				await this.switchToCampaign(campaign);
			};
		}

		// Edit button
		const editBtn = actionsCell.createEl('button', { text: 'Edit' });
		editBtn.onclick = () => {
			this.openEditModal(campaign);
		};

		// Clone button
		const cloneBtn = actionsCell.createEl('button', { text: 'Clone' });
		cloneBtn.onclick = () => {
			this.openCloneModal(campaign);
		};

		// Delete button (disabled if active)
		const deleteBtn = actionsCell.createEl('button', {
			text: 'Delete',
			cls: 'mod-warning'
		});
		if (campaign.isActive) {
			deleteBtn.disabled = true;
			deleteBtn.title = 'Cannot delete active campaign';
		}
		deleteBtn.onclick = () => {
			this.confirmDelete(campaign);
		};
	}

	/**
	 * Format timestamp for display
	 */
	private formatTimestamp(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;

		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes} min ago`;
		if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

		// Fallback to date
		return new Date(timestamp).toLocaleDateString();
	}

	/**
	 * Switch to a different campaign
	 */
	private async switchToCampaign(campaign: CampaignMetadata): Promise<void> {
		try {
			const loader = new CampaignSwitchLoader(this.app, campaign.name);

			await this.plugin.switchCampaign(campaign.id);

			loader.onSwitchComplete();
			this.close();

			new Notice(`Switched to campaign: ${campaign.name}`);

			// Trigger refresh callback
			if (this.onComplete) {
				this.onComplete();
			}

		} catch (error) {
			console.error('[CampaignManagerModal] Failed to switch campaign:', error);
			new Notice(`Failed to switch campaign: ${error.message}`);
		}
	}

	/**
	 * Get full campaign profile (loads if not cached)
	 */
	private async getCampaignProfile(campaignId: string): Promise<CampaignProfile | null> {
		if (this.campaignProfiles.has(campaignId)) {
			return this.campaignProfiles.get(campaignId)!;
		}

		// Load from campaign manager
		const campaignManager = this.plugin.adapterFactory.getCampaignManager();
		if (!campaignManager) {
			throw new Error('CampaignManager not available');
		}

		const profile = await campaignManager.getCampaign(campaignId);
		if (profile) {
			this.campaignProfiles.set(campaignId, profile);
		}

		return profile;
	}

	/**
	 * Open edit modal for a campaign
	 */
	private async openEditModal(campaign: CampaignMetadata): Promise<void> {
		const profile = await this.getCampaignProfile(campaign.id);
		if (!profile) {
			new Notice('Failed to load campaign details');
			return;
		}

		const editModal = new CampaignEditModal(
			this.app,
			this.plugin,
			profile,
			this.WORLD_PRESETS,
			async () => {
				await this.loadCampaigns();
				this.render();

				if (this.onComplete) {
					this.onComplete();
				}
			}
		);
		editModal.open();
	}

	/**
	 * Open clone modal for a campaign
	 */
	private async openCloneModal(campaign: CampaignMetadata): Promise<void> {
		const profile = await this.getCampaignProfile(campaign.id);
		if (!profile) {
			new Notice('Failed to load campaign details');
			return;
		}

		const cloneModal = new CampaignCloneModal(
			this.app,
			this.plugin,
			profile,
			async () => {
				await this.loadCampaigns();
				this.render();

				if (this.onComplete) {
					this.onComplete();
				}
			}
		);
		cloneModal.open();
	}

	/**
	 * Confirm campaign deletion
	 */
	private confirmDelete(campaign: CampaignMetadata): void {
		const confirmModal = new CampaignDeleteConfirmModal(
			this.app,
			this.plugin,
			campaign,
			async () => {
				await this.loadCampaigns();
				this.render();

				if (this.onComplete) {
					this.onComplete();
				}
			}
		);
		confirmModal.open();
	}
}

/**
 * Campaign Edit Modal
 * Sub-modal for editing campaign properties
 */
class CampaignEditModal extends Modal {
	private formData: {
		name: string;
		description: string;
		worldId: string;
		activeLibraryIds: string[];
	};

	constructor(
		app: App,
		private plugin: QuartermasterPlugin,
		private campaign: CampaignProfile,
		private worldPresets: WorldPreset[],
		private onComplete: () => void
	) {
		super(app);

		// Initialize form data with current campaign values
		this.formData = {
			name: campaign.name,
			description: campaign.description || '',
			worldId: campaign.worldId,
			activeLibraryIds: [...(campaign.activeLibraryIds || [])]
		};
	}

	onOpen() {
		this.render();
	}

	onClose() {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Edit Campaign' });

		// Campaign Name
		new Setting(contentEl)
			.setName('Campaign Name')
			.setDesc('Descriptive name for this campaign')
			.addText(text => text
				.setPlaceholder('Campaign name')
				.setValue(this.formData.name)
				.onChange(value => {
					this.formData.name = value;
				})
			);

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Optional notes about this campaign')
			.addTextArea(text => {
				text
					.setPlaceholder('Campaign description')
					.setValue(this.formData.description)
					.onChange(value => {
						this.formData.description = value;
					});
				text.inputEl.rows = 3;
				text.inputEl.style.width = '100%';
			});

		// World Selector
		new Setting(contentEl)
			.setName('World Setting')
			.setDesc('The world/setting this campaign takes place in')
			.addDropdown(dropdown => {
				this.worldPresets.forEach(preset => {
					dropdown.addOption(preset.id, preset.name);
				});
				dropdown.setValue(this.formData.worldId);
				dropdown.onChange(value => {
					this.formData.worldId = value;
				});
			});

		// Libraries (simplified - just show current, editing deferred to settings)
		const libraryText = this.formData.activeLibraryIds.length > 0
			? this.formData.activeLibraryIds.join(', ')
			: 'None';

		new Setting(contentEl)
			.setName('Libraries')
			.setDesc('Active libraries for this campaign (edit in Campaign Settings)')
			.addText(text => {
				text.setValue(libraryText);
				text.inputEl.disabled = true;
			});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'quartermaster-wizard-buttons' });

		const saveBtn = buttonContainer.createEl('button', {
			text: 'Save Changes',
			cls: 'mod-cta'
		});

		saveBtn.onclick = async () => {
			await this.saveChanges();
		};

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => {
			this.close();
		};
	}

	private async saveChanges(): Promise<void> {
		try {
			// Validate name
			if (!this.formData.name || this.formData.name.trim().length === 0) {
				new Notice('Campaign name is required');
				return;
			}

			if (this.formData.name.length > 100) {
				new Notice('Campaign name must be 100 characters or less');
				return;
			}

			// Update campaign via CampaignManager
			const campaignManager = this.plugin.adapterFactory.getCampaignManager();
			if (!campaignManager) {
				throw new Error('CampaignManager not available');
			}

			await campaignManager.updateCampaign(this.campaign.id, {
				name: this.formData.name.trim(),
				description: this.formData.description.trim() || undefined,
				worldId: this.formData.worldId
			});

			new Notice(`Campaign "${this.formData.name}" updated successfully`);
			this.close();

			// Trigger refresh
			if (this.onComplete) {
				this.onComplete();
			}

		} catch (error) {
			console.error('[CampaignEditModal] Failed to save changes:', error);
			new Notice(`Failed to save changes: ${error.message}`);
		}
	}
}

/**
 * Campaign Clone Modal
 * Sub-modal for cloning campaigns
 */
class CampaignCloneModal extends Modal {
	private newName: string = '';

	constructor(
		app: App,
		private plugin: QuartermasterPlugin,
		private campaign: CampaignProfile,
		private onComplete: () => void
	) {
		super(app);
		this.newName = `${campaign.name} (Copy)`;
	}

	onOpen() {
		this.render();
	}

	onClose() {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Clone Campaign' });

		contentEl.createEl('p', {
			text: `Create a copy of "${this.campaign.name}" with a new name.`,
			cls: 'setting-item-description'
		});

		// New Name
		new Setting(contentEl)
			.setName('New Campaign Name')
			.setDesc('Name for the cloned campaign')
			.addText(text => text
				.setPlaceholder('Campaign name')
				.setValue(this.newName)
				.onChange(value => {
					this.newName = value;
				})
			);

		// Info note
		contentEl.createEl('p', {
			text: 'Note: This clones the campaign profile only. Campaign data files are not copied.',
			cls: 'mod-warning'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'quartermaster-wizard-buttons' });

		const cloneBtn = buttonContainer.createEl('button', {
			text: 'Clone Campaign',
			cls: 'mod-cta'
		});

		cloneBtn.onclick = async () => {
			await this.cloneCampaign();
		};

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => {
			this.close();
		};
	}

	private async cloneCampaign(): Promise<void> {
		try {
			// Validate name
			if (!this.newName || this.newName.trim().length === 0) {
				new Notice('Campaign name is required');
				return;
			}

			if (this.newName.length > 100) {
				new Notice('Campaign name must be 100 characters or less');
				return;
			}

			// Clone via CampaignManager
			const campaignManager = this.plugin.adapterFactory.getCampaignManager();
			if (!campaignManager) {
				throw new Error('CampaignManager not available');
			}

			const clonedCampaign = await campaignManager.cloneCampaign(
				this.campaign.id,
				this.newName.trim(),
				{
					updatePathMappings: true // Add suffix to avoid path conflicts
				}
			);

			new Notice(`Campaign "${this.newName}" created successfully`);
			this.close();

			// Trigger refresh
			if (this.onComplete) {
				this.onComplete();
			}

		} catch (error) {
			console.error('[CampaignCloneModal] Failed to clone campaign:', error);
			new Notice(`Failed to clone campaign: ${error.message}`);
		}
	}
}

/**
 * Campaign Delete Confirmation Modal
 * Sub-modal for confirming campaign deletion
 */
class CampaignDeleteConfirmModal extends Modal {
	constructor(
		app: App,
		private plugin: QuartermasterPlugin,
		private campaign: CampaignMetadata,
		private onComplete: () => void
	) {
		super(app);
	}

	onOpen() {
		this.render();
	}

	onClose() {
		this.contentEl.empty();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Delete Campaign?' });

		contentEl.createEl('p', {
			text: `Are you sure you want to delete the campaign "${this.campaign.name}"?`
		});

		contentEl.createEl('p', {
			text: 'This action cannot be undone. Campaign data files will NOT be deleted from the vault.',
			cls: 'mod-warning'
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'quartermaster-wizard-buttons' });

		const deleteBtn = buttonContainer.createEl('button', {
			text: 'Delete Campaign',
			cls: 'mod-warning'
		});

		deleteBtn.onclick = async () => {
			await this.deleteCampaign();
		};

		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel',
			cls: 'mod-cta'
		});
		cancelBtn.onclick = () => {
			this.close();
		};
	}

	private async deleteCampaign(): Promise<void> {
		try {
			// Delete via CampaignManager
			const campaignManager = this.plugin.adapterFactory.getCampaignManager();
			if (!campaignManager) {
				throw new Error('CampaignManager not available');
			}

			await campaignManager.deleteCampaign(this.campaign.id);

			new Notice(`Campaign "${this.campaign.name}" deleted`);
			this.close();

			// Trigger refresh
			if (this.onComplete) {
				this.onComplete();
			}

		} catch (error) {
			console.error('[CampaignDeleteConfirmModal] Failed to delete campaign:', error);
			new Notice(`Failed to delete campaign: ${error.message}`);
		}
	}
}
