import { App, PluginSettingTab, Setting, TFolder, Notice, Modal } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { FileSuggest } from './suggest/FileSuggest';
import { FolderSuggest } from './suggest/FolderSuggest';
// ConfigLoader no longer needed - using dataAdapter instead
import { ItemVaultHandler } from '../adapters/ItemVaultHandler';
import { TemplateCustomizerModal } from './TemplateCustomizerModal';
import { PartyMemberChoiceModal } from './PartyMemberChoiceModal';
import { EditPartyMemberModal } from './EditPartyMemberModal';
import { CampaignManagerModal } from './CampaignManagerModal';
import { SetupWizardModal } from './SetupWizardModal';

export class RPGShopkeepSettingTab extends PluginSettingTab {
	plugin: QuartermasterPlugin;
	private scopeMode: 'global' | 'campaign' = 'campaign';

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		// Header with campaign info and scope selector
		await this.renderHeader(containerEl);

		containerEl.createEl('h2', { text: 'Quartermaster Settings' });

		// Conditionally render sections based on scope mode
		if (this.scopeMode === 'campaign') {
			// Campaign-scoped sections
			this.renderCampaignScopedSections(containerEl);
		}

		// Always show global sections
		this.renderGlobalSections(containerEl);

		// Support Links Footer
		this.renderSupportLinksFooter(containerEl);
	}

	/**
	 * Render campaign-scoped settings sections
	 */
	private renderCampaignScopedSections(containerEl: HTMLElement): void {
		// Party Management Section
		const partySection = this.createCollapsibleSection(containerEl, 'Party Management (Campaign-Scoped)', true);

		new Setting(partySection)
			.setName('Party Inventory File')
			.setDesc('The file to use for tracking party inventory and currency.')
			.addText(text => {
				new FileSuggest(this.app, text.inputEl);
				text.setValue(this.plugin.settings.partyInventoryFile)
					.onChange(async (value) => {
						this.plugin.settings.partyInventoryFile = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(partySection)
			.setName('Transaction Log File')
			.setDesc('The file to log all transactions to.')
			.addText(text => {
				new FileSuggest(this.app, text.inputEl);
				text.setValue(this.plugin.settings.transactionLogFile)
					.onChange(async (value) => {
						this.plugin.settings.transactionLogFile = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(partySection)
			.setName('Activity Log Path')
			.setDesc('Path to your activity log file (e.g., activity-log.md or logs/campaign-log.md)')
			.addText(text => {
				new FileSuggest(this.app, text.inputEl);
				text.setPlaceholder('activity-log.md')
					.setValue(this.plugin.settings.activityLogPath)
					.onChange(async (value) => {
						this.plugin.settings.activityLogPath = value;
						await this.plugin.saveSettings();
					});
			});

		// Item Management Section (Campaign-Scoped)
		const itemSection = this.createCollapsibleSection(containerEl, 'Item Management (Campaign-Scoped)', true);

		// Display configured folders
		if (this.plugin.settings.itemsFolders && this.plugin.settings.itemsFolders.length > 0) {
			const foldersDiv = itemSection.createDiv('configured-folders');
			foldersDiv.createEl('strong', { text: 'Configured Item Folders:' });

			for (let i = 0; i < this.plugin.settings.itemsFolders.length; i++) {
				const folderConfig = this.plugin.settings.itemsFolders[i];
				const folderRow = foldersDiv.createDiv('folder-row');
				folderRow.style.display = 'flex';
				folderRow.style.alignItems = 'center';
				folderRow.style.gap = '10px';
				folderRow.style.marginTop = '8px';
				folderRow.style.padding = '8px';
				folderRow.style.backgroundColor = 'var(--background-modifier-border)';
				folderRow.style.borderRadius = '4px';

				// Folder path
				const pathSpan = folderRow.createSpan({ text: folderConfig.path });
				pathSpan.style.flex = '1';
				pathSpan.style.fontFamily = 'var(--font-monospace)';

				// Exclude subfolders toggle
				const toggleLabel = folderRow.createEl('label');
				toggleLabel.style.display = 'flex';
				toggleLabel.style.alignItems = 'center';
				toggleLabel.style.gap = '6px';
				toggleLabel.style.cursor = 'pointer';
				toggleLabel.style.fontSize = '0.9em';

				const checkbox = toggleLabel.createEl('input', { type: 'checkbox' });
				checkbox.checked = folderConfig.excludeSubfolders;
				checkbox.addEventListener('change', async () => {
					this.plugin.settings.itemsFolders[i].excludeSubfolders = checkbox.checked;
					await this.plugin.saveSettings();
				});

				toggleLabel.createSpan({ text: 'Exclude subfolders' });

				// Remove button
				const removeBtn = folderRow.createEl('button', { text: '×' });
				removeBtn.style.border = 'none';
				removeBtn.style.background = 'transparent';
				removeBtn.style.cursor = 'pointer';
				removeBtn.style.fontSize = '20px';
				removeBtn.style.lineHeight = '1';
				removeBtn.style.padding = '0 4px';
				removeBtn.style.color = 'var(--text-error)';

				removeBtn.addEventListener('click', async () => {
					this.plugin.settings.itemsFolders.splice(i, 1);
					await this.plugin.saveSettings();
					this.display();
				});
			}
		} else {
			const warningDiv = itemSection.createDiv('folder-warning');
			warningDiv.style.color = 'var(--text-error)';
			warningDiv.style.marginBottom = '10px';
			warningDiv.createEl('strong', { text: 'No item folders configured.' });
			warningDiv.createEl('p', { text: 'Please add at least one folder to scan for items.' });
		}

		// Add folder interface
		let folderInput: HTMLInputElement;
		new Setting(itemSection)
			.setName('Add Item Folder')
			.setDesc('Add a folder to scan for item files.')
			.addText(text => {
				folderInput = text.inputEl;
				new FolderSuggest(this.app, text.inputEl);
				text.setPlaceholder('Select a folder...');
			})
			.addButton(button => button
				.setButtonText('Add')
				.setCta()
				.onClick(async () => {
					const folderPath = folderInput.value.trim();

					if (!folderPath) {
						new Notice('Please enter a folder path');
						return;
					}

					const folder = this.app.vault.getAbstractFileByPath(folderPath);
					if (!folder || !(folder instanceof TFolder)) {
						new Notice('Folder does not exist');
						return;
					}

					if (this.plugin.settings.itemsFolders.some(f => f.path === folderPath)) {
						new Notice('Folder already added');
						return;
					}

					this.plugin.settings.itemsFolders.push({
						path: folderPath,
						excludeSubfolders: false
					});
					await this.plugin.saveSettings();
					new Notice(`Added folder: ${folderPath}`);
					this.display();
				}));

		new Setting(itemSection)
			.setName('Use SRD Items')
			.setDesc('Use the built-in SRD item database as a fallback.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useSRDDatabase)
				.onChange(async (value) => {
					this.plugin.settings.useSRDDatabase = value;
					await this.plugin.saveSettings();
				}));

		// Inventory Settings Section (Campaign-Scoped)
		const inventorySection = this.createCollapsibleSection(containerEl, 'Inventory Settings (Campaign-Scoped)', true);

		new Setting(inventorySection)
			.setName('Party Inventory File')
			.setDesc('Path to Party Inventory.md file')
			.addText(text => text
				.setPlaceholder('Party Inventory.md')
				.setValue(this.plugin.settings.partyInventoryPath || 'Party Inventory.md')
				.onChange(async (value) => {
					this.plugin.settings.partyInventoryPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(inventorySection)
			.setName('Enable Encumbrance Tracking')
			.setDesc('Track carrying capacity and speed penalties for party members')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableEncumbranceTracking || false)
				.onChange(async (value) => {
					this.plugin.settings.enableEncumbranceTracking = value;
					await this.plugin.saveSettings();
				}));

		new Setting(inventorySection)
			.setName('Track Manual Edits in Activity Log')
			.setDesc('Log changes made to inventory via markdown edits (not just modal operations)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackManualInventoryEdits !== false)
				.onChange(async (value) => {
					this.plugin.settings.trackManualInventoryEdits = value;
					await this.plugin.saveSettings();
				}));

		// Shop Settings Section (Campaign-Scoped)
		const shopSection = this.createCollapsibleSection(containerEl, 'Shop Settings (Campaign-Scoped)', true);

		new Setting(shopSection)
			.setName('Shops Folder')
			.setDesc('The folder to save generated shop notes in.')
			.addText(text => {
				new FolderSuggest(this.app, text.inputEl);
				text.setValue(this.plugin.settings.shopsFolder)
					.onChange(async (value) => {
						this.plugin.settings.shopsFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(shopSection)
			.setName('Default Currency')
			.setDesc('The default currency to use for items without a specified currency.')
			.addDropdown(dropdown => {
				dropdown
					.addOption('cp', 'Copper')
					.addOption('sp', 'Silver')
					.addOption('gp', 'Gold')
					.addOption('pp', 'Platinum')
					.setValue(this.plugin.settings.defaultCurrency)
					.onChange(async (value) => {
						this.plugin.settings.defaultCurrency = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(shopSection)
			.setName('Auto-save Shops')
			.setDesc('Automatically save shops when they are closed.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoSaveShops)
				.onChange(async (value) => {
					this.plugin.settings.autoSaveShops = value;
					await this.plugin.saveSettings();
				}));

		// NPC Settings Section (Campaign-Scoped)
		const npcSection = this.createCollapsibleSection(containerEl, 'NPC & Hireling Settings (Campaign-Scoped)', true);

		new Setting(npcSection)
			.setName('NPCs Folder')
			.setDesc('The folder to save NPC files in.')
			.addText(text => {
				new FolderSuggest(this.app, text.inputEl);
				text.setValue(this.plugin.settings.npcsFolder)
					.onChange(async (value) => {
						this.plugin.settings.npcsFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(npcSection)
			.setName('Hirelings Folder')
			.setDesc('The folder to save hireling tracking files in.')
			.addText(text => {
				new FolderSuggest(this.app, text.inputEl);
				text.setValue(this.plugin.settings.hirelingsFolder)
					.onChange(async (value) => {
						this.plugin.settings.hirelingsFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(npcSection)
			.setName('Create NPC Links')
			.setDesc('Automatically create NPC files when generating shops.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.createNPCLinks)
				.onChange(async (value) => {
					this.plugin.settings.createNPCLinks = value;
					await this.plugin.saveSettings();
				}));

		new Setting(npcSection)
			.setName('Track Hireling Loyalty')
			.setDesc('Enable loyalty and morale mechanics for hirelings.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.trackHirelingLoyalty)
				.onChange(async (value) => {
					this.plugin.settings.trackHirelingLoyalty = value;
					await this.plugin.saveSettings();
				}));

		new Setting(npcSection)
			.setName('Auto-pay Hirelings')
			.setDesc('Automatically deduct hireling wages from party gold on scheduled payment dates.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoPayHirelings)
				.onChange(async (value) => {
					this.plugin.settings.autoPayHirelings = value;
					await this.plugin.saveSettings();
				}));

		// Player Tracking Section (Campaign-Scoped)
		const playerSection = this.createCollapsibleSection(containerEl, 'Player Tracking (Campaign-Scoped)', true);

		new Setting(playerSection)
			.setName('Enable Player Tracking')
			.setDesc('Track which player buys which item.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePlayerTracking)
				.onChange(async (value) => {
					this.plugin.settings.enablePlayerTracking = value;
					await this.plugin.saveSettings();
					this.display(); // Re-render to show/hide party members
				}));

		if (this.plugin.settings.enablePlayerTracking) {
			// Party Member Folder setting
			new Setting(playerSection)
				.setName('Party Member Folder')
				.setDesc('Folder where party member files will be stored')
				.addText(text => {
					new FolderSuggest(this.app, text.inputEl);
					text.setValue(this.plugin.settings.partyMemberFolder || 'party-members')
						.setPlaceholder('party-members')
						.onChange(async (value) => {
							this.plugin.settings.partyMemberFolder = value;
							await this.plugin.saveSettings();
						});
				});

			// Load party members from files
			playerSection.createEl('h4', { text: 'Party Members' });

			// Get party members from files (not settings)
			this.renderPartyMemberList(playerSection);

			// Add Party Member button (opens choice modal)
			new Setting(playerSection)
				.addButton(button => button
					.setButtonText('Add Party Member')
					.onClick(() => {
						new PartyMemberChoiceModal(this.app, this.plugin, () => {
							this.display(); // Refresh to show new member
						}).open();
					}));
		}

		// Calendar System Section (Campaign-Scoped)
		this.renderCalendarSettings(containerEl);

		// Job Board System Section (Campaign-Scoped)
		this.renderJobBoardSettings(containerEl);

		// Project System Section (Campaign-Scoped)
		this.renderProjectSettings(containerEl);
	}

	/**
	 * Render global settings sections (shown in both modes)
	 */
	private renderGlobalSections(containerEl: HTMLElement): void {
		// Source Filtering Section
		this.renderSourceFiltering(containerEl);

		// Magic Item Settings Section
		this.renderMagicItemSettings(containerEl);

		// Shop Templates Section
		this.renderTemplateManagement(containerEl);

		// Vault Health Check Section
		this.renderVaultHealthCheck(containerEl);
	}

	/**
	 * Render Source Filtering section
	 */
	private renderSourceFiltering(containerEl: HTMLElement): void {
		const sourceSection = this.createCollapsibleSection(containerEl, 'Source Filtering (Global)', true);

		sourceSection.createEl('p', {
			text: 'Control which item sources appear in generated shops.',
			cls: 'setting-item-description'
		});

		new Setting(sourceSection)
			.setName('Refresh Sources')
			.setDesc('Scan vault to update available item sources')
			.addButton(button => button
				.setButtonText('Refresh')
				.onClick(async () => {
					try {
						const itemHandler = new ItemVaultHandler(this.app, this.plugin.settings);
						const sources = await itemHandler.indexSources();
						const items = await itemHandler.getAvailableItems();

						this.plugin.settings.availableSources = sources.sort();

						// Ensure all new sources are enabled by default
						sources.forEach(source => {
							if (!this.plugin.settings.enabledSources.includes(source)) {
								this.plugin.settings.enabledSources.push(source);
							}
						});

						await this.plugin.saveSettings();
						new Notice(`Found ${sources.length} sources from ${items.length} items`);
						this.display(); // Refresh to show new sources
					} catch (error) {
						console.error('Error refreshing sources:', error);
						new Notice('Error refreshing sources. Check console for details.');
					}
				})
			);

		if (this.plugin.settings.availableSources.length > 0) {
			const bulkButtons = new Setting(sourceSection)
				.setName('Bulk Actions')
				.setDesc('Enable or disable all sources at once');

			bulkButtons.addButton(button => button
				.setButtonText('Enable All')
				.onClick(async () => {
					this.plugin.settings.enabledSources = [...this.plugin.settings.availableSources];
					await this.plugin.saveSettings();
					this.display();
				})
			);

			bulkButtons.addButton(button => button
				.setButtonText('Disable All')
				.setWarning()
				.onClick(async () => {
					this.plugin.settings.enabledSources = [];
					await this.plugin.saveSettings();
					this.display();
				})
			);

			sourceSection.createEl('h4', { text: `Sources (${this.plugin.settings.enabledSources.length}/${this.plugin.settings.availableSources.length} enabled)` });

			this.plugin.settings.availableSources.forEach(source => {
				new Setting(sourceSection)
					.setName(source)
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.enabledSources.includes(source))
						.onChange(async (value) => {
							if (value) {
								if (!this.plugin.settings.enabledSources.includes(source)) {
									this.plugin.settings.enabledSources.push(source);
								}
							} else {
								this.plugin.settings.enabledSources = this.plugin.settings.enabledSources.filter(s => s !== source);
							}
							await this.plugin.saveSettings();
							this.display(); // Refresh count
						})
					);
			});
		} else {
			sourceSection.createEl('p', {
				text: 'Click "Refresh Sources" to scan your vault for item sources.',
				cls: 'setting-item-description'
			});
		}
	}

	/**
	 * Render Magic Item Settings section
	 */
	private renderMagicItemSettings(containerEl: HTMLElement): void {
		const magicSection = this.createCollapsibleSection(containerEl, 'Magic Item Settings (Global)', true);

		magicSection.createEl('p', {
			text: 'Configure automatic pricing and rarity distribution for magic items',
			cls: 'setting-item-description'
		});

		new Setting(magicSection)
			.setName('Magic Item Shop Markup')
			.setDesc('Percentage added to crafting cost (default: 50%)')
			.addText(text => text
				.setPlaceholder('50')
				.setValue(String(this.plugin.settings.magicItemMarkupPercent))
				.onChange(async (value) => {
					const numValue = Number(value);
					if (!isNaN(numValue) && numValue >= 0) {
						this.plugin.settings.magicItemMarkupPercent = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(magicSection)
			.setName('Party Level')
			.setDesc('Level 1-20, affects base rarity distribution')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(String(this.plugin.settings.partyLevel))
				.onChange(async (value) => {
					const numValue = Number(value);
					if (!isNaN(numValue) && numValue >= 1 && numValue <= 20) {
						this.plugin.settings.partyLevel = Math.floor(numValue);
						await this.plugin.saveSettings();
					}
				}));

		magicSection.createEl('h4', { text: 'Wealth Level Rarity Modifiers' });
		magicSection.createEl('p', {
			text: 'Adjust how wealth level affects magic item rarity chances (0.0 = never, 1.0 = full chance)',
			cls: 'setting-item-description'
		});

		// Wealth level sliders
		const wealthLevels: Array<{ key: 'poor' | 'modest' | 'comfortable' | 'wealthy' | 'aristocratic'; display: string }> = [
			{ key: 'poor', display: 'Poor' },
			{ key: 'modest', display: 'Modest' },
			{ key: 'comfortable', display: 'Comfortable' },
			{ key: 'wealthy', display: 'Wealthy' },
			{ key: 'aristocratic', display: 'Aristocratic' }
		];

		wealthLevels.forEach(level => {
			const setting = new Setting(magicSection)
				.setName(level.display)
				.addSlider(slider => slider
					.setLimits(0, 1, 0.1)
					.setValue(this.plugin.settings.magicItemRarityModifiers[level.key])
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.magicItemRarityModifiers[level.key] = value;
						await this.plugin.saveSettings();
					}))
				.addExtraButton(button => button
					.setIcon('reset')
					.setTooltip('Reset to default')
					.onClick(async () => {
						const defaults = {
							poor: 0.1,
							modest: 0.3,
							comfortable: 0.6,
							wealthy: 0.8,
							aristocratic: 1.0
						};
						this.plugin.settings.magicItemRarityModifiers[level.key] = defaults[level.key];
						await this.plugin.saveSettings();
						this.display(); // Refresh to show updated value
					}));
		});
	}

	/**
	 * Render Job Board Settings section
	 */
	private renderJobBoardSettings(containerEl: HTMLElement): void {
		const jobSection = this.createCollapsibleSection(containerEl, 'Job Board & Quest Management (Campaign-Scoped)', false);

		jobSection.createEl('p', {
			text: 'Configure the job board system for tracking quests and jobs.',
			cls: 'setting-item-description'
		});

		// Jobs folder
		new Setting(jobSection)
			.setName('Jobs Folder')
			.setDesc('Folder where job files will be stored')
			.addText(text => {
				new FolderSuggest(this.app, text.inputEl);
				text.setValue(this.plugin.settings.jobsFolder)
					.onChange(async (value) => {
						this.plugin.settings.jobsFolder = value;
						await this.plugin.saveSettings();
					});
			});

		// Notification log path
		new Setting(jobSection)
			.setName('Notification Log File')
			.setDesc('File where job board notifications will be logged')
			.addText(text => {
				new FileSuggest(this.app, text.inputEl);
				text.setValue(this.plugin.settings.jobNotificationLogPath)
					.onChange(async (value) => {
						this.plugin.settings.jobNotificationLogPath = value;
						await this.plugin.saveSettings();
					});
			});

		// Auto-expire jobs
		new Setting(jobSection)
			.setName('Auto-Expire Jobs')
			.setDesc('Automatically expire Posted jobs when availability duration passes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoExpireJobs)
				.onChange(async (value) => {
					this.plugin.settings.autoExpireJobs = value;
					await this.plugin.saveSettings();
					// Update job board manager config
					if (this.plugin.jobBoardManager) {
						this.plugin.jobBoardManager.updateConfig({ autoExpireJobs: value });
					}
				}));

		// Notify on deadlines
		new Setting(jobSection)
			.setName('Notify on Deadlines')
			.setDesc('Show GM notifications when Taken jobs pass their completion deadline')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.notifyOnJobDeadlines)
				.onChange(async (value) => {
					this.plugin.settings.notifyOnJobDeadlines = value;
					await this.plugin.saveSettings();
					// Update job board manager config
					if (this.plugin.jobBoardManager) {
						this.plugin.jobBoardManager.updateConfig({ notifyOnDeadlines: value });
					}
				}));

		// Notify on expirations
		new Setting(jobSection)
			.setName('Notify on Expirations')
			.setDesc('Show GM notifications when jobs auto-expire')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.notifyOnJobExpirations)
				.onChange(async (value) => {
					this.plugin.settings.notifyOnJobExpirations = value;
					await this.plugin.saveSettings();
					// Update job board manager config
					if (this.plugin.jobBoardManager) {
						this.plugin.jobBoardManager.updateConfig({ notifyOnExpirations: value });
					}
				}));

		jobSection.createEl('p', {
			text: 'Job notifications integrate with the daily summary modal (being implemented separately)',
			cls: 'setting-item-description'
		});
	}

	/**
	 * Render Calendar Settings section
	 */
	private async renderCalendarSettings(containerEl: HTMLElement): Promise<void> {
		const calendarSection = this.createCollapsibleSection(containerEl, 'Calendar & Time Tracking (Campaign-Scoped)', false);

		calendarSection.createEl('p', {
			text: 'Configure the in-game calendar system for time tracking, daily upkeep, and shop restocking.',
			cls: 'setting-item-description'
		});

		// Get calendar service for dynamic information
		let currentDay = 0;
		let currentDate = 'Not initialized';

		try {
			if (this.plugin.dataAdapter.getCurrentDay) {
				currentDay = this.plugin.dataAdapter.getCurrentDay();
			}
			if (this.plugin.dataAdapter.getCurrentDate) {
				const formatted = this.plugin.dataAdapter.getCurrentDate();
				currentDate = formatted.formatted;
			}
		} catch (error) {
			// Calendar not initialized yet
		}

		// Current date display
		const currentDateDiv = calendarSection.createDiv({ cls: 'calendar-current-date' });
		currentDateDiv.style.padding = '12px';
		currentDateDiv.style.backgroundColor = 'var(--background-modifier-border)';
		currentDateDiv.style.borderRadius = '4px';
		currentDateDiv.style.marginBottom = '12px';

		currentDateDiv.createEl('strong', { text: 'Current Date: ' });
		currentDateDiv.createSpan({ text: `Day ${currentDay} (${currentDate})` });

		// Calendar selection
		const activeCalendarId = this.plugin.settings.calendarState?.activeCalendarId || 'harptos';

		new Setting(calendarSection)
			.setName('Active Calendar')
			.setDesc('Choose which calendar system to use for date formatting.')
			.addDropdown(dropdown => dropdown
				.addOption('harptos', 'Harptos (Forgotten Realms)')
				.addOption('gregorian', 'Gregorian (Real World)')
				.setValue(activeCalendarId)
				.onChange(async (value) => {
					try {
						const calendarService = this.plugin.dataAdapter.getCalendarService();
						await calendarService.setActiveCalendar(value);
						new Notice(`Calendar changed to ${value}`);
						this.display(); // Refresh to show new date format
					} catch (error) {
						new Notice('Failed to change calendar');
						console.error(error);
					}
				}));

		// Current day override
		new Setting(calendarSection)
			.setName('Set Current Day')
			.setDesc('Manually set the current day counter. Warning will appear if going backwards in time.')
			.addText(text => text
				.setPlaceholder(`Current: ${currentDay}`)
				.onChange(async (value) => {
					const newDay = parseInt(value);
					if (isNaN(newDay) || newDay < 0) {
						return;
					}

					try {
						const calendarService = this.plugin.dataAdapter.getCalendarService();
						const currentDay = calendarService.getCurrentDay();

						if (newDay < currentDay) {
							const confirmed = confirm(
								`Warning: You are setting the day backwards (from ${currentDay} to ${newDay}).\n\n` +
								`This may cause issues with shop restocking and other time-based features.\n\n` +
								`Continue?`
							);
							if (!confirmed) return;
						}

						await calendarService.setCurrentDay(newDay, true);
						new Notice(`Day set to ${newDay}`);
						this.display(); // Refresh to show new date
					} catch (error) {
						new Notice('Failed to set day');
						console.error(error);
					}
				}))
			.addButton(button => button
				.setButtonText('Set')
				.onClick(() => {
					// Text field onChange already handles the logic
				}));

		// Origin date settings
		calendarSection.createEl('h4', { text: 'Origin Date Mapping' });
		calendarSection.createEl('p', {
			text: 'Map Day 0 to a specific calendar date (e.g., "1st of Hammer, 1492 DR"). This affects how dates are displayed.',
			cls: 'setting-item-description'
		});

		const originDate = this.plugin.settings.calendarState?.originDate;

		new Setting(calendarSection)
			.setName('Origin Year')
			.setDesc('The year that Day 0 maps to.')
			.addText(text => text
				.setPlaceholder('1492')
				.setValue(originDate?.year?.toString() || '')
				.onChange(async (value) => {
					const year = parseInt(value);
					if (isNaN(year)) return;

					if (!this.plugin.settings.calendarState) {
						this.plugin.settings.calendarState = {
							currentDay: 0,
							activeCalendarId: 'harptos'
						};
					}
					if (!this.plugin.settings.calendarState.originDate) {
						this.plugin.settings.calendarState.originDate = {
							year: year,
							month: 0,
							day: 1
						};
					} else {
						this.plugin.settings.calendarState.originDate.year = year;
					}
					await this.plugin.saveSettings();
					this.display();
				}));

		new Setting(calendarSection)
			.setName('Origin Month')
			.setDesc('The month that Day 0 maps to (0-indexed).')
			.addText(text => text
				.setPlaceholder('0')
				.setValue(originDate?.month?.toString() || '')
				.onChange(async (value) => {
					const month = parseInt(value);
					if (isNaN(month) || month < 0) return;

					if (!this.plugin.settings.calendarState) {
						this.plugin.settings.calendarState = {
							currentDay: 0,
							activeCalendarId: 'harptos'
						};
					}
					if (!this.plugin.settings.calendarState.originDate) {
						this.plugin.settings.calendarState.originDate = {
							year: 1492,
							month: month,
							day: 1
						};
					} else {
						this.plugin.settings.calendarState.originDate.month = month;
					}
					await this.plugin.saveSettings();
					this.display();
				}));

		new Setting(calendarSection)
			.setName('Origin Day')
			.setDesc('The day of month that Day 0 maps to (1-indexed).')
			.addText(text => text
				.setPlaceholder('1')
				.setValue(originDate?.day?.toString() || '')
				.onChange(async (value) => {
					const day = parseInt(value);
					if (isNaN(day) || day < 1) return;

					if (!this.plugin.settings.calendarState) {
						this.plugin.settings.calendarState = {
							currentDay: 0,
							activeCalendarId: 'harptos'
						};
					}
					if (!this.plugin.settings.calendarState.originDate) {
						this.plugin.settings.calendarState.originDate = {
							year: 1492,
							month: 0,
							day: day
						};
					} else {
						this.plugin.settings.calendarState.originDate.day = day;
					}
					await this.plugin.saveSettings();
					this.display();
				}));

		// Upkeep settings
		calendarSection.createEl('h4', { text: 'Default Upkeep Settings' });
		calendarSection.createEl('p', {
			text: 'Configure default party-wide upkeep costs (lifestyle and rations). These can be overridden per party member when advancing time.',
			cls: 'setting-item-description'
		});

		if (!this.plugin.settings.upkeepConfig) {
			this.plugin.settings.upkeepConfig = {
				partyWideSettings: {
					useRations: true,
					useLifestyleExpenses: true,
					lifestyleLevel: 'modest'
				}
			};
			await this.plugin.saveSettings();
		}

		new Setting(calendarSection)
			.setName('Use Rations')
			.setDesc('Deduct ration costs (5 sp per day per party member) when advancing time.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.upkeepConfig?.partyWideSettings.useRations || false)
				.onChange(async (value) => {
					if (this.plugin.settings.upkeepConfig) {
						this.plugin.settings.upkeepConfig.partyWideSettings.useRations = value;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(calendarSection)
			.setName('Use Lifestyle Expenses')
			.setDesc('Deduct lifestyle costs when advancing time.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.upkeepConfig?.partyWideSettings.useLifestyleExpenses || false)
				.onChange(async (value) => {
					if (this.plugin.settings.upkeepConfig) {
						this.plugin.settings.upkeepConfig.partyWideSettings.useLifestyleExpenses = value;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(calendarSection)
			.setName('Default Lifestyle Level')
			.setDesc('Default lifestyle level for all party members (D&D 5e PHB p. 157).')
			.addDropdown(dropdown => dropdown
				.addOption('wretched', 'Wretched (0 gp/day)')
				.addOption('squalid', 'Squalid (1 sp/day)')
				.addOption('poor', 'Poor (2 sp/day)')
				.addOption('modest', 'Modest (1 gp/day)')
				.addOption('comfortable', 'Comfortable (2 gp/day)')
				.addOption('wealthy', 'Wealthy (4 gp/day)')
				.addOption('aristocratic', 'Aristocratic (10 gp/day)')
				.setValue(this.plugin.settings.upkeepConfig?.partyWideSettings.lifestyleLevel || 'modest')
				.onChange(async (value: any) => {
					if (this.plugin.settings.upkeepConfig) {
						this.plugin.settings.upkeepConfig.partyWideSettings.lifestyleLevel = value;
						await this.plugin.saveSettings();
					}
				}));
	}

	// Project Settings Section
	private renderProjectSettings(containerEl: HTMLElement): void {
		const projectSection = this.createCollapsibleSection(containerEl, 'Projects & Downtime (Campaign-Scoped)', false);

		new Setting(projectSection)
			.setName('Project Templates Path')
			.setDesc('Directory for storing project templates (YAML)')
			.addText(text => {
				text.setPlaceholder('config/projectTemplates')
					.setValue(this.plugin.settings.projectTemplatesPath || 'config/projectTemplates')
					.onChange(async (value) => {
						this.plugin.settings.projectTemplatesPath = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(projectSection)
			.setName('Project Instances Path')
			.setDesc('Directory for storing active project instances (JSON)')
			.addText(text => {
				text.setPlaceholder('projects')
					.setValue(this.plugin.settings.projectInstancesPath || 'projects')
					.onChange(async (value) => {
						this.plugin.settings.projectInstancesPath = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(projectSection)
			.setName('Show Progress Summary')
			.setDesc('Display modal showing project progress after advancing time')
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.projectProgressionSummary !== false)
					.onChange(async (value) => {
						this.plugin.settings.projectProgressionSummary = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private createCollapsibleSection(
		containerEl: HTMLElement,
		title: string,
		defaultOpen: boolean = true
	): HTMLElement {
		const header = containerEl.createDiv({
			text: title,
			cls: 'settings-section-header collapsible setting-item-heading'
		});

		const content = containerEl.createDiv({ cls: 'settings-section-content' });
		if (!defaultOpen) {
			content.style.display = 'none';
			header.addClass('collapsed');
		}

		header.onclick = () => {
			const isCollapsed = content.style.display === 'none';
			content.style.display = isCollapsed ? 'block' : 'none';
			if (isCollapsed) {
				header.removeClass('collapsed');
			} else {
				header.addClass('collapsed');
			}
		};

		return content;
	}

	private async renderTemplateManagement(containerEl: HTMLElement) {
		const templateSection = this.createCollapsibleSection(containerEl, 'Shop Templates', false);

		templateSection.createEl('p', {
			text: 'Customize shop generation for specific shop types and wealth levels.',
			cls: 'setting-item-description'
		});

		// Refresh Item Types button
		new Setting(templateSection)
			.setName('Refresh Item Types')
			.setDesc('Re-scan vault to update available item types and rarities (first scan may take a moment)')
			.addButton(button => button
				.setButtonText('Refresh')
				.onClick(async () => {
					const itemHandler = new ItemVaultHandler(this.app, this.plugin.settings);
					itemHandler.invalidateCache();
					const metadata = await itemHandler.getItemMetadata(true);
					new Notice(`Refreshed: ${metadata.totalItems} items, ${metadata.types.length} types`);
				})
			);

		// Create New Template button
		new Setting(templateSection)
			.setName('Create New Template')
			.setDesc('Create a custom shop template for a specific shop type and wealth level')
			.addButton(button => button
				.setButtonText('Create Template')
				.setClass('mod-cta')
				.onClick(() => {
					// Open modal to select shop type/wealth level
					this.openTemplateSelector();
				})
			);

		// List existing templates
		const allTemplates = await this.plugin.dataAdapter.getAllCustomTemplates();

		if (Object.keys(allTemplates).length > 0) {
			templateSection.createEl('h4', { text: 'Current Templates' });

			for (const [shopType, wealthTemplates] of Object.entries(allTemplates)) {
				for (const [wealthLevel, template] of Object.entries(wealthTemplates)) {
					new Setting(templateSection)
						.setName(`${shopType} (${wealthLevel})`)
						.setDesc('Custom template')
						.addButton(button => button
							.setButtonText('Edit')
							.onClick(() => {
								new TemplateCustomizerModal(this.app, this.plugin, shopType, wealthLevel).open();
							})
						)
						.addButton(button => button
							.setButtonText('Delete')
							.setWarning()
							.onClick(async () => {
								if (confirm(`Delete ${shopType} (${wealthLevel}) template?`)) {
									await this.plugin.dataAdapter.deleteCustomTemplate(shopType, wealthLevel);
									new Notice('Template deleted');
									this.display(); // Refresh settings page
								}
							})
						);
				}
			}
		} else {
			templateSection.createEl('p', {
				text: 'No custom templates created yet',
				cls: 'setting-item-description'
			});
		}
	}

	private openTemplateSelector() {
		const modal = new (class extends Modal {
			plugin: QuartermasterPlugin;

			constructor(app: App, plugin: QuartermasterPlugin) {
				super(app);
				this.plugin = plugin;
			}

			onOpen() {
				const { contentEl } = this;
				contentEl.createEl('h2', { text: 'Select Shop Type' });

				let selectedType = 'blacksmith';
				let selectedWealth = 'modest';

				new Setting(contentEl)
					.setName('Shop Type')
					.addDropdown(dropdown => dropdown
						.addOption('blacksmith', 'Blacksmith')
						.addOption('alchemist', 'Alchemist')
						.addOption('general', 'General Store')
						.addOption('magic', 'Magic Shop')
						.addOption('tavern', 'Tavern')
						.addOption('marketplace', 'Large Marketplace')
						.addOption('inn', 'Inn')
						.addOption('temple', 'Temple')
						.addOption('travel', 'Travel Services')
						.setValue(selectedType)
						.onChange(value => selectedType = value)
					);

				new Setting(contentEl)
					.setName('Wealth Level')
					.addDropdown(dropdown => dropdown
						.addOption('poor', 'Poor')
						.addOption('modest', 'Modest')
						.addOption('comfortable', 'Comfortable')
						.addOption('wealthy', 'Wealthy')
						.addOption('aristocratic', 'Aristocratic')
						.setValue(selectedWealth)
						.onChange(value => selectedWealth = value)
					);

				const createBtn = contentEl.createEl('button', {
					text: 'Create Template',
					cls: 'mod-cta'
				});
				createBtn.onclick = () => {
					this.close();
					new TemplateCustomizerModal(this.app, this.plugin, selectedType, selectedWealth).open();
				};
			}
		})(this.app, this.plugin);

		modal.open();
	}

	/**
	 * Render header with campaign info and scope selector
	 */
	private async renderHeader(containerEl: HTMLElement): Promise<void> {
		const headerDiv = containerEl.createDiv('quartermaster-settings-header');
		headerDiv.style.padding = '16px';
		headerDiv.style.backgroundColor = 'var(--background-secondary)';
		headerDiv.style.borderRadius = '8px';
		headerDiv.style.marginBottom = '16px';

		// Get active campaign via campaign manager
		const campaignManager = this.plugin.adapterFactory.getCampaignManager();
		const activeCampaign = await campaignManager.getActiveCampaign();

		// Campaign info row
		const infoRow = headerDiv.createDiv('campaign-info-row');
		infoRow.style.display = 'flex';
		infoRow.style.justifyContent = 'space-between';
		infoRow.style.alignItems = 'center';
		infoRow.style.marginBottom = '12px';

		const campaignInfo = infoRow.createDiv();
		campaignInfo.createEl('strong', { text: 'Active Campaign: ' });
		campaignInfo.createSpan({
			text: activeCampaign?.name || 'No Campaign Active',
			attr: { style: 'color: var(--text-accent);' }
		});

		// Scope selector
		const scopeSelector = infoRow.createDiv('scope-selector');
		scopeSelector.style.display = 'flex';
		scopeSelector.style.gap = '8px';
		scopeSelector.style.alignItems = 'center';

		scopeSelector.createEl('label', { text: 'Settings Scope:' });

		const globalBtn = scopeSelector.createEl('button', {
			text: 'Global',
			cls: this.scopeMode === 'global' ? 'mod-cta' : ''
		});
		globalBtn.style.padding = '6px 12px';
		globalBtn.onclick = () => {
			this.scopeMode = 'global';
			this.display();
		};

		const campaignBtn = scopeSelector.createEl('button', {
			text: 'Current Campaign',
			cls: this.scopeMode === 'campaign' ? 'mod-cta' : ''
		});
		campaignBtn.style.padding = '6px 12px';
		campaignBtn.onclick = () => {
			this.scopeMode = 'campaign';
			this.display();
		};

		// Campaign Actions Row
		const actionRow = headerDiv.createDiv('campaign-actions-row');
		actionRow.style.display = 'flex';
		actionRow.style.gap = '8px';
		actionRow.style.marginBottom = '12px';

		const manageBtn = actionRow.createEl('button', { text: 'Switch / Manage' });
		manageBtn.onclick = () => {
			new CampaignManagerModal(this.app, this.plugin, () => this.display()).open();
		};

		const newBtn = actionRow.createEl('button', { text: 'New Campaign' });
		newBtn.onclick = () => {
			new SetupWizardModal(this.app, this.plugin, () => this.display()).open();
		};

		// Description of scope mode
		const descDiv = headerDiv.createDiv('scope-description');
		descDiv.style.fontSize = '0.9em';
		descDiv.style.color = 'var(--text-muted)';

		if (this.scopeMode === 'global') {
			descDiv.textContent = 'Viewing global settings that apply to all campaigns. Campaign-specific settings are hidden.';
		} else {
			descDiv.textContent = activeCampaign
				? `Viewing campaign-specific settings for "${activeCampaign.name}". These override global defaults.`
				: 'No campaign active. Create or switch to a campaign to manage campaign-specific settings.';
		}
	}

	/**
	 * Render Vault Health Check section
	 */
	private renderVaultHealthCheck(containerEl: HTMLElement): void {
		const healthSection = this.createCollapsibleSection(containerEl, 'Vault Health Check', false);

		healthSection.createEl('p', {
			text: 'Diagnose item detection issues in your vault. This scans all markdown files and shows why items are included or excluded.',
			cls: 'setting-item-description'
		});

		// Cache status display
		const cacheStatusDiv = healthSection.createDiv('cache-status');
		this.renderCacheStatus(cacheStatusDiv);

		// Scan button
		new Setting(healthSection)
			.setName('Run Health Check')
			.setDesc('Scan vault and display detailed item detection statistics')
			.addButton(button => button
				.setButtonText('Scan Vault')
				.setCta()
				.onClick(async () => {
					button.setDisabled(true);
					button.setButtonText('Scanning...');

					try {
						// Force cache rebuild to get fresh diagnostics
						const itemCount = await this.plugin.dataAdapter.rebuildItemCache();
						const cacheInfo = this.plugin.dataAdapter.getCacheInfo();

						// Update cache status
						this.renderCacheStatus(cacheStatusDiv);

						// Display health check results
						this.displayHealthCheckResults(healthSection, cacheInfo);

						new Notice(`Health check complete: ${itemCount} items found`);
					} catch (error) {
						new Notice('Health check failed: ' + error.message);
						console.error('[HealthCheck] Error:', error);
					} finally {
						button.setDisabled(false);
						button.setButtonText('Scan Vault');
					}
				})
			);
	}

	/**
	 * Display current cache status in settings UI
	 */
	private renderCacheStatus(container: HTMLElement): void {
		// Clear previous status
		container.empty();

		const cacheInfo = this.plugin.dataAdapter.getCacheInfo();

		if (!cacheInfo.cached) {
			container.createEl('p', {
				text: 'No cache built yet. Generate a shop or run health check to build cache.',
				cls: 'mod-warning'
			});
			return;
		}

		const ageSeconds = Math.round(cacheInfo.ageMs / 1000);
		const statusEl = container.createEl('div', { cls: 'cache-status-info' });

		statusEl.createEl('p', {
			text: `Cache active: ${cacheInfo.itemCount} items (updated ${ageSeconds}s ago)`
		});

		// Show diagnostics summary if available
		if (cacheInfo.diagnostics) {
			const diag = cacheInfo.diagnostics;
			const successRate = ((diag.success / diag.scanned) * 100).toFixed(1);

			statusEl.createEl('p', {
				text: `Success rate: ${successRate}% (${diag.success}/${diag.scanned} files)`,
				cls: 'setting-item-description'
			});
		}
	}

	/**
	 * Display detailed health check results
	 */
	private displayHealthCheckResults(
		container: HTMLElement,
		cacheInfo: ReturnType<typeof this.plugin.dataAdapter.getCacheInfo>
	): void {
		// Remove old results
		container.querySelectorAll('.health-results').forEach(el => el.remove());

		const resultsDiv = container.createDiv('health-results');

		if (!cacheInfo.diagnostics) {
			resultsDiv.createEl('p', {
				text: 'No diagnostics available. Run scan first.',
				cls: 'mod-warning'
			});
			return;
		}

		const diag = cacheInfo.diagnostics;
		const successRate = ((diag.success / diag.scanned) * 100).toFixed(1);

		// ===== SUMMARY =====
		const summaryDiv = resultsDiv.createDiv('health-summary');
		summaryDiv.createEl('h3', { text: 'Scan Results' });

		const successEl = summaryDiv.createEl('div', { cls: 'health-metric-success' });
		successEl.createEl('strong', { text: 'Successfully loaded: ' });
		successEl.createSpan({
			text: `${diag.success} / ${diag.scanned} files (${successRate}%)`
		});

		// ===== EXCLUSION BREAKDOWN =====
		const breakdownDiv = resultsDiv.createDiv('health-breakdown');
		breakdownDiv.createEl('h4', { text: 'Exclusion Breakdown' });

		const exclusions = [
			{
				label: 'No frontmatter',
				count: diag.noFrontmatter,
				examples: diag.examples?.noFrontmatter,
				recommendation: 'These files are missing YAML frontmatter (---). Add frontmatter with required fields.'
			},
			{
				label: 'Not detected as item',
				count: diag.notDetected,
				examples: diag.examples?.notDetected,
				recommendation: 'These files have frontmatter but may be missing required properties. All files in designated folders are treated as items.'
			},
			{
				label: 'Invalid/missing cost',
				count: diag.invalidCost,
				examples: diag.examples?.invalidCost,
				recommendation: 'Non-magic items must have a valid cost string (e.g., "25 gp"). Magic items can have empty cost (auto-calculated).'
			},
			{
				label: 'Source filtered',
				count: diag.sourceFiltered,
				examples: diag.examples?.sourceFiltered,
				recommendation: 'These items are from disabled sources. Enable sources in "Source Filtering" section above.'
			},
			{
				label: 'Parse errors',
				count: diag.parseErrors,
				examples: diag.examples?.parseErrors,
				recommendation: 'These files caused parsing errors. Check console for details.'
			}
		];

		const listEl = breakdownDiv.createEl('ul', { cls: 'health-exclusion-list' });

		for (const { label, count, examples, recommendation } of exclusions) {
			if (count === 0) continue;

			const itemEl = listEl.createEl('li');

			// Count header
			const headerEl = itemEl.createDiv('exclusion-header');
			headerEl.createEl('strong', { text: `${label}: ` });
			headerEl.createSpan({ text: `${count} files` });

			// Examples (if available) - make expandable
			if (examples && examples.length > 0) {
				const expandBtn = itemEl.createEl('button', {
					text: `Show ${examples.length} example file${examples.length === 1 ? '' : 's'}`,
					cls: 'health-expand-btn'
				});
				expandBtn.style.border = 'none';
				expandBtn.style.background = 'transparent';
				expandBtn.style.color = 'var(--text-accent)';
				expandBtn.style.cursor = 'pointer';
				expandBtn.style.padding = '4px 0';
				expandBtn.style.fontSize = '0.9em';

				const exampleListEl = itemEl.createEl('ul', { cls: 'health-example-list' });
				exampleListEl.style.display = 'none';

				examples.forEach((path: string) => {
					const filename = path.replace(/^.*[\\/]/, ''); // Extract filename
					const exampleItem = exampleListEl.createEl('li');
					exampleItem.createEl('code', { text: filename });
					exampleItem.setAttribute('title', path); // Full path on hover
				});

				if (count > examples.length) {
					exampleListEl.createEl('li', {
						text: `... and ${count - examples.length} more (showing first ${examples.length})`,
						cls: 'health-example-more'
					});
				}

				// Toggle expand/collapse
				expandBtn.addEventListener('click', () => {
					const isHidden = exampleListEl.style.display === 'none';
					exampleListEl.style.display = isHidden ? 'block' : 'none';
					expandBtn.textContent = isHidden
						? `Hide ${examples.length} example file${examples.length === 1 ? '' : 's'}`
						: `Show ${examples.length} example file${examples.length === 1 ? '' : 's'}`;
				});
			}

			// Recommendation
			const recEl = itemEl.createDiv('exclusion-recommendation');
			recEl.createEl('em', { text: `${recommendation}` });
		}

		// ===== RECOMMENDATIONS =====
		const hasIssues = diag.notDetected > 0 || diag.invalidCost > 0 || diag.sourceFiltered > 0;

		if (hasIssues) {
			const recsDiv = resultsDiv.createDiv('health-recommendations');
			recsDiv.createEl('h4', { text: 'Quick Fixes' });

			const recsList = recsDiv.createEl('ul');

			if (diag.sourceFiltered > 0) {
				const sourceRec = recsList.createEl('li');
				sourceRec.createEl('strong', { text: 'Source Filtering: ' });
				sourceRec.createSpan({
					text: `${diag.sourceFiltered} items are from disabled sources. Check "Source Filtering" section above.`
				});
			}

			if (diag.invalidCost > 0) {
				const costRec = recsList.createEl('li');
				costRec.createEl('strong', { text: 'Cost Fields: ' });
				costRec.createSpan({
					text: `${diag.invalidCost} items have invalid costs. Add valid cost strings (e.g., cost: "25 gp") to frontmatter.`
				});
			}
		} else if (diag.success === diag.scanned) {
			const perfectDiv = resultsDiv.createDiv('health-perfect');
			perfectDiv.createEl('p', {
				text: 'Perfect! All files were successfully loaded as items.',
				cls: 'mod-success'
			});
		}
	}

	/**
	 * Render Support Links Footer section
	 */
	private renderSupportLinksFooter(containerEl: HTMLElement): void {
		const footerDiv = containerEl.createDiv('support-links-footer');
		footerDiv.style.marginTop = '32px';
		footerDiv.style.padding = '24px';
		footerDiv.style.borderTop = '2px solid var(--background-modifier-border)';
		footerDiv.style.textAlign = 'center';

		// Title
		footerDiv.createEl('h3', {
			text: 'Support Quartermaster Development',
			attr: { style: 'margin-bottom: 16px; font-size: 1.1em;' }
		});

		// Description
		footerDiv.createEl('p', {
			text: 'If you enjoy using Quartermaster, consider supporting its development!',
			cls: 'setting-item-description',
			attr: { style: 'margin-bottom: 16px;' }
		});

		// Links container
		const linksContainer = footerDiv.createDiv('support-links-container');
		linksContainer.style.display = 'flex';
		linksContainer.style.justifyContent = 'center';
		linksContainer.style.gap = '16px';
		linksContainer.style.flexWrap = 'wrap';

		// Ko-fi link
		const kofiLink = linksContainer.createEl('a', {
			text: 'Support on Ko-fi',
			href: 'https://ko-fi.com/dubyafm',
			attr: {
				target: '_blank',
				rel: 'noopener noreferrer',
				style: 'display: inline-flex; align-items: center; padding: 10px 20px; background-color: #13C3FF; color: white; text-decoration: none; border-radius: 6px; font-weight: 500; transition: opacity 0.2s;'
			}
		});
		kofiLink.addEventListener('mouseenter', () => {
			kofiLink.style.opacity = '0.85';
		});
		kofiLink.addEventListener('mouseleave', () => {
			kofiLink.style.opacity = '1';
		});

		// GitHub link
		const githubLink = linksContainer.createEl('a', {
			text: 'Star on GitHub',
			href: 'https://github.com/DubyaFM/quartermaster',
			attr: {
				target: '_blank',
				rel: 'noopener noreferrer',
				style: 'display: inline-flex; align-items: center; padding: 10px 20px; background-color: var(--interactive-accent); color: white; text-decoration: none; border-radius: 6px; font-weight: 500; transition: opacity 0.2s;'
			}
		});
		githubLink.addEventListener('mouseenter', () => {
			githubLink.style.opacity = '0.85';
		});
		githubLink.addEventListener('mouseleave', () => {
			githubLink.style.opacity = '1';
		});
	}

	/**
	 * Render the party member list from files
	 */
	private async renderPartyMemberList(containerEl: HTMLElement): Promise<void> {
		try {
			const members = await this.plugin.dataAdapter.getPartyMembers();

			if (members.length === 0) {
				containerEl.createEl('p', {
					text: 'No party members yet. Click "Add Party Member" to create one.',
					cls: 'setting-item-description'
				});
				return;
			}

			for (const member of members) {
				new Setting(containerEl)
					.setName(member.name)
					.setDesc(member.linkedFile || 'No file linked')
					.addButton(btn => btn
						.setButtonText('Edit')
						.onClick(() => {
							new EditPartyMemberModal(this.app, this.plugin, member, () => {
								this.display(); // Refresh after edit
							}).open();
						}))
					.addExtraButton(btn => btn
						.setIcon('trash')
						.setTooltip('Remove party member')
						.onClick(async () => {
							// Confirm delete
							const confirmed = confirm(`Delete party member "${member.name}"?`);
							if (confirmed) {
								await this.plugin.dataAdapter.deletePartyMember(member.id);
								new Notice(`Deleted party member "${member.name}"`);
								this.display(); // Refresh list
							}
						}));
			}
		} catch (error) {
			console.error('Failed to load party members:', error);
			containerEl.createEl('p', {
				text: 'Failed to load party members. Check console for errors.',
				cls: 'mod-warning'
			});
		}
	}
}
