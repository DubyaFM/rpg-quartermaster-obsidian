/**
 * LocationFileHandler
 *
 * Handles location file operations (save, load, update, list, scan).
 * Obsidian-specific implementation for location entity management.
 */

import { App, TFile } from 'obsidian';
import { Location } from '@quartermaster/core/models/types';
import {
	ResidentEntry,
	BusinessEntry,
	FactionPresenceEntry,
	JobEntry,
	buildLocationBody,
	generateRenownSection,
	generateHierarchySection,
	buildLocationBreadcrumb
} from '@quartermaster/core/services/LocationService';
import { Shop } from '@quartermaster/core/models/types';
import { NPCProfile } from '@quartermaster/core/models/npc';

export class LocationFileHandler {
	constructor(private app: App) {}

	/**
	 * Load a location from a file path
	 */
	async getLocation(path: string): Promise<Location> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Location file not found: ${path}`);
		}

		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter) {
			throw new Error('Location file has no frontmatter');
		}

		const fm = cache.frontmatter;

		return {
			locationId: fm.locationId,
			name: fm.name,
			parentLocation: fm.parentLocation,
			status: fm.status,
			description: fm.description,
			renownTracking: fm.renownTracking,
			created: fm.created,
			lastUpdated: fm.lastUpdated
		};
	}

	/**
	 * Save a new location to the vault
	 */
	async saveLocation(location: Location, folderPath: string): Promise<string> {
		const content = await this.generateLocationMarkdown(location);
		const filename = this.generateFilename(location.name, folderPath);

		await this.ensureFolder(folderPath);
		await this.app.vault.create(filename, content);

		return filename;
	}

	/**
	 * Update an existing location file
	 */
	async updateLocation(path: string, updates: Partial<Location>): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Location file not found: ${path}`);
		}

		const location = await this.getLocation(path);
		const updatedLocation = { ...location, ...updates };

		// Update timestamp
		updatedLocation.lastUpdated = new Date().toISOString();

		const content = await this.generateLocationMarkdown(updatedLocation);
		await this.app.vault.modify(file, content);
	}

	/**
	 * List all location files in a folder
	 */
	async listLocations(folderPath: string): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) return [];

		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(folderPath))
			.map(f => f.path);

		return files;
	}

	/**
	 * Find location file path by name
	 */
	async findLocationPath(name: string, folderPath: string): Promise<string | null> {
		const paths = await this.listLocations(folderPath);

		for (const path of paths) {
			try {
				const location = await this.getLocation(path);
				if (location.name === name) {
					return path;
				}
			} catch (error) {
				console.error(`Failed to load location at ${path}:`, error);
			}
		}

		return null;
	}

	/**
	 * Scan vault for NPCs residing at this location
	 */
	async scanLocationResidents(locationName: string, npcFolderPath: string): Promise<ResidentEntry[]> {
		const residents: ResidentEntry[] = [];
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(npcFolderPath));

		for (const file of files) {
			try {
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter) continue;

				const fm = cache.frontmatter;

				// Check if NPC has location field matching locationName
				if (fm.location && this.extractLinkTarget(fm.location) === locationName) {
					residents.push({
						name: fm.name || file.basename,
						link: `[[${file.basename}]]`,
						species: fm.species,
						occupation: fm.occupation || this.extractOccupationFromRoles(fm.roles),
						faction: fm.faction
					});
				}
			} catch (error) {
				console.error(`Failed to process NPC file ${file.path}:`, error);
			}
		}

		return residents;
	}

	/**
	 * Scan vault for shops at this location
	 */
	async scanLocationBusinesses(locationName: string, shopsFolderPath: string): Promise<BusinessEntry[]> {
		const businesses: BusinessEntry[] = [];
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(shopsFolderPath));

		for (const file of files) {
			try {
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter) continue;

				const fm = cache.frontmatter;

				// Check if shop has location field matching locationName
				if (fm.location && this.extractLinkTarget(fm.location) === locationName) {
					businesses.push({
						name: fm.name || file.basename,
						link: `[[${file.basename}]]`,
						type: fm.type || 'Unknown',
						wealthLevel: fm.wealthLevel,
						shopkeeper: fm.shopkeepNPC || fm.npcLink
					});
				}
			} catch (error) {
				console.error(`Failed to process shop file ${file.path}:`, error);
			}
		}

		return businesses;
	}

	/**
	 * Scan vault for factions present at this location
	 * (This is a placeholder - full implementation depends on faction file structure)
	 */
	async scanLocationFactions(locationName: string, factionsFolderPath: string): Promise<FactionPresenceEntry[]> {
		const factions: FactionPresenceEntry[] = [];
		// TODO: Implement when FactionFileHandler is created
		return factions;
	}

	// ========================================================================
	// Private Helper Methods
	// ========================================================================

	/**
	 * Generate full markdown content for a location file
	 */
	private async generateLocationMarkdown(location: Location): Promise<string> {
		let markdown = '---\n';
		markdown += `locationId: ${location.locationId}\n`;
		markdown += `name: "${location.name}"\n`;

		if (location.parentLocation) {
			markdown += `parentLocation: "${location.parentLocation}"\n`;
		}

		if (location.status) {
			markdown += `status: "${location.status}"\n`;
		}

		if (location.description) {
			markdown += `description: "${location.description}"\n`;
		}

		if (location.renownTracking) {
			markdown += `renownTracking:\n`;
			markdown += `  enabled: ${location.renownTracking.enabled}\n`;
			markdown += `  partyScore: ${location.renownTracking.partyScore}\n`;

			if (location.renownTracking.individualScores && Object.keys(location.renownTracking.individualScores).length > 0) {
				markdown += `  individualScores:\n`;
				for (const [player, score] of Object.entries(location.renownTracking.individualScores)) {
					markdown += `    ${player}: ${score}\n`;
				}
			}

			if (location.renownTracking.rankLadder && location.renownTracking.rankLadder.length > 0) {
				markdown += `  rankLadder:\n`;
				for (const rank of location.renownTracking.rankLadder) {
					markdown += `    - threshold: ${rank.threshold}\n`;
					markdown += `      title: "${rank.title}"\n`;
					if (rank.perk) {
						markdown += `      perk: "${rank.perk}"\n`;
					}
				}
			}

			if (location.renownTracking.lastUpdated) {
				markdown += `  lastUpdated: "${location.renownTracking.lastUpdated}"\n`;
			}

			if (location.renownTracking.notes) {
				markdown += `  notes: "${location.renownTracking.notes}"\n`;
			}
		}

		markdown += `created: "${location.created}"\n`;

		if (location.lastUpdated) {
			markdown += `lastUpdated: "${location.lastUpdated}"\n`;
		}

		markdown += '---\n\n';

		// Generate hierarchy section (if parent exists)
		if (location.parentLocation) {
			const breadcrumb = buildLocationBreadcrumb(location.name, [location.parentLocation]);
			markdown += generateHierarchySection(location.parentLocation, breadcrumb);
		}

		// Generate renown section (if enabled)
		if (location.renownTracking) {
			markdown += generateRenownSection(location.renownTracking);
		}

		// Get settings to find folder paths for scanning
		const settings = (this.app as any).plugins?.plugins?.quartermaster?.settings;
		const npcFolder = settings?.npcsFolder || 'NPCs';
		const shopFolder = settings?.shopsFolder || 'Shops';
		const factionFolder = settings?.factionsFolder || 'Factions';

		// Scan for related entities
		const residents = await this.scanLocationResidents(location.name, npcFolder);
		const businesses = await this.scanLocationBusinesses(location.name, shopFolder);
		const factions = await this.scanLocationFactions(location.name, factionFolder);
		const jobs: JobEntry[] = [];  // TODO: Implement job scanning when job system is added

		// Generate body with dynamic tables
		markdown += buildLocationBody({
			description: undefined,  // Already in frontmatter
			residents,
			businesses,
			factions,
			jobs
		});

		return markdown;
	}

	/**
	 * Generate filename for a location
	 */
	private generateFilename(name: string, folderPath: string): string {
		const sanitized = name.replace(/[\\/:*?"<>|]/g, '-');
		return `${folderPath}/${sanitized}.md`;
	}

	/**
	 * Ensure folder exists, create if it doesn't
	 */
	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}

	/**
	 * Extract link target from wikilink or plain string
	 * "[[Waterdeep]]" -> "Waterdeep"
	 * "Waterdeep" -> "Waterdeep"
	 */
	private extractLinkTarget(value: string): string {
		const match = value.match(/\[\[(.+?)\]\]/);
		return match ? match[1] : value;
	}

	/**
	 * Extract occupation from roles array if present
	 */
	private extractOccupationFromRoles(roles: any[]): string | undefined {
		if (!roles || !Array.isArray(roles) || roles.length === 0) {
			return undefined;
		}

		// Look for first role with occupation field
		for (const role of roles) {
			if (typeof role === 'object' && role.occupation) {
				return role.occupation;
			}
		}

		// Fall back to first role type
		if (typeof roles[0] === 'string') {
			return roles[0];
		}

		if (typeof roles[0] === 'object' && roles[0].type) {
			return roles[0].type;
		}

		return undefined;
	}
}
