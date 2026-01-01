import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectTemplateService } from '../services/ProjectTemplateService';
import { ProjectTemplate } from '../models/types';

// Mock adapter
class MockProjectConfigAdapter {
	private templates: Map<string, ProjectTemplate> = new Map();

	async loadTemplates(): Promise<ProjectTemplate[]> {
		return Array.from(this.templates.values());
	}

	async saveTemplate(template: ProjectTemplate): Promise<void> {
		this.templates.set(template.id, template);
	}

	async deleteTemplate(id: string): Promise<void> {
		this.templates.delete(id);
	}

	async templateExists(id: string): Promise<boolean> {
		return this.templates.has(id);
	}

	getConfigPath(): string {
		return '/mock/config';
	}
}

describe('ProjectTemplateService', () => {
	let service: ProjectTemplateService;
	let adapter: MockProjectConfigAdapter;

	beforeEach(() => {
		adapter = new MockProjectConfigAdapter();
		service = new ProjectTemplateService(adapter);
	});

	describe('template loading', () => {
		it('should load templates from adapter', async () => {
			const mockTemplate: ProjectTemplate = {
				id: 'template_1',
				name: 'Test Template',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			await adapter.saveTemplate(mockTemplate);
			await service.loadTemplates();

			const templates = service.getAllTemplates();
			expect(templates).toHaveLength(1);
			expect(templates[0].id).toBe('template_1');
		});

		it('should cache templates in memory', async () => {
			const mockTemplate: ProjectTemplate = {
				id: 'template_1',
				name: 'Test Template',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			await adapter.saveTemplate(mockTemplate);
			await service.loadTemplates();

			const template = service.getTemplate('template_1');
			expect(template).toBeDefined();
			expect(template?.name).toBe('Test Template');
		});
	});

	describe('template creation', () => {
		it('should create a new template', async () => {
			const template: ProjectTemplate = {
				id: 'new_template',
				name: 'New Template',
				outcomeType: 'currency',
				fundsCostStrategy: { type: 'fixed', fixedCost: { cp: 0, sp: 0, gp: 100, pp: 0 } },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 3 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			await service.loadTemplates();
			await service.createTemplate(template);

			const saved = service.getTemplate('new_template');
			expect(saved).toBeDefined();
			expect(saved?.name).toBe('New Template');
		});

		it('should validate template before creating', async () => {
			const invalidTemplate: ProjectTemplate = {
				id: '',  // Invalid: empty ID
				name: 'Invalid Template',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			await service.loadTemplates();
			await expect(service.createTemplate(invalidTemplate)).rejects.toThrow();
		});

		it('should reject duplicate template IDs', async () => {
			const template: ProjectTemplate = {
				id: 'template_1',
				name: 'First Template',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			await service.loadTemplates();
			await service.createTemplate(template);

			const duplicate = { ...template, name: 'Duplicate Template' };
			await expect(service.createTemplate(duplicate)).rejects.toThrow();
		});
	});

	describe('template updating', () => {
		it('should update existing template', async () => {
			const template: ProjectTemplate = {
				id: 'template_1',
				name: 'Original Name',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			await service.loadTemplates();
			await service.createTemplate(template);

			await service.updateTemplate('template_1', { name: 'Updated Name' });

			const updated = service.getTemplate('template_1');
			expect(updated?.name).toBe('Updated Name');
		});

		it('should throw error for non-existent template', async () => {
			await service.loadTemplates();
			await expect(service.updateTemplate('nonexistent', { name: 'Test' })).rejects.toThrow();
		});
	});

	describe('template deletion', () => {
		it('should delete existing template', async () => {
			const template: ProjectTemplate = {
				id: 'template_1',
				name: 'To Delete',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			await service.loadTemplates();
			await service.createTemplate(template);
			await service.deleteTemplate('template_1');

			const deleted = service.getTemplate('template_1');
			expect(deleted).toBeNull();
		});
	});

	describe('template validation', () => {
		it('should validate valid template', () => {
			const template: ProjectTemplate = {
				id: 'template_1',
				name: 'Valid Template',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			const result = service.validateTemplate(template);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should reject template without ID', () => {
			const template: ProjectTemplate = {
				id: '',
				name: 'Invalid Template',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			const result = service.validateTemplate(template);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should reject template without name', () => {
			const template: ProjectTemplate = {
				id: 'template_1',
				name: '',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			const result = service.validateTemplate(template);
			expect(result.valid).toBe(false);
		});

		it('should reject invalid cost strategy', () => {
			const template: ProjectTemplate = {
				id: 'template_1',
				name: 'Invalid Template',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'fixed' },  // Missing fixedCost
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			const result = service.validateTemplate(template);
			expect(result.valid).toBe(false);
		});

		it('should reject invalid duration strategy', () => {
			const template: ProjectTemplate = {
				id: 'template_1',
				name: 'Invalid Template',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'none' },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed' },  // Missing fixedDays
				automaticSuccess: true,
				createdDate: Date.now()
			};

			const result = service.validateTemplate(template);
			expect(result.valid).toBe(false);
		});
	});

	describe('template summaries', () => {
		it('should generate template summaries', async () => {
			const template: ProjectTemplate = {
				id: 'template_1',
				name: 'Test Template',
				description: 'Test description',
				outcomeType: 'item',
				fundsCostStrategy: { type: 'fixed', fixedCost: { cp: 0, sp: 0, gp: 50, pp: 0 } },
				consumesMaterials: false,
				durationStrategy: { type: 'fixed', fixedDays: 5 },
				automaticSuccess: true,
				createdDate: Date.now()
			};

			await service.loadTemplates();
			await service.createTemplate(template);

			const summaries = service.getTemplateSummaries();
			expect(summaries).toHaveLength(1);
			expect(summaries[0].id).toBe('template_1');
			expect(summaries[0].name).toBe('Test Template');
			expect(summaries[0].outcomeType).toBe('item');
		});
	});
});
