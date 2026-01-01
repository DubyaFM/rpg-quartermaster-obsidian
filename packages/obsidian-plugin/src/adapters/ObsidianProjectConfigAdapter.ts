/**
 * ObsidianProjectConfigAdapter
 *
 * Handles loading and saving project templates from YAML config files.
 * Stores templates in config/projectTemplates/ directory.
 * Implements IProjectConfigAdapter for platform-agnostic template services.
 */

import { App, TFile, TFolder } from 'obsidian';
import * as yaml from 'js-yaml';
import { IProjectConfigAdapter } from '@quartermaster/core/interfaces/IProjectConfigAdapter';
import { ProjectTemplate } from '@quartermaster/core/models/types';

export class ObsidianProjectConfigAdapter implements IProjectConfigAdapter {
	private readonly CONFIG_DIR = 'config/projectTemplates';
	private readonly TEMPLATES_FILE = 'templates.yaml';

	constructor(private app: App) {}

	/**
	 * Load all project templates from config file
	 * @returns Array of project templates
	 */
	async loadTemplates(): Promise<ProjectTemplate[]> {
		const filePath = `${this.CONFIG_DIR}/${this.TEMPLATES_FILE}`;

		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (!file || !(file instanceof TFile)) {
				console.log(`[ProjectConfigAdapter] No templates file found at ${filePath}, returning empty array`);
				return [];
			}

			const content = await this.app.vault.read(file);
			const data = yaml.load(content) as any;

			if (!data || !data.templates || !Array.isArray(data.templates)) {
				console.warn(`[ProjectConfigAdapter] Invalid templates file structure at ${filePath}`);
				return [];
			}

			console.log(`[ProjectConfigAdapter] Loaded ${data.templates.length} template(s) from ${filePath}`);
			return data.templates as ProjectTemplate[];
		} catch (error) {
			console.error(`[ProjectConfigAdapter] Error loading templates from ${filePath}:`, error);
			return [];
		}
	}

	/**
	 * Save project template to config file
	 * Updates existing template or adds new one
	 *
	 * @param template Template to save
	 */
	async saveTemplate(template: ProjectTemplate): Promise<void> {
		const filePath = `${this.CONFIG_DIR}/${this.TEMPLATES_FILE}`;

		try {
			// Ensure config directory exists
			await this.ensureConfigDirectory();

			// Load existing templates
			const templates = await this.loadTemplates();

			// Find and update existing template, or add new one
			const existingIndex = templates.findIndex(t => t.id === template.id);

			if (existingIndex >= 0) {
				templates[existingIndex] = template;
				console.log(`[ProjectConfigAdapter] Updated template: ${template.id}`);
			} else {
				templates.push(template);
				console.log(`[ProjectConfigAdapter] Added new template: ${template.id}`);
			}

			// Save back to file
			await this.saveAllTemplates(templates, filePath);
		} catch (error) {
			console.error(`[ProjectConfigAdapter] Error saving template ${template.id}:`, error);
			throw new Error(`Failed to save project template: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Delete project template from config file
	 *
	 * @param id Template ID to delete
	 */
	async deleteTemplate(id: string): Promise<void> {
		const filePath = `${this.CONFIG_DIR}/${this.TEMPLATES_FILE}`;

		try {
			const templates = await this.loadTemplates();
			const filteredTemplates = templates.filter(t => t.id !== id);

			if (filteredTemplates.length === templates.length) {
				console.warn(`[ProjectConfigAdapter] Template ${id} not found, nothing to delete`);
				return;
			}

			await this.saveAllTemplates(filteredTemplates, filePath);
			console.log(`[ProjectConfigAdapter] Deleted template: ${id}`);
		} catch (error) {
			console.error(`[ProjectConfigAdapter] Error deleting template ${id}:`, error);
			throw new Error(`Failed to delete project template: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Check if template exists
	 *
	 * @param id Template ID
	 * @returns True if template exists
	 */
	async templateExists(id: string): Promise<boolean> {
		const templates = await this.loadTemplates();
		return templates.some(t => t.id === id);
	}

	/**
	 * Get config directory path
	 *
	 * @returns Config directory path
	 */
	getConfigPath(): string {
		return this.CONFIG_DIR;
	}

	/**
	 * Ensure config directory exists
	 * Creates directory if it doesn't exist
	 */
	private async ensureConfigDirectory(): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(this.CONFIG_DIR);

		if (!folder) {
			console.log(`[ProjectConfigAdapter] Creating config directory: ${this.CONFIG_DIR}`);
			await this.app.vault.createFolder(this.CONFIG_DIR);
		}
	}

	/**
	 * Save all templates to YAML file
	 *
	 * @param templates Array of templates to save
	 * @param filePath Path to templates file
	 */
	private async saveAllTemplates(templates: ProjectTemplate[], filePath: string): Promise<void> {
		const data = {
			templates: templates,
			metadata: {
				version: '1.0',
				lastModified: Date.now()
			}
		};

		const yamlContent = yaml.dump(data, {
			indent: 2,
			lineWidth: 120,
			noRefs: true
		});

		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file && file instanceof TFile) {
			await this.app.vault.modify(file, yamlContent);
		} else {
			await this.app.vault.create(filePath, yamlContent);
		}

		console.log(`[ProjectConfigAdapter] Saved ${templates.length} template(s) to ${filePath}`);
	}
}
