// Modal for advancing time and managing daily upkeep costs
import { Modal, App, Setting, Notice } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { formatCurrency } from '@quartermaster/core/calculators/currency';
import { UpkeepConfig, ItemCost } from '@quartermaster/core/models/types';

export class AdvanceTimeModal extends Modal {
	plugin: QuartermasterPlugin;
	private daysToAdvance: number = 1;
	private upkeepConfig: UpkeepConfig;
	private previewCost: ItemCost | null = null;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;

		// Load upkeep config from settings or use defaults
		this.upkeepConfig = this.plugin.settings.upkeepConfig || {
			partyWideSettings: {
				useRations: true,
				useLifestyleExpenses: true,
				lifestyleLevel: 'modest'
			}
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('quartermaster-advance-time-modal');

		contentEl.createEl('h2', { text: 'Advance Time' });

		this.renderCurrentDate();
		this.renderTimeAdvancement();
		this.renderUpkeepSettings();
		this.renderCostPreview();
		this.renderActionButtons();
	}

	private renderCurrentDate() {
		const { contentEl } = this;

		try {
			const currentDay = this.plugin.dataAdapter.getCurrentDay();
			const currentDate = this.plugin.dataAdapter.getCurrentDate();

			const dateDiv = contentEl.createDiv({ cls: 'current-date-display' });
			dateDiv.style.padding = '12px';
			dateDiv.style.backgroundColor = 'var(--background-modifier-border)';
			dateDiv.style.borderRadius = '4px';
			dateDiv.style.marginBottom = '16px';
			dateDiv.style.textAlign = 'center';

			dateDiv.createEl('strong', { text: 'Current Date: ' });
			dateDiv.createEl('span', { text: `Day ${currentDay}` });
			dateDiv.createEl('br');
			dateDiv.createEl('span', {
				text: currentDate.formatted,
				cls: 'calendar-formatted-date'
			});
		} catch (error) {
			contentEl.createEl('p', {
				text: 'Calendar system not initialized',
				cls: 'mod-warning'
			});
		}
	}

	private renderTimeAdvancement() {
		const { contentEl } = this;

		new Setting(contentEl)
			.setName('Days to Advance')
			.setDesc('How many days should pass?')
			.addText(text => text
				.setValue('1')
				.onChange(async (value) => {
					const days = parseInt(value);
					if (!isNaN(days) && days > 0) {
						this.daysToAdvance = days;
						await this.updateCostPreview();
					}
				}));
	}

	private renderUpkeepSettings() {
		const { contentEl } = this;

		contentEl.createEl('h3', { text: 'Daily Upkeep Costs' });

		// Party-wide settings
		const partySettings = contentEl.createDiv({ cls: 'upkeep-party-settings' });
		partySettings.style.marginBottom = '16px';

		new Setting(partySettings)
			.setName('Use Rations')
			.setDesc('Deduct ration costs (5 sp per day per party member)')
			.addToggle(toggle => toggle
				.setValue(this.upkeepConfig.partyWideSettings.useRations)
				.onChange(async (value) => {
					this.upkeepConfig.partyWideSettings.useRations = value;
					await this.updateCostPreview();
				}));

		new Setting(partySettings)
			.setName('Use Lifestyle Expenses')
			.setDesc('Deduct lifestyle costs')
			.addToggle(toggle => toggle
				.setValue(this.upkeepConfig.partyWideSettings.useLifestyleExpenses)
				.onChange(async (value) => {
					this.upkeepConfig.partyWideSettings.useLifestyleExpenses = value;
					await this.updateCostPreview();
				}));

		new Setting(partySettings)
			.setName('Lifestyle Level')
			.setDesc('Default lifestyle level for all party members')
			.addDropdown(dropdown => dropdown
				.addOption('wretched', 'Wretched (0 gp/day)')
				.addOption('squalid', 'Squalid (1 sp/day)')
				.addOption('poor', 'Poor (2 sp/day)')
				.addOption('modest', 'Modest (1 gp/day)')
				.addOption('comfortable', 'Comfortable (2 gp/day)')
				.addOption('wealthy', 'Wealthy (4 gp/day)')
				.addOption('aristocratic', 'Aristocratic (10 gp/day)')
				.setValue(this.upkeepConfig.partyWideSettings.lifestyleLevel)
				.onChange(async (value: any) => {
					this.upkeepConfig.partyWideSettings.lifestyleLevel = value;
					await this.updateCostPreview();
				}));

		// Individual member overrides section (collapsible)
		if (this.plugin.settings.partyMembers && this.plugin.settings.partyMembers.length > 0) {
			const individualSection = contentEl.createDiv({ cls: 'upkeep-individual-settings' });
			individualSection.style.marginTop = '16px';

			const toggleHeader = individualSection.createDiv({ cls: 'setting-item-heading' });
			toggleHeader.style.cursor = 'pointer';
			toggleHeader.style.padding = '8px';
			toggleHeader.style.backgroundColor = 'var(--background-modifier-border)';
			toggleHeader.style.borderRadius = '4px';
			toggleHeader.createEl('strong', { text: 'Individual Member Settings (click to expand)' });

			const memberSettingsContainer = individualSection.createDiv({ cls: 'individual-member-settings' });
			memberSettingsContainer.style.display = 'none';
			memberSettingsContainer.style.marginTop = '8px';

			toggleHeader.onclick = () => {
				const isHidden = memberSettingsContainer.style.display === 'none';
				memberSettingsContainer.style.display = isHidden ? 'block' : 'none';
			};

			// Render individual settings for each party member
			this.plugin.settings.partyMembers.forEach(member => {
				if (!member.name) return;

				const memberDiv = memberSettingsContainer.createDiv({ cls: 'member-upkeep' });
				memberDiv.style.marginBottom = '12px';
				memberDiv.style.padding = '8px';
				memberDiv.style.backgroundColor = 'var(--background-modifier-border)';
				memberDiv.style.borderRadius = '4px';

				memberDiv.createEl('h4', { text: member.name });

				// Get or initialize individual settings
				if (!this.upkeepConfig.individualSettings) {
					this.upkeepConfig.individualSettings = {};
				}
				if (!this.upkeepConfig.individualSettings[member.name]) {
					this.upkeepConfig.individualSettings[member.name] = {
						useRations: this.upkeepConfig.partyWideSettings.useRations,
						useLifestyleExpenses: this.upkeepConfig.partyWideSettings.useLifestyleExpenses,
						lifestyleLevel: this.upkeepConfig.partyWideSettings.lifestyleLevel
					};
				}

				const memberSettings = this.upkeepConfig.individualSettings[member.name];

				new Setting(memberDiv)
					.setName('Use Rations')
					.addToggle(toggle => toggle
						.setValue(memberSettings.useRations)
						.onChange(async (value) => {
							memberSettings.useRations = value;
							await this.updateCostPreview();
						}));

				new Setting(memberDiv)
					.setName('Use Lifestyle')
					.addToggle(toggle => toggle
						.setValue(memberSettings.useLifestyleExpenses)
						.onChange(async (value) => {
							memberSettings.useLifestyleExpenses = value;
							await this.updateCostPreview();
						}));

				new Setting(memberDiv)
					.setName('Lifestyle Level')
					.addDropdown(dropdown => dropdown
						.addOption('wretched', 'Wretched')
						.addOption('squalid', 'Squalid')
						.addOption('poor', 'Poor')
						.addOption('modest', 'Modest')
						.addOption('comfortable', 'Comfortable')
						.addOption('wealthy', 'Wealthy')
						.addOption('aristocratic', 'Aristocratic')
						.setValue(memberSettings.lifestyleLevel)
						.onChange(async (value: any) => {
							memberSettings.lifestyleLevel = value;
							await this.updateCostPreview();
						}));
			});
		}
	}

	private renderCostPreview() {
		const { contentEl } = this;

		const previewDiv = contentEl.createDiv({ cls: 'upkeep-cost-preview' });
		previewDiv.style.padding = '12px';
		previewDiv.style.backgroundColor = 'var(--background-primary-alt)';
		previewDiv.style.borderRadius = '4px';
		previewDiv.style.marginTop = '16px';
		previewDiv.style.textAlign = 'center';

		previewDiv.createEl('strong', { text: 'Estimated Total Cost: ' });
		const costSpan = previewDiv.createEl('span', {
			text: 'Calculating...',
			cls: 'upkeep-cost-amount'
		});
		costSpan.style.fontSize = '1.2em';
		costSpan.style.color = 'var(--text-accent)';

		// Store reference for updates
		this.updateCostPreview();
	}

	private async updateCostPreview() {
		try {
			const upkeepManager = this.plugin.dataAdapter.getUpkeepManager();
			const configService = (this.plugin.dataAdapter as any).configService;

			if (!configService) {
				return;
			}

			const lifestyleCostsConfig = await configService.getLifestyleCosts();

			this.previewCost = upkeepManager.calculateUpkeepCost(
				this.daysToAdvance,
				this.upkeepConfig,
				this.plugin.settings.partyMembers,
				lifestyleCostsConfig
			);

			// Update preview display
			const costSpan = this.contentEl.querySelector('.upkeep-cost-amount') as HTMLElement;
			if (costSpan && this.previewCost) {
				const config = this.plugin.dataAdapter.getCurrencyConfig();
			const formatted = formatCurrency(this.previewCost, config);
				costSpan.setText(formatted);

				// Add daily rate
				const dailyDiv = this.contentEl.querySelector('.upkeep-cost-preview') as HTMLElement;
				if (dailyDiv) {
					const existingDaily = dailyDiv.querySelector('.daily-rate');
					if (existingDaily) existingDaily.remove();

					if (this.daysToAdvance > 1) {
						const dailySpan = dailyDiv.createEl('span', { cls: 'daily-rate' });
						dailySpan.style.display = 'block';
						dailySpan.style.fontSize = '0.9em';
						dailySpan.style.marginTop = '4px';
						dailySpan.style.opacity = '0.8';

						const dailyCost = upkeepManager.calculateUpkeepCost(
							1,
							this.upkeepConfig,
							this.plugin.settings.partyMembers,
							lifestyleCostsConfig
						);
						dailySpan.setText(`(${formatCurrency(dailyCost, config)} per day)`);
					}
				}
			}
		} catch (error) {
			console.error('Failed to calculate upkeep preview:', error);
		}
	}

	private renderActionButtons() {
		const { contentEl } = this;

		const buttonDiv = contentEl.createDiv({ cls: 'modal-button-container' });
		buttonDiv.style.marginTop = '16px';
		buttonDiv.style.display = 'flex';
		buttonDiv.style.gap = '8px';
		buttonDiv.style.justifyContent = 'flex-end';

		const cancelBtn = buttonDiv.createEl('button', { text: 'Cancel' });
		cancelBtn.onclick = () => this.close();

		const advanceBtn = buttonDiv.createEl('button', {
			text: 'Advance Time',
			cls: 'mod-cta'
		});
		advanceBtn.onclick = async () => await this.advanceTime();
	}

	private async advanceTime() {
		try {
			// Save upkeep config to settings for next time
			this.plugin.settings.upkeepConfig = this.upkeepConfig;
			await this.plugin.saveSettings();

			// Apply upkeep if cost > 0
			if (this.previewCost) {
				const upkeepManager = this.plugin.dataAdapter.getUpkeepManager();
				const currentDay = this.plugin.dataAdapter.getCurrentDay();
				const currentDate = this.plugin.dataAdapter.getCurrentDate();

				await upkeepManager.applyUpkeep(
					this.previewCost,
					this.daysToAdvance,
					{
						calendarDay: currentDay,
						formattedDate: currentDate.formatted
					}
				);
			}

			// Advance time
			await this.plugin.dataAdapter.advanceTime(this.daysToAdvance);

			const newDay = this.plugin.dataAdapter.getCurrentDay();
			const newDate = this.plugin.dataAdapter.getCurrentDate();

			// Collect summaries from listeners and log to activity log
			const adapter = this.plugin.dataAdapter as any;
			const projectProgressListener = adapter.getProjectProgressListener?.();
			const projectSummary = projectProgressListener?.getLastSummary();

			// Build time advance summary for activity log
			const activityService = adapter.activityLogService;
			if (activityService) {
				const sections: Array<{title: string; items: string[]}> = [];
				const config = this.plugin.dataAdapter.getCurrencyConfig();

				// Add upkeep section if applicable
				if (this.previewCost) {
					const formattedCost = formatCurrency(this.previewCost, config);
					if (formattedCost !== '0 cp') {
						const upkeepText = `Deducted ${formattedCost} for ${this.daysToAdvance} day(s)`;
						sections.push({
							title: 'Upkeep & Rations',
							items: [upkeepText]
						});
					}
				}

				// Add project progress section
				if (projectSummary) {
					const projectItems: string[] = [];

					// Completed projects
					for (const completed of projectSummary.completedProjects) {
						projectItems.push(`✓ Completed: ${completed.instance.name}`);
					}

					// Failed projects
					for (const failed of projectSummary.failedProjects) {
						projectItems.push(`✗ Failed: ${failed.instance.name}`);
					}

					// Progress updates
					for (const update of projectSummary.updates) {
						if (update.completed) {
							// Already shown in completed
						} else if (update.remainingDays <= 0) {
							// Already shown in failed
						} else {
							projectItems.push(`⟳ ${update.instance.name}: ${update.remainingDays} day(s) remaining`);
						}
					}

					if (projectItems.length > 0) {
						sections.push({
							title: 'Project Progress',
							items: projectItems
						});
					}
				}

				await activityService.logTimeAdvanced({
					daysAdvanced: this.daysToAdvance,
					fromDay: newDay - this.daysToAdvance,
					toDay: newDay,
					fromDate: this.plugin.dataAdapter.getCurrentDate().formatted,
					toDate: newDate.formatted,
					sections
				});
			}

			new Notice(`Time advanced ${this.daysToAdvance} day(s)!\nNew date: Day ${newDay} (${newDate.formatted})`);

			this.close();
		} catch (error) {
			console.error('Failed to advance time:', error);
			new Notice('Failed to advance time. Check console for details.');
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
