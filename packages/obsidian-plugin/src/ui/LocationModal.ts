/**
 * LocationModal
 *
 * Modal for creating and editing location files.
 * Supports renown tracking, parent location hierarchy, and validation.
 */

import { Modal, App, Setting, Notice, DropdownComponent } from 'obsidian';
import { Location, RenownRank } from '@quartermaster/core/models/types';
import { createNewLocation, createLocationWithRenown, validateLocationHierarchy } from '@quartermaster/core/services/LocationService';
import type QuartermasterPlugin from '../main';

export class LocationModal extends Modal {
	plugin: QuartermasterPlugin;
	location: Location | null = null;  // null for new location, populated for edit
	isEditMode: boolean = false;

	// Form values
	name: string = '';
	parentLocation: string = '';
	status: string = '';
	description: string = '';
	enableRenown: boolean = false;
	partyScore: number = 0;
	rankLadderType: string = 'location-default';
	individualScores: Record<string, number> = {};

	// Callbacks
	onSave?: (location: Location) => Promise<void>;

	constructor(app: App, plugin: QuartermasterPlugin, existingLocation?: Location) {
		super(app);
		this.plugin = plugin;

		if (existingLocation) {
			this.location = existingLocation;
			this.isEditMode = true;
			this.loadLocationData(existingLocation);
		}
	}

	/**
	 * Load existing location data into form fields
	 */
	private loadLocationData(location: Location): void {
		this.name = location.name;
		this.parentLocation = location.parentLocation || '';
		this.status = location.status || '';
		this.description = location.description || '';
		this.enableRenown = location.renownTracking?.enabled || false;
		this.partyScore = location.renownTracking?.partyScore || 0;
		this.individualScores = location.renownTracking?.individualScores || {};

		// Detect rank ladder type (simplified - just default for now)
		this.rankLadderType = 'location-default';
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: this.isEditMode ? 'Edit Location' : 'Create New Location' });

		// Name
		new Setting(contentEl)
			.setName('Location Name')
			.setDesc('Name of this location')
			.addText(text => text
				.setPlaceholder('Waterdeep, Dock Ward, The Rusty Anchor, etc.')
				.setValue(this.name)
				.onChange(value => this.name = value));

		// Parent Location
		const parentSetting = new Setting(contentEl)
			.setName('Parent Location')
			.setDesc('Parent location in the hierarchy (leave empty for top-level locations)');

		// Get all locations for dropdown
		const locations = await this.getAllLocationNames();

		parentSetting.addDropdown(dropdown => {
			dropdown.addOption('', '-- No Parent --');

			for (const locationName of locations) {
				// Don't show current location as option (can't be your own parent)
				if (locationName !== this.name) {
					dropdown.addOption(locationName, locationName);
				}
			}

			dropdown.setValue(this.extractLocationName(this.parentLocation));
			dropdown.onChange(value => this.parentLocation = value);
		});

		// Status
		new Setting(contentEl)
			.setName('Status')
			.setDesc('Current status of this location (optional)')
			.addText(text => text
				.setPlaceholder('Prosperous, Plagued, War-torn, etc.')
				.setValue(this.status)
				.onChange(value => this.status = value));

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Brief description of this location (optional)')
			.addTextArea(text => {
				text
					.setPlaceholder('A bustling port city known for its diverse population...')
					.setValue(this.description)
					.onChange(value => this.description = value);
				text.inputEl.rows = 4;
				text.inputEl.style.width = '100%';
			});

		// Renown Tracking Toggle
		const renownContainer = contentEl.createDiv({ cls: 'renown-section' });

		new Setting(renownContainer)
			.setName('Enable Renown Tracking')
			.setDesc('Track party reputation with this location')
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
			.setDesc('Default reputation score (used when no individual override exists)')
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
			.setDesc('Enter player name and score');

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
			.setDesc('Reputation rank progression for this location');

		// Get available ladder types from config service
		const ladderTypes = this.getAvailableLadderTypes();
		ladderSetting.addDropdown(dropdown => {
			for (const type of ladderTypes) {
				const label = this.formatLadderTypeName(type);
				dropdown.addOption(`location-${type}`, label);
			}
			dropdown.setValue(this.rankLadderType);
			dropdown.onChange(value => this.rankLadderType = value);
		});

		// Store reference to renown fields for toggle
		(this as any).renownFieldsDiv = renownFieldsDiv;

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		// Save button
		buttonContainer.createEl('button', { text: this.isEditMode ? 'Save Changes' : 'Create Location' }, (btn) => {
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
	 * Get all existing location names for parent dropdown
	 */
	private async getAllLocationNames(): Promise<string[]> {
		try {
			const paths = await this.plugin.dataAdapter.listLocations!();
			const names: string[] = [];

			for (const path of paths) {
				try {
					const location = await this.plugin.dataAdapter.getLocation!(path);
					names.push(location.name);
				} catch (error) {
					console.error(`Failed to load location ${path}:`, error);
				}
			}

			return names.sort();
		} catch (error) {
			console.error('Failed to load locations:', error);
			return [];
		}
	}

	/**
	 * Load all locations into a map for validation
	 */
	private async getAllLocationsMap(): Promise<Map<string, Location>> {
		const locationMap = new Map<string, Location>();

		try {
			const paths = await this.plugin.dataAdapter.listLocations!();

			for (const path of paths) {
				try {
					const location = await this.plugin.dataAdapter.getLocation!(path);
					locationMap.set(location.name, location);
				} catch (error) {
					console.error(`Failed to load location ${path}:`, error);
				}
			}
		} catch (error) {
			console.error('Failed to load locations for validation:', error);
		}

		return locationMap;
	}

	/**
	 * Extract location name from wikilink or plain string
	 */
	private extractLocationName(value: string): string {
		if (!value) return '';
		const match = value.match(/\[\[(.+?)\]\]/);
		return match ? match[1] : value;
	}

	/**
	 * Handle save button click
	 */
	private async handleSave(): Promise<void> {
		// Validate name
		if (!this.name || this.name.trim() === '') {
			new Notice('Location name is required');
			return;
		}

		// Validate parent location hierarchy
		if (this.parentLocation) {
			const allLocations = await this.getAllLocationsMap();
			const validation = validateLocationHierarchy(
				this.name,
				this.parentLocation,
				allLocations
			);

			if (!validation.isValid) {
				new Notice(validation.error || 'Invalid parent location');
				return;
			}
		}

		// Create or update location object
		let location: Location;

		if (this.isEditMode && this.location) {
			// Update existing location
			location = {
				...this.location,
				name: this.name.trim(),
				parentLocation: this.parentLocation ? `[[${this.parentLocation}]]` : undefined,
				status: this.status.trim() || undefined,
				description: this.description.trim() || undefined,
				lastUpdated: new Date().toISOString()
			};

			// Update renown tracking
			if (this.enableRenown) {
				if (!location.renownTracking) {
					// Enable renown for first time
					location.renownTracking = {
						enabled: true,
						partyScore: this.partyScore,
						rankLadder: await this.getRankLadder(this.rankLadderType)
					};
					// Add individual scores if any exist
					if (Object.keys(this.individualScores).length > 0) {
						location.renownTracking.individualScores = this.individualScores;
					}
				} else {
					// Update existing renown
					location.renownTracking.enabled = true;
					location.renownTracking.partyScore = this.partyScore;
					// Update individual scores (remove if empty)
					if (Object.keys(this.individualScores).length > 0) {
						location.renownTracking.individualScores = this.individualScores;
					} else {
						delete location.renownTracking.individualScores;
					}
				}
			} else {
				// Disable renown if it was enabled
				if (location.renownTracking) {
					location.renownTracking.enabled = false;
				}
			}
		} else {
			// Create new location
			if (this.enableRenown) {
				location = createLocationWithRenown(
					this.name.trim(),
					this.parentLocation ? `[[${this.parentLocation}]]` : undefined,
					await this.getRankLadder(this.rankLadderType)
				);
				location.renownTracking!.partyScore = this.partyScore;
				// Add individual scores if any exist
				if (Object.keys(this.individualScores).length > 0) {
					location.renownTracking!.individualScores = this.individualScores;
				}
			} else {
				location = createNewLocation(
					this.name.trim(),
					this.parentLocation ? `[[${this.parentLocation}]]` : undefined
				);
			}

			location.status = this.status.trim() || undefined;
			location.description = this.description.trim() || undefined;
		}

		// Call onSave callback if provided
		if (this.onSave) {
			try {
				await this.onSave(location);
				new Notice(`Location "${location.name}" ${this.isEditMode ? 'updated' : 'created'} successfully`);
				this.close();
			} catch (error) {
				console.error('Failed to save location:', error);
				new Notice(`Failed to save location: ${error.message}`);
			}
		} else {
			// Default: save directly via data adapter
			try {
				if (this.isEditMode) {
					const path = await this.plugin.dataAdapter.findLocationPath!(location.name);
					if (path) {
						await this.plugin.dataAdapter.updateLocation!(path, location);
						new Notice(`Location "${location.name}" updated successfully`);
					} else {
						throw new Error('Location file not found');
					}
				} else {
					await this.plugin.dataAdapter.saveLocation!(location);
					new Notice(`Location "${location.name}" created successfully`);
				}
				this.close();
			} catch (error) {
				console.error('Failed to save location:', error);
				new Notice(`Failed to save location: ${error.message}`);
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
			return configService.getLocationLadderTypes();
		} catch (error) {
			console.warn('RenownConfigService not available, using defaults:', error);
			return ['default', 'city'];
		}
	}

	/**
	 * Format ladder type name for display
	 */
	private formatLadderTypeName(type: string): string {
		// Convert "default" -> "Default Location Ladder"
		// Convert "city" -> "City/Large Settlement Ladder"
		const nameMap: Record<string, string> = {
			'default': 'Default Location Ladder',
			'city': 'City/Large Settlement Ladder'
		};

		return nameMap[type] || type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1');
	}

	/**
	 * Get rank ladder based on type selection
	 */
	private async getRankLadder(type: string): Promise<RenownRank[]> {
		// Extract the ladder type from the prefixed format (e.g., "location-default" -> "default")
		const ladderType = type.replace('location-', '');

		// Try to load from config service
		try {
			const configService = this.plugin.dataAdapter.getRenownConfigService();
			const ladder = configService.getLocationLadder(ladderType);
			if (ladder) {
				return ladder;
			}
		} catch (error) {
			console.warn('Could not load ladder from config service:', error);
		}

		// Fallback to defaults
		const { DEFAULT_LOCATION_RANK_LADDER } = await import('@quartermaster/core/services/LocationService');
		return DEFAULT_LOCATION_RANK_LADDER;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
