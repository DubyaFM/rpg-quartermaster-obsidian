/**
 * FacilityFileHandler - Handles facility template YAML file operations
 * Loads and caches facility templates from config folder
 */

import { App, TFile } from 'obsidian';
import { FacilityTemplate } from '@quartermaster/core/models/stronghold';
import * as yaml from 'js-yaml';

export class FacilityFileHandler {
	private templateCache: Map<string, FacilityTemplate> = new Map();
	private cacheValid: boolean = false;

	constructor(private app: App) {}

	/**
	 * Load all facility templates from config folder
	 */
	async loadFacilityTemplates(folderPath: string): Promise<FacilityTemplate[]> {
		// Return cached templates if cache is valid
		if (this.cacheValid && this.templateCache.size > 0) {
			return Array.from(this.templateCache.values());
		}

		const templates: FacilityTemplate[] = [];
		const files = this.app.vault.getFiles();

		for (const file of files) {
			if (file.path.startsWith(folderPath) && file.extension === 'yaml') {
				try {
					const template = await this.loadTemplate(file);
					if (template) {
						templates.push(template);
						this.templateCache.set(template.id, template);
					}
				} catch (error) {
					console.error(`Error loading facility template from ${file.path}:`, error);
				}
			}
		}

		this.cacheValid = true;
		return templates;
	}

	/**
	 * Load a single facility template from a file
	 */
	async loadTemplate(file: TFile): Promise<FacilityTemplate | null> {
		try {
			const content = await this.app.vault.read(file);
			const data = yaml.load(content) as any;

			if (!data || !data.id) {
				return null;
			}

			const template: FacilityTemplate = {
				id: data.id,
				name: data.name || 'Unnamed Facility',
				tier: data.tier || 1,
				baseFacilityId: data.baseFacilityId,
				type: data.type || 'basic',
				description: data.description || '',
				unlockLevel: data.unlockLevel,
				prerequisites: data.prerequisites || '',
				size: {
					category: data.size?.category || 'roomy',
					areaSquares: data.size?.areaSquares || 15
				},
				hirelingsRequired: data.hirelingsRequired || 0,
				buildCost: {
					gold: data.buildCost?.gold || 0,
					timeInDays: data.buildCost?.timeInDays || 0
				},
				upgradeCost: data.upgradeCost ? {
					gold: data.upgradeCost.gold || 0,
					timeInDays: data.upgradeCost.timeInDays || 0
				} : undefined,
				associatedOrderIds: data.associatedOrderIds || [],
				passiveBenefits: data.passiveBenefits || '',
				metadata: {
					createdDate: data.metadata?.createdDate || new Date().toISOString(),
					lastModified: data.metadata?.lastModified || new Date().toISOString()
				}
			};

			return template;
		} catch (error) {
			console.error(`Error parsing facility template from ${file.path}:`, error);
			return null;
		}
	}

	/**
	 * Save a facility template to YAML file
	 */
	async saveFacilityTemplate(template: FacilityTemplate, folderPath: string): Promise<void> {
		const fileName = `${template.id}.yaml`;
		const filePath = `${folderPath}/${fileName}`;

		// Prepare template data
		const data = {
			id: template.id,
			name: template.name,
			tier: template.tier,
			baseFacilityId: template.baseFacilityId,
			type: template.type,
			description: template.description,
			unlockLevel: template.unlockLevel,
			prerequisites: template.prerequisites,
			size: template.size,
			hirelingsRequired: template.hirelingsRequired,
			buildCost: template.buildCost,
			upgradeCost: template.upgradeCost,
			associatedOrderIds: template.associatedOrderIds,
			passiveBenefits: template.passiveBenefits,
			metadata: {
				...template.metadata,
				lastModified: new Date().toISOString()
			}
		};

		// Convert to YAML
		const content = yaml.dump(data, {
			indent: 2,
			lineWidth: -1,
			noRefs: true
		});

		// Check if file exists
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (existingFile && existingFile instanceof TFile) {
			// Update existing file
			await this.app.vault.modify(existingFile, content);
		} else {
			// Create new file
			await this.ensureFolder(folderPath);
			await this.app.vault.create(filePath, content);
		}

		// Update cache
		this.templateCache.set(template.id, template);
	}

	/**
	 * Delete a facility template file
	 */
	async deleteTemplate(templateId: string, folderPath: string): Promise<void> {
		const filePath = `${folderPath}/${templateId}.yaml`;
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file && file instanceof TFile) {
			await this.app.vault.delete(file);
			this.templateCache.delete(templateId);
		}
	}

	/**
	 * Invalidate template cache (call when files change)
	 */
	invalidateCache(): void {
		this.cacheValid = false;
	}

	/**
	 * Clear template cache completely
	 */
	clearCache(): void {
		this.templateCache.clear();
		this.cacheValid = false;
	}

	/**
	 * Get template from cache
	 */
	getCachedTemplate(templateId: string): FacilityTemplate | undefined {
		return this.templateCache.get(templateId);
	}

	/**
	 * Check if cache is valid
	 */
	isCacheValid(): boolean {
		return this.cacheValid;
	}

	/**
	 * Ensure folder exists, create if needed
	 */
	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}
}
