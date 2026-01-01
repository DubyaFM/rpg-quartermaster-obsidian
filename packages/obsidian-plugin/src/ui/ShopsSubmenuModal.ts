import { App } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { BaseSubmenuModal, SubmenuAction } from './BaseSubmenuModal';
import { NewShopModal } from './NewShopModal';
import { ExistingShopModal } from './ExistingShopModal';
import { QuickTransactionModal } from './QuickTransactionModal';
import { AllItemsViewerModal } from './AllItemsViewerModal';

/**
 * Shops & Commerce submenu
 * Access shop generation, transactions, and item management
 */
export class ShopsSubmenuModal extends BaseSubmenuModal {
	getTitle(): string {
		return 'Shops & Commerce';
	}

	getActions(): SubmenuAction[] {
		return [
			{
				label: '🏪 Generate New Shop',
				action: () => new NewShopModal(this.app, this.plugin).open()
			},
			{
				label: '🛒 Visit Existing Shop',
				action: () => new ExistingShopModal(this.app, this.plugin).open()
			},
			{
				label: '💰 Quick Transaction',
				action: () => new QuickTransactionModal(this.app, this.plugin).open()
			},
			{
				label: '📦 View All Items',
				action: () => new AllItemsViewerModal(this.app, this.plugin).open()
			}
		];
	}
}
