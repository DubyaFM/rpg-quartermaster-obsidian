import { App } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { BaseSubmenuModal, SubmenuAction } from './BaseSubmenuModal';
import { StrongholdDashboardModal } from './stronghold/StrongholdDashboardModal';

/**
 * Strongholds submenu
 * Manage strongholds, facilities, and related operations
 */
export class StrongholdsSubmenuModal extends BaseSubmenuModal {
	getTitle(): string {
		return 'Strongholds';
	}

	getActions(): SubmenuAction[] {
		return [
			{
				label: '🏰 Stronghold Dashboard',
				action: () => new StrongholdDashboardModal(this.app, this.plugin).open()
			}
		];
	}
}
