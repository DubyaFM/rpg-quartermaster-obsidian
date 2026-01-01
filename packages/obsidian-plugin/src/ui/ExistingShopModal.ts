// Modal for loading and visiting existing shops
import { Modal, App, TFile } from 'obsidian';
import { Shop } from '@quartermaster/core/models/types';
import type QuartermasterPlugin from '../main';
import { ShopModal } from './ShopModal';

export class ExistingShopModal extends Modal {
	plugin: QuartermasterPlugin;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Visit Existing Shop' });

		this.loadShopList();
	}

	async loadShopList() {
		const { contentEl } = this;

		// Use adapter to get shop list
		const shopPaths = await this.plugin.dataAdapter.listShops();

		if (shopPaths.length === 0) {
			contentEl.createEl('p', { text: 'No existing shops found. Create a new shop first!' });
			return;
		}

		shopPaths.forEach(path => {
			const fileName = path.split('/').pop()?.replace('.md', '') || path;
			const shopBtn = contentEl.createEl('button', {
				text: fileName,
				cls: 'shop-file-button'
			});
			shopBtn.onclick = async () => {
				this.close();
				await this.loadExistingShop(path);
			};
		});
	}

	async loadExistingShop(path: string) {
		try {
			// Use adapter to load shop
			const shop = await this.plugin.dataAdapter.getShop(path);
			new ShopModal(this.app, this.plugin, shop, path).open();
		} catch (error) {
			console.error('Error loading shop:', error);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
