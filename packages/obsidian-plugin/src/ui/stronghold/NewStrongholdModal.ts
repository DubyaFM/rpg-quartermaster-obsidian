// Creation wizard for new strongholds
import { Modal, App, Setting, Notice, TextComponent } from 'obsidian';
import { Stronghold } from '@quartermaster/core/models/stronghold';
import type QuartermasterPlugin from '../../main';
import { StrongholdDashboardModal } from './StrongholdDashboardModal';

export class NewStrongholdModal extends Modal {
	plugin: QuartermasterPlugin;
	name: string = '';
	ownershipType: 'party' | 'individual' = 'party';
	ownerName: string = '';
	ownerLinkedFile: string = '';
	location: string = '';
	basicDefendersCount: number = 0;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('new-stronghold-modal');

		contentEl.createEl('h2', { text: 'Create New Stronghold' });

		// Name Input
		new Setting(contentEl)
			.setName('Stronghold Name')
			.setDesc('A unique name for this stronghold')
			.addText(text => text
				.setPlaceholder('Thorin\'s Mountain Keep')
				.setValue(this.name)
				.onChange(value => {
					this.name = value;
				}));

		// Ownership Type
		new Setting(contentEl)
			.setName('Ownership Type')
			.setDesc('Is this owned by the party or an individual?')
			.addDropdown(dropdown => dropdown
				.addOption('party', 'Party Owned')
				.addOption('individual', 'Individual Owned')
				.setValue(this.ownershipType)
				.onChange(async (value) => {
					this.ownershipType = value as 'party' | 'individual';
					// Re-render to show/hide owner fields
					this.onOpen();
				}));

		// Owner Name (only if individual)
		if (this.ownershipType === 'individual') {
			new Setting(contentEl)
				.setName('Owner Name')
				.setDesc('Name of the individual owner')
				.addText(text => text
					.setPlaceholder('Character Name')
					.setValue(this.ownerName)
					.onChange(value => {
						this.ownerName = value;
					}));

			new Setting(contentEl)
				.setName('Owner Link')
				.setDesc('Optional link to character sheet (e.g., [[Character Name]])')
				.addText(text => text
					.setPlaceholder('[[Character Name]]')
					.setValue(this.ownerLinkedFile)
					.onChange(value => {
						this.ownerLinkedFile = value;
					}));
		}

		// Location
		new Setting(contentEl)
			.setName('Location')
			.setDesc('Optional location description')
			.addText(text => text
				.setPlaceholder('The Sword Mountains')
				.setValue(this.location)
				.onChange(value => {
					this.location = value;
				}));

		// Basic Defenders Count
		new Setting(contentEl)
			.setName('Initial Defenders')
			.setDesc('Number of basic defenders (0-100)')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(this.basicDefendersCount.toString())
				.onChange(value => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0) {
						this.basicDefendersCount = num;
					}
				}));

		// Actions
		const actionsContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		new Setting(actionsContainer)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText('Create Stronghold')
				.setCta()
				.onClick(async () => {
					await this.createStronghold();
				}));
	}

	async createStronghold() {
		// Validation
		if (!this.name || this.name.trim() === '') {
			new Notice('Please provide a stronghold name');
			return;
		}

		if (this.ownershipType === 'individual' && (!this.ownerName || this.ownerName.trim() === '')) {
			new Notice('Please provide an owner name for individual ownership');
			return;
		}

		try {
			const folder = this.plugin.settings.strongholdsFolder || 'Strongholds';
			const stashFolder = this.plugin.settings.strongholdStashesFolder || 'Strongholds/Stashes';

			// Generate stash inventory file path
			const stashFileName = `${this.name.replace(/[^a-zA-Z0-9]/g, '_')}_Stash.md`;
			const stashInventoryFile = `${stashFolder}/${stashFileName}`;

			// Create stronghold data
			const stronghold: Stronghold = {
				id: `stronghold_${Date.now()}`,
				name: this.name,
				ownership: {
					type: this.ownershipType,
					ownerName: this.ownershipType === 'individual' ? this.ownerName : undefined,
					ownerLinkedFile: this.ownershipType === 'individual' && this.ownerLinkedFile ? this.ownerLinkedFile : undefined
				},
				location: this.location || undefined,
				defenders: {
					basic: {
						current: this.basicDefendersCount,
						maximum: this.basicDefendersCount
					},
					special: []
				},
				stashInventoryFile: stashInventoryFile,
				facilities: [],
				activeBuffs: [],
				neglectCounter: 0,
				metadata: {
					createdDate: new Date().toISOString(),
					lastModified: new Date().toISOString()
				}
			};

			// Save stronghold
			await this.plugin.dataAdapter.saveStronghold(stronghold);

			// Create stash inventory file
			await this.createStashInventoryFile(stashInventoryFile);

			new Notice(`Stronghold "${this.name}" created successfully!`);
			this.close();

			// Open dashboard
			new StrongholdDashboardModal(this.app, this.plugin).open();
		} catch (error) {
			console.error('Failed to create stronghold:', error);
			new Notice('Failed to create stronghold. See console for details.');
		}
	}

	async createStashInventoryFile(filePath: string) {
		try {
			const content = `---
name: ${this.name} Stash
type: inventory
---

# ${this.name} Stash

This is the inventory stash for ${this.name}.

## Gold
- 0 gp

## Items
- (None yet)
`;

			// Ensure folder exists
			const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
			const folder = this.app.vault.getAbstractFileByPath(folderPath);

			if (!folder) {
				await this.app.vault.createFolder(folderPath);
			}

			// Create file
			await this.app.vault.create(filePath, content);
		} catch (error) {
			console.error('Failed to create stash inventory file:', error);
			// Don't fail the whole operation if stash creation fails
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
