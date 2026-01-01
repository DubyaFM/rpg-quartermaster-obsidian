// Handles NPC file operations (save, load, update, list)
import { App, TFile } from 'obsidian';
import { NPCProfile, NPCRole, NPCRelationship } from '@quartermaster/core/models/npc';

export class NPCFileHandler {
	constructor(private app: App) {}

	/**
	 * Load an NPC from a file path
	 */
	async getNPC(path: string): Promise<NPCProfile> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`NPC file not found: ${path}`);
		}

		const content = await this.app.vault.read(file);
		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter) {
			throw new Error('NPC file has no frontmatter');
		}

		const fm = cache.frontmatter;

		return {
			npcId: fm.npcId,
			name: fm.name,
			species: fm.species,
			gender: fm.gender,
			age: fm.age,
			pronouns: fm.pronouns,
			physicalDescription: fm.physicalDescription,
			distinguishingFeatures: fm.distinguishingFeatures,
			disposition: fm.disposition,
			quirk: fm.quirk,
			alignment: fm.alignment,
			bargainDC: fm.bargainDC,
			faction: fm.faction,
			location: fm.location,
			bastion: fm.bastion,
			roles: fm.roles || [],
			relationships: fm.relationships || [],
			skills: fm.skills || [],
			toolProficiencies: fm.toolProficiencies || [],
			languages: fm.languages || [],
			specialAbilities: fm.specialAbilities || [],
			status: fm.status || 'active',
			partyReputation: fm.partyReputation,
			created: fm.created,
			lastInteraction: fm.lastInteraction,
			// Notes are stored in the markdown body, not frontmatter
			notes: this.extractNotes(content)
		};
	}

	/**
	 * Load an NPC by wikilink reference (e.g., "[[NPC Name]]")
	 */
	async getNPCByLink(link: string): Promise<NPCProfile | null> {
		// Extract the filename from [[link]]
		const match = link.match(/\[\[(.+?)\]\]/);
		if (!match) return null;

		const filename = match[1];

		// Search for the file in the vault
		const files = this.app.vault.getMarkdownFiles();
		const file = files.find(f => f.basename === filename || f.path.includes(filename));

		if (!file) return null;

		return this.getNPC(file.path);
	}

	/**
	 * Get NPC by UUID.
	 * Searches all NPC files in the specified folder (or entire vault) for matching npcId.
	 * @param npcId - UUID in format "npc-abc123..."
	 * @param folderPath - Optional: limit search to specific folder
	 * @returns NPCProfile if found, null otherwise
	 */
	async getNPCById(npcId: string, folderPath?: string): Promise<NPCProfile | null> {
		const npcPaths = folderPath ? await this.listNPCs(folderPath) : this.app.vault.getMarkdownFiles().map(f => f.path);

		for (const path of npcPaths) {
			try {
				const npc = await this.getNPC(path);
				if (npc.npcId === npcId) {
					return npc;
				}
			} catch (error) {
				console.error(`Failed to load NPC at ${path}:`, error);
			}
		}

		return null;
	}

	/**
	 * Save a new NPC to the vault
	 */
	async saveNPC(npc: NPCProfile, folderPath: string): Promise<string> {
		const content = this.generateNPCMarkdown(npc);
		const filename = this.generateFilename(npc.name, folderPath);

		await this.ensureFolder(folderPath);
		await this.app.vault.create(filename, content);

		return filename;
	}

	/**
	 * Update an existing NPC file
	 */
	async updateNPC(path: string, updates: Partial<NPCProfile>): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`NPC file not found: ${path}`);
		}

		const npc = await this.getNPC(path);
		const updatedNPC = { ...npc, ...updates };

		// Update last interaction timestamp
		updatedNPC.lastInteraction = new Date().toISOString();

		const content = this.generateNPCMarkdown(updatedNPC);
		await this.app.vault.modify(file, content);
	}

	/**
	 * List all NPC files in a folder
	 */
	async listNPCs(folderPath: string): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) return [];

		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(folderPath))
			.map(f => f.path);

		return files;
	}

	/**
	 * Get all NPCs with a specific role
	 */
	async getNPCsByRole(folderPath: string, role: NPCRole): Promise<NPCProfile[]> {
		const paths = await this.listNPCs(folderPath);
		const npcs: NPCProfile[] = [];

		for (const path of paths) {
			try {
				const npc = await this.getNPC(path);
				if (npc.roles.includes(role)) {
					npcs.push(npc);
				}
			} catch (error) {
				console.error(`Failed to load NPC at ${path}:`, error);
			}
		}

		return npcs;
	}

	/**
	 * Find NPC file path by name
	 */
	async findNPCPath(name: string, folderPath: string): Promise<string | null> {
		const paths = await this.listNPCs(folderPath);

		for (const path of paths) {
			try {
				const npc = await this.getNPC(path);
				if (npc.name === name) {
					return path;
				}
			} catch (error) {
				console.error(`Failed to load NPC at ${path}:`, error);
			}
		}

		return null;
	}

	/**
	 * Generate NPC file content with frontmatter and body
	 */
	private generateNPCMarkdown(npc: NPCProfile): string {
		// Build frontmatter object
		const frontmatter: Record<string, any> = {
			npcId: npc.npcId,
			name: npc.name,
			species: npc.species,
			gender: npc.gender,
		};

		// Add optional identity fields
		if (npc.age !== undefined) frontmatter.age = npc.age;
		if (npc.pronouns) frontmatter.pronouns = npc.pronouns;

		// Add appearance
		if (npc.physicalDescription) frontmatter.physicalDescription = npc.physicalDescription;
		if (npc.distinguishingFeatures) frontmatter.distinguishingFeatures = npc.distinguishingFeatures;

		// Add personality
		frontmatter.disposition = npc.disposition;
		frontmatter.quirk = npc.quirk;
		frontmatter.bargainDC = npc.bargainDC;
		if (npc.alignment) frontmatter.alignment = npc.alignment;

		// Add affiliations
		if (npc.faction) frontmatter.faction = npc.faction;
		if (npc.location) frontmatter.location = npc.location;
		if (npc.bastion) frontmatter.bastion = npc.bastion;

		// Add roles and relationships
		frontmatter.roles = npc.roles;
		if (npc.relationships.length > 0) {
			// Save relationships with both wikilinks and UUIDs
			// Do NOT save resolvedNpc (runtime-only cache)
			frontmatter.relationships = npc.relationships.map(rel => ({
				npcLink: rel.npcLink,           // Wikilink (user-editable)
				targetNpcId: rel.targetNpcId,   // UUID (auto-maintained)
				type: rel.type,
				description: rel.description
			}));
		}

		// Add capabilities
		if (npc.skills && npc.skills.length > 0) frontmatter.skills = npc.skills;
		if (npc.toolProficiencies && npc.toolProficiencies.length > 0) {
			frontmatter.toolProficiencies = npc.toolProficiencies;
		}
		if (npc.languages && npc.languages.length > 0) frontmatter.languages = npc.languages;
		if (npc.specialAbilities && npc.specialAbilities.length > 0) {
			frontmatter.specialAbilities = npc.specialAbilities;
		}

		// Add game state
		frontmatter.status = npc.status;
		if (npc.partyReputation !== undefined) {
			frontmatter.partyReputation = npc.partyReputation;
		}

		// Add metadata
		frontmatter.created = npc.created;
		if (npc.lastInteraction) frontmatter.lastInteraction = npc.lastInteraction;

		// Generate frontmatter YAML
		let content = '---\n';
		for (const [key, value] of Object.entries(frontmatter)) {
			if (typeof value === 'object') {
				content += `${key}: ${JSON.stringify(value)}\n`;
			} else if (typeof value === 'string') {
				// Escape quotes in strings
				const escaped = value.replace(/"/g, '\\"');
				content += `${key}: "${escaped}"\n`;
			} else {
				content += `${key}: ${value}\n`;
			}
		}
		content += '---\n\n';

		// Generate markdown body
		content += `# ${npc.name}\n\n`;

		// Role subtitle
		if (npc.roles.length > 0) {
			const roleText = npc.roles.join(', ');
			content += `*${npc.species} ${roleText}*\n\n`;
		} else {
			content += `*${npc.species}*\n\n`;
		}

		// Background section
		content += `## Background\n`;
		if (npc.notes) {
			content += `${npc.notes}\n\n`;
		} else {
			content += `(Add background information here)\n\n`;
		}

		// Relationships section
		if (npc.relationships.length > 0) {
			content += `## Relationships\n`;
			for (const rel of npc.relationships) {
				const desc = rel.description ? ` - ${rel.description}` : '';
				content += `- ${rel.npcLink} (${rel.type})${desc}\n`;
			}
			content += '\n';
		}

		// Notes section for DM
		content += `## DM Notes\n`;
		content += `(Add private notes, quest hooks, secrets, etc.)\n\n`;

		return content;
	}

	/**
	 * Extract notes from the markdown body (everything after frontmatter)
	 */
	private extractNotes(content: string): string | undefined {
		const parts = content.split('---');
		if (parts.length < 3) return undefined;

		// Everything after the second '---' is the body
		const body = parts.slice(2).join('---').trim();
		return body || undefined;
	}

	/**
	 * Generate filename from NPC name
	 */
	private generateFilename(npcName: string, folder: string): string {
		const clean = npcName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-');
		const folderPath = folder.endsWith('/') ? folder : folder + '/';
		return `${folderPath}${clean}.md`;
	}

	/**
	 * Ensure folder exists, create if not
	 */
	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}

	/**
	 * Generate a new UUID for an NPC
	 */
	static generateNPCId(): string {
		return `npc-${crypto.randomUUID()}`;
	}
}
