import {
	ProjectTemplate,
	ProjectTemplateSummary,
	ProjectCostStrategy,
	ProjectDurationStrategy,
	ProjectSuccessCriteriaStrategy
} from '../models/types';
import { IProjectConfigAdapter } from '../interfaces/IProjectConfigAdapter';

/**
 * Service for managing project templates
 * Platform-agnostic business logic
 */
export class ProjectTemplateService {
	private templates: Map<string, ProjectTemplate>;
	private configAdapter: IProjectConfigAdapter;
	private loaded: boolean = false;
	private generateUUID?: () => string;

	constructor(
		configAdapter: IProjectConfigAdapter,
		generateUUID?: () => string
	) {
		this.configAdapter = configAdapter;
		this.templates = new Map();
		this.generateUUID = generateUUID;
	}

	/**
	 * Load all project templates from config
	 */
	async loadTemplates(): Promise<void> {
		const templateList = await this.configAdapter.loadTemplates();
		this.templates.clear();

		for (const template of templateList) {
			this.templates.set(template.id, template);
		}

		this.loaded = true;
		console.log(`[ProjectTemplateService] Loaded ${this.templates.size} project templates`);
	}

	/**
	 * Get all templates
	 */
	getAllTemplates(): ProjectTemplate[] {
		return Array.from(this.templates.values());
	}

	/**
	 * Get template by ID
	 */
	getTemplate(id: string): ProjectTemplate | null {
		return this.templates.get(id) || null;
	}

	/**
	 * Get template summaries (for browsing)
	 */
	getTemplateSummaries(): ProjectTemplateSummary[] {
		return this.getAllTemplates().map(template => this.generateSummary(template));
	}

	/**
	 * Create new template
	 */
	async createTemplate(template: ProjectTemplate): Promise<void> {
		// Check for duplicate ID
		if (this.templates.has(template.id)) {
			throw new Error(`Template with ID ${template.id} already exists`);
		}

		// Validate before saving
		const validation = this.validateTemplate(template);
		if (!validation.valid) {
			throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
		}

		// Save via adapter
		await this.configAdapter.saveTemplate(template);

		// Update in-memory cache
		this.templates.set(template.id, template);

		console.log(`[ProjectTemplateService] Created template: ${template.id}`);
	}

	/**
	 * Update existing template
	 */
	async updateTemplate(id: string, updates: Partial<ProjectTemplate>): Promise<void> {
		const existing = this.templates.get(id);
		if (!existing) {
			throw new Error(`Template not found: ${id}`);
		}

		// Merge updates
		const updated: ProjectTemplate = { ...existing, ...updates };

		// Validate
		const validation = this.validateTemplate(updated);
		if (!validation.valid) {
			throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
		}

		// Save via adapter
		await this.configAdapter.saveTemplate(updated);

		// Update in-memory cache
		this.templates.set(id, updated);

		console.log(`[ProjectTemplateService] Updated template: ${id}`);
	}

	/**
	 * Delete template
	 */
	async deleteTemplate(id: string): Promise<void> {
		await this.configAdapter.deleteTemplate(id);
		this.templates.delete(id);
		console.log(`[ProjectTemplateService] Deleted template: ${id}`);
	}

	/**
	 * Validate template structure
	 */
	validateTemplate(template: ProjectTemplate): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Required fields
		if (!template.id || template.id.trim() === '') {
			errors.push('Template ID is required');
		}
		if (!template.name || template.name.trim() === '') {
			errors.push('Template name is required');
		}

		// Outcome type validation
		const validOutcomeTypes = ['item', 'currency', 'information', 'other'];
		if (!validOutcomeTypes.includes(template.outcomeType)) {
			errors.push(`Invalid outcome type: ${template.outcomeType}`);
		}

		// Cost strategy validation
		if (!template.currencyCostStrategy || !template.currencyCostStrategy.type) {
			errors.push('Cost strategy is required');
		} else {
			const costErrors = this.validateCostStrategy(template.currencyCostStrategy);
			errors.push(...costErrors);
		}

		// Duration strategy validation
		if (!template.durationStrategy || !template.durationStrategy.type) {
			errors.push('Duration strategy is required');
		} else {
			const durationErrors = this.validateDurationStrategy(template.durationStrategy);
			errors.push(...durationErrors);
		}

		// Success criteria validation
		if (!template.automaticSuccess) {
			if (!template.successCriteriaStrategy) {
				errors.push('Success criteria strategy is required when not automatic success');
			} else {
				const criteriaErrors = this.validateSuccessCriteriaStrategy(template.successCriteriaStrategy);
				errors.push(...criteriaErrors);
			}
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Validate cost strategy
	 */
	private validateCostStrategy(strategy: ProjectCostStrategy): string[] {
		const errors: string[] = [];

		if (strategy.type === 'fixed') {
			if (!strategy.fixedCost) {
				errors.push('Fixed cost strategy requires fixedCost value');
			}
		} else if (strategy.type === 'variable') {
			if (!strategy.guidanceText || strategy.guidanceText.trim() === '') {
				errors.push('Variable cost strategy requires guidance text for cost specification');
			}
		}

		return errors;
	}

	/**
	 * Validate duration strategy
	 */
	private validateDurationStrategy(strategy: ProjectDurationStrategy): string[] {
		const errors: string[] = [];

		if (strategy.type === 'fixed') {
			if (!strategy.fixedDays || strategy.fixedDays < 1) {
				errors.push('Fixed duration strategy requires fixedDays >= 1');
			}
		} else if (strategy.type === 'variable') {
			if (!strategy.guidanceText || strategy.guidanceText.trim() === '') {
				errors.push('Variable duration strategy requires guidance text');
			}
		}

		return errors;
	}

	/**
	 * Validate success criteria strategy
	 */
	private validateSuccessCriteriaStrategy(strategy: ProjectSuccessCriteriaStrategy): string[] {
		const errors: string[] = [];

		if (strategy.type === 'fixed') {
			if (!strategy.fixedCriteria || strategy.fixedCriteria.trim() === '') {
				errors.push('Fixed success criteria strategy requires fixedCriteria text');
			}
		} else if (strategy.type === 'variable') {
			if (!strategy.guidanceText || strategy.guidanceText.trim() === '') {
				errors.push('Variable success criteria strategy requires guidance text');
			}
		}

		return errors;
	}

	/**
	 * Generate template summary for display
	 */
	generateSummary(template: ProjectTemplate): ProjectTemplateSummary {
		// Estimate cost
		let estimatedCost = 'Variable';
		if (template.currencyCostStrategy.type === 'none') {
			estimatedCost = 'Free';
		} else if (template.currencyCostStrategy.type === 'fixed' && template.currencyCostStrategy.fixedCost) {
			const funds = template.currencyCostStrategy.fixedCost.gold || 0;
			estimatedCost = funds > 0 ? `${funds} gp` : 'Free';
		}

		// Estimate duration
		let estimatedDuration = 'Variable';
		if (template.durationStrategy.type === 'fixed' && template.durationStrategy.fixedDays) {
			const days = template.durationStrategy.fixedDays;
			estimatedDuration = `${days} day${days === 1 ? '' : 's'}`;
		}

		return {
			id: template.id,
			name: template.name,
			outcomeType: template.outcomeType,
			estimatedCost,
			estimatedDuration
		};
	}

	/**
	 * Check if templates have been loaded
	 */
	isLoaded(): boolean {
		return this.loaded;
	}
}
