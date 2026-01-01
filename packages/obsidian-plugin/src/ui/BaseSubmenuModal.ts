import { App, Modal } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { ActionMenuModal } from './ActionMenuModal';

/**
 * Action button configuration for submenus
 */
export interface SubmenuAction {
	label: string;
	icon?: string;
	action: () => void;
}

/**
 * Base class for Action Menu submenu modals
 * Provides common functionality for back button and action list rendering
 */
export abstract class BaseSubmenuModal extends Modal {
	plugin: QuartermasterPlugin;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	/**
	 * Get the title for this submenu
	 */
	abstract getTitle(): string;

	/**
	 * Get the list of actions for this submenu
	 */
	abstract getActions(): SubmenuAction[];

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('quartermaster-submenu');

		// Header with back button
		const header = contentEl.createDiv({ cls: 'submenu-header' });

		const backBtn = header.createEl('button', {
			text: '← Back',
			cls: 'back-button'
		});
		backBtn.onclick = () => {
			this.close();
			new ActionMenuModal(this.app, this.plugin).open();
		};

		const title = header.createEl('h2', {
			text: this.getTitle(),
			cls: 'submenu-title'
		});

		// Actions list
		const actionsContainer = contentEl.createDiv({ cls: 'submenu-actions' });

		const actions = this.getActions();
		actions.forEach(({ label, icon, action }) => {
			const btnContainer = actionsContainer.createDiv({ cls: 'action-button-container' });
			const btn = btnContainer.createEl('button', {
				text: label,
				cls: 'action-menu-btn'
			});

			if (icon) {
				btn.addClass('with-icon');
				// Could add icon support here with setIcon() if desired
			}

			btn.onclick = () => {
				this.close();
				action();
			};
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
