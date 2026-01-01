import { App, Modal } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { AdvanceTimeModal } from './AdvanceTimeModal';
import { JobBoardModal } from './JobBoardModal';
import { ShopsSubmenuModal } from './ShopsSubmenuModal';
import { DowntimeSubmenuModal } from './DowntimeSubmenuModal';
import { NPCsSubmenuModal } from './NPCsSubmenuModal';
import { CreateNewSubmenuModal } from './CreateNewSubmenuModal';
import { StrongholdsSubmenuModal } from './StrongholdsSubmenuModal';

/**
 * Action Menu - Main entry point for all Quartermaster actions
 * Two-level navigation: Primary actions (direct) + Category buttons (open submenus)
 */
export class ActionMenuModal extends Modal {
	plugin: QuartermasterPlugin;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('quartermaster-action-menu');

		// Header
		contentEl.createEl('h2', { text: 'Quartermaster', cls: 'action-menu-header' });

		// Grid container for all buttons
		const grid = contentEl.createDiv({ cls: 'action-menu-grid' });

		// All action buttons use the same rendering method
		this.renderActionButton(
			grid,
			'⏰ Advance Time',
			'Advance the campaign calendar',
			() => {
				this.close();
				new AdvanceTimeModal(this.app, this.plugin).open();
			}
		);

		this.renderActionButton(
			grid,
			'📋 Job Board',
			'View and manage jobs',
			() => {
				this.close();
				new JobBoardModal(this.app, this.plugin).open();
			}
		);

		this.renderActionButton(
			grid,
			'🛍️ Shops & Commerce',
			'Generate shops, transactions, and items',
			() => {
				this.close();
				new ShopsSubmenuModal(this.app, this.plugin).open();
			}
		);

		this.renderActionButton(
			grid,
			'📅 Downtime & Projects',
			'Manage projects and templates',
			() => {
				this.close();
				new DowntimeSubmenuModal(this.app, this.plugin).open();
			}
		);

		this.renderActionButton(
			grid,
			'👥 NPCs & Hirelings',
			'Generate and manage NPCs',
			() => {
				this.close();
				new NPCsSubmenuModal(this.app, this.plugin).open();
			}
		);

		this.renderActionButton(
			grid,
			'✨ Create New...',
			'Create factions, locations, NPCs, and quests',
			() => {
				this.close();
				new CreateNewSubmenuModal(this.app, this.plugin).open();
			}
		);

		this.renderActionButton(
			grid,
			'🏰 Strongholds',
			'Manage strongholds and facilities',
			() => {
				this.close();
				new StrongholdsSubmenuModal(this.app, this.plugin).open();
			}
		);
	}

	/**
	 * Render an action button (unified styling for all buttons)
	 */
	private renderActionButton(
		container: HTMLElement,
		label: string,
		description: string,
		action: () => void
	) {
		const card = container.createDiv({ cls: 'action-menu-card' });

		const labelEl = card.createEl('div', { text: label, cls: 'card-label' });
		const descEl = card.createEl('div', { text: description, cls: 'card-description' });

		card.onclick = action;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
