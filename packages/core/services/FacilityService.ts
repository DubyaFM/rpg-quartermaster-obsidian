/**
 * FacilityService - Business logic for facility management
 * Platform-agnostic service for managing facility templates and instances
 */

import {
	FacilityTemplate,
	StrongholdFacility,
	Ownership,
	ValidationResult
} from '../models/stronghold';

export class FacilityService {
	private templates: Map<string, FacilityTemplate> = new Map();

	/**
	 * Load facility templates from provided array
	 * Typically called by adapter layer after reading YAML files
	 */
	loadTemplates(templates: FacilityTemplate[]): void {
		this.templates.clear();
		for (const template of templates) {
			this.templates.set(template.id, template);
		}
	}

	/**
	 * Get a facility template by ID
	 */
	getTemplate(templateId: string): FacilityTemplate | undefined {
		return this.templates.get(templateId);
	}

	/**
	 * Get all loaded templates
	 */
	getAllTemplates(): FacilityTemplate[] {
		return Array.from(this.templates.values());
	}

	/**
	 * Get templates by type
	 */
	getTemplatesByType(type: 'basic' | 'special'): FacilityTemplate[] {
		return Array.from(this.templates.values()).filter(t => t.type === type);
	}

	/**
	 * Get templates by tier
	 */
	getTemplatesByTier(tier: number): FacilityTemplate[] {
		return Array.from(this.templates.values()).filter(t => t.tier === tier);
	}

	/**
	 * Get available upgrade templates for a facility
	 * Returns templates that can upgrade this facility (higher tier, matching baseFacilityId)
	 */
	getUpgradeTemplates(currentTemplate: FacilityTemplate): FacilityTemplate[] {
		return Array.from(this.templates.values()).filter(
			t => t.tier > currentTemplate.tier && t.baseFacilityId === currentTemplate.id
		);
	}

	/**
	 * Create a facility instance from a template
	 */
	createFacilityInstance(
		template: FacilityTemplate,
		ownership?: Ownership
	): StrongholdFacility {
		return {
			id: `facility-${Date.now()}-${Math.random().toString(36).substring(7)}`,
			templateId: template.id,
			name: template.name,
			ownership: ownership || { type: 'party' },
			status: 'idle',
			busyUntilDay: undefined,
			assignedHirelings: [],
			notes: undefined
		};
	}

	/**
	 * Upgrade a facility to a new template
	 * Preserves ID, assigned hirelings, and notes
	 */
	upgradeFacility(
		facility: StrongholdFacility,
		newTemplate: FacilityTemplate
	): boolean {
		const currentTemplate = this.getTemplate(facility.templateId);
		if (!currentTemplate) {
			return false;
		}

		// Validate upgrade path
		if (newTemplate.tier <= currentTemplate.tier) {
			return false;
		}

		if (newTemplate.baseFacilityId !== currentTemplate.id) {
			return false;
		}

		// Facility must be idle to upgrade
		if (facility.status !== 'idle') {
			return false;
		}

		// Apply upgrade
		facility.templateId = newTemplate.id;
		facility.name = newTemplate.name;

		return true;
	}

	/**
	 * Assign a hireling to a facility
	 */
	assignHireling(facility: StrongholdFacility, hirelingId: string): void {
		if (!facility.assignedHirelings.includes(hirelingId)) {
			facility.assignedHirelings.push(hirelingId);
		}
	}

	/**
	 * Unassign a hireling from a facility
	 */
	unassignHireling(facility: StrongholdFacility, hirelingId: string): boolean {
		const index = facility.assignedHirelings.indexOf(hirelingId);
		if (index === -1) {
			return false;
		}

		facility.assignedHirelings.splice(index, 1);
		return true;
	}

	/**
	 * Unassign all hirelings from a facility
	 */
	unassignAllHirelings(facility: StrongholdFacility): void {
		facility.assignedHirelings = [];
	}

	/**
	 * Check if a facility is operational (has required hirelings assigned)
	 */
	isOperational(facility: StrongholdFacility): boolean {
		const template = this.getTemplate(facility.templateId);
		if (!template) {
			return false;
		}

		return facility.assignedHirelings.length >= template.hirelingsRequired;
	}

	/**
	 * Get the number of hirelings still needed for a facility to be operational
	 */
	getHirelingsNeeded(facility: StrongholdFacility): number {
		const template = this.getTemplate(facility.templateId);
		if (!template) {
			return 0;
		}

		const needed = template.hirelingsRequired - facility.assignedHirelings.length;
		return Math.max(0, needed);
	}

	/**
	 * Set facility status
	 */
	setStatus(
		facility: StrongholdFacility,
		status: 'idle' | 'busy' | 'inoperable'
	): void {
		facility.status = status;
	}

	/**
	 * Set facility as busy until a specific day
	 */
	setBusyUntil(facility: StrongholdFacility, completionDay: number): void {
		facility.status = 'busy';
		facility.busyUntilDay = completionDay;
	}

	/**
	 * Complete a facility's current task (set back to idle)
	 */
	completeFacilityTask(facility: StrongholdFacility): void {
		facility.status = 'idle';
		facility.busyUntilDay = undefined;
	}

	/**
	 * Check if a facility can execute an order
	 * Must be idle and operational (have required hirelings)
	 */
	canExecuteOrder(facility: StrongholdFacility): boolean {
		return facility.status === 'idle' && this.isOperational(facility);
	}

	/**
	 * Validate facility construction
	 */
	validateConstruction(
		template: FacilityTemplate,
		pcLevel: number,
		fundsAvailable: number
	): ValidationResult {
		const errors: string[] = [];

		// Check PC level requirement
		if (template.unlockLevel && pcLevel < template.unlockLevel) {
			errors.push(`PC level must be ${template.unlockLevel} or higher to build this facility`);
		}

		// Check construction costs
		if (fundsAvailable < template.buildCost.gold) {
			errors.push(`Insufficient funds (need ${template.buildCost.gold} gp, have ${fundsAvailable} gp)`);
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Validate facility upgrade
	 */
	validateUpgrade(
		facility: StrongholdFacility,
		newTemplate: FacilityTemplate,
		fundsAvailable: number
	): ValidationResult {
		const errors: string[] = [];
		const currentTemplate = this.getTemplate(facility.templateId);

		if (!currentTemplate) {
			errors.push('Current facility template not found');
			return { valid: false, errors };
		}

		// Check facility status
		if (facility.status !== 'idle') {
			errors.push('Facility must be idle to upgrade');
		}

		// Check tier
		if (newTemplate.tier <= currentTemplate.tier) {
			errors.push('Upgrade must be to a higher tier');
		}

		// Check base facility match
		if (newTemplate.baseFacilityId !== currentTemplate.id) {
			errors.push('This template is not a valid upgrade for this facility');
		}

		// Check upgrade costs
		if (newTemplate.upgradeCost) {
			if (fundsAvailable < newTemplate.upgradeCost.gold) {
				errors.push(`Insufficient funds (need ${newTemplate.upgradeCost.gold} gp, have ${fundsAvailable} gp)`);
			}
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Search templates by name
	 */
	searchTemplates(query: string): FacilityTemplate[] {
		const lowerQuery = query.toLowerCase();
		return Array.from(this.templates.values()).filter(t =>
			t.name.toLowerCase().includes(lowerQuery) ||
			t.description.toLowerCase().includes(lowerQuery)
		);
	}

	/**
	 * Get templates that require a specific number of hirelings
	 */
	getTemplatesByHirelingRequirement(hirelingCount: number): FacilityTemplate[] {
		return Array.from(this.templates.values()).filter(
			t => t.hirelingsRequired === hirelingCount
		);
	}

	/**
	 * Add or update a template
	 */
	addTemplate(template: FacilityTemplate): void {
		this.templates.set(template.id, template);
	}

	/**
	 * Remove a template
	 */
	removeTemplate(templateId: string): boolean {
		return this.templates.delete(templateId);
	}

	/**
	 * Check if a template exists
	 */
	hasTemplate(templateId: string): boolean {
		return this.templates.has(templateId);
	}

	/**
	 * Get template count
	 */
	getTemplateCount(): number {
		return this.templates.size;
	}

	/**
	 * Clear all templates
	 */
	clearTemplates(): void {
		this.templates.clear();
	}

	/**
	 * Validate template structure
	 */
	validateTemplate(template: FacilityTemplate): ValidationResult {
		const errors: string[] = [];

		if (!template.id || template.id.trim() === '') {
			errors.push('Template ID is required');
		}

		if (!template.name || template.name.trim() === '') {
			errors.push('Template name is required');
		}

		if (template.tier < 1) {
			errors.push('Template tier must be at least 1');
		}

		if (template.buildCost.gold < 0) {
			errors.push('Build cost cannot be negative');
		}

		if (template.buildCost.timeInDays < 0) {
			errors.push('Build time cannot be negative');
		}

		if (template.hirelingsRequired < 0) {
			errors.push('Hirelings required cannot be negative');
		}

		// Validate upgrade cost if present
		if (template.upgradeCost) {
			if (template.upgradeCost.gold < 0) {
				errors.push('Upgrade cost cannot be negative');
			}
			if (template.upgradeCost.timeInDays < 0) {
				errors.push('Upgrade time cannot be negative');
			}
		}

		// If baseFacilityId is set, this should be tier 2+
		if (template.baseFacilityId && template.tier < 2) {
			errors.push('Upgrade facilities must be tier 2 or higher');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}
}
