import { ProjectInstance } from '../models/types';

/**
 * Interface for project instance state persistence
 * Platform-agnostic - implemented by adapter layer
 */
export interface IProjectStateAdapter {
	/**
	 * Load all project instances from storage
	 */
	loadInstances(): Promise<ProjectInstance[]>;

	/**
	 * Save project instance
	 */
	saveInstance(instance: ProjectInstance): Promise<void>;

	/**
	 * Delete project instance
	 */
	deleteInstance(id: string): Promise<void>;

	/**
	 * Check if instance exists
	 */
	instanceExists(id: string): Promise<boolean>;

	/**
	 * Get storage directory path
	 */
	getStoragePath(): string;
}
