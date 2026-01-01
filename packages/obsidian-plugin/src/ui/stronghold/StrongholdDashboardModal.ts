// Main dashboard for stronghold management
import { Modal, App, Setting, Notice } from 'obsidian';
import { Stronghold } from '@quartermaster/core/models/stronghold';
import type QuartermasterPlugin from '../../main';
import { NewStrongholdModal } from './NewStrongholdModal';

export class StrongholdDashboardModal extends Modal {
	plugin: QuartermasterPlugin;
	strongholds: Stronghold[] = [];
	selectedStronghold: Stronghold | null = null;
	ownershipFilter: 'all' | 'party' | 'individual' = 'all';

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('stronghold-dashboard-modal');

		await this.loadStrongholds();
		this.renderHeader(contentEl);
		this.renderFilters(contentEl);
		this.renderStrongholdList(contentEl);
		if (this.selectedStronghold) {
			this.renderStrongholdDetails(contentEl);
		}
	}

	async loadStrongholds() {
		try {
			const paths = await this.plugin.dataAdapter.listStrongholds();
			this.strongholds = [];

			// listStrongholds() returns string[] for Obsidian, Stronghold[] for backend
			for (const pathOrStronghold of paths) {
				if (typeof pathOrStronghold === 'string') {
					const stronghold = await this.plugin.dataAdapter.loadStronghold(pathOrStronghold);
					if (stronghold) {
						this.strongholds.push(stronghold);
					}
				} else {
					this.strongholds.push(pathOrStronghold);
				}
			}
		} catch (error) {
			console.error('Failed to load strongholds:', error);
			new Notice('Failed to load strongholds');
		}
	}

	renderHeader(container: HTMLElement) {
		const header = container.createDiv({ cls: 'stronghold-dashboard-header' });
		header.createEl('h2', { text: 'Stronghold Management' });

		const actions = header.createDiv({ cls: 'stronghold-dashboard-actions' });

		new Setting(actions)
			.addButton(btn => btn
				.setButtonText('Create New Stronghold')
				.setCta()
				.onClick(() => {
					this.close();
					new NewStrongholdModal(this.app, this.plugin).open();
				}));
	}

	renderFilters(container: HTMLElement) {
		const filterContainer = container.createDiv({ cls: 'stronghold-filters' });

		new Setting(filterContainer)
			.setName('Filter by Ownership')
			.addDropdown(dropdown => dropdown
				.addOption('all', 'All')
				.addOption('party', 'Party Owned')
				.addOption('individual', 'Individual Owned')
				.setValue(this.ownershipFilter)
				.onChange(async (value) => {
					this.ownershipFilter = value as 'all' | 'party' | 'individual';
					await this.onOpen();
				}));
	}

	renderStrongholdList(container: HTMLElement) {
		const listContainer = container.createDiv({ cls: 'stronghold-list-container' });
		listContainer.createEl('h3', { text: 'Your Strongholds' });

		const filteredStrongholds = this.strongholds.filter(s => {
			if (this.ownershipFilter === 'all') return true;
			return s.ownership.type === this.ownershipFilter;
		});

		if (filteredStrongholds.length === 0) {
			listContainer.createEl('p', {
				text: 'No strongholds found. Create your first stronghold to get started!',
				cls: 'stronghold-empty-state'
			});
			return;
		}

		const list = listContainer.createDiv({ cls: 'stronghold-list' });

		filteredStrongholds.forEach(stronghold => {
			const item = list.createDiv({ cls: 'stronghold-list-item' });

			if (this.selectedStronghold?.id === stronghold.id) {
				item.addClass('selected');
			}

			const nameDiv = item.createDiv({ cls: 'stronghold-name' });
			nameDiv.createEl('strong', { text: stronghold.name });

			const ownerDiv = item.createDiv({ cls: 'stronghold-owner' });
			if (stronghold.ownership.type === 'party') {
				ownerDiv.createEl('span', { text: 'Party Owned' });
			} else {
				ownerDiv.createEl('span', { text: `Owner: ${stronghold.ownership.ownerName || 'Unknown'}` });
			}

			const statsDiv = item.createDiv({ cls: 'stronghold-quick-stats' });
			statsDiv.createEl('span', { text: `Facilities: ${stronghold.facilities.length}` });
			statsDiv.createEl('span', { text: `Defenders: ${stronghold.defenders.basic.current}/${stronghold.defenders.basic.maximum}` });
			statsDiv.createEl('span', { text: `Buffs: ${stronghold.activeBuffs.length}` });

			item.addEventListener('click', () => {
				this.selectedStronghold = stronghold;
				this.onOpen();
			});
		});
	}

	renderStrongholdDetails(container: HTMLElement) {
		if (!this.selectedStronghold) return;

		const detailsContainer = container.createDiv({ cls: 'stronghold-details-container' });
		detailsContainer.createEl('h3', { text: this.selectedStronghold.name });

		// Basic Info
		const infoSection = detailsContainer.createDiv({ cls: 'stronghold-info-section' });
		infoSection.createEl('h4', { text: 'Basic Information' });

		if (this.selectedStronghold.location) {
			infoSection.createEl('p', { text: `Location: ${this.selectedStronghold.location}` });
		}

		infoSection.createEl('p', {
			text: `Created: ${new Date(this.selectedStronghold.metadata.createdDate).toLocaleDateString()}`
		});

		// Defenders Section
		const defendersSection = detailsContainer.createDiv({ cls: 'stronghold-defenders-section' });
		defendersSection.createEl('h4', { text: 'Defenders' });
		defendersSection.createEl('p', {
			text: `Basic: ${this.selectedStronghold.defenders.basic.current}/${this.selectedStronghold.defenders.basic.maximum}`
		});

		if (this.selectedStronghold.defenders.special.length > 0) {
			const specialList = defendersSection.createEl('ul');
			this.selectedStronghold.defenders.special.forEach(defender => {
				const li = specialList.createEl('li');
				li.createEl('strong', { text: defender.name });
				li.appendText(` - ${defender.role} (${defender.status})`);
			});
		}

		new Setting(defendersSection)
			.addButton(btn => btn
				.setButtonText('Manage Defenders')
				.onClick(() => {
					new Notice('Manage Defenders modal coming soon');
					// TODO: Open ManageDefendersModal
				}));

		// Facilities Section
		const facilitiesSection = detailsContainer.createDiv({ cls: 'stronghold-facilities-section' });
		facilitiesSection.createEl('h4', { text: 'Facilities' });

		if (this.selectedStronghold.facilities.length === 0) {
			facilitiesSection.createEl('p', { text: 'No facilities built yet' });
		} else {
			const facilitiesList = facilitiesSection.createEl('ul');
			this.selectedStronghold.facilities.forEach(facility => {
				const li = facilitiesList.createEl('li');
				li.createEl('strong', { text: facility.name });
				li.appendText(` - ${facility.status}`);
			});
		}

		// Active Buffs Section
		if (this.selectedStronghold.activeBuffs.length > 0) {
			const buffsSection = detailsContainer.createDiv({ cls: 'stronghold-buffs-section' });
			buffsSection.createEl('h4', { text: 'Active Buffs' });

			const buffsList = buffsSection.createEl('ul');
			this.selectedStronghold.activeBuffs.forEach(buff => {
				const li = buffsList.createEl('li');
				li.createEl('strong', { text: buff.name });
				li.appendText(` - ${buff.description}`);
				if (buff.expiresOnDay) {
					li.appendText(` (Expires: Day ${buff.expiresOnDay})`);
				}
			});
		}

		// Actions
		const actionsSection = detailsContainer.createDiv({ cls: 'stronghold-actions-section' });
		actionsSection.createEl('h4', { text: 'Actions' });

		new Setting(actionsSection)
			.addButton(btn => btn
				.setButtonText('Give Orders')
				.onClick(() => {
					new Notice('Give Orders modal coming soon');
					// TODO: Open GiveOrdersModal
				}));

		new Setting(actionsSection)
			.addButton(btn => btn
				.setButtonText('View Stash')
				.onClick(() => {
					if (this.selectedStronghold?.stashInventoryFile) {
						this.app.workspace.openLinkText(
							this.selectedStronghold.stashInventoryFile,
							'',
							false
						);
					} else {
						new Notice('No stash inventory file configured');
					}
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
