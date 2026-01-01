/**
 * NewProjectModal - Simplified version for starting projects
 */

import { Modal, App, Setting, Notice } from 'obsidian';
import type QuartermasterPlugin from '../main';

export class NewProjectModal extends Modal {
	plugin: QuartermasterPlugin;

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Start New Project' });
		contentEl.createEl('p', {
			text: 'Project instances can be created through the Project Browser.',
			cls: 'mod-warning'
		});

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Open Project Browser')
				.setCta()
				.onClick(() => {
					this.close();
					// Open project browser modal
					const ProjectBrowserModal = require('./ProjectBrowserModal').ProjectBrowserModal;
					new ProjectBrowserModal(this.app, this.plugin).open();
				}));
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
