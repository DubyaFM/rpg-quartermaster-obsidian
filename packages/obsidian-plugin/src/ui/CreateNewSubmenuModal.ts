import { App, Notice } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { BaseSubmenuModal, SubmenuAction } from './BaseSubmenuModal';
import { FactionModal } from './FactionModal';
import { LocationModal } from './LocationModal';
import { NPCGeneratorModal } from './NPCGeneratorModal';

/**
 * Create New... submenu
 * Create various campaign entities (factions, locations, NPCs, quests)
 */
export class CreateNewSubmenuModal extends BaseSubmenuModal {
	getTitle(): string {
		return 'Create New...';
	}

	getActions(): SubmenuAction[] {
		return [
			{
				label: '⚔️ Create Faction',
				action: () => new FactionModal(this.app, this.plugin).open()
			},
			{
				label: '📍 Create Location',
				action: () => new LocationModal(this.app, this.plugin).open()
			},
			{
				label: '👤 Create NPC',
				action: () => new NPCGeneratorModal(this.app, this.plugin).open()
			},
			{
				label: '📜 Create Quest',
				action: () => {
					new Notice('Quest creation coming soon!');
					// TODO: Implement QuestModal when ready
				}
			}
		];
	}
}
