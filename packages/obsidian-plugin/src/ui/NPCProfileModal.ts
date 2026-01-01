// NPC Profile Modal - View and edit NPC details
import { Modal, App, Setting, Notice, TextAreaComponent } from 'obsidian';
import { NPCProfile, NPCRole, NPCRelationship } from '@quartermaster/core/models/npc';
import { RelationshipManager } from '@quartermaster/core/services/RelationshipManager';
import type QuartermasterPlugin from '../main';

export class NPCProfileModal extends Modal {
	plugin: QuartermasterPlugin;
	npc: NPCProfile;
	npcFilePath: string;
	onSave?: (npc: NPCProfile) => void;
	currentTab: 'overview' | 'relationships' | 'notes' = 'overview';
	relationshipManager: RelationshipManager;

	constructor(
		app: App,
		plugin: QuartermasterPlugin,
		npc: NPCProfile,
		npcFilePath: string,
		onSave?: (npc: NPCProfile) => void
	) {
		super(app);
		this.plugin = plugin;
		this.npc = { ...npc }; // Create a copy to avoid mutating original
		this.npcFilePath = npcFilePath;
		this.onSave = onSave;
		this.relationshipManager = new RelationshipManager();
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		this.renderHeader(contentEl);
		this.renderTabs(contentEl);
		this.renderTabContent(contentEl);
		this.renderActions(contentEl);
	}

	renderHeader(container: HTMLElement) {
		const header = container.createDiv({ cls: 'npc-profile-header' });

		// Name and species
		header.createEl('h2', { text: this.npc.name });
		const subtitle = `${this.npc.species}`;
		header.createEl('p', { text: subtitle, cls: 'npc-subtitle' });

		// Roles badges
		if (this.npc.roles.length > 0) {
			const rolesContainer = header.createDiv({ cls: 'npc-roles' });
			for (const role of this.npc.roles) {
				rolesContainer.createEl('span', {
					text: role,
					cls: `npc-role-badge npc-role-${role}`
				});
			}
		}

		// Status and disposition
		const statusLine = header.createDiv({ cls: 'npc-status-line' });
		statusLine.createEl('span', {
			text: `Status: ${this.npc.status}`,
			cls: `npc-status npc-status-${this.npc.status}`
		});
		statusLine.createEl('span', {
			text: ` • Disposition: ${this.npc.disposition}`,
			cls: `npc-disposition npc-disposition-${this.npc.disposition}`
		});
		if (this.npc.partyReputation !== undefined) {
			const rep = this.npc.partyReputation;
			const repText = rep > 50 ? 'Ally' : rep < -50 ? 'Enemy' : 'Neutral';
			statusLine.createEl('span', {
				text: ` • Reputation: ${rep} (${repText})`,
				cls: 'npc-reputation'
			});
		}
	}

	renderTabs(container: HTMLElement) {
		const tabsContainer = container.createDiv({ cls: 'npc-tabs' });

		const createTab = (name: string, label: string) => {
			const tab = tabsContainer.createEl('button', {
				text: label,
				cls: this.currentTab === name ? 'npc-tab npc-tab-active' : 'npc-tab'
			});
			tab.onclick = () => {
				this.currentTab = name as any;
				this.onOpen(); // Re-render
			};
		};

		createTab('overview', 'Overview');
		createTab('relationships', 'Relationships');
		createTab('notes', 'Notes');
	}

	renderTabContent(container: HTMLElement) {
		const contentContainer = container.createDiv({ cls: 'npc-tab-content' });

		switch (this.currentTab) {
			case 'overview':
				this.renderOverviewTab(contentContainer);
				break;
			case 'relationships':
				this.renderRelationshipsTab(contentContainer);
				break;
			case 'notes':
				this.renderNotesTab(contentContainer);
				break;
		}
	}

	renderOverviewTab(container: HTMLElement) {
		// Identity Section
		const identitySection = container.createDiv({ cls: 'npc-section' });
		identitySection.createEl('h3', { text: 'Identity' });

		new Setting(identitySection)
			.setName('Name')
			.addText(text => text
				.setValue(this.npc.name)
				.onChange(value => this.npc.name = value));

		new Setting(identitySection)
			.setName('Species')
			.addText(text => text
				.setValue(this.npc.species)
				.onChange(value => this.npc.species = value));

		new Setting(identitySection)
			.setName('Gender')
			.addText(text => text
				.setValue(this.npc.gender)
				.onChange(value => this.npc.gender = value));

		if (this.npc.age !== undefined) {
			new Setting(identitySection)
				.setName('Age')
				.addText(text => text
					.setValue(String(this.npc.age))
					.onChange(value => this.npc.age = parseInt(value) || undefined));
		}

		if (this.npc.pronouns) {
			new Setting(identitySection)
				.setName('Pronouns')
				.addText(text => text
					.setValue(this.npc.pronouns!)
					.onChange(value => this.npc.pronouns = value));
		}

		// Personality Section
		const personalitySection = container.createDiv({ cls: 'npc-section' });
		personalitySection.createEl('h3', { text: 'Personality' });

		new Setting(personalitySection)
			.setName('Disposition')
			.addDropdown(dropdown => dropdown
				.addOption('hostile', 'Hostile')
				.addOption('unfriendly', 'Unfriendly')
				.addOption('neutral', 'Neutral')
				.addOption('friendly', 'Friendly')
				.addOption('helpful', 'Helpful')
				.setValue(this.npc.disposition)
				.onChange(value => {
					this.npc.disposition = value as NPCProfile['disposition'];
					// Update bargain DC based on disposition
					const dcMap = { hostile: 20, unfriendly: 15, neutral: 10, friendly: 7, helpful: 5 };
					this.npc.bargainDC = dcMap[this.npc.disposition];
				}));

		new Setting(personalitySection)
			.setName('Bargain DC')
			.setDesc('Persuasion check difficulty')
			.addText(text => text
				.setValue(String(this.npc.bargainDC))
				.setDisabled(true));

		new Setting(personalitySection)
			.setName('Quirk')
			.addText(text => text
				.setValue(this.npc.quirk)
				.onChange(value => this.npc.quirk = value));

		if (this.npc.alignment) {
			new Setting(personalitySection)
				.setName('Alignment')
				.addText(text => text
					.setValue(this.npc.alignment!)
					.onChange(value => this.npc.alignment = value));
		}

		// Affiliations Section
		const affiliationsSection = container.createDiv({ cls: 'npc-section' });
		affiliationsSection.createEl('h3', { text: 'Affiliations' });

		if (this.npc.faction) {
			new Setting(affiliationsSection)
				.setName('Faction')
				.addText(text => text
					.setValue(this.npc.faction!)
					.onChange(value => this.npc.faction = value));
		}

		if (this.npc.location) {
			new Setting(affiliationsSection)
				.setName('Location')
				.addText(text => text
					.setValue(this.npc.location!)
					.onChange(value => this.npc.location = value));
		}

		// Capabilities Section
		if (this.npc.skills || this.npc.toolProficiencies || this.npc.languages || this.npc.specialAbilities) {
			const capabilitiesSection = container.createDiv({ cls: 'npc-section' });
			capabilitiesSection.createEl('h3', { text: 'Capabilities' });

			if (this.npc.skills && this.npc.skills.length > 0) {
				capabilitiesSection.createEl('p', { text: `Skills: ${this.npc.skills.join(', ')}` });
			}

			if (this.npc.toolProficiencies && this.npc.toolProficiencies.length > 0) {
				capabilitiesSection.createEl('p', { text: `Tools: ${this.npc.toolProficiencies.join(', ')}` });
			}

			if (this.npc.languages && this.npc.languages.length > 0) {
				capabilitiesSection.createEl('p', { text: `Languages: ${this.npc.languages.join(', ')}` });
			}

			if (this.npc.specialAbilities && this.npc.specialAbilities.length > 0) {
				capabilitiesSection.createEl('p', { text: `Abilities: ${this.npc.specialAbilities.join(', ')}` });
			}
		}

		// Appearance Section (if present)
		if (this.npc.physicalDescription || this.npc.distinguishingFeatures) {
			const appearanceSection = container.createDiv({ cls: 'npc-section' });
			appearanceSection.createEl('h3', { text: 'Appearance' });

			if (this.npc.physicalDescription) {
				appearanceSection.createEl('p', { text: this.npc.physicalDescription });
			}

			if (this.npc.distinguishingFeatures) {
				appearanceSection.createEl('p', { text: `Distinguishing Features: ${this.npc.distinguishingFeatures}` });
			}
		}
	}

	renderRelationshipsTab(container: HTMLElement) {
		const headerContainer = container.createDiv({ cls: 'relationships-header' });
		headerContainer.createEl('h3', { text: 'Relationships' });

		// Add new relationship button
		const addBtn = headerContainer.createEl('button', {
			text: '+ Add Relationship',
			cls: 'relationship-add-btn'
		});
		addBtn.onclick = () => this.showAddRelationshipDialog();

		if (this.npc.relationships.length === 0) {
			container.createEl('p', { text: 'No relationships defined.', cls: 'npc-empty-state' });
			return;
		}

		const relationshipsList = container.createDiv({ cls: 'npc-relationships-list' });

		for (const rel of this.npc.relationships) {
			const relItem = relationshipsList.createDiv({ cls: 'npc-relationship-item' });

			const relType = relItem.createEl('span', {
				text: rel.type,
				cls: `npc-relationship-type npc-relationship-${rel.type}`
			});

			const relLink = relItem.createEl('span', {
				text: rel.npcLink,
				cls: 'npc-relationship-link'
			});

			if (rel.description) {
				relItem.createEl('span', {
					text: ` - ${rel.description}`,
					cls: 'npc-relationship-desc'
				});
			}

			// Action buttons
			const actionsContainer = relItem.createDiv({ cls: 'relationship-actions' });

			// Edit button
			const editBtn = actionsContainer.createEl('button', {
				text: 'Edit',
				cls: 'relationship-action-btn'
			});
			editBtn.onclick = () => this.showEditRelationshipDialog(rel);

			// Remove button
			const removeBtn = actionsContainer.createEl('button', {
				text: 'Remove',
				cls: 'relationship-action-btn relationship-remove-btn'
			});
			removeBtn.onclick = () => this.removeRelationship(rel);
		}
	}

	async showAddRelationshipDialog() {
		// Get all NPCs for dropdown
		const npcPaths = await this.plugin.dataAdapter.listNPCs?.() || [];
		const npcs: NPCProfile[] = [];

		for (const path of npcPaths) {
			try {
				const npc = await this.plugin.dataAdapter.getNPC?.(path);
				if (npc && npc.npcId !== this.npc.npcId) {
					npcs.push(npc);
				}
			} catch (error) {
				console.error(`Failed to load NPC at ${path}:`, error);
			}
		}

		// Create dialog container
		const dialog = this.contentEl.createDiv({ cls: 'relationship-dialog' });
		dialog.createEl('h4', { text: 'Add Relationship' });

		let selectedNPC: NPCProfile | null = null;
		let relationType = '';
		let description = '';

		new Setting(dialog)
			.setName('NPC')
			.setDesc('Select the NPC to create a relationship with')
			.addDropdown(dropdown => {
				dropdown.addOption('', '-- Select NPC --');
				for (const npc of npcs) {
					dropdown.addOption(npc.npcId, npc.name);
				}
				dropdown.onChange(value => {
					selectedNPC = npcs.find(n => n.npcId === value) || null;
				});
			});

		new Setting(dialog)
			.setName('Relationship Type')
			.setDesc('e.g., friend, ally, rival, parent, employer')
			.addText(text => text
				.setPlaceholder('friend')
				.onChange(value => {
					relationType = value;
				}));

		new Setting(dialog)
			.setName('Description (Optional)')
			.addText(text => text
				.setPlaceholder('Met at the tavern')
				.onChange(value => {
					description = value;
				}));

		new Setting(dialog)
			.addButton(btn => btn
				.setButtonText('Add')
				.setCta()
				.onClick(async () => {
					if (!selectedNPC || !relationType) {
						new Notice('Please select an NPC and enter a relationship type');
						return;
					}

					await this.addRelationship(selectedNPC, relationType, description);
					dialog.remove();
					this.onOpen(); // Refresh
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					dialog.remove();
				}));
	}

	async showEditRelationshipDialog(rel: NPCRelationship) {
		const dialog = this.contentEl.createDiv({ cls: 'relationship-dialog' });
		dialog.createEl('h4', { text: 'Edit Relationship' });

		let relationType = rel.type;
		let description = rel.description || '';

		new Setting(dialog)
			.setName('Relationship Type')
			.addText(text => text
				.setValue(relationType)
				.onChange(value => {
					relationType = value;
				}));

		new Setting(dialog)
			.setName('Description')
			.addText(text => text
				.setValue(description)
				.onChange(value => {
					description = value;
				}));

		new Setting(dialog)
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(async () => {
					await this.updateRelationship(rel, relationType, description);
					dialog.remove();
					this.onOpen(); // Refresh
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					dialog.remove();
				}));
	}

	async addRelationship(targetNPC: NPCProfile, type: string, description?: string) {
		try {
			// Use RelationshipManager to add bidirectional relationship
			const result = this.relationshipManager.addRelationship(
				this.npc,
				targetNPC,
				type,
				description
			);

			// Save both NPCs
			await this.plugin.dataAdapter.updateNPC?.(this.npcFilePath, {
				relationships: result.npc1.relationships
			});

			const targetPath = await this.plugin.dataAdapter.findNPCPath?.(targetNPC.name);
			if (targetPath) {
				await this.plugin.dataAdapter.updateNPC?.(targetPath, {
					relationships: result.npc2.relationships
				});
			}

			new Notice(`Added relationship: ${this.npc.name} -> ${targetNPC.name}`);
		} catch (error) {
			new Notice('Failed to add relationship');
			console.error(error);
		}
	}

	async updateRelationship(rel: NPCRelationship, newType: string, newDescription?: string) {
		try {
			const targetName = rel.npcLink.replace(/\[\[|\]\]/g, '');
			const targetPath = await this.plugin.dataAdapter.findNPCPath?.(targetName);

			if (!targetPath) {
				new Notice(`Target NPC "${targetName}" not found`);
				return;
			}

			const targetNPC = await this.plugin.dataAdapter.getNPC?.(targetPath);
			if (!targetNPC) return;

			// Use RelationshipManager to update bidirectional relationship
			const result = this.relationshipManager.updateRelationship(
				this.npc,
				targetNPC,
				newType,
				newDescription
			);

			// Save both NPCs
			await this.plugin.dataAdapter.updateNPC?.(this.npcFilePath, {
				relationships: result.npc1.relationships
			});

			await this.plugin.dataAdapter.updateNPC?.(targetPath, {
				relationships: result.npc2.relationships
			});

			new Notice('Relationship updated');
		} catch (error) {
			new Notice('Failed to update relationship');
			console.error(error);
		}
	}

	async removeRelationship(rel: NPCRelationship) {
		try {
			const targetName = rel.npcLink.replace(/\[\[|\]\]/g, '');
			const targetPath = await this.plugin.dataAdapter.findNPCPath?.(targetName);

			if (!targetPath) {
				new Notice(`Target NPC "${targetName}" not found`);
				return;
			}

			const targetNPC = await this.plugin.dataAdapter.getNPC?.(targetPath);
			if (!targetNPC) return;

			// Use RelationshipManager to remove bidirectional relationship
			const result = this.relationshipManager.removeRelationship(
				this.npc,
				targetNPC
			);

			// Save both NPCs
			await this.plugin.dataAdapter.updateNPC?.(this.npcFilePath, {
				relationships: result.npc1.relationships
			});

			await this.plugin.dataAdapter.updateNPC?.(targetPath, {
				relationships: result.npc2.relationships
			});

			new Notice('Relationship removed');
			this.onOpen(); // Refresh
		} catch (error) {
			new Notice('Failed to remove relationship');
			console.error(error);
		}
	}

	renderNotesTab(container: HTMLElement) {
		container.createEl('h3', { text: 'DM Notes' });

		const notesContainer = container.createDiv({ cls: 'npc-notes-container' });

		new Setting(notesContainer)
			.setName('Background & Notes')
			.setDesc('Personal notes, quest hooks, secrets, etc.')
			.addTextArea(text => {
				text
					.setValue(this.npc.notes || '')
					.onChange(value => this.npc.notes = value);
				text.inputEl.rows = 15;
				text.inputEl.style.width = '100%';
			});
	}

	renderActions(container: HTMLElement) {
		const actionsContainer = container.createDiv({ cls: 'npc-actions' });

		// Save button
		new Setting(actionsContainer)
			.addButton(btn => btn
				.setButtonText('Save Changes')
				.setCta()
				.onClick(async () => {
					await this.saveNPC();
				}))
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}));
	}

	async saveNPC() {
		try {
			await this.plugin.dataAdapter.updateNPC(this.npcFilePath, this.npc);
			new Notice(`Updated ${this.npc.name}`);

			if (this.onSave) {
				this.onSave(this.npc);
			}

			this.close();
		} catch (error) {
			new Notice('Failed to save NPC');
			console.error(error);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
