// Handles hireling tracking file operations
import { App, TFile } from 'obsidian';
import { HirelingEmployment, HirelingsTrackingFile } from '@quartermaster/core/models/hireling';

export class HirelingFileHandler {
	private readonly ACTIVE_HIRELINGS_FILE = 'Active Hirelings.md';

	constructor(private app: App) {}

	/**
	 * Get the path to the active hirelings file
	 */
	private getHirelingsFilePath(folder: string): string {
		const folderPath = folder.endsWith('/') ? folder : folder + '/';
		return `${folderPath}${this.ACTIVE_HIRELINGS_FILE}`;
	}

	/**
	 * Load all active hirelings from the tracking file
	 */
	async loadHirelings(folder: string): Promise<HirelingEmployment[]> {
		const filePath = this.getHirelingsFilePath(folder);
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!file || !(file instanceof TFile)) {
			// File doesn't exist yet, return empty array
			return [];
		}

		const content = await this.app.vault.read(file);
		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter?.hirelings) {
			return [];
		}

		return cache.frontmatter.hirelings as HirelingEmployment[];
	}

	/**
	 * Save hirelings to the tracking file
	 */
	async saveHirelings(hirelings: HirelingEmployment[], folder: string): Promise<void> {
		const filePath = this.getHirelingsFilePath(folder);
		const content = this.generateHirelingsMarkdown(hirelings);

		// Check if file exists
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (existingFile && existingFile instanceof TFile) {
			// Update existing file
			await this.app.vault.modify(existingFile, content);
		} else {
			// Create new file
			await this.ensureFolder(folder);
			await this.app.vault.create(filePath, content);
		}
	}

	/**
	 * Add a new hireling to the tracking file
	 */
	async addHireling(hireling: HirelingEmployment, folder: string): Promise<void> {
		const hirelings = await this.loadHirelings(folder);
		hirelings.push(hireling);
		await this.saveHirelings(hirelings, folder);
	}

	/**
	 * Update an existing hireling in the tracking file
	 */
	async updateHireling(hirelingId: string, updates: Partial<HirelingEmployment>, folder: string): Promise<void> {
		const hirelings = await this.loadHirelings(folder);
		const index = hirelings.findIndex(h => h.hirelingId === hirelingId);

		if (index === -1) {
			throw new Error(`Hireling with ID ${hirelingId} not found`);
		}

		hirelings[index] = { ...hirelings[index], ...updates };
		await this.saveHirelings(hirelings, folder);
	}

	/**
	 * Remove a hireling from the tracking file
	 */
	async removeHireling(hirelingId: string, folder: string): Promise<void> {
		const hirelings = await this.loadHirelings(folder);
		const filtered = hirelings.filter(h => h.hirelingId !== hirelingId);
		await this.saveHirelings(filtered, folder);
	}

	/**
	 * Get a specific hireling by ID
	 */
	async getHireling(hirelingId: string, folder: string): Promise<HirelingEmployment | null> {
		const hirelings = await this.loadHirelings(folder);
		return hirelings.find(h => h.hirelingId === hirelingId) || null;
	}

	/**
	 * Get all active hirelings
	 */
	async getActiveHirelings(folder: string): Promise<HirelingEmployment[]> {
		const hirelings = await this.loadHirelings(folder);
		return hirelings.filter(h => h.status === 'active');
	}

	/**
	 * Generate markdown content for the hirelings tracking file
	 */
	private generateHirelingsMarkdown(hirelings: HirelingEmployment[]): string {
		// Strip npcData before saving (it's loaded at runtime)
		const hirelingsForSave = hirelings.map(h => {
			if (h.npcData) {
				const { npcData, ...hirelingWithoutNPCData } = h;
				return hirelingWithoutNPCData;
			}
			return h;
		});

		// Frontmatter
		let content = '---\n';
		content += `hirelings: ${JSON.stringify(hirelingsForSave, null, 2)}\n`;
		content += '---\n\n';

		// Body
		content += `# Active Hirelings\n\n`;

		if (hirelings.length === 0) {
			content += `No active hirelings.\n\n`;
			return content;
		}

		// Group by employer
		const partyHirelings = hirelings.filter(h => h.employer === 'party' && h.status === 'active');
		const individualHirelings = hirelings.filter(h => h.employer !== 'party' && h.status === 'active');

		if (partyHirelings.length > 0) {
			content += `## Party Hirelings\n\n`;
			for (const h of partyHirelings) {
				const wageStr = this.formatWages(h.wages, h.paymentSchedule);
				content += `- ${h.npc} - ${h.type} hireling (${wageStr})\n`;
			}
			content += '\n';
		}

		if (individualHirelings.length > 0) {
			content += `## Individual Hirelings\n\n`;
			for (const h of individualHirelings) {
				const wageStr = this.formatWages(h.wages, h.paymentSchedule);
				content += `- ${h.npc} - ${h.type} hireling for ${h.employer} (${wageStr})\n`;
			}
			content += '\n';
		}

		// Payment schedule
		content += `## Payment Schedule\n\n`;
		for (const h of hirelings.filter(h => h.status === 'active')) {
			const wageStr = this.formatWages(h.wages, h.paymentSchedule);
			const nextPayment = new Date(h.nextPayment).toLocaleDateString();
			content += `- ${h.npc}: ${wageStr} - Next payment: ${nextPayment}\n`;
		}
		content += '\n';

		// Total weekly cost
		const totalWeekly = this.calculateTotalWeeklyCost(hirelings.filter(h => h.status === 'active'));
		content += `## Total Weekly Cost: ${totalWeekly}\n\n`;

		return content;
	}

	/**
	 * Format wages for display
	 */
	private formatWages(wages: any, schedule: string): string {
		const parts = [];
		if (wages.platinum > 0) parts.push(`${wages.platinum} pp`);
		if (wages.gold > 0) parts.push(`${wages.gold} gp`);
		if (wages.silver > 0) parts.push(`${wages.silver} sp`);
		if (wages.copper > 0) parts.push(`${wages.copper} cp`);

		const amount = parts.join(', ') || '0 cp';
		return `${amount}/${schedule}`;
	}

	/**
	 * Calculate total weekly cost (simplified)
	 */
	private calculateTotalWeeklyCost(hirelings: HirelingEmployment[]): string {
		let totalFunds = 0;

		for (const h of hirelings) {
			// Convert to copper equivalent for simple calculation
			const dailyFunds = h.wages.gold + h.wages.platinum * 10 + h.wages.silver / 10 + h.wages.copper / 100;

			let weeklyFunds = 0;
			switch (h.paymentSchedule) {
				case 'daily':
					weeklyFunds = dailyFunds * 7;
					break;
				case 'weekly':
					weeklyFunds = dailyFunds;
					break;
				case 'monthly':
					weeklyFunds = dailyFunds / 4;
					break;
			}

			totalFunds += weeklyFunds;
		}

		return `${totalFunds.toFixed(2)} gp`;
	}

	/**
	 * Ensure folder exists
	 */
	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}
}
