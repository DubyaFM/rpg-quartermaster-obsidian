// Modal for adding new party members
import { Modal, App, Setting, Notice } from 'obsidian';
import { PartyMember } from '@quartermaster/core/models/types';
import type QuartermasterPlugin from '../main';
import { calculateCarryingCapacity } from '@quartermaster/core/calculators/encumbrance';

export class NewPartyMemberModal extends Modal {
	plugin: QuartermasterPlugin;
	name: string = '';
	strength: number = 10;
	dexterity: number = 10;
	constitution: number = 10;
	intelligence: number = 10;
	wisdom: number = 10;
	charisma: number = 10;
	size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan' = 'Medium';
	level: number = 1;
	capacityDisplay?: HTMLElement;
	onSuccess?: () => void;

	constructor(app: App, plugin: QuartermasterPlugin, onSuccess?: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Add Party Member' });

		// Name
		new Setting(contentEl)
			.setName('Character Name')
			.setDesc('Enter the character\'s name')
			.addText(text => text
				.setPlaceholder('Aragorn')
				.setValue(this.name)
				.onChange(value => this.name = value));

		// Level
		new Setting(contentEl)
			.setName('Level')
			.setDesc('Character level (1-20)')
			.addText(text => text
				.setPlaceholder('1')
				.setValue(String(this.level))
				.onChange(value => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed >= 1 && parsed <= 20) {
						this.level = parsed;
					}
				}));

		// Size
		new Setting(contentEl)
			.setName('Size')
			.setDesc('Character size category')
			.addDropdown(dropdown => dropdown
				.addOption('Tiny', 'Tiny')
				.addOption('Small', 'Small')
				.addOption('Medium', 'Medium')
				.addOption('Large', 'Large')
				.addOption('Huge', 'Huge')
				.addOption('Gargantuan', 'Gargantuan')
				.setValue(this.size)
				.onChange((value) => {
					this.size = value as PartyMember['size'];
					this.updateCapacityDisplay();
				}));

		// Ability Scores Section
		contentEl.createEl('h3', { text: 'Ability Scores', cls: 'ability-scores-header' });

		// Strength
		new Setting(contentEl)
			.setName('Strength')
			.setDesc('STR score (1-30)')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(String(this.strength))
				.onChange(value => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
						this.strength = parsed;
						this.updateCapacityDisplay();
					}
				}));

		// Dexterity
		new Setting(contentEl)
			.setName('Dexterity')
			.setDesc('DEX score (1-30)')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(String(this.dexterity))
				.onChange(value => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
						this.dexterity = parsed;
					}
				}));

		// Constitution
		new Setting(contentEl)
			.setName('Constitution')
			.setDesc('CON score (1-30)')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(String(this.constitution))
				.onChange(value => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
						this.constitution = parsed;
					}
				}));

		// Intelligence
		new Setting(contentEl)
			.setName('Intelligence')
			.setDesc('INT score (1-30)')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(String(this.intelligence))
				.onChange(value => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
						this.intelligence = parsed;
					}
				}));

		// Wisdom
		new Setting(contentEl)
			.setName('Wisdom')
			.setDesc('WIS score (1-30)')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(String(this.wisdom))
				.onChange(value => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
						this.wisdom = parsed;
					}
				}));

		// Charisma
		new Setting(contentEl)
			.setName('Charisma')
			.setDesc('CHA score (1-30)')
			.addText(text => text
				.setPlaceholder('10')
				.setValue(String(this.charisma))
				.onChange(value => {
					const parsed = parseInt(value);
					if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
						this.charisma = parsed;
					}
				}));

		// Carrying Capacity Display
		const capacityDiv = contentEl.createDiv({ cls: 'carrying-capacity-display' });
		capacityDiv.createEl('h3', { text: 'Carrying Capacity' });
		this.capacityDisplay = capacityDiv.createEl('p', { cls: 'capacity-value' });
		this.updateCapacityDisplay();

		// Buttons
		const buttonDiv = contentEl.createDiv({ cls: 'modal-button-container' });

		new Setting(buttonDiv)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText('Create Party Member')
				.setCta()
				.onClick(async () => {
					await this.createPartyMember();
				}));
	}

	/**
	 * Update the carrying capacity display based on current stats
	 */
	private updateCapacityDisplay(): void {
		if (!this.capacityDisplay) return;

		const capacity = calculateCarryingCapacity(
			this.strength,
			this.size
		);

		this.capacityDisplay.setText(`${capacity} lbs`);
	}

	/**
	 * Create the party member and save to vault
	 */
	private async createPartyMember(): Promise<void> {
		// Validation
		if (!this.name.trim()) {
			new Notice('Please enter a character name');
			return;
		}

		// Check if party member folder is set in settings
		const folderPath = this.plugin.settings.partyMemberFolder;
		if (!folderPath) {
			new Notice('Please set Party Member Folder in settings first');
			return;
		}

		try {
			// Generate UUID for the party member
			const id = this.plugin.uuidRegistry.generatePartyMemberId();

			const newMember: PartyMember = {
				id,
				name: this.name.trim(),
				level: this.level,
				strength: this.strength,
				dexterity: this.dexterity,
				constitution: this.constitution,
				intelligence: this.intelligence,
				wisdom: this.wisdom,
				charisma: this.charisma,
				size: this.size,
				bonuses: [],
				dataSource: {
					type: 'manual'
				}
			};

			// Save to file in designated folder
			await this.plugin.dataAdapter.savePartyMember(newMember);

			new Notice(`Party member "${this.name}" created successfully`);

			// Call success callback if provided
			if (this.onSuccess) {
				this.onSuccess();
			}

			this.close();
		} catch (error) {
			console.error('Failed to create party member:', error);
			new Notice(`Failed to create party member: ${error.message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
