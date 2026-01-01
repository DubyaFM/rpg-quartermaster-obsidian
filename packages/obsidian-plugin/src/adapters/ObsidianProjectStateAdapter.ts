/**
 * ObsidianProjectStateAdapter
 *
 * Handles loading and saving project instances as JSON files.
 * Stores instances in a configurable directory (default: projects/).
 * Implements IProjectStateAdapter for platform-agnostic instance services.
 */

import { App, TFile, TFolder } from 'obsidian';
import { IProjectStateAdapter } from '@quartermaster/core/interfaces/IProjectStateAdapter';
import { ProjectInstance } from '@quartermaster/core/models/types';

export class ObsidianProjectStateAdapter implements IProjectStateAdapter {
	private storagePath: string;

	constructor(private app: App, storagePath?: string) {
		this.storagePath = storagePath || 'projects';
	}

	/**
	 * Load all project instances from storage directory
	 * @returns Array of project instances
	 */
	async loadInstances(): Promise<ProjectInstance[]> {
		try {
			// Ensure storage directory exists
			await this.ensureStorageDirectory();

			const folder = this.app.vault.getAbstractFileByPath(this.storagePath);

			if (!folder || !(folder instanceof TFolder)) {
				console.log(`[ProjectStateAdapter] Storage directory not found: ${this.storagePath}`);
				return [];
			}

			// Get all JSON files in the directory
			const files = this.app.vault.getFiles()
				.filter(f => f.path.startsWith(this.storagePath) && f.extension === 'json');

			const instances: ProjectInstance[] = [];

			for (const file of files) {
				try {
					const content = await this.app.vault.read(file);
					const instance = JSON.parse(content) as ProjectInstance;

					// Validate required fields
					if (this.isValidInstance(instance)) {
						instances.push(instance);
					} else {
						console.warn(`[ProjectStateAdapter] Invalid instance format in ${file.path}`);
					}
				} catch (error) {
					console.error(`[ProjectStateAdapter] Error loading instance from ${file.path}:`, error);
				}
			}

			console.log(`[ProjectStateAdapter] Loaded ${instances.length} instance(s) from ${this.storagePath}`);
			return instances;
		} catch (error) {
			console.error(`[ProjectStateAdapter] Error loading instances:`, error);
			return [];
		}
	}

	/**
	 * Save project instance to storage
	 * Creates or updates the instance file
	 *
	 * @param instance Instance to save
	 */
	async saveInstance(instance: ProjectInstance): Promise<void> {
		try {
			// Ensure storage directory exists
			await this.ensureStorageDirectory();

			const filename = this.getInstanceFilename(instance.id);
			const filePath = `${this.storagePath}/${filename}`;

			// Convert to JSON with pretty formatting
			const content = JSON.stringify(instance, null, 2);

			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (file && file instanceof TFile) {
				// Update existing file
				await this.app.vault.modify(file, content);
				console.log(`[ProjectStateAdapter] Updated instance: ${instance.id}`);
			} else {
				// Create new file
				await this.app.vault.create(filePath, content);
				console.log(`[ProjectStateAdapter] Created instance: ${instance.id}`);
			}
		} catch (error) {
			console.error(`[ProjectStateAdapter] Error saving instance ${instance.id}:`, error);
			throw new Error(`Failed to save project instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Delete project instance from storage
	 *
	 * @param id Instance ID to delete
	 */
	async deleteInstance(id: string): Promise<void> {
		try {
			const filename = this.getInstanceFilename(id);
			const filePath = `${this.storagePath}/${filename}`;

			const file = this.app.vault.getAbstractFileByPath(filePath);

			if (file && file instanceof TFile) {
				await this.app.vault.delete(file);
				console.log(`[ProjectStateAdapter] Deleted instance: ${id}`);
			} else {
				console.warn(`[ProjectStateAdapter] Instance file not found for deletion: ${id}`);
			}
		} catch (error) {
			console.error(`[ProjectStateAdapter] Error deleting instance ${id}:`, error);
			throw new Error(`Failed to delete project instance: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Check if instance exists
	 *
	 * @param id Instance ID
	 * @returns True if instance exists
	 */
	async instanceExists(id: string): Promise<boolean> {
		const filename = this.getInstanceFilename(id);
		const filePath = `${this.storagePath}/${filename}`;

		const file = this.app.vault.getAbstractFileByPath(filePath);
		return file instanceof TFile;
	}

	/**
	 * Get storage directory path
	 *
	 * @returns Storage directory path
	 */
	getStoragePath(): string {
		return this.storagePath;
	}

	/**
	 * Update storage path (allows dynamic configuration)
	 *
	 * @param path New storage path
	 */
	setStoragePath(path: string): void {
		this.storagePath = path;
	}

	/**
	 * Ensure storage directory exists
	 * Creates directory if it doesn't exist
	 */
	private async ensureStorageDirectory(): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(this.storagePath);

		if (!folder) {
			console.log(`[ProjectStateAdapter] Creating storage directory: ${this.storagePath}`);
			await this.app.vault.createFolder(this.storagePath).catch((error: Error) => {
				if (!error.message.includes('already exists')) {
					throw error;
				}
			});
		}
	}

	/**
	 * Generate filename for instance
	 *
	 * @param id Instance ID
	 * @returns Filename with extension
	 */
	private getInstanceFilename(id: string): string {
		// Sanitize ID to remove any path separators
		const sanitizedId = id.replace(/[\/\\]/g, '_');
		return `${sanitizedId}.json`;
	}

	/**
	 * Validate instance structure
	 *
	 * @param instance Instance to validate
	 * @returns True if instance has required fields
	 */
	private isValidInstance(instance: any): instance is ProjectInstance {
		return (
			instance &&
			typeof instance.id === 'string' &&
			typeof instance.templateId === 'string' &&
			typeof instance.name === 'string' &&
			Array.isArray(instance.assignedTo) &&
			typeof instance.status === 'string' &&
			typeof instance.totalDays === 'number' &&
			typeof instance.remainingDays === 'number' &&
			instance.goldCost &&
			instance.outcome &&
			typeof instance.createdDate === 'number'
		);
	}
}
