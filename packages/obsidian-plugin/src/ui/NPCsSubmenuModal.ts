import { App } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { BaseSubmenuModal, SubmenuAction } from './BaseSubmenuModal';
import { NPCGeneratorModal } from './NPCGeneratorModal';
import { HireNPCModal } from './HireNPCModal';
import { HirelingManagementModal } from './HirelingManagementModal';

/**
 * NPCs & Hirelings submenu
 * Generate and manage NPCs and hired help
 */
export class NPCsSubmenuModal extends BaseSubmenuModal {
	getTitle(): string {
		return 'NPCs & Hirelings';
	}

	getActions(): SubmenuAction[] {
		return [
			{
				label: '🎲 Generate Random NPC',
				action: () => new NPCGeneratorModal(this.app, this.plugin).open()
			},
			{
				label: '🤝 Hire NPC',
				action: () => new HireNPCModal(this.app, this.plugin).open()
			},
			{
				label: '👔 Manage Hirelings',
				action: () => new HirelingManagementModal(this.app, this.plugin).open()
			}
		];
	}
}
