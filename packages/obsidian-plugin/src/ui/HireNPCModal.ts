// HireNPCModal - Modal for hiring an NPC as a hireling
import { Modal, App, Setting, Notice, TextComponent } from 'obsidian';
import { NPCProfile, NPCRole } from '@quartermaster/core/models/npc';
import { HirelingEmployment, HirelingType, PaymentSchedule, DEFAULT_WAGES } from '@quartermaster/core/models/hireling';
import { Currency } from '@quartermaster/core/models/types';
import { formatCurrency } from '@quartermaster/core/calculators/currency';
import type QuartermasterPlugin from '../main';

export class HireNPCModal extends Modal {
	plugin: QuartermasterPlugin;
	npc: NPCProfile | null = null;
	npcLink: string = '';
	hirelingType: HirelingType = 'skilled';
	employer: string = 'party';
	paymentSchedule: PaymentSchedule = 'weekly';
	customWages: Currency | null = null;
	duties: string[] = [];
	restrictions: string[] = [];
	startingLoyalty: number = 50;
	onHire?: (hireling: HirelingEmployment) => void;

	// Input fields
	private dutiesInput: TextComponent | null = null;
	private restrictionsInput: TextComponent | null = null;

	constructor(app: App, plugin: QuartermasterPlugin, npc?: NPCProfile, onHire?: (hireling: HirelingEmployment) => void) {
		super(app);
		this.plugin = plugin;
		if (npc) {
			this.npc = npc;
			this.npcLink = `[[${npc.name}]]`;
		}
		this.onHire = onHire;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Hire NPC' });

		await this.renderNPCSelector(contentEl);
		this.renderHirelingTypeSelector(contentEl);
		this.renderEmployerInput(contentEl);
		this.renderPaymentSettings(contentEl);
		this.renderDutiesAndRestrictions(contentEl);
		this.renderLoyaltySettings(contentEl);
		this.renderActions(contentEl);
	}

	async renderNPCSelector(container: HTMLElement) {
		const npcSection = container.createDiv({ cls: 'hire-npc-section' });
		npcSection.createEl('h3', { text: 'Select NPC' });

		if (this.npc) {
			// NPC already selected (passed to constructor)
			const npcInfo = npcSection.createDiv({ cls: 'npc-info' });
			npcInfo.createEl('p', { text: `Hiring: ${this.npc.name}` });
			npcInfo.createEl('p', { text: `${this.npc.species} • ${this.npc.disposition}` });
		} else {
			// Show NPC picker
			new Setting(npcSection)
				.setName('NPC')
				.setDesc('Select an existing NPC to hire')
				.addDropdown(async dropdown => {
					// Load all NPCs
					const npcPaths = await this.plugin.dataAdapter.listNPCs();
					const npcs: NPCProfile[] = [];

					for (const path of npcPaths) {
						try {
							const npc = await this.plugin.dataAdapter.getNPC(path);
							npcs.push(npc);
						} catch (error) {
							console.error(`Failed to load NPC at ${path}:`, error);
						}
					}

					dropdown.addOption('', '-- Select NPC --');
					for (const npc of npcs) {
						dropdown.addOption(npc.npcId, npc.name);
					}

					dropdown.onChange(async value => {
						if (value) {
							this.npc = npcs.find(n => n.npcId === value) || null;
							if (this.npc) {
								this.npcLink = `[[${this.npc.name}]]`;
								this.onOpen(); // Re-render
							}
						}
					});
				});
		}
	}

	renderHirelingTypeSelector(container: HTMLElement) {
		const typeSection = container.createDiv({ cls: 'hire-type-section' });
		typeSection.createEl('h3', { text: 'Employment Type' });

		new Setting(typeSection)
			.setName('Hireling Type')
			.setDesc('Skill level determines base wages')
			.addDropdown(dropdown => dropdown
				.addOption('unskilled', 'Unskilled (2 sp/day)')
				.addOption('skilled', 'Skilled (2 gp/day)')
				.addOption('expert', 'Expert (5 gp/day)')
				.setValue(this.hirelingType)
				.onChange(value => {
					this.hirelingType = value as HirelingType;
					this.customWages = null; // Reset custom wages
					this.onOpen(); // Re-render to update wage display
				}));
	}

	renderEmployerInput(container: HTMLElement) {
		new Setting(container)
			.setName('Employer')
			.setDesc('Who is hiring this NPC? ("party" or player name)')
			.addText(text => text
				.setValue(this.employer)
				.setPlaceholder('party')
				.onChange(value => {
					this.employer = value || 'party';
				}));
	}

	renderPaymentSettings(container: HTMLElement) {
		const paymentSection = container.createDiv({ cls: 'payment-section' });
		const config = this.plugin.dataAdapter.getCurrencyConfig();
		paymentSection.createEl('h3', { text: 'Payment Settings' });

		new Setting(paymentSection)
			.setName('Payment Schedule')
			.setDesc('How often wages are paid')
			.addDropdown(dropdown => dropdown
				.addOption('daily', 'Daily')
				.addOption('weekly', 'Weekly')
				.addOption('monthly', 'Monthly')
				.setValue(this.paymentSchedule)
				.onChange(value => {
					this.paymentSchedule = value as PaymentSchedule;
					this.onOpen(); // Re-render to update wage display
				}));

		// Display default wages
		const defaultWages = this.plugin.dataAdapter.getDefaultHirelingWages(this.hirelingType, this.paymentSchedule);
		const wagesDisplay = paymentSection.createDiv({ cls: 'wages-display' });
		wagesDisplay.createEl('p', {
			text: `Default Wages: ${formatCurrency(defaultWages, config)} per ${this.paymentSchedule} period`,
			cls: 'wages-info'
		});

		new Setting(paymentSection)
			.setName('Custom Wages (Optional)')
			.setDesc('Override default wages - leave blank to use defaults')
			.addText(text => text
				.setPlaceholder('e.g., 5 gp, 10 sp')
				.onChange(value => {
					// TODO: Parse currency string
					// For now, just store null
					this.customWages = null;
				}));
	}

	renderDutiesAndRestrictions(container: HTMLElement) {
		const dutiesSection = container.createDiv({ cls: 'duties-section' });
		dutiesSection.createEl('h3', { text: 'Duties & Restrictions' });

		new Setting(dutiesSection)
			.setName('Duties')
			.setDesc('What tasks will this hireling perform? (comma-separated)')
			.addText(text => {
				this.dutiesInput = text;
				text
					.setPlaceholder('Guard camp, carry supplies, cook meals')
					.onChange(value => {
						this.duties = value.split(',').map(d => d.trim()).filter(d => d);
					});
			});

		new Setting(dutiesSection)
			.setName('Restrictions')
			.setDesc('What will this hireling refuse to do? (comma-separated)')
			.addText(text => {
				this.restrictionsInput = text;
				text
					.setPlaceholder('Fight dragons, enter dungeons')
					.onChange(value => {
						this.restrictions = value.split(',').map(r => r.trim()).filter(r => r);
					});
			});
	}

	renderLoyaltySettings(container: HTMLElement) {
		const loyaltySection = container.createDiv({ cls: 'loyalty-section' });
		loyaltySection.createEl('h3', { text: 'Initial Loyalty' });

		new Setting(loyaltySection)
			.setName('Starting Loyalty')
			.setDesc('Initial loyalty score (0-100, default: 50)')
			.addSlider(slider => slider
				.setLimits(0, 100, 5)
				.setValue(this.startingLoyalty)
				.setDynamicTooltip()
				.onChange(value => {
					this.startingLoyalty = value;
				}));
	}

	renderActions(container: HTMLElement) {
		const actionsContainer = container.createDiv({ cls: 'hire-actions' });

		new Setting(actionsContainer)
			.addButton(btn => btn
				.setButtonText('Hire NPC')
				.setCta()
				.onClick(async () => {
					await this.hireNPC();
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}));
	}

	async hireNPC() {
		if (!this.npcLink) {
			new Notice('Please select an NPC to hire');
			return;
		}

		try {
			// Create hireling record
			const hireling = this.plugin.dataAdapter.createHirelingRecord(
				this.npcLink,
				this.hirelingType,
				this.employer,
				{
					wages: this.customWages || undefined,
					paymentSchedule: this.paymentSchedule,
					duties: this.duties,
					restrictions: this.restrictions.length > 0 ? this.restrictions : undefined,
					startingLoyalty: this.startingLoyalty
				}
			);

			// Add to tracking file
			await this.plugin.dataAdapter.addHireling(hireling);

			// Update NPC roles if NPC is loaded
			if (this.npc) {
				const npcPath = await this.plugin.dataAdapter.findNPCPath(this.npc.name);
				if (npcPath) {
					const existingRoles = this.npc.roles || [];
					if (!existingRoles.includes(NPCRole.HIRELING)) {
						await this.plugin.dataAdapter.updateNPC(npcPath, {
							roles: [...existingRoles, NPCRole.HIRELING]
						});
					}
				}
			}

			new Notice(`Hired ${this.npc?.name || 'NPC'} as ${this.hirelingType} hireling`);

			if (this.onHire) {
				this.onHire(hireling);
			}

			this.close();
		} catch (error) {
			new Notice('Failed to hire NPC');
			console.error(error);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
