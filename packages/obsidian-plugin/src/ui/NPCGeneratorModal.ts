// NPC Generator Modal - Create new NPCs
import { Modal, App, Setting, Notice } from 'obsidian';
import { NPCProfile, NPCRole } from '@quartermaster/core/models/npc';
import { generateNPC, generateShopkeepNPC, generateHirelingNPC } from '@quartermaster/core/generators/npc';
import { rerollShopkeepTrait } from '@quartermaster/core/generators/shopkeeper';
import { ObsidianRandomizer } from '../utils/ObsidianRandomizer';
import type QuartermasterPlugin from '../main';

export class NPCGeneratorModal extends Modal {
	plugin: QuartermasterPlugin;
	npc: NPCProfile | null = null;
	npcType: 'general' | 'shopkeep' | 'hireling' = 'general';
	hirelingType: 'unskilled' | 'skilled' | 'expert' = 'skilled';
	onSave?: (npc: NPCProfile, filePath: string) => void;

	constructor(app: App, plugin: QuartermasterPlugin, onSave?: (npc: NPCProfile, filePath: string) => void) {
		super(app);
		this.plugin = plugin;
		this.onSave = onSave;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Generate NPC' });

		this.renderTypeSelector(contentEl);

		if (!this.npc) {
			this.renderGenerateButton(contentEl);
		} else {
			this.renderNPCPreview(contentEl);
			this.renderRerollButtons(contentEl);
			this.renderActions(contentEl);
		}
	}

	renderTypeSelector(container: HTMLElement) {
		new Setting(container)
			.setName('NPC Type')
			.setDesc('Choose what type of NPC to generate')
			.addDropdown(dropdown => dropdown
				.addOption('general', 'General NPC')
				.addOption('shopkeep', 'Shopkeeper')
				.addOption('hireling', 'Hireling')
				.setValue(this.npcType)
				.onChange(value => {
					this.npcType = value as any;
					this.npc = null; // Reset NPC when type changes
					this.onOpen();
				}));

		// Show hireling type selector if hireling is selected
		if (this.npcType === 'hireling') {
			new Setting(container)
				.setName('Hireling Type')
				.setDesc('Skill level of the hireling')
				.addDropdown(dropdown => dropdown
					.addOption('unskilled', 'Unskilled (2 sp/day)')
					.addOption('skilled', 'Skilled (2 gp/day)')
					.addOption('expert', 'Expert (varies)')
					.setValue(this.hirelingType)
					.onChange(value => {
						this.hirelingType = value as any;
						this.npc = null;
						this.onOpen();
					}));
		}
	}

	renderGenerateButton(container: HTMLElement) {
		new Setting(container)
			.addButton(btn => btn
				.setButtonText('Generate NPC')
				.setCta()
				.onClick(async () => {
					await this.generateNewNPC();
				}));
	}

	async generateNewNPC() {
		try {
			const randomizer = new ObsidianRandomizer();
			const config = await this.plugin.dataAdapter.getShopkeepConfig();

			switch (this.npcType) {
				case 'shopkeep':
					this.npc = generateShopkeepNPC(randomizer, config);
					break;
				case 'hireling':
					this.npc = generateHirelingNPC(randomizer, config, this.hirelingType);
					break;
				default:
					this.npc = generateNPC(randomizer, config);
					break;
			}

			this.onOpen(); // Re-render with NPC preview
		} catch (error) {
			new Notice('Failed to generate NPC');
			console.error(error);
		}
	}

	renderNPCPreview(container: HTMLElement) {
		if (!this.npc) return;

		const previewContainer = container.createDiv({ cls: 'npc-preview' });

		// Name and species
		previewContainer.createEl('h3', { text: this.npc.name });
		previewContainer.createEl('p', {
			text: `${this.npc.species} • ${this.npc.gender} • ${this.npc.pronouns || ''}`,
			cls: 'npc-preview-subtitle'
		});

		// Disposition
		const dispositionColor = this.getDispositionColor(this.npc.disposition);
		previewContainer.createEl('p', {
			text: `Disposition: ${this.npc.disposition} (DC ${this.npc.bargainDC})`,
			cls: `npc-preview-disposition npc-disposition-${this.npc.disposition}`
		});

		// Quirk
		previewContainer.createEl('p', {
			text: `"${this.npc.quirk}"`,
			cls: 'npc-preview-quirk'
		});

		// Alignment
		if (this.npc.alignment) {
			previewContainer.createEl('p', { text: `Alignment: ${this.npc.alignment}` });
		}

		// Roles
		if (this.npc.roles.length > 0) {
			previewContainer.createEl('p', { text: `Roles: ${this.npc.roles.join(', ')}` });
		}

		// Capabilities (for hirelings)
		if (this.npc.skills && this.npc.skills.length > 0) {
			previewContainer.createEl('p', { text: `Skills: ${this.npc.skills.join(', ')}` });
		}

		if (this.npc.toolProficiencies && this.npc.toolProficiencies.length > 0) {
			previewContainer.createEl('p', { text: `Tools: ${this.npc.toolProficiencies.join(', ')}` });
		}

		if (this.npc.specialAbilities && this.npc.specialAbilities.length > 0) {
			previewContainer.createEl('p', { text: `Abilities: ${this.npc.specialAbilities.join(', ')}` });
		}
	}

	renderRerollButtons(container: HTMLElement) {
		if (!this.npc) return;

		const rerollContainer = container.createDiv({ cls: 'npc-reroll-buttons' });
		rerollContainer.createEl('h4', { text: 'Re-roll Individual Traits' });

		const buttonContainer = rerollContainer.createDiv({ cls: 'npc-reroll-button-grid' });

		// Re-roll buttons
		this.addRerollButton(buttonContainer, 'Name', 'name');
		this.addRerollButton(buttonContainer, 'Species', 'species');
		this.addRerollButton(buttonContainer, 'Gender', 'gender');
		this.addRerollButton(buttonContainer, 'Disposition', 'disposition');
		this.addRerollButton(buttonContainer, 'Quirk', 'quirk');
	}

	addRerollButton(
		container: HTMLElement,
		label: string,
		trait: 'name' | 'species' | 'gender' | 'disposition' | 'quirk'
	) {
		const button = container.createEl('button', {
			text: `🎲 ${label}`,
			cls: 'npc-reroll-button'
		});

		button.onclick = async () => {
			await this.rerollTrait(trait);
		};
	}

	async rerollTrait(trait: 'name' | 'species' | 'gender' | 'disposition' | 'quirk') {
		if (!this.npc) return;

		try {
			const randomizer = new ObsidianRandomizer();
			const config = await this.plugin.dataAdapter.getShopkeepConfig();

			// Use shopkeeper reroll logic (works for all NPC types)
			const shopkeep = {
				name: this.npc.name,
				species: this.npc.species,
				gender: this.npc.gender,
				disposition: this.npc.disposition,
				quirk: this.npc.quirk,
				bargainDC: this.npc.bargainDC
			};

			const updated = rerollShopkeepTrait(randomizer, shopkeep, trait, config);

			// Update NPC with rerolled values
			this.npc.name = updated.name;
			this.npc.species = updated.species;
			this.npc.gender = updated.gender;
			this.npc.disposition = updated.disposition;
			this.npc.quirk = updated.quirk;
			this.npc.bargainDC = updated.bargainDC;

			this.onOpen(); // Re-render
		} catch (error) {
			new Notice('Failed to re-roll trait');
			console.error(error);
		}
	}

	renderActions(container: HTMLElement) {
		const actionsContainer = container.createDiv({ cls: 'npc-actions' });

		new Setting(actionsContainer)
			.addButton(btn => btn
				.setButtonText('Save NPC')
				.setCta()
				.onClick(async () => {
					await this.saveNPC();
				}))
			.addButton(btn => btn
				.setButtonText('Generate New')
				.onClick(async () => {
					await this.generateNewNPC();
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}));
	}

	async saveNPC() {
		if (!this.npc) return;

		try {
			const filePath = await this.plugin.dataAdapter.saveNPC(this.npc);
			new Notice(`Created ${this.npc.name}`);

			if (this.onSave) {
				this.onSave(this.npc, filePath);
			}

			this.close();
		} catch (error) {
			new Notice('Failed to save NPC');
			console.error(error);
		}
	}

	getDispositionColor(disposition: string): string {
		const colors: Record<string, string> = {
			hostile: '#ff4444',
			unfriendly: '#ff8844',
			neutral: '#ffbb44',
			friendly: '#88dd88',
			helpful: '#44dd44'
		};
		return colors[disposition] || '#999999';
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
