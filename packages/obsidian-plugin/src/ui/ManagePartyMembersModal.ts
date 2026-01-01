// Modal for managing party members (list, edit, delete)
import { Modal, App, Setting, Notice, ButtonComponent } from 'obsidian';
import { PartyMember } from '@quartermaster/core/models/types';
import type QuartermasterPlugin from '../main';
import { calculateCarryingCapacity } from '@quartermaster/core/calculators/encumbrance';
import { PartyMemberChoiceModal } from './PartyMemberChoiceModal';
import { EditPartyMemberModal } from './EditPartyMemberModal';

export class ManagePartyMembersModal extends Modal {
	plugin: QuartermasterPlugin;
	members: PartyMember[] = [];
	memberListContainer?: HTMLElement;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Manage Party Members' });

		// Add Member Button
		const headerDiv = contentEl.createDiv({ cls: 'party-members-header' });
		new Setting(headerDiv)
			.addButton(btn => btn
				.setButtonText('Add Party Member')
				.setIcon('plus')
				.onClick(() => {
					new PartyMemberChoiceModal(this.app, this.plugin, () => {
						this.refreshMemberList();
					}).open();
				}));

		// Member List Container
		this.memberListContainer = contentEl.createDiv({ cls: 'party-members-list' });

		// Load and display members
		await this.refreshMemberList();

		// Close Button
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Close')
				.onClick(() => {
					this.close();
				}));
	}

	/**
	 * Refresh the party member list
	 */
	private async refreshMemberList(): Promise<void> {
		if (!this.memberListContainer) return;

		try {
			this.members = await this.plugin.dataAdapter.getPartyMembers();

			// Clear the container
			this.memberListContainer.empty();

			if (this.members.length === 0) {
				this.memberListContainer.createEl('p', {
					text: 'No party members yet. Click "Add Party Member" to create one.',
					cls: 'empty-state'
				});
				return;
			}

			// Create member cards
			for (const member of this.members) {
				this.createMemberCard(member);
			}
		} catch (error) {
			console.error('Failed to load party members:', error);
			new Notice(`Failed to load party members: ${error.message}`);
		}
	}

	/**
	 * Create a card display for a party member
	 */
	private createMemberCard(member: PartyMember): void {
		if (!this.memberListContainer) return;

		const card = this.memberListContainer.createDiv({ cls: 'party-member-card' });

		// Header with name and level
		const header = card.createDiv({ cls: 'member-header' });
		header.createEl('h3', { text: member.name });
		if (member.level) {
			header.createEl('span', { text: `Level ${member.level}`, cls: 'member-level' });
		}

		// Stats section
		const stats = card.createDiv({ cls: 'member-stats' });

		// Size
		if (member.size) {
			stats.createEl('div', { text: `Size: ${member.size}` });
		}

		// Ability Scores
		const abilityScores = stats.createDiv({ cls: 'ability-scores' });
		if (member.strength) {
			abilityScores.createEl('span', {
				text: `STR: ${member.strength} (${this.getModifier(member.strength)})`,
				cls: 'ability-score'
			});
		}
		if (member.dexterity) {
			abilityScores.createEl('span', {
				text: `DEX: ${member.dexterity} (${this.getModifier(member.dexterity)})`,
				cls: 'ability-score'
			});
		}
		if (member.constitution) {
			abilityScores.createEl('span', {
				text: `CON: ${member.constitution} (${this.getModifier(member.constitution)})`,
				cls: 'ability-score'
			});
		}

		// Carrying Capacity
		const capacity = calculateCarryingCapacity(member.strength || 10, member.size || 'Medium');
		stats.createEl('div', {
			text: `Carrying Capacity: ${capacity} lbs`,
			cls: 'carrying-capacity'
		});

		// Action buttons
		const actions = card.createDiv({ cls: 'member-actions' });

		new ButtonComponent(actions)
			.setButtonText('Edit')
			.onClick(() => {
				new EditPartyMemberModal(this.app, this.plugin, member, () => {
					this.refreshMemberList();
				}).open();
			});

		new ButtonComponent(actions)
			.setButtonText('Delete')
			.setClass('mod-warning')
			.onClick(async () => {
				await this.deleteMember(member);
			});

		// Link to file if available
		if (member.linkedFile) {
			new ButtonComponent(actions)
				.setButtonText('Open File')
				.setIcon('file-text')
				.onClick(async () => {
					const file = this.app.vault.getAbstractFileByPath(member.linkedFile!);
					if (file) {
						await this.app.workspace.getLeaf().openFile(file as any);
					} else {
						new Notice('File not found');
					}
				});
		}
	}

	/**
	 * Delete a party member
	 */
	private async deleteMember(member: PartyMember): Promise<void> {
		const confirmed = await this.confirmDelete(member.name);
		if (!confirmed) return;

		try {
			await this.plugin.dataAdapter.deletePartyMember(member.id);
			new Notice(`Deleted party member "${member.name}"`);
			await this.refreshMemberList();
		} catch (error) {
			console.error('Failed to delete party member:', error);
			new Notice(`Failed to delete party member: ${error.message}`);
		}
	}

	/**
	 * Show confirmation dialog for deletion
	 */
	private async confirmDelete(name: string): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new Modal(this.app);
			modal.contentEl.createEl('h2', { text: 'Confirm Deletion' });
			modal.contentEl.createEl('p', {
				text: `Are you sure you want to delete "${name}"? This cannot be undone.`
			});

			new Setting(modal.contentEl)
				.addButton(btn => btn
					.setButtonText('Cancel')
					.onClick(() => {
						resolve(false);
						modal.close();
					}))
				.addButton(btn => btn
					.setButtonText('Delete')
					.setWarning()
					.onClick(() => {
						resolve(true);
						modal.close();
					}));

			modal.open();
		});
	}

	/**
	 * Calculate ability score modifier
	 */
	private getModifier(score: number): string {
		const mod = Math.floor((score - 10) / 2);
		return mod >= 0 ? `+${mod}` : `${mod}`;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
