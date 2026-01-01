/**
 * Obsidian implementation of IPathResolver
 *
 * Maps functional path keys to vault file/folder paths.
 * Implements "Lazy Creation" policy - auto-creates missing directories.
 */

import { Vault, normalizePath } from 'obsidian';
import { IPathResolver, CampaignPathKey, CampaignPathMappings } from '../interfaces/IPathResolver';

/**
 * Path resolver for Obsidian vault operations
 *
 * Responsibilities:
 * - Resolve functional keys to absolute vault paths
 * - Auto-create missing directories (Lazy Creation)
 * - Normalize paths for cross-platform compatibility
 */
export class ObsidianPathResolver implements IPathResolver {
	constructor(
		private pathMappings: CampaignPathMappings,
		private vault: Vault
	) {}

	// ==================== PUBLIC API ====================

	async resolveRoot(key: CampaignPathKey): Promise<string> {
		const rawPath = this.pathMappings[key];

		if (!rawPath) {
			throw new Error(`Path mapping not configured for key: ${key}`);
		}

		// Normalize path (handles Windows backslashes, removes trailing slashes)
		const normalizedPath = normalizePath(rawPath);

		// Ensure directory exists (Lazy Creation policy)
		await this.ensureDirectory(normalizedPath);

		// Return with trailing slash for consistency
		return normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`;
	}

	async resolveEntityPath(key: CampaignPathKey, filename: string): Promise<string> {
		const rootPath = await this.resolveRoot(key);

		// Normalize filename (remove leading slashes)
		const normalizedFilename = filename.replace(/^\/+/, '');

		// Combine root + filename
		const fullPath = normalizePath(`${rootPath}${normalizedFilename}`);

		return fullPath;
	}

	getRawPath(key: CampaignPathKey): string | undefined {
		return this.pathMappings[key];
	}

	hasPath(key: CampaignPathKey): boolean {
		return this.pathMappings[key] !== undefined;
	}

	// ==================== HELPER METHODS ====================

	/**
	 * Ensure directory exists in vault
	 * Creates directory recursively if missing (mkdir -p behavior)
	 *
	 * @param path - Normalized directory path
	 */
	private async ensureDirectory(path: string): Promise<void> {
		// Check if path already exists
		const existingFolder = this.vault.getAbstractFileByPath(path);

		if (existingFolder) {
			// Path exists - verify it's a folder, not a file
			if (existingFolder.hasOwnProperty('children')) {
				// It's a folder - we're done
				return;
			} else {
				// It's a file - this is an error
				throw new Error(
					`Path "${path}" exists but is a file, not a folder. ` +
					`Please check campaign path configuration.`
				);
			}
		}

		// Directory doesn't exist - create it recursively
		try {
			await this.vault.createFolder(path);
			console.log(`[Quartermaster] Created directory: ${path}`);
		} catch (error) {
			// Obsidian throws an error if parent directory doesn't exist
			// We need to create parent directories first
			const parentPath = path.substring(0, path.lastIndexOf('/'));

			if (parentPath && parentPath !== path) {
				// Recursively create parent directory
				await this.ensureDirectory(parentPath);

				// Now try creating the target directory again
				await this.vault.createFolder(path);
				console.log(`[Quartermaster] Created directory: ${path}`);
			} else {
				// No parent path - re-throw error
				throw new Error(
					`Failed to create directory "${path}": ${error.message}`
				);
			}
		}
	}

	/**
	 * Get all configured path mappings
	 * Useful for debugging and validation
	 */
	getAllPaths(): CampaignPathMappings {
		return { ...this.pathMappings };
	}

	/**
	 * Validate that all required paths are configured
	 * Returns list of missing required paths
	 *
	 * @param requiredKeys - List of path keys that must be configured
	 * @returns Array of missing keys (empty if all present)
	 */
	validateRequiredPaths(requiredKeys: CampaignPathKey[]): CampaignPathKey[] {
		return requiredKeys.filter(key => !this.hasPath(key));
	}
}
