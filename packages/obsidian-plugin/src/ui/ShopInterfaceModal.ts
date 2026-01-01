// Main entry modal for the shop system
import { Modal, App } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { NewShopModal } from './NewShopModal';
import { ExistingShopModal } from './ExistingShopModal';
import { QuickTransactionModal } from './QuickTransactionModal';
import { AllItemsViewerModal } from './AllItemsViewerModal';

export class ShopInterfaceModal extends Modal {
	plugin: QuartermasterPlugin;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Quartermaster' });

		const buttonContainer = contentEl.createDiv({ cls: 'quartermaster-buttons' });

		// Generate New Shop Button
		const newShopBtn = buttonContainer.createEl('button', {
			text: 'Generate New Shop',
			cls: 'mod-cta'
		});
		newShopBtn.onclick = () => {
			this.close();
			new NewShopModal(this.app, this.plugin).open();
		};

		// Visit Existing Shop Button
		const existingShopBtn = buttonContainer.createEl('button', {
			text: 'Visit Existing Shop'
		});
		existingShopBtn.onclick = () => {
			this.close();
			new ExistingShopModal(this.app, this.plugin).open();
		};

		// Quick Transaction Button
		const quickTransactionBtn = buttonContainer.createEl('button', {
			text: 'Log Quick Transaction'
		});
		quickTransactionBtn.onclick = () => {
			this.close();
			new QuickTransactionModal(this.app, this.plugin).open();
		};

		// View All Items Button
		const viewAllItemsBtn = buttonContainer.createEl('button', {
			text: 'View All Items'
		});
		viewAllItemsBtn.onclick = () => {
			this.close();
			new AllItemsViewerModal(this.app, this.plugin).open();
		};

		// Styling
		contentEl.createEl('style', {
			text: `
				.quartermaster-buttons {
					display: flex;
					flex-direction: column;
					gap: 10px;
					margin-top: 20px;
				}
				.quartermaster-buttons button {
					padding: 12px 20px;
					font-size: 14px;
					border-radius: 6px;
				}
			`
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
