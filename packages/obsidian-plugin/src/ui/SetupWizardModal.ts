/**
 * Campaign Setup Wizard Modal
 *
 * Three-step wizard for creating new campaigns:
 * - Step 1: Identity (name, description, world selection)
 * - Step 2: Libraries (select which libraries to enable)
 * - Step 3: Paths (configure folder structure)
 *
 * **Phase 3 - TKT-CS-024**
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { CampaignSwitchLoader } from './CampaignSwitchLoader';
import type { CampaignProfile } from '@quartermaster/core/services/CampaignManager';

/**
 * World preset configuration
 * Provides quick-start options with recommended libraries
 */
interface WorldPreset {
	id: string;
	name: string;
	description: string;
	recommendedLibraries: string[];
}

/**
 * Library definition for checkbox selection
 */
interface LibraryOption {
	id: string;
	name: string;
	description: string;
	enabled: boolean;
}

/**
 * Path template configuration
 */
interface PathTemplate {
	id: 'standard' | 'custom';
	name: string;
	description: string;
	paths: Record<string, string>;
}

/**
 * Campaign creation data accumulator
 */
interface CampaignFormData {
	// Step 1: Identity
	name: string;
	description: string;
	worldId: string;
	worldName: string;

	// Step 2: Libraries
	activeLibraryIds: string[];

	// Step 3: Paths
	pathTemplate: 'standard' | 'custom';
	pathMappings?: Record<string, string>;
}

/**
 * Wizard steps
 */
type WizardStep = 1 | 2 | 3;

export class SetupWizardModal extends Modal {
	private currentStep: WizardStep = 1;
	private formData: CampaignFormData;
	private onComplete?: () => void;

	// World presets
	private readonly WORLD_PRESETS: WorldPreset[] = [
		{
			id: 'world-generic-fantasy',
			name: 'Generic Fantasy',
			description: 'Standard D&D 5e fantasy setting using SRD content',
			recommendedLibraries: ['srd']
		},
		{
			id: 'world-forgotten-realms',
			name: 'Forgotten Realms',
			description: 'Classic D&D setting - Sword Coast and beyond',
			recommendedLibraries: ['srd']
		},
		{
			id: 'world-eberron',
			name: 'Eberron',
			description: 'Pulp noir fantasy with warforged and airships',
			recommendedLibraries: ['srd']
		},
		{
			id: 'world-homebrew',
			name: 'Custom Homebrew',
			description: 'Build your own world from scratch',
			recommendedLibraries: []
		}
	];

	// Available libraries (eventually this will be dynamic)
	private readonly AVAILABLE_LIBRARIES: LibraryOption[] = [
		{
			id: 'srd',
			name: 'D&D 5e SRD',
			description: 'Core rules and items from the Systems Reference Document',
			enabled: true
		}
		// Future: Dynamically load from library registry
	];

	// Path templates
	private readonly PATH_TEMPLATES: PathTemplate[] = [
		{
			id: 'standard',
			name: 'Standard Structure',
			description: 'Recommended folder organization for most campaigns',
			paths: {
				shops: 'Shops/',
				party: 'Party/',
				npcs: 'NPCs/',
				locations: 'Locations/',
				factions: 'Factions/',
				jobs: 'Jobs/',
				projects: 'Projects/'
			}
		},
		{
			id: 'custom',
			name: 'Custom Paths',
			description: 'Define your own folder structure',
			paths: {}
		}
	];

	constructor(
		app: App,
		private plugin: QuartermasterPlugin,
		onComplete?: () => void
	) {
		super(app);
		this.onComplete = onComplete;

		// Initialize form data with defaults
		this.formData = {
			name: '',
			description: '',
			worldId: this.WORLD_PRESETS[0].id,
			worldName: this.WORLD_PRESETS[0].name,
			activeLibraryIds: [...this.WORLD_PRESETS[0].recommendedLibraries],
			pathTemplate: 'standard',
			pathMappings: { ...this.PATH_TEMPLATES[0].paths }
		};
	}

	onOpen() {
		this.renderStep();
	}

	onClose() {
		this.contentEl.empty();
	}

	/**
	 * Render the current wizard step
	 */
	private renderStep(): void {
		const { contentEl } = this;
		contentEl.empty();

		// Modal header
		contentEl.createEl('h2', { text: 'Create New Campaign' });

		// Progress indicator
		this.renderProgressIndicator(contentEl);

		// Step content
		const stepContainer = contentEl.createDiv({ cls: 'quartermaster-wizard-step' });

		switch (this.currentStep) {
			case 1:
				this.renderStep1Identity(stepContainer);
				break;
			case 2:
				this.renderStep2Libraries(stepContainer);
				break;
			case 3:
				this.renderStep3Paths(stepContainer);
				break;
		}

		// Navigation buttons
		this.renderNavigationButtons(contentEl);
	}

	/**
	 * Render progress indicator (Step X of 3)
	 */
	private renderProgressIndicator(container: HTMLElement): void {
		const progressEl = container.createDiv({ cls: 'quartermaster-wizard-progress' });

		for (let i = 1; i <= 3; i++) {
			const stepEl = progressEl.createDiv({ cls: 'wizard-progress-step' });

			if (i < this.currentStep) {
				stepEl.addClass('completed');
				stepEl.createSpan({ text: '✓' });
			} else if (i === this.currentStep) {
				stepEl.addClass('active');
				stepEl.createSpan({ text: i.toString() });
			} else {
				stepEl.createSpan({ text: i.toString() });
			}

			// Step label
			const labels = ['Identity', 'Libraries', 'Paths'];
			stepEl.createDiv({
				text: labels[i - 1],
				cls: 'wizard-progress-label'
			});
		}
	}

	/**
	 * Step 1: Identity - Name, description, world selection
	 */
	private renderStep1Identity(container: HTMLElement): void {
		container.createEl('h3', { text: 'Step 1: Campaign Identity' });
		container.createEl('p', {
			text: 'Give your campaign a name and choose a world setting.',
			cls: 'setting-item-description'
		});

		// Campaign Name
		new Setting(container)
			.setName('Campaign Name')
			.setDesc('A descriptive name for this campaign (required)')
			.addText(text => text
				.setPlaceholder('e.g., Curse of Strahd - Tuesday Group')
				.setValue(this.formData.name)
				.onChange(value => {
					this.formData.name = value;
				})
			);

		// Description
		new Setting(container)
			.setName('Description')
			.setDesc('Optional notes about this campaign')
			.addTextArea(text => {
				text
					.setPlaceholder('e.g., Weekly game with the Tuesday crew')
					.setValue(this.formData.description)
					.onChange(value => {
						this.formData.description = value;
					});
				text.inputEl.rows = 3;
				text.inputEl.style.width = '100%';
			});

		// World Selector
		container.createEl('h4', { text: 'World Setting' });

		const worldGrid = container.createDiv({ cls: 'quartermaster-world-grid' });

		this.WORLD_PRESETS.forEach(preset => {
			const worldCard = worldGrid.createDiv({ cls: 'world-preset-card' });

			if (this.formData.worldId === preset.id) {
				worldCard.addClass('selected');
			}

			worldCard.createEl('h5', { text: preset.name });
			worldCard.createEl('p', { text: preset.description });

			// Click handler
			worldCard.onclick = () => {
				// Update form data
				this.formData.worldId = preset.id;
				this.formData.worldName = preset.name;
				this.formData.activeLibraryIds = [...preset.recommendedLibraries];

				// Re-render to update selection
				this.renderStep();
			};
		});
	}

	/**
	 * Step 2: Libraries - Select which libraries to enable
	 */
	private renderStep2Libraries(container: HTMLElement): void {
		container.createEl('h3', { text: 'Step 2: Content Libraries' });
		container.createEl('p', {
			text: 'Choose which content libraries to enable for this campaign.',
			cls: 'setting-item-description'
		});

		container.createEl('p', {
			text: `Recommended for ${this.formData.worldName}: ${this.formData.activeLibraryIds.join(', ') || 'None'}`,
			cls: 'setting-item-description mod-warning'
		});

		// Library checkboxes
		this.AVAILABLE_LIBRARIES.forEach(library => {
			const isEnabled = this.formData.activeLibraryIds.includes(library.id);

			new Setting(container)
				.setName(library.name)
				.setDesc(library.description)
				.addToggle(toggle => toggle
					.setValue(isEnabled)
					.onChange(value => {
						if (value) {
							// Add library if not already present
							if (!this.formData.activeLibraryIds.includes(library.id)) {
								this.formData.activeLibraryIds.push(library.id);
							}
						} else {
							// Remove library
							this.formData.activeLibraryIds = this.formData.activeLibraryIds.filter(
								id => id !== library.id
							);
						}
					})
				);
		});

		// Info message if no libraries selected
		if (this.formData.activeLibraryIds.length === 0) {
			container.createEl('p', {
				text: 'Note: No libraries selected. You can enable libraries later in campaign settings.',
				cls: 'mod-warning'
			});
		}
	}

	/**
	 * Step 3: Paths - Configure folder structure
	 */
	private renderStep3Paths(container: HTMLElement): void {
		container.createEl('h3', { text: 'Step 3: Folder Structure' });
		container.createEl('p', {
			text: 'Choose how to organize your campaign files in the vault.',
			cls: 'setting-item-description'
		});

		// Template selector
		this.PATH_TEMPLATES.forEach(template => {
			const templateCard = container.createDiv({ cls: 'path-template-card' });

			if (this.formData.pathTemplate === template.id) {
				templateCard.addClass('selected');
			}

			const header = templateCard.createDiv({ cls: 'template-header' });
			header.createEl('h5', { text: template.name });
			header.createEl('p', { text: template.description });

			// Show path preview for standard template
			if (template.id === 'standard') {
				const pathList = templateCard.createEl('ul', { cls: 'path-preview' });
				Object.entries(template.paths).forEach(([key, value]) => {
					pathList.createEl('li', { text: `${key}: ${value}` });
				});
			}

			// Click handler
			templateCard.onclick = () => {
				this.formData.pathTemplate = template.id;

				if (template.id === 'standard') {
					this.formData.pathMappings = { ...template.paths };
				} else {
					// Custom - will be configured in settings later
					this.formData.pathMappings = {};
				}

				this.renderStep();
			};
		});

		// Custom path editor (if custom template selected)
		if (this.formData.pathTemplate === 'custom') {
			container.createEl('p', {
				text: 'You can configure custom paths in Campaign Settings after creation.',
				cls: 'setting-item-description'
			});
		}
	}

	/**
	 * Render navigation buttons (Back, Next, Finish)
	 */
	private renderNavigationButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv({ cls: 'quartermaster-wizard-buttons' });

		// Back button (disabled on step 1)
		const backBtn = buttonContainer.createEl('button', {
			text: 'Back',
			cls: 'mod-cta'
		});

		if (this.currentStep === 1) {
			backBtn.disabled = true;
		}

		backBtn.onclick = () => {
			if (this.currentStep > 1) {
				this.currentStep = (this.currentStep - 1) as WizardStep;
				this.renderStep();
			}
		};

		// Next/Finish button
		const nextBtn = buttonContainer.createEl('button', {
			text: this.currentStep === 3 ? 'Create Campaign' : 'Next',
			cls: 'mod-cta'
		});

		nextBtn.onclick = async () => {
			// Validate current step
			const validationError = this.validateCurrentStep();
			if (validationError) {
				new Notice(validationError);
				return;
			}

			if (this.currentStep < 3) {
				// Move to next step
				this.currentStep = (this.currentStep + 1) as WizardStep;
				this.renderStep();
			} else {
				// Final step - create campaign
				await this.createCampaign();
			}
		};

		// Cancel button
		const cancelBtn = buttonContainer.createEl('button', {
			text: 'Cancel'
		});

		cancelBtn.onclick = () => {
			this.close();
		};
	}

	/**
	 * Validate the current step's form data
	 * @returns Error message if validation fails, null if valid
	 */
	private validateCurrentStep(): string | null {
		switch (this.currentStep) {
			case 1:
				// Validate name
				if (!this.formData.name || this.formData.name.trim().length === 0) {
					return 'Campaign name is required';
				}

				if (this.formData.name.length > 100) {
					return 'Campaign name must be 100 characters or less';
				}

				// Validate world ID
				if (!this.formData.worldId) {
					return 'Please select a world setting';
				}

				return null;

			case 2:
				// Libraries are optional - no validation needed
				return null;

			case 3:
				// Path template validation
				if (!this.formData.pathTemplate) {
					return 'Please select a folder structure template';
				}

				return null;

			default:
				return null;
		}
	}

	/**
	 * Create the campaign using the factory
	 */
	private async createCampaign(): Promise<void> {
		try {
			// Show loading modal
			const loader = new CampaignSwitchLoader(this.app, this.formData.name);

			// Create campaign via adapter factory
			const campaign = await this.plugin.adapterFactory.createCampaign({
				name: this.formData.name,
				worldId: this.formData.worldId,
				description: this.formData.description,
				activeLibraryIds: this.formData.activeLibraryIds,
				pathMappings: this.formData.pathMappings
			});

			// Switch to the new campaign
			await this.plugin.switchCampaign(campaign.id);

			// Close loader and wizard
			loader.onSwitchComplete();
			this.close();

			// Show success message
			new Notice(`Campaign "${this.formData.name}" created successfully!`);

			// Call completion callback
			if (this.onComplete) {
				this.onComplete();
			}

		} catch (error) {
			console.error('[SetupWizardModal] Failed to create campaign:', error);
			new Notice(`Failed to create campaign: ${error.message}`);
		}
	}
}
