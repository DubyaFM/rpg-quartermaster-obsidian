// HirelingManagementModal - Modal for managing all hirelings
import { Modal, App, Setting, Notice } from 'obsidian';
import { HirelingEmployment } from '@quartermaster/core/models/hireling';
import { Currency } from '@quartermaster/core/models/types';
import { formatCurrency } from '@quartermaster/core/calculators/currency';
import { HireNPCModal } from './HireNPCModal';
import { NPCProfileModal } from './NPCProfileModal';
import type QuartermasterPlugin from '../main';

export class HirelingManagementModal extends Modal {
	plugin: QuartermasterPlugin;
	hirelings: HirelingEmployment[] = [];
	filterStatus: 'all' | 'active' | 'dismissed' | 'resigned' | 'deceased' = 'active';

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Hireling Management' });

		await this.loadHirelings();
		this.renderHeader(contentEl);
		this.renderFilters(contentEl);
		await this.renderHirelingsTable(contentEl);
		this.renderActions(contentEl);
	}

	async loadHirelings() {
		try {
			this.hirelings = await this.plugin.dataAdapter.loadHirelings();
		} catch (error) {
			console.error('Failed to load hirelings:', error);
			new Notice('Failed to load hirelings');
		}
	}

	renderHeader(container: HTMLElement) {
		const headerSection = container.createDiv({ cls: 'hirelings-header' });
		const config = this.plugin.dataAdapter.getCurrencyConfig();

		// Summary stats
		const activeCount = this.hirelings.filter(h => h.status === 'active').length;
		const weeklyCost = this.calculateWeeklyCost(this.hirelings.filter(h => h.status === 'active'));

		headerSection.createEl('p', {
			text: `Active Hirelings: ${activeCount}`,
			cls: 'hireling-stat'
		});

		headerSection.createEl('p', {
			text: `Weekly Cost: ${formatCurrency(weeklyCost, config)}`,
			cls: 'hireling-stat'
		});
	}

	calculateWeeklyCost(hirelings: HirelingEmployment[]): Currency {
		// Simple calculation - will be replaced by HirelingManager method
		let total: Currency = { copper: 0, silver: 0, gold: 0, platinum: 0 };

		for (const h of hirelings) {
			// Convert to weekly based on payment schedule
			let weeklyCost = { ...h.wages };

			switch (h.paymentSchedule) {
				case 'daily':
					weeklyCost.copper *= 7;
					weeklyCost.silver *= 7;
					weeklyCost.gold *= 7;
					weeklyCost.platinum *= 7;
					break;
				case 'monthly':
					weeklyCost.copper = Math.floor(weeklyCost.copper / 4);
					weeklyCost.silver = Math.floor(weeklyCost.silver / 4);
					weeklyCost.gold = Math.floor(weeklyCost.gold / 4);
					weeklyCost.platinum = Math.floor(weeklyCost.platinum / 4);
					break;
				// weekly: no change
			}

			total.copper += weeklyCost.copper;
			total.silver += weeklyCost.silver;
			total.gold += weeklyCost.gold;
			total.platinum += weeklyCost.platinum;
		}

		return total;
	}

	renderFilters(container: HTMLElement) {
		const filterSection = container.createDiv({ cls: 'hirelings-filters' });

		new Setting(filterSection)
			.setName('Filter by Status')
			.addDropdown(dropdown => dropdown
				.addOption('all', 'All')
				.addOption('active', 'Active')
				.addOption('dismissed', 'Dismissed')
				.addOption('resigned', 'Resigned')
				.addOption('deceased', 'Deceased')
				.setValue(this.filterStatus)
				.onChange(value => {
					this.filterStatus = value as any;
					this.onOpen(); // Re-render
				}));
	}

	async renderHirelingsTable(container: HTMLElement) {
		const tableSection = container.createDiv({ cls: 'hirelings-table-section' });

		// Filter hirelings
		const filteredHirelings = this.filterStatus === 'all'
			? this.hirelings
			: this.hirelings.filter(h => h.status === this.filterStatus);

		if (filteredHirelings.length === 0) {
			tableSection.createEl('p', {
				text: 'No hirelings found.',
				cls: 'hirelings-empty'
			});
			return;
		}

		// Create table
		const table = tableSection.createEl('table', { cls: 'hirelings-table' });

		// Header row
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: 'Name' });
		headerRow.createEl('th', { text: 'Type' });
		headerRow.createEl('th', { text: 'Employer' });
		headerRow.createEl('th', { text: 'Wages' });
		headerRow.createEl('th', { text: 'Loyalty' });
		headerRow.createEl('th', { text: 'Morale' });
		headerRow.createEl('th', { text: 'Next Payment' });
		headerRow.createEl('th', { text: 'Status' });
		headerRow.createEl('th', { text: 'Actions' });

		// Body rows
		const tbody = table.createEl('tbody');
		for (const hireling of filteredHirelings) {
			await this.renderHirelingRow(tbody, hireling);
		}
	}

	async renderHirelingRow(tbody: HTMLTableSectionElement, hireling: HirelingEmployment) {
		const row = tbody.createEl('tr');
		const config = this.plugin.dataAdapter.getCurrencyConfig();

		// Name (with link to NPC profile)
		const nameCell = row.createEl('td');
		const npcName = hireling.npcData?.name || hireling.npc.replace(/\[\[|\]\]/g, '');
		const nameLink = nameCell.createEl('a', {
			text: npcName,
			cls: 'hireling-npc-link'
		});
		nameLink.onclick = async () => {
			if (hireling.npcData) {
				const npcPath = await this.plugin.dataAdapter.findNPCPath(hireling.npcData.name);
				if (npcPath) {
					new NPCProfileModal(this.app, this.plugin, hireling.npcData, npcPath).open();
				}
			}
		};

		// Type
		row.createEl('td', { text: hireling.type });

		// Employer
		row.createEl('td', { text: hireling.employer });

		// Wages
		const wagesCell = row.createEl('td');
		wagesCell.createEl('span', {
			text: `${formatCurrency(hireling.wages, config)}/${hireling.paymentSchedule}`
		});

		// Loyalty
		const loyaltyCell = row.createEl('td');
		const loyaltyColor = this.getLoyaltyColor(hireling.loyalty);
		loyaltyCell.createEl('span', {
			text: String(hireling.loyalty),
			attr: { style: `color: ${loyaltyColor};` }
		});

		// Morale
		const moraleCell = row.createEl('td');
		const moraleColor = this.getMoraleColor(hireling.morale);
		moraleCell.createEl('span', {
			text: hireling.morale,
			attr: { style: `color: ${moraleColor};` }
		});

		// Next Payment
		const nextPaymentDate = new Date(hireling.nextPayment);
		const isPastDue = nextPaymentDate < new Date();
		const nextPaymentCell = row.createEl('td');
		nextPaymentCell.createEl('span', {
			text: nextPaymentDate.toLocaleDateString(),
			cls: isPastDue ? 'payment-past-due' : ''
		});

		// Status
		row.createEl('td', { text: hireling.status });

		// Actions
		const actionsCell = row.createEl('td', { cls: 'hireling-actions' });

		if (hireling.status === 'active') {
			// Pay button
			const payBtn = actionsCell.createEl('button', { text: 'Pay', cls: 'hireling-action-btn' });
			payBtn.onclick = async () => {
				await this.processPayment(hireling.hirelingId);
			};

			// Dismiss button
			const dismissBtn = actionsCell.createEl('button', { text: 'Dismiss', cls: 'hireling-action-btn' });
			dismissBtn.onclick = async () => {
				await this.dismissHireling(hireling.hirelingId);
			};
		}
	}

	async processPayment(hirelingId: string) {
		try {
			const config = this.plugin.dataAdapter.getCurrencyConfig();
			const result = await this.plugin.dataAdapter.processHirelingPayment(hirelingId);

			const loyaltyChangeText = result.loyaltyChange > 0
				? `+${result.loyaltyChange}`
				: String(result.loyaltyChange);

			new Notice(
				`Paid ${formatCurrency(result.amountPaid, config)} to ${result.hireling.npc}\n` +
				`Loyalty change: ${loyaltyChangeText}`
			);

			// Log transaction
			const npcName = result.hireling.npcData?.name || result.hireling.npc.replace(/\[\[|\]\]/g, '');
			await this.plugin.dataAdapter.logTransaction?.(
				[{
					name: `Wages for ${npcName}`,
					cost: result.amountPaid,
					type: 'service',
					rarity: 'common',
					description: `${result.hireling.paymentSchedule} wages for ${result.hireling.type} hireling`,
					source: 'Hireling System',
					file: { path: '', name: '' },
					category: 'Services',
					quantity: 1,
					totalCost: result.amountPaid,
					purchasedBy: result.hireling.employer,
					isSale: false
				}],
				result.amountPaid,
				`Hireling Payment`,
				{
					transactionType: 'purchase'
				}
			);

			this.onOpen(); // Re-render
		} catch (error) {
			new Notice('Failed to process payment');
			console.error(error);
		}
	}

	async dismissHireling(hirelingId: string) {
		try {
			await this.plugin.dataAdapter.updateHireling(hirelingId, { status: 'dismissed' });
			new Notice('Hireling dismissed');
			this.onOpen(); // Re-render
		} catch (error) {
			new Notice('Failed to dismiss hireling');
			console.error(error);
		}
	}

	getLoyaltyColor(loyalty: number): string {
		if (loyalty < 30) return '#ff4444';
		if (loyalty < 70) return '#ffbb44';
		return '#44dd44';
	}

	getMoraleColor(morale: string): string {
		switch (morale) {
			case 'low': return '#ff4444';
			case 'stable': return '#ffbb44';
			case 'high': return '#44dd44';
			default: return '#999999';
		}
	}

	renderActions(container: HTMLElement) {
		const actionsContainer = container.createDiv({ cls: 'hirelings-management-actions' });

		new Setting(actionsContainer)
			.addButton(btn => btn
				.setButtonText('Hire New NPC')
				.setCta()
				.onClick(() => {
					const hireModal = new HireNPCModal(this.app, this.plugin, undefined, () => {
						this.onOpen(); // Refresh list
					});
					hireModal.open();
				}))
			.addButton(btn => btn
				.setButtonText('Refresh')
				.onClick(async () => {
					await this.onOpen();
				}))
			.addButton(btn => btn
				.setButtonText('Close')
				.onClick(() => {
					this.close();
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
