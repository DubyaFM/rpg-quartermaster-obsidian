/**
 * FactionFileHandler
 *
 * Handles faction file operations (save, load, update, list, scan).
 * Obsidian-specific implementation for faction entity management.
 */

import { App, TFile } from 'obsidian';
import { FactionEntity } from '@quartermaster/core/models/types';
import {
	RosterEntry,
	PresenceEntry,
	ActivityEntry,
	buildFactionBody,
	generateRenownSection
} from '@quartermaster/core/services/FactionService';

export class FactionFileHandler {
	constructor(private app: App) {}

	/**
	 * Load a faction from a file path
	 */
	async getFaction(path: string): Promise<FactionEntity> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Faction file not found: ${path}`);
		}

		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter) {
			throw new Error('Faction file has no frontmatter');
		}

		const fm = cache.frontmatter;

		return {
			factionId: fm.factionId,
			name: fm.name,
			description: fm.description,
			alignment: fm.alignment,
			renownTracking: fm.renownTracking,
			created: fm.created,
			lastUpdated: fm.lastUpdated
		};
	}

	/**
	 * Save a new faction to the vault
	 */
	async saveFaction(faction: FactionEntity, folderPath: string): Promise<string> {
		const content = await this.generateFactionMarkdown(faction);
		const filename = this.generateFilename(faction.name, folderPath);

		await this.ensureFolder(folderPath);
		await this.app.vault.create(filename, content);

		return filename;
	}

	/**
	 * Update an existing faction file
	 */
	async updateFaction(path: string, updates: Partial<FactionEntity>): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Faction file not found: ${path}`);
		}

		const faction = await this.getFaction(path);
		const updatedFaction = { ...faction, ...updates };

		// Update timestamp
		updatedFaction.lastUpdated = new Date().toISOString();

		const content = await this.generateFactionMarkdown(updatedFaction);
		await this.app.vault.modify(file, content);
	}

	/**
	 * List all faction files in a folder
	 */
	async listFactions(folderPath: string): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) return [];

		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(folderPath))
			.map(f => f.path);

		return files;
	}

	/**
	 * Find faction file path by name
	 */
	async findFactionPath(name: string, folderPath: string): Promise<string | null> {
		const paths = await this.listFactions(folderPath);

		for (const path of paths) {
			try {
				const faction = await this.getFaction(path);
				if (faction.name === name) {
					return path;
				}
			} catch (error) {
				console.error(`Failed to load faction at ${path}:`, error);
			}
		}

		return null;
	}

	/**
	 * Scan vault for NPCs in this faction's roster
	 * (NPCs with factionRole field referencing this faction)
	 */
	async scanFactionRoster(factionName: string, npcFolderPath: string): Promise<RosterEntry[]> {
		const roster: RosterEntry[] = [];
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(npcFolderPath));

		for (const file of files) {
			try {
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter) continue;

				const fm = cache.frontmatter;

				// Check if NPC has factionRole field
				if (fm.factionRole && this.isFactionRoleMatch(fm.factionRole, factionName)) {
					const factionRole = this.parseFactionRole(fm.factionRole, factionName);

					roster.push({
						name: fm.name || file.basename,
						link: `[[${file.basename}]]`,
						role: factionRole.role,
						rank: factionRole.rank,
						location: fm.location,
						status: fm.status
					});
				}
			} catch (error) {
				console.error(`Failed to process NPC file ${file.path}:`, error);
			}
		}

		return roster;
	}

	/**
	 * Scan vault for locations where this faction is present
	 * (This is a placeholder - implementation depends on how locations track faction presence)
	 */
	async scanFactionPresence(factionName: string, locationsFolderPath: string): Promise<PresenceEntry[]> {
		const presence: PresenceEntry[] = [];
		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(locationsFolderPath));

		for (const file of files) {
			try {
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.frontmatter) continue;

				const fm = cache.frontmatter;

				// Check if location has this faction present
				// (For now, we'll check if the faction is mentioned in the location's body)
				const content = await this.app.vault.read(file as TFile);
				if (this.isFactionMentioned(content, factionName)) {
					presence.push({
						location: fm.name || file.basename,
						link: `[[${file.basename}]]`,
						influence: undefined,  // Could be extracted from frontmatter if available
						operations: undefined  // Could be extracted from location body
					});
				}
			} catch (error) {
				console.error(`Failed to process location file ${file.path}:`, error);
			}
		}

		return presence;
	}

	// ========================================================================
	// Private Helper Methods
	// ========================================================================

	/**
	 * Generate full markdown content for a faction file
	 */
	private async generateFactionMarkdown(faction: FactionEntity): Promise<string> {
		let markdown = '---\n';

		if (faction.factionId) {
			markdown += `factionId: ${faction.factionId}\n`;
		}

		markdown += `name: "${faction.name}"\n`;
		markdown += `description: "${faction.description}"\n`;
		markdown += `alignment: "${faction.alignment}"\n`;

		if (faction.renownTracking) {
			markdown += `renownTracking:\n`;
			markdown += `  enabled: ${faction.renownTracking.enabled}\n`;
			markdown += `  partyScore: ${faction.renownTracking.partyScore}\n`;

			if (faction.renownTracking.individualScores && Object.keys(faction.renownTracking.individualScores).length > 0) {
				markdown += `  individualScores:\n`;
				for (const [player, score] of Object.entries(faction.renownTracking.individualScores)) {
					markdown += `    ${player}: ${score}\n`;
				}
			}

			if (faction.renownTracking.rankLadder && faction.renownTracking.rankLadder.length > 0) {
				markdown += `  rankLadder:\n`;
				for (const rank of faction.renownTracking.rankLadder) {
					markdown += `    - threshold: ${rank.threshold}\n`;
					markdown += `      title: "${rank.title}"\n`;
					if (rank.perk) {
						markdown += `      perk: "${rank.perk}"\n`;
					}
				}
			}

			if (faction.renownTracking.lastUpdated) {
				markdown += `  lastUpdated: "${faction.renownTracking.lastUpdated}"\n`;
			}

			if (faction.renownTracking.notes) {
				markdown += `  notes: "${faction.renownTracking.notes}"\n`;
			}
		}

		if (faction.created) {
			markdown += `created: "${faction.created}"\n`;
		}

		if (faction.lastUpdated) {
			markdown += `lastUpdated: "${faction.lastUpdated}"\n`;
		}

		markdown += '---\n\n';

		// Generate renown section (if enabled)
		if (faction.renownTracking) {
			markdown += generateRenownSection(faction.renownTracking);
		}

		// Get settings to find folder paths for scanning
		const settings = (this.app as any).plugins?.plugins?.quartermaster?.settings;
		const npcFolder = settings?.npcsFolder || 'NPCs';
		const locationFolder = settings?.locationsFolder || 'Locations';

		// Scan for related entities
		const roster = await this.scanFactionRoster(faction.name, npcFolder);
		const presence = await this.scanFactionPresence(faction.name, locationFolder);
		const activities: ActivityEntry[] = [];  // TODO: Implement activity tracking

		// Generate body with dynamic tables
		markdown += buildFactionBody({
			description: undefined,  // Already in frontmatter
			alignment: undefined,  // Already in frontmatter
			roster,
			presence,
			activities
		});

		return markdown;
	}

	/**
	 * Generate filename for a faction
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
	 * Check if factionRole field references this faction
	 * Supports multiple formats:
	 * - "Harpers: Agent"
	 * - "Agent (Harpers)"
	 * - { faction: "Harpers", role: "Agent" }
	 */
	private isFactionRoleMatch(factionRole: any, factionName: string): boolean {
		if (typeof factionRole === 'string') {
			// Check both "Faction: Role" and "Role (Faction)" formats
			return factionRole.includes(factionName);
		}

		if (typeof factionRole === 'object' && factionRole.faction) {
			return this.extractLinkTarget(factionRole.faction) === factionName;
		}

		return false;
	}

	/**
	 * Parse factionRole field to extract role and rank
	 * Supports formats:
	 * - "Harpers: Agent"
	 * - "Agent (Harpers)"
	 * - { faction: "Harpers", role: "Agent", rank: "Lieutenant" }
	 */
	private parseFactionRole(factionRole: any, factionName: string): { role?: string; rank?: string } {
		if (typeof factionRole === 'string') {
			// Try "Faction: Role" format
			const colonMatch = factionRole.match(/^(.+?):\s*(.+)$/);
			if (colonMatch) {
				const [, faction, role] = colonMatch;
				if (faction.trim() === factionName) {
					return { role: role.trim() };
				}
			}

			// Try "Role (Faction)" format
			const parenMatch = factionRole.match(/^(.+?)\s*\((.+?)\)$/);
			if (parenMatch) {
				const [, role, faction] = parenMatch;
				if (faction.trim() === factionName) {
					return { role: role.trim() };
				}
			}

			// Fall back to entire string as role
			return { role: factionRole };
		}

		if (typeof factionRole === 'object') {
			return {
				role: factionRole.role,
				rank: factionRole.rank
			};
		}

		return {};
	}

	/**
	 * Check if faction is mentioned in location content
	 */
	private isFactionMentioned(content: string, factionName: string): boolean {
		// Check for direct mentions or wikilinks
		return content.includes(factionName) || content.includes(`[[${factionName}]]`);
	}

	/**
	 * Extract link target from wikilink or plain string
	 * "[[Harpers]]" -> "Harpers"
	 * "Harpers" -> "Harpers"
	 */
	private extractLinkTarget(value: string): string {
		const match = value.match(/\[\[(.+?)\]\]/);
		return match ? match[1] : value;
	}
}
