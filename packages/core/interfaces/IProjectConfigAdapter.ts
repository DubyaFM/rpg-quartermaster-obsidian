import { ProjectTemplate } from '../models/types';

/**
 * Interface for project template configuration persistence
 * Platform-agnostic - implemented by adapter layer
 */
export interface IProjectConfigAdapter {
	/**
	 * Load all project templates from config files
	 */
	loadTemplates(): Promise<ProjectTemplate[]>;

	/**
	 * Save project template to config
	 */
	saveTemplate(template: ProjectTemplate): Promise<void>;

	/**
	 * Delete project template from config
	 */
	deleteTemplate(id: string): Promise<void>;

	/**
	 * Check if template exists
	 */
	templateExists(id: string): Promise<boolean>;

	/**
	 * Get config directory path
	 */
	getConfigPath(): string;
}
