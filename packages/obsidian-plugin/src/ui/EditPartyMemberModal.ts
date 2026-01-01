// Modal for editing an existing party member
import { Modal, App, Setting, Notice } from 'obsidian';
import { PartyMember } from '@quartermaster/core/models/types';
import type QuartermasterPlugin from '../main';
import { calculateCarryingCapacity } from '@quartermaster/core/calculators/encumbrance';

export class EditPartyMemberModal extends Modal {
	plugin: QuartermasterPlugin;
	member: PartyMember;
	name: string;
	strength: number;
	dexterity: number;
	constitution: number;
	intelligence: number;
	wisdom: number;
	charisma: number;
	size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
	level: number;
	capacityDisplay?: HTMLElement;
	onSuccess?: () => void;

	constructor(app: App, plugin: QuartermasterPlugin, member: PartyMember, onSuccess?: () => void) {
		super(app);
		this.plugin = plugin;
		this.member = member;
		this.onSuccess = onSuccess;

		// Initialize form values from member
		this.name = member.name;
		this.strength = member.strength || 10;
		this.dexterity = member.dexterity || 10;
		this.constitution = member.constitution || 10;
		this.intelligence = member.intelligence || 10;
		this.wisdom = member.wisdom || 10;
		this.charisma = member.charisma || 10;
		this.size = member.size || 'Medium';
		this.level = member.level || 1;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: `Edit ${this.member.name}` });

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
				.setButtonText('Save Changes')
				.setCta()
				.onClick(async () => {
					await this.savePartyMember();
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
	 * Save the updated party member
	 */
	private async savePartyMember(): Promise<void> {
		// Validation
		if (!this.name.trim()) {
			new Notice('Please enter a character name');
			return;
		}

		try {
			const updatedMember: PartyMember = {
				...this.member,
				name: this.name.trim(),
				level: this.level,
				strength: this.strength,
				dexterity: this.dexterity,
				constitution: this.constitution,
				intelligence: this.intelligence,
				wisdom: this.wisdom,
				charisma: this.charisma,
				size: this.size
			};

			await this.plugin.dataAdapter.updatePartyMember(updatedMember);

			new Notice(`Party member "${this.name}" updated successfully`);

			// Call success callback if provided
			if (this.onSuccess) {
				this.onSuccess();
			}

			this.close();
		} catch (error) {
			console.error('Failed to update party member:', error);
			new Notice(`Failed to update party member: ${error.message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
