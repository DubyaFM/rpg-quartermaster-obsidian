/**
 * StrongholdFileHandler - Handles stronghold markdown file operations
 * Reads and writes stronghold data with frontmatter serialization
 */

import { App, TFile, Notice } from 'obsidian';
import { Stronghold } from '@quartermaster/core/models/stronghold';
import * as yaml from 'js-yaml';

export class StrongholdFileHandler {
	constructor(private app: App) {}

	/**
	 * Save a stronghold to a markdown file
	 */
	async saveStronghold(stronghold: Stronghold, folderPath: string): Promise<void> {
		const fileName = this.sanitizeFileName(stronghold.name);
		const filePath = `${folderPath}/${fileName}.md`;

		const content = this.generateStrongholdMarkdown(stronghold);

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
	}

	/**
	 * Load a stronghold from a markdown file
	 */
	async loadStronghold(filePath: string): Promise<Stronghold | null> {
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!file || !(file instanceof TFile)) {
			return null;
		}

		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter) {
			return null;
		}

		try {
			// Parse stronghold data from frontmatter
			const frontmatter = cache.frontmatter;

			const stronghold: Stronghold = {
				id: frontmatter.strongholdId || `stronghold-${Date.now()}`,
				name: frontmatter.name || file.basename,
				ownership: frontmatter.ownership || { type: 'party' },
				location: frontmatter.location,
				defenders: frontmatter.defenders || {
					basic: { current: 0, maximum: 10 },
					special: []
				},
				stashInventoryFile: frontmatter.stashInventoryFile || `${file.basename}-Stash.md`,
				facilities: frontmatter.facilities || [],
				activeBuffs: frontmatter.activeBuffs || [],
				neglectCounter: frontmatter.neglectCounter || 0,
				lastTurnDay: frontmatter.lastTurnDay,
				metadata: frontmatter.metadata || {
					createdDate: new Date().toISOString(),
					lastModified: new Date().toISOString()
				}
			};

			return stronghold;
		} catch (error) {
			console.error(`Error loading stronghold from ${filePath}:`, error);
			return null;
		}
	}

	/**
	 * List all stronghold files in a folder
	 */
	async listStrongholds(folderPath: string): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);

		if (!folder) {
			return [];
		}

		const files = this.app.vault.getMarkdownFiles();
		const strongholdFiles: string[] = [];

		for (const file of files) {
			if (file.path.startsWith(folderPath)) {
				const cache = this.app.metadataCache.getFileCache(file);
				// Check if file has strongholdId in frontmatter
				if (cache?.frontmatter?.strongholdId) {
					strongholdFiles.push(file.path);
				}
			}
		}

		return strongholdFiles;
	}

	/**
	 * Delete a stronghold file
	 */
	async deleteStronghold(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file && file instanceof TFile) {
			await this.app.vault.delete(file);
		}
	}

	/**
	 * Check if a stronghold file exists
	 */
	strongholdExists(filePath: string): boolean {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		return file !== null && file instanceof TFile;
	}

	/**
	 * Get stronghold file path from stronghold ID
	 */
	async getStrongholdFilePath(strongholdId: string, folderPath: string): Promise<string | null> {
		const files = await this.listStrongholds(folderPath);

		for (const filePath of files) {
			const stronghold = await this.loadStronghold(filePath);
			if (stronghold && stronghold.id === strongholdId) {
				return filePath;
			}
		}

		return null;
	}

	/**
	 * Generate markdown content for stronghold file
	 */
	private generateStrongholdMarkdown(stronghold: Stronghold): string {
		// Prepare frontmatter data
		const frontmatter = {
			strongholdId: stronghold.id,
			name: stronghold.name,
			ownership: stronghold.ownership,
			location: stronghold.location,
			defenders: stronghold.defenders,
			stashInventoryFile: stronghold.stashInventoryFile,
			facilities: stronghold.facilities,
			activeBuffs: stronghold.activeBuffs,
			neglectCounter: stronghold.neglectCounter,
			lastTurnDay: stronghold.lastTurnDay,
			metadata: {
				...stronghold.metadata,
				lastModified: new Date().toISOString()
			}
		};

		// Generate YAML frontmatter
		let content = '---\n';
		content += yaml.dump(frontmatter, {
			indent: 2,
			lineWidth: -1, // No line wrapping
			noRefs: true // Don't use YAML references
		});
		content += '---\n\n';

		// Generate markdown body
		content += `# ${stronghold.name}\n\n`;

		// Stronghold Status Section
		content += `## Stronghold Status\n`;
		content += `**Defenders:** ${stronghold.defenders.basic.current} / ${stronghold.defenders.basic.maximum}\n`;
		if (stronghold.location) {
			content += `**Location:** ${stronghold.location}\n`;
		}
		if (stronghold.lastTurnDay !== undefined) {
			content += `**Last Turn:** Day ${stronghold.lastTurnDay}\n`;
		}
		content += `**Neglect Counter:** ${stronghold.neglectCounter}\n\n`;

		// Ownership Section
		content += `## Ownership\n`;
		if (stronghold.ownership.type === 'party') {
			content += `Party-owned stronghold\n\n`;
		} else {
			content += `Owner: ${stronghold.ownership.ownerName || 'Unknown'}\n`;
			if (stronghold.ownership.ownerLinkedFile) {
				content += `Link: [[${stronghold.ownership.ownerLinkedFile}]]\n`;
			}
			content += '\n';
		}

		// Special Defenders Section
		if (stronghold.defenders.special.length > 0) {
			content += `## Special Defenders\n`;
			for (const defender of stronghold.defenders.special) {
				content += `- **${defender.name}**`;
				if (defender.role) {
					content += ` (${defender.role})`;
				}
				content += ` - ${defender.status}\n`;
				if (defender.characteristics) {
					content += `  - ${defender.characteristics}\n`;
				}
				if (defender.statBlock) {
					content += `  - Stat Block: ${defender.statBlock}\n`;
				}
			}
			content += '\n';
		}

		// Facilities Section
		if (stronghold.facilities.length > 0) {
			content += `## Facilities\n`;
			for (const facility of stronghold.facilities) {
				content += `### ${facility.name} (${facility.status})\n`;
				if (facility.status === 'busy' && facility.busyUntilDay) {
					content += `- Busy until: Day ${facility.busyUntilDay}\n`;
				}
				if (facility.assignedHirelings.length > 0) {
					content += `- Assigned Hirelings: ${facility.assignedHirelings.length}\n`;
				}
				if (facility.notes) {
					content += `- Notes: ${facility.notes}\n`;
				}
				content += '\n';
			}
		} else {
			content += `## Facilities\nNo facilities constructed yet.\n\n`;
		}

		// Active Buffs Section
		if (stronghold.activeBuffs.length > 0) {
			content += `## Active Buffs\n`;
			for (const buff of stronghold.activeBuffs) {
				content += `- **${buff.name}**`;
				if (buff.expiresOnDay !== undefined) {
					content += ` (expires Day ${buff.expiresOnDay})`;
				} else {
					content += ` (permanent)`;
				}
				content += `\n`;
				content += `  - ${buff.description}\n`;
				if (buff.effects) {
					content += `  - Effects: ${buff.effects}\n`;
				}
			}
			content += '\n';
		}

		// Stronghold Stash Section
		content += `## Stronghold Stash\n`;
		content += `See: [[${stronghold.stashInventoryFile.replace('.md', '')}]]\n\n`;

		return content;
	}

	/**
	 * Sanitize filename to remove invalid characters
	 */
	private sanitizeFileName(name: string): string {
		return name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
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
