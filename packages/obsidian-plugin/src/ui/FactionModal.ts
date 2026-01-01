/**
 * FactionModal
 *
 * Modal for creating and editing faction files.
 * Supports renown tracking, alignment selection, and rank ladder configuration.
 */

import { Modal, App, Setting, Notice } from 'obsidian';
import { FactionEntity, RenownRank } from '@quartermaster/core/models/types';
import { createNewFaction, createFactionWithRenown, VALID_ALIGNMENTS } from '@quartermaster/core/services/FactionService';
import type QuartermasterPlugin from '../main';

export class FactionModal extends Modal {
	plugin: QuartermasterPlugin;
	faction: FactionEntity | null = null;  // null for new faction, populated for edit
	isEditMode: boolean = false;

	// Form values
	name: string = '';
	description: string = '';
	alignment: string = 'True Neutral';
	enableRenown: boolean = false;
	partyScore: number = 0;
	rankLadderType: string = 'faction-positive';
	individualScores: Record<string, number> = {};

	// Callbacks
	onSave?: (faction: FactionEntity) => Promise<void>;

	constructor(app: App, plugin: QuartermasterPlugin, existingFaction?: FactionEntity) {
		super(app);
		this.plugin = plugin;

		if (existingFaction) {
			this.faction = existingFaction;
			this.isEditMode = true;
			this.loadFactionData(existingFaction);
		}
	}

	/**
	 * Load existing faction data into form fields
	 */
	private loadFactionData(faction: FactionEntity): void {
		this.name = faction.name;
		this.description = faction.description;
		this.alignment = faction.alignment;
		this.enableRenown = faction.renownTracking?.enabled || false;
		this.partyScore = faction.renownTracking?.partyScore || 0;
		this.individualScores = faction.renownTracking?.individualScores || {};

		// Detect rank ladder type based on ladder content
		this.rankLadderType = this.detectRankLadderType(faction.renownTracking?.rankLadder);
	}

	/**
	 * Detect rank ladder type from existing ladder
	 */
	private detectRankLadderType(rankLadder?: RenownRank[]): string {
		if (!rankLadder || rankLadder.length === 0) {
			return 'faction-positive';
		}

		// Check if ladder has negative thresholds
		const hasNegative = rankLadder.some(rank => rank.threshold < 0);
		const hasPositive = rankLadder.some(rank => rank.threshold > 0);

		if (hasNegative && hasPositive) {
			return 'faction-combined';
		} else if (hasNegative) {
			return 'faction-negative';
		}

		return 'faction-positive';
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: this.isEditMode ? 'Edit Faction' : 'Create New Faction' });

		// Name
		new Setting(contentEl)
			.setName('Faction Name')
			.setDesc('Name of this faction or organization')
			.addText(text => text
				.setPlaceholder('The Harpers, Zhentarim, City Guard, etc.')
				.setValue(this.name)
				.onChange(value => this.name = value));

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Brief description of this faction')
			.addTextArea(text => {
				text
					.setPlaceholder('A secret network of spellcasters and spies who covertly oppose the rise of tyranny...')
					.setValue(this.description)
					.onChange(value => this.description = value);
				text.inputEl.rows = 4;
				text.inputEl.style.width = '100%';
			});

		// Alignment
		new Setting(contentEl)
			.setName('Alignment')
			.setDesc('D&D alignment for this faction')
			.addDropdown(dropdown => {
				for (const alignment of VALID_ALIGNMENTS) {
					dropdown.addOption(alignment, alignment);
				}
				dropdown.setValue(this.alignment);
				dropdown.onChange(value => this.alignment = value);
			});

		// Renown Tracking Toggle
		const renownContainer = contentEl.createDiv({ cls: 'renown-section' });

		new Setting(renownContainer)
			.setName('Enable Renown Tracking')
			.setDesc('Track party reputation with this faction')
			.addToggle(toggle => toggle
				.setValue(this.enableRenown)
				.onChange(value => {
					this.enableRenown = value;
					this.updateRenownFields();
				}));

		// Renown fields container (shown only when enabled)
		const renownFieldsDiv = renownContainer.createDiv({ cls: 'renown-fields' });
		renownFieldsDiv.style.display = this.enableRenown ? 'block' : 'none';

		// Party Score
		new Setting(renownFieldsDiv)
			.setName('Party Renown Score')
			.setDesc('Default reputation score (used when no individual override exists, can be negative)')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(this.partyScore.toString())
				.onChange(value => {
					const parsed = parseInt(value);
					if (!isNaN(parsed)) {
						this.partyScore = parsed;
					}
				}));

		// Individual Player Scores Section
		const individualSection = renownFieldsDiv.createDiv({ cls: 'individual-scores-section' });
		individualSection.createEl('h4', { text: 'Individual Player Overrides' });
		individualSection.createEl('p', {
			text: 'Override party score for specific players',
			cls: 'setting-item-description'
		});

		// Container for individual score entries
		const individualListDiv = individualSection.createDiv({ cls: 'individual-scores-list' });
		this.renderIndividualScores(individualListDiv);

		// Add new individual score
		const addIndividualSetting = new Setting(individualSection)
			.setName('Add Player Override')
			.setDesc('Enter player name and score (can be negative)');

		let newPlayerName = '';
		let newPlayerScore = 0;

		addIndividualSetting.addText(text => {
			text.setPlaceholder('Player name');
			text.onChange(value => newPlayerName = value);
		});

		addIndividualSetting.addText(text => {
			text.setPlaceholder('Score');
			text.onChange(value => {
				const parsed = parseInt(value);
				if (!isNaN(parsed)) {
					newPlayerScore = parsed;
				}
			});
		});

		addIndividualSetting.addButton(button => {
			button.setButtonText('Add');
			button.onClick(() => {
				if (newPlayerName.trim()) {
					this.individualScores[newPlayerName.trim()] = newPlayerScore;
					this.renderIndividualScores(individualListDiv);
					// Clear inputs
					newPlayerName = '';
					newPlayerScore = 0;
					// Re-render the add section to clear input fields
					addIndividualSetting.clear();
					this.rebuildAddIndividualSetting(addIndividualSetting, individualListDiv);
				}
			});
		});

		// Store reference for updates
		(this as any).individualListDiv = individualListDiv;

		// Rank Ladder Type
		const ladderSetting = new Setting(renownFieldsDiv)
			.setName('Rank Ladder')
			.setDesc('Reputation rank progression for this faction');

		// Get available ladder types from config service
		const ladderTypes = this.getAvailableLadderTypes();
		ladderSetting.addDropdown(dropdown => {
			for (const type of ladderTypes) {
				const label = this.formatLadderTypeName(type);
				dropdown.addOption(`faction-${type}`, label);
			}
			dropdown.setValue(this.rankLadderType);
			dropdown.onChange(value => this.rankLadderType = value);
		});

		// Store reference to renown fields for toggle
		(this as any).renownFieldsDiv = renownFieldsDiv;

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		// Save button
		buttonContainer.createEl('button', { text: this.isEditMode ? 'Save Changes' : 'Create Faction' }, (btn) => {
			btn.addEventListener('click', async () => {
				await this.handleSave();
			});
			btn.addClass('mod-cta');
		});

		// Cancel button
		buttonContainer.createEl('button', { text: 'Cancel' }, (btn) => {
			btn.addEventListener('click', () => {
				this.close();
			});
		});
	}

	/**
	 * Update visibility of renown fields based on toggle
	 */
	private updateRenownFields(): void {
		const renownFieldsDiv = (this as any).renownFieldsDiv as HTMLDivElement;
		if (renownFieldsDiv) {
			renownFieldsDiv.style.display = this.enableRenown ? 'block' : 'none';
		}
	}

	/**
	 * Handle save button click
	 */
	private async handleSave(): Promise<void> {
		// Validate name
		if (!this.name || this.name.trim() === '') {
			new Notice('Faction name is required');
			return;
		}

		// Validate description
		if (!this.description || this.description.trim() === '') {
			new Notice('Faction description is required');
			return;
		}

		// Create or update faction object
		let faction: FactionEntity;

		if (this.isEditMode && this.faction) {
			// Update existing faction
			faction = {
				...this.faction,
				name: this.name.trim(),
				description: this.description.trim(),
				alignment: this.alignment,
				lastUpdated: new Date().toISOString()
			};

			// Update renown tracking
			if (this.enableRenown) {
				if (!faction.renownTracking) {
					// Enable renown for first time
					faction.renownTracking = {
						enabled: true,
						partyScore: this.partyScore,
						rankLadder: await this.getRankLadder(this.rankLadderType)
					};
					// Add individual scores if any exist
					if (Object.keys(this.individualScores).length > 0) {
						faction.renownTracking.individualScores = this.individualScores;
					}
				} else {
					// Update existing renown
					faction.renownTracking.enabled = true;
					faction.renownTracking.partyScore = this.partyScore;
					// Update individual scores (remove if empty)
					if (Object.keys(this.individualScores).length > 0) {
						faction.renownTracking.individualScores = this.individualScores;
					} else {
						delete faction.renownTracking.individualScores;
					}
				}
			} else {
				// Disable renown if it was enabled
				if (faction.renownTracking) {
					faction.renownTracking.enabled = false;
				}
			}
		} else {
			// Create new faction
			const rankLadderTypeKey = this.rankLadderType.replace('faction-', '');
			const ladderType = rankLadderTypeKey as 'positive' | 'negative' | 'combined';

			if (this.enableRenown) {
				faction = createFactionWithRenown(
					this.name.trim(),
					this.description.trim(),
					this.alignment,
					ladderType,
					await this.getRankLadder(this.rankLadderType)
				);
				faction.renownTracking!.partyScore = this.partyScore;
				// Add individual scores if any exist
				if (Object.keys(this.individualScores).length > 0) {
					faction.renownTracking!.individualScores = this.individualScores;
				}
			} else {
				faction = createNewFaction(
					this.name.trim(),
					this.description.trim(),
					this.alignment
				);
			}
		}

		// Call onSave callback if provided
		if (this.onSave) {
			try {
				await this.onSave(faction);
				new Notice(`Faction "${faction.name}" ${this.isEditMode ? 'updated' : 'created'} successfully`);
				this.close();
			} catch (error) {
				console.error('Failed to save faction:', error);
				new Notice(`Failed to save faction: ${error.message}`);
			}
		} else {
			// Default: save directly via data adapter
			try {
				if (this.isEditMode) {
					const path = await this.plugin.dataAdapter.findFactionPath!(faction.name);
					if (path) {
						await this.plugin.dataAdapter.updateFaction!(path, faction);
						new Notice(`Faction "${faction.name}" updated successfully`);
					} else {
						throw new Error('Faction file not found');
					}
				} else {
					await this.plugin.dataAdapter.saveFaction!(faction);
					new Notice(`Faction "${faction.name}" created successfully`);
				}
				this.close();
			} catch (error) {
				console.error('Failed to save faction:', error);
				new Notice(`Failed to save faction: ${error.message}`);
			}
		}
	}

	/**
	 * Render list of individual player score overrides
	 */
	private renderIndividualScores(container: HTMLDivElement): void {
		container.empty();

		const playerNames = Object.keys(this.individualScores);

		if (playerNames.length === 0) {
			container.createEl('p', {
				text: 'No individual overrides set',
				cls: 'setting-item-description'
			});
			return;
		}

		for (const playerName of playerNames) {
			const score = this.individualScores[playerName];
			const playerDiv = container.createDiv({ cls: 'individual-score-entry' });

			new Setting(playerDiv)
				.setName(playerName)
				.addText(text => {
					text.setValue(score.toString());
					text.onChange(value => {
						const parsed = parseInt(value);
						if (!isNaN(parsed)) {
							this.individualScores[playerName] = parsed;
						}
					});
				})
				.addButton(button => {
					button.setButtonText('Remove');
					button.onClick(() => {
						delete this.individualScores[playerName];
						this.renderIndividualScores(container);
					});
				});
		}
	}

	/**
	 * Rebuild the "Add Player Override" setting after adding a player
	 */
	private rebuildAddIndividualSetting(setting: Setting, listDiv: HTMLDivElement): void {
		let newPlayerName = '';
		let newPlayerScore = 0;

		setting.addText(text => {
			text.setPlaceholder('Player name');
			text.onChange(value => newPlayerName = value);
		});

		setting.addText(text => {
			text.setPlaceholder('Score');
			text.onChange(value => {
				const parsed = parseInt(value);
				if (!isNaN(parsed)) {
					newPlayerScore = parsed;
				}
			});
		});

		setting.addButton(button => {
			button.setButtonText('Add');
			button.onClick(() => {
				if (newPlayerName.trim()) {
					this.individualScores[newPlayerName.trim()] = newPlayerScore;
					this.renderIndividualScores(listDiv);
					// Clear inputs
					newPlayerName = '';
					newPlayerScore = 0;
					// Re-render
					setting.clear();
					this.rebuildAddIndividualSetting(setting, listDiv);
				}
			});
		});
	}

	/**
	 * Get available ladder types from config service
	 */
	private getAvailableLadderTypes(): string[] {
		try {
			const configService = this.plugin.dataAdapter.getRenownConfigService();
			return configService.getFactionLadderTypes();
		} catch (error) {
			console.warn('RenownConfigService not available, using defaults:', error);
			return ['positive', 'negative', 'combined', 'secretOrganization', 'military', 'thievesGuild', 'religious'];
		}
	}

	/**
	 * Format ladder type name for display
	 */
	private formatLadderTypeName(type: string): string {
		const nameMap: Record<string, string> = {
			'positive': 'Positive Reputation (Friendly Faction)',
			'negative': 'Negative Reputation (Hostile Faction)',
			'combined': 'Combined (Both Positive & Negative)',
			'secretOrganization': 'Secret Organization',
			'military': 'Military/Guard',
			'thievesGuild': "Thieves' Guild",
			'religious': 'Religious Order'
		};

		return nameMap[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1');
	}

	/**
	 * Get rank ladder based on type selection
	 */
	private async getRankLadder(type: string): Promise<RenownRank[]> {
		// Extract the ladder type from the prefixed format (e.g., "faction-positive" -> "positive")
		const ladderType = type.replace('faction-', '');

		// Try to load from config service
		try {
			const configService = this.plugin.dataAdapter.getRenownConfigService();
			const ladder = configService.getFactionLadder(ladderType);
			if (ladder) {
				return ladder;
			}
		} catch (error) {
			console.warn('Could not load ladder from config service:', error);
		}

		// Fallback to defaults
		const { DEFAULT_FACTION_RANK_LADDER } = await import('@quartermaster/core/services/FactionService');
		return DEFAULT_FACTION_RANK_LADDER;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
