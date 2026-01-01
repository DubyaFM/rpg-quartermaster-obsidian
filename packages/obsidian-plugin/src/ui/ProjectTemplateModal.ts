/**
 * ProjectTemplateModal - Create and edit project templates
 */

import { Modal, App, Setting, Notice } from 'obsidian';
import {
	ProjectTemplate,
	ProjectCostStrategy,
	ProjectDurationStrategy,
	ProjectSuccessCriteriaStrategy,
	ItemCost
} from '@quartermaster/core/models/types';
import type QuartermasterPlugin from '../main';

export class ProjectTemplateModal extends Modal {
	plugin: QuartermasterPlugin;
	template: ProjectTemplate | null;
	isEdit: boolean;

	// Form fields
	private name: string = '';
	private description: string = '';
	private outcomeType: 'item' | 'gold' | 'information' | 'other' = 'item';
	private consumesMaterials: boolean = false;
	private automaticSuccess: boolean = true;

	// Cost strategy
	private costType: 'none' | 'fixed' | 'variable' = 'none';
	private fixedFundsCost: number = 0;
	private fundsCostGuidance: string = '';

	// Duration strategy
	private durationType: 'fixed' | 'variable' = 'fixed';
	private fixedDuration: number = 1;
	private durationGuidance: string = '';

	// Success criteria strategy (if not automatic)
	private criteriaType: 'fixed' | 'variable' = 'fixed';
	private fixedCriteria: string = '';
	private criteriaGuidance: string = '';

	constructor(app: App, plugin: QuartermasterPlugin, template?: ProjectTemplate) {
		super(app);
		this.plugin = plugin;
		this.template = template || null;
		this.isEdit = !!template;

		if (template) {
			this.loadFromTemplate(template);
		}
	}

	private loadFromTemplate(template: ProjectTemplate): void {
		this.name = template.name;
		this.description = template.description || '';
		this.outcomeType = template.outcomeType as any;
		this.consumesMaterials = template.consumesMaterials;
		this.automaticSuccess = template.automaticSuccess;

		// Load cost strategy
		this.costType = template.currencyCostStrategy.type;
		if (template.currencyCostStrategy.type === 'fixed' && template.currencyCostStrategy.fixedCost) {
			this.fixedFundsCost = template.currencyCostStrategy.fixedCost.gp || 0;
		}
		this.fundsCostGuidance = template.currencyCostStrategy.guidanceText || '';

		// Load duration strategy
		this.durationType = template.durationStrategy.type;
		this.fixedDuration = template.durationStrategy.fixedDays || 1;
		this.durationGuidance = template.durationStrategy.guidanceText || '';

		// Load success criteria strategy
		if (template.successCriteriaStrategy) {
			this.criteriaType = template.successCriteriaStrategy.type;
			this.fixedCriteria = template.successCriteriaStrategy.fixedCriteria || '';
			this.criteriaGuidance = template.successCriteriaStrategy.guidanceText || '';
		}
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: this.isEdit ? 'Edit Project Template' : 'Create Project Template' });

		// Template Name
		new Setting(contentEl)
			.setName('Template Name')
			.setDesc('Name for this project template (e.g., "Scribe Spell Scroll")')
			.addText(text => text
				.setPlaceholder('Enter template name')
				.setValue(this.name)
				.onChange(value => this.name = value));

		// Description
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Optional description')
			.addTextArea(text => text
				.setPlaceholder('Enter description')
				.setValue(this.description)
				.onChange(value => this.description = value));

		// Outcome Type
		new Setting(contentEl)
			.setName('Outcome Type')
			.setDesc('What does this project produce?')
			.addDropdown(dropdown => dropdown
				.addOption('item', 'Item')
				.addOption('currency', 'Currency')
				.addOption('information', 'Information')
				.addOption('other', 'Other')
				.setValue(this.outcomeType)
				.onChange((value: any) => {
					this.outcomeType = value;
				}));

		// Consumes Materials
		new Setting(contentEl)
			.setName('Consumes Materials')
			.setDesc('Does this project require materials from inventory?')
			.addToggle(toggle => toggle
				.setValue(this.consumesMaterials)
				.onChange(value => this.consumesMaterials = value));

		// Cost Strategy
		const costStrategySetting = new Setting(contentEl)
			.setName('Cost Strategy')
			.setDesc('How is the cost determined?')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'No cost')
				.addOption('fixed', 'Fixed cost')
				.addOption('variable', 'Variable (set per instance)')
				.setValue(this.costType)
				.onChange((value: any) => {
					this.costType = value;
					this.renderCostFields(contentEl);
				}));

		// Cost fields container (will be populated based on strategy)
		const costContainer = contentEl.createDiv({ cls: 'project-cost-container' });
		this.renderCostFieldsIn(costContainer);

		// Duration Strategy
		const durationStrategySetting = new Setting(contentEl)
			.setName('Duration Strategy')
			.setDesc('How is the duration determined?')
			.addDropdown(dropdown => dropdown
				.addOption('fixed', 'Fixed duration')
				.addOption('variable', 'Variable (set per instance)')
				.setValue(this.durationType)
				.onChange((value: any) => {
					this.durationType = value;
					this.renderDurationFields(contentEl);
				}));

		// Duration fields container
		const durationContainer = contentEl.createDiv({ cls: 'project-duration-container' });
		this.renderDurationFieldsIn(durationContainer);

		// Automatic Success
		new Setting(contentEl)
			.setName('Automatic Success')
			.setDesc('Does this project always succeed?')
			.addToggle(toggle => toggle
				.setValue(this.automaticSuccess)
				.onChange(value => {
					this.automaticSuccess = value;
					this.renderSuccessCriteriaFields(contentEl);
				}));

		// Success criteria container (only shown if not automatic)
		const criteriaContainer = contentEl.createDiv({ cls: 'project-criteria-container' });
		this.renderSuccessCriteriaFieldsIn(criteriaContainer);

		// Action buttons
		const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });

		const saveBtn = buttonContainer.createEl('button', {
			text: this.isEdit ? 'Update Template' : 'Create Template',
			cls: 'mod-cta'
		});
		saveBtn.onclick = async () => {
			await this.saveTemplate();
		};

		const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();
	}

	private renderCostFields(parentEl: HTMLElement): void {
		const container = parentEl.querySelector('.project-cost-container');
		if (container) {
			container.empty();
			this.renderCostFieldsIn(container as HTMLElement);
		}
	}

	private renderCostFieldsIn(container: HTMLElement): void {
		container.empty();

		if (this.costType === 'fixed') {
			new Setting(container)
				.setName('Fixed Cost')
				.addText(text => text
					.setPlaceholder('0')
					.setValue(this.fixedFundsCost.toString())
					.onChange(value => this.fixedFundsCost = parseInt(value) || 0));
		} else if (this.costType === 'variable') {
			new Setting(container)
				.setName('Cost Guidance Text')
				.setDesc('Descriptive text shown when creating instances (not parsed)')
				.addTextArea(text => text
					.setPlaceholder('e.g., "Cost varies based on spell level"')
					.setValue(this.fundsCostGuidance)
					.onChange(value => this.fundsCostGuidance = value));
		}
	}

	private renderDurationFields(parentEl: HTMLElement): void {
		const container = parentEl.querySelector('.project-duration-container');
		if (container) {
			container.empty();
			this.renderDurationFieldsIn(container as HTMLElement);
		}
	}

	private renderDurationFieldsIn(container: HTMLElement): void {
		container.empty();

		if (this.durationType === 'fixed') {
			new Setting(container)
				.setName('Fixed Duration (days)')
				.addText(text => text
					.setPlaceholder('1')
					.setValue(this.fixedDuration.toString())
					.onChange(value => this.fixedDuration = parseInt(value) || 1));
		} else {
			new Setting(container)
				.setName('Duration Guidance Text')
				.setDesc('Descriptive text shown when creating instances (not parsed)')
				.addTextArea(text => text
					.setPlaceholder('e.g., "1 day per spell level"')
					.setValue(this.durationGuidance)
					.onChange(value => this.durationGuidance = value));
		}
	}

	private renderSuccessCriteriaFields(parentEl: HTMLElement): void {
		const container = parentEl.querySelector('.project-criteria-container');
		if (container) {
			container.empty();
			this.renderSuccessCriteriaFieldsIn(container as HTMLElement);
		}
	}

	private renderSuccessCriteriaFieldsIn(container: HTMLElement): void {
		container.empty();

		if (!this.automaticSuccess) {
			new Setting(container)
				.setName('Success Criteria Strategy')
				.addDropdown(dropdown => dropdown
					.addOption('fixed', 'Fixed criteria')
					.addOption('variable', 'Variable (set per instance)')
					.setValue(this.criteriaType)
					.onChange((value: any) => {
						this.criteriaType = value;
						this.renderSuccessCriteriaStrategyFields(container);
					}));

			const strategyContainer = container.createDiv({ cls: 'criteria-strategy-container' });
			this.renderSuccessCriteriaStrategyFieldsIn(strategyContainer);
		}
	}

	private renderSuccessCriteriaStrategyFields(parentEl: HTMLElement): void {
		const container = parentEl.querySelector('.criteria-strategy-container');
		if (container) {
			container.empty();
			this.renderSuccessCriteriaStrategyFieldsIn(container as HTMLElement);
		}
	}

	private renderSuccessCriteriaStrategyFieldsIn(container: HTMLElement): void {
		container.empty();

		if (this.criteriaType === 'fixed') {
			new Setting(container)
				.setName('Fixed Success Criteria')
				.addTextArea(text => text
					.setPlaceholder('e.g., "DC 15 Arcana check each day"')
					.setValue(this.fixedCriteria)
					.onChange(value => this.fixedCriteria = value));
		} else {
			new Setting(container)
				.setName('Criteria Guidance Text')
				.setDesc('Descriptive text shown when creating instances (not parsed)')
				.addTextArea(text => text
					.setPlaceholder('e.g., "DC varies by complexity"')
					.setValue(this.criteriaGuidance)
					.onChange(value => this.criteriaGuidance = value));
		}
	}

	private async saveTemplate(): Promise<void> {
		// Validation
		if (!this.name.trim()) {
			new Notice('Please enter a template name');
			return;
		}

		const templateService = (this.plugin.dataAdapter as any).getProjectTemplateService();
		if (!templateService) {
			new Notice('Project system not initialized');
			return;
		}

		// Build cost strategy
		const currencyCostStrategy: ProjectCostStrategy = {
			type: this.costType
		};
		if (this.costType === 'fixed') {
			currencyCostStrategy.fixedCost = {
				cp: 0,
				sp: 0,
				gp: this.fixedFundsCost,
				pp: 0
			};
		} else if (this.costType === 'variable') {
			currencyCostStrategy.guidanceText = this.fundsCostGuidance;
		}

		// Build duration strategy
		const durationStrategy: ProjectDurationStrategy = {
			type: this.durationType
		};
		if (this.durationType === 'fixed') {
			durationStrategy.fixedDays = this.fixedDuration;
		} else {
			durationStrategy.guidanceText = this.durationGuidance;
		}

		// Build success criteria strategy (if needed)
		let successCriteriaStrategy: ProjectSuccessCriteriaStrategy | undefined;
		if (!this.automaticSuccess) {
			successCriteriaStrategy = {
				type: this.criteriaType
			};
			if (this.criteriaType === 'fixed') {
				successCriteriaStrategy.fixedCriteria = this.fixedCriteria;
			} else {
				successCriteriaStrategy.guidanceText = this.criteriaGuidance;
			}
		}

		// Build template object
		const template: ProjectTemplate = {
			id: this.template?.id || `template_${Date.now()}`,
			name: this.name,
			description: this.description || undefined,
			outcomeType: this.outcomeType as any,
			currencyCostStrategy,
			consumesMaterials: this.consumesMaterials,
			durationStrategy,
			automaticSuccess: this.automaticSuccess,
			successCriteriaStrategy,
			createdBy: this.template?.createdBy,
			createdDate: this.template?.createdDate || Date.now()
		};

		// Validate with service
		const validation = templateService.validateTemplate(template);
		if (!validation.valid) {
			new Notice(`Validation error: ${validation.errors.join(', ')}`);
			return;
		}

		// Save template
		try {
			await templateService.saveTemplate(template);
			new Notice(this.isEdit ? 'Template updated' : 'Template created');
			this.close();
		} catch (error) {
			console.error('Error saving template:', error);
			new Notice(`Error saving template: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
