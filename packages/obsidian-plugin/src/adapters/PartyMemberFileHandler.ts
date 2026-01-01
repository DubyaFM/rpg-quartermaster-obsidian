// Handles party member file operations (save, load, update, list, delete)
import { App, TFile, Notice } from 'obsidian';
import { PartyMember } from '@quartermaster/core/models/types';

export class PartyMemberFileHandler {
	constructor(private app: App) {}

	/**
	 * Load a party member from a file path
	 */
	async getPartyMember(path: string): Promise<PartyMember> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Party member file not found: ${path}`);
		}

		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter) {
			throw new Error('Party member file has no frontmatter');
		}

		const fm = cache.frontmatter;

		return {
			id: fm.id,
			name: fm.name,
			linkedFile: path,
			level: fm.level,
			xp: fm.xp,
			strength: fm.strength,
			dexterity: fm.dexterity,
			constitution: fm.constitution,
			intelligence: fm.intelligence,
			wisdom: fm.wisdom,
			charisma: fm.charisma,
			size: fm.size,
			bonuses: fm.bonuses || [],
			dataSource: {
				type: fm.dataSource?.type || fm.dataSourceType || 'manual',
				linkedFile: fm.dataSource?.linkedFile || path
			}
		};
	}

	/**
	 * Get all party members from a folder
	 */
	async getPartyMembers(folderPath: string): Promise<PartyMember[]> {
		const paths = await this.listPartyMembers(folderPath);
		const members: PartyMember[] = [];

		for (const path of paths) {
			try {
				const member = await this.getPartyMember(path);
				members.push(member);
			} catch (error) {
				console.error(`Failed to load party member at ${path}:`, error);
			}
		}

		return members;
	}

	/**
	 * Save a new party member to the vault
	 */
	async savePartyMember(member: PartyMember, folderPath: string): Promise<string> {
		const content = this.generatePartyMemberMarkdown(member);
		const filename = this.generateFilename(member.name, folderPath);

		await this.ensureFolder(folderPath);
		await this.app.vault.create(filename, content);

		return filename;
	}

	/**
	 * Update an existing party member file
	 */
	async updatePartyMember(path: string, updates: Partial<PartyMember>): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Party member file not found: ${path}`);
		}

		const member = await this.getPartyMember(path);
		const updatedMember = {
			...member,
			...updates
		};

		const content = this.generatePartyMemberMarkdown(updatedMember);
		await this.app.vault.modify(file, content);
	}

	/**
	 * Delete a party member file
	 */
	async deletePartyMember(path: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Party member file not found: ${path}`);
		}

		await this.app.vault.delete(file);
	}

	/**
	 * Find party member file by ID
	 */
	async findPartyMemberById(id: string, folderPath: string): Promise<string | null> {
		const paths = await this.listPartyMembers(folderPath);

		for (const path of paths) {
			try {
				const member = await this.getPartyMember(path);
				if (member.id === id) {
					return path;
				}
			} catch (error) {
				console.error(`Failed to load party member at ${path}:`, error);
			}
		}

		return null;
	}

	/**
	 * List all party member files in a folder
	 */
	async listPartyMembers(folderPath: string): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) return [];

		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(folderPath))
			.map(f => f.path);

		return files;
	}

	/**
	 * Generate markdown content for a party member file
	 */
	private generatePartyMemberMarkdown(member: PartyMember): string {
		const frontmatter = [
			'---',
			`id: ${member.id}`,
			`name: ${member.name}`,
			member.level !== undefined ? `level: ${member.level}` : null,
			member.xp !== undefined ? `xp: ${member.xp}` : null,
			member.strength !== undefined ? `strength: ${member.strength}` : null,
			member.dexterity !== undefined ? `dexterity: ${member.dexterity}` : null,
			member.constitution !== undefined ? `constitution: ${member.constitution}` : null,
			member.intelligence !== undefined ? `intelligence: ${member.intelligence}` : null,
			member.wisdom !== undefined ? `wisdom: ${member.wisdom}` : null,
			member.charisma !== undefined ? `charisma: ${member.charisma}` : null,
			member.size !== undefined ? `size: ${member.size}` : null,
			member.bonuses && member.bonuses.length > 0 ? `bonuses: ${JSON.stringify(member.bonuses)}` : null,
			`dataSourceType: ${member.dataSource?.type || 'manual'}`,
			member.linkedFile ? `linkedFile: ${member.linkedFile}` : null,
			'---',
			''
		].filter(line => line !== null).join('\n');

		const body = [
			`# ${member.name}`,
			'',
			'## Character Stats',
			'',
			member.level !== undefined ? `**Level**: ${member.level}` : null,
			member.xp !== undefined ? `**Experience**: ${member.xp} XP` : null,
			member.size !== undefined ? `**Size**: ${member.size}` : null,
			'',
			'### Ability Scores',
			'',
			member.strength !== undefined ? `- **Strength**: ${member.strength} (${this.getModifier(member.strength)})` : null,
			member.dexterity !== undefined ? `- **Dexterity**: ${member.dexterity} (${this.getModifier(member.dexterity)})` : null,
			member.constitution !== undefined ? `- **Constitution**: ${member.constitution} (${this.getModifier(member.constitution)})` : null,
			member.intelligence !== undefined ? `- **Intelligence**: ${member.intelligence} (${this.getModifier(member.intelligence)})` : null,
			member.wisdom !== undefined ? `- **Wisdom**: ${member.wisdom} (${this.getModifier(member.wisdom)})` : null,
			member.charisma !== undefined ? `- **Charisma**: ${member.charisma} (${this.getModifier(member.charisma)})` : null,
			'',
			member.bonuses && member.bonuses.length > 0 ? '### Active Bonuses' : null,
			member.bonuses && member.bonuses.length > 0 ? '' : null,
			...(member.bonuses || []).map(bonus => `- **${bonus.type}**: +${bonus.value} (${bonus.source})`),
			'',
			'## Notes',
			'',
			'Add character notes here...'
		].filter(line => line !== null).join('\n');

		return frontmatter + body;
	}

	/**
	 * Calculate ability score modifier
	 */
	private getModifier(score: number): string {
		const mod = Math.floor((score - 10) / 2);
		return mod >= 0 ? `+${mod}` : `${mod}`;
	}

	/**
	 * Generate a unique filename for a party member
	 */
	private generateFilename(name: string, folderPath: string): string {
		// Sanitize name for filename
		const safeName = name.replace(/[^a-z0-9]/gi, '_');
		const basePath = `${folderPath}/${safeName}`;

		// Check if file already exists
		let counter = 1;
		let filename = `${basePath}.md`;

		while (this.app.vault.getAbstractFileByPath(filename)) {
			filename = `${basePath}_${counter}.md`;
			counter++;
		}

		return filename;
	}

	/**
	 * Ensure folder exists, create if it doesn't
	 */
	private async ensureFolder(folderPath: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) {
			await this.app.vault.createFolder(folderPath);
		}
	}
}
