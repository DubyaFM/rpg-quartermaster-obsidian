import { App } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { BaseSubmenuModal, SubmenuAction } from './BaseSubmenuModal';
import { ProjectBrowserModal } from './ProjectBrowserModal';
import { ProjectTemplateModal } from './ProjectTemplateModal';
import { NewProjectModal } from './NewProjectModal';

/**
 * Downtime & Projects submenu
 * Access project management and templates
 */
export class DowntimeSubmenuModal extends BaseSubmenuModal {
	getTitle(): string {
		return 'Downtime & Projects';
	}

	getActions(): SubmenuAction[] {
		return [
			{
				label: '📚 Project Browser',
				action: () => new ProjectBrowserModal(this.app, this.plugin).open()
			},
			{
				label: '📝 Create Project Template',
				action: () => new ProjectTemplateModal(this.app, this.plugin).open()
			},
			{
				label: '▶️ Start New Project',
				action: () => new NewProjectModal(this.app, this.plugin).open()
			}
		];
	}
}
