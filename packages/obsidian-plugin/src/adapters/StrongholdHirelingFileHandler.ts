/**
 * StrongholdHirelingFileHandler - Handles stronghold hireling file operations
 * Separate from HirelingFileHandler to avoid conflicts with existing employment tracking
 * This handler works with the enhanced Hireling model that includes the morale system
 */

import { App, TFile } from 'obsidian';
import { Hireling } from '@quartermaster/core/models/stronghold';
import * as yaml from 'js-yaml';

export class StrongholdHirelingFileHandler {
	private readonly STRONGHOLD_HIRELINGS_FILE = 'Stronghold Hirelings.md';

	constructor(private app: App) {}

	/**
	 * Get the path to the stronghold hirelings file
	 */
	private getHirelingsFilePath(folder: string): string {
		const folderPath = folder.endsWith('/') ? folder : folder + '/';
		return `${folderPath}${this.STRONGHOLD_HIRELINGS_FILE}`;
	}

	/**
	 * Load all stronghold hirelings from the tracking file
	 */
	async loadHirelings(folder: string): Promise<Hireling[]> {
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

		return cache.frontmatter.hirelings as Hireling[];
	}

	/**
	 * Save hirelings to the tracking file
	 */
	async saveHirelings(hirelings: Hireling[], folder: string): Promise<void> {
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
	async addHireling(hireling: Hireling, folder: string): Promise<void> {
		const hirelings = await this.loadHirelings(folder);
		hirelings.push(hireling);
		await this.saveHirelings(hirelings, folder);
	}

	/**
	 * Update an existing hireling in the tracking file
	 */
	async updateHireling(hirelingId: string, updates: Partial<Hireling>, folder: string): Promise<void> {
		const hirelings = await this.loadHirelings(folder);
		const index = hirelings.findIndex(h => h.id === hirelingId);

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
		const filtered = hirelings.filter(h => h.id !== hirelingId);
		await this.saveHirelings(filtered, folder);
	}

	/**
	 * Get a specific hireling by ID
	 */
	async getHireling(hirelingId: string, folder: string): Promise<Hireling | null> {
		const hirelings = await this.loadHirelings(folder);
		return hirelings.find(h => h.id === hirelingId) || null;
	}

	/**
	 * Get hirelings assigned to a specific stronghold
	 */
	async getHirelingsForStronghold(strongholdId: string, folder: string): Promise<Hireling[]> {
		const hirelings = await this.loadHirelings(folder);
		return hirelings.filter(h => h.assignedStrongholdId === strongholdId);
	}

	/**
	 * Get hirelings assigned to a specific facility
	 */
	async getHirelingsForFacility(facilityId: string, folder: string): Promise<Hireling[]> {
		const hirelings = await this.loadHirelings(folder);
		return hirelings.filter(h => h.assignedFacilityId === facilityId);
	}

	/**
	 * Get all unassigned hirelings
	 */
	async getUnassignedHirelings(folder: string): Promise<Hireling[]> {
		const hirelings = await this.loadHirelings(folder);
		return hirelings.filter(h => !h.assignedStrongholdId);
	}

	/**
	 * Generate markdown content for the hirelings tracking file
	 */
	private generateHirelingsMarkdown(hirelings: Hireling[]): string {
		// Frontmatter
		let content = '---\n';
		content += `hirelings: ${JSON.stringify(hirelings, null, 2)}\n`;
		content += '---\n\n';

		// Body
		content += `# Stronghold Hirelings\n\n`;

		if (hirelings.length === 0) {
			content += `No stronghold hirelings.\n\n`;
			return content;
		}

		// Group by assignment status
		const assigned = hirelings.filter(h => h.assignedStrongholdId);
		const unassigned = hirelings.filter(h => !h.assignedStrongholdId);

		// Assigned hirelings
		if (assigned.length > 0) {
			content += `## Assigned Hirelings\n\n`;

			// Group by stronghold
			const byStronghold = new Map<string, Hireling[]>();
			for (const h of assigned) {
				const strongholdId = h.assignedStrongholdId!;
				if (!byStronghold.has(strongholdId)) {
					byStronghold.set(strongholdId, []);
				}
				byStronghold.get(strongholdId)!.push(h);
			}

			for (const [strongholdId, strongholdHirelings] of byStronghold) {
				content += `### Stronghold: ${strongholdId}\n\n`;
				for (const h of strongholdHirelings) {
					content += `- **${h.identity.name}** (${h.identity.role}) - ${h.identity.status}\n`;
					content += `  - Morale: ${h.morale.value}/${h.morale.scale.max}`;

					const moraleLabel = this.getMoraleLabel(h);
					if (moraleLabel) {
						content += ` (${moraleLabel})`;
					}
					content += '\n';

					if (h.assignedFacilityId) {
						content += `  - Assigned to Facility: ${h.assignedFacilityId}\n`;
					}

					const paymentStr = this.formatPayment(h);
					if (paymentStr) {
						content += `  - Payment: ${paymentStr}\n`;
					}
				}
				content += '\n';
			}
		}

		// Unassigned hirelings
		if (unassigned.length > 0) {
			content += `## Unassigned Hirelings\n\n`;
			for (const h of unassigned) {
				content += `- **${h.identity.name}** (${h.identity.role}) - ${h.identity.status}\n`;
				content += `  - Morale: ${h.morale.value}/${h.morale.scale.max}\n`;

				const paymentStr = this.formatPayment(h);
				if (paymentStr) {
					content += `  - Payment: ${paymentStr}\n`;
				}
			}
			content += '\n';
		}

		// Payment summary
		content += `## Payment Summary\n\n`;
		const withPayments = hirelings.filter(h =>
			h.payment.schedule !== 'none' &&
			h.payment.schedule !== 'manual' &&
			h.identity.status === 'at_stronghold'
		);

		if (withPayments.length === 0) {
			content += `No automated payments configured.\n\n`;
		} else {
			for (const h of withPayments) {
				const paymentStr = this.formatPayment(h);
				content += `- ${h.identity.name}: ${paymentStr}\n`;
				if (h.lastPaymentDay !== undefined) {
					content += `  - Last Payment: Day ${h.lastPaymentDay}\n`;
				}
			}
			content += '\n';
		}

		return content;
	}

	/**
	 * Get morale label for hireling
	 */
	private getMoraleLabel(hireling: Hireling): string | null {
		if (!hireling.morale.scale.labels) {
			return null;
		}

		const labels = hireling.morale.scale.labels;
		const thresholds = Object.keys(labels)
			.map(Number)
			.sort((a, b) => b - a); // Sort descending

		for (const threshold of thresholds) {
			if (hireling.morale.value >= threshold) {
				return labels[threshold];
			}
		}

		return null;
	}

	/**
	 * Format payment for display
	 */
	private formatPayment(hireling: Hireling): string | null {
		if (hireling.payment.schedule === 'none' || hireling.payment.schedule === 'manual') {
			return null;
		}

		const { gold, silver, copper } = hireling.payment.amount;
		const parts = [];

		if (gold > 0) parts.push(`${gold} gp`);
		if (silver > 0) parts.push(`${silver} sp`);
		if (copper > 0) parts.push(`${copper} cp`);

		const amount = parts.join(', ') || '0 cp';
		return `${amount}/${hireling.payment.schedule}`;
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
