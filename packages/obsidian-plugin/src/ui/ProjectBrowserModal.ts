/**
 * ProjectBrowserModal - Browse and manage project templates and instances
 */

import { Modal, App, Setting, Notice } from 'obsidian';
import { ProjectTemplate, ProjectInstance } from '@quartermaster/core/models/types';
import type QuartermasterPlugin from '../main';
import { ProjectTemplateModal } from './ProjectTemplateModal';

export class ProjectBrowserModal extends Modal {
	plugin: QuartermasterPlugin;
	private activeTab: 'templates' | 'instances' = 'templates';

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('project-browser-modal');

		contentEl.createEl('h2', { text: 'Project Browser' });

		// Tab buttons
		const tabContainer = contentEl.createDiv({ cls: 'project-browser-tabs' });

		const templatesTab = tabContainer.createEl('button', {
			text: 'Templates',
			cls: this.activeTab === 'templates' ? 'active' : ''
		});
		templatesTab.onclick = () => {
			this.activeTab = 'templates';
			this.render();
		};

		const instancesTab = tabContainer.createEl('button', {
			text: 'Active Projects',
			cls: this.activeTab === 'instances' ? 'active' : ''
		});
		instancesTab.onclick = () => {
			this.activeTab = 'instances';
			this.render();
		};

		// Content area
		const contentContainer = contentEl.createDiv({ cls: 'project-browser-content' });
		this.renderContent(contentContainer);
	}

	private render(): void {
		const contentEl = this.contentEl;
		contentEl.empty();
		this.onOpen();
	}

	private renderContent(container: HTMLElement): void {
		container.empty();

		if (this.activeTab === 'templates') {
			this.renderTemplatesTab(container);
		} else {
			this.renderInstancesTab(container);
		}
	}

	private renderTemplatesTab(container: HTMLElement): void {
		const templateService = (this.plugin.dataAdapter as any).getProjectTemplateService();
		if (!templateService) {
			container.createEl('p', { text: 'Project system not initialized' });
			return;
		}

		// Create template button
		const createBtn = container.createEl('button', {
			text: 'Create New Template',
			cls: 'mod-cta'
		});
		createBtn.onclick = () => {
			new ProjectTemplateModal(this.app, this.plugin).open();
			this.close();
		};

		container.createEl('h3', { text: 'Project Templates' });

		const templates = templateService.getAllTemplates();

		if (templates.length === 0) {
			container.createEl('p', {
				text: 'No templates found. Create your first template to get started.',
				cls: 'project-empty-state'
			});
			return;
		}

		// Templates list
		const listContainer = container.createDiv({ cls: 'project-templates-list' });

		for (const template of templates) {
			const item = listContainer.createDiv({ cls: 'project-template-item' });

			const header = item.createDiv({ cls: 'project-template-header' });
			header.createEl('strong', { text: template.name });

			const outcomeType = header.createEl('span', {
				cls: 'project-outcome-badge',
				text: template.outcomeType
			});

			if (template.description) {
				item.createEl('p', {
					text: template.description,
					cls: 'project-template-description'
				});
			}

			// Template details
			const details = item.createDiv({ cls: 'project-template-details' });

			const costText = this.getCostText(template);
			details.createEl('span', { text: `Cost: ${costText}` });
			details.createEl('span', { text: ` • ` });

			const durationText = this.getDurationText(template);
			details.createEl('span', { text: `Duration: ${durationText}` });
			details.createEl('span', { text: ` • ` });

			const successText = template.automaticSuccess ? 'Auto-success' : 'Requires checks';
			details.createEl('span', { text: successText });

			// Actions
			const actions = item.createDiv({ cls: 'project-template-actions' });

			const editBtn = actions.createEl('button', { text: 'Edit' });
			editBtn.onclick = () => {
				new ProjectTemplateModal(this.app, this.plugin, template).open();
				this.close();
			};

			const deleteBtn = actions.createEl('button', {
				text: 'Delete',
				cls: 'mod-warning'
			});
			deleteBtn.onclick = async () => {
				if (confirm(`Delete template "${template.name}"?`)) {
					try {
						await templateService.deleteTemplate(template.id);
						new Notice('Template deleted');
						this.render();
					} catch (error) {
						new Notice(`Error deleting template: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}
			};
		}
	}

	private renderInstancesTab(container: HTMLElement): void {
		const instanceService = (this.plugin.dataAdapter as any).getProjectInstanceService();
		if (!instanceService) {
			container.createEl('p', { text: 'Project system not initialized' });
			return;
		}

		container.createEl('h3', { text: 'Active Projects' });

		const instances = instanceService.getActiveInstances();

		if (instances.length === 0) {
			container.createEl('p', {
				text: 'No active projects. Start a new project from a template.',
				cls: 'project-empty-state'
			});
			return;
		}

		// Instances list
		const listContainer = container.createDiv({ cls: 'project-instances-list' });

		for (const instance of instances) {
			const item = listContainer.createDiv({ cls: 'project-instance-item' });

			const header = item.createDiv({ cls: 'project-instance-header' });
			header.createEl('strong', { text: instance.name });

			const statusBadge = header.createEl('span', {
				cls: `project-status-badge project-status-${instance.status}`,
				text: instance.status
			});

			// Instance details
			const details = item.createDiv({ cls: 'project-instance-details' });

			const assignedText = instance.assignedTo.join(', ');
			details.createEl('p', { text: `Assigned to: ${assignedText}` });

			const progressText = `${instance.totalDays - instance.remainingDays} / ${instance.totalDays} days`;
			details.createEl('p', { text: `Progress: ${progressText}` });

			if (instance.successCriteria) {
				const successStats = `Successes: ${instance.successfulDays || 0} | Failures: ${instance.failedDays || 0}`;
				details.createEl('p', { text: successStats });
			}

			// Actions
			const actions = item.createDiv({ cls: 'project-instance-actions' });

			const cancelBtn = actions.createEl('button', {
				text: 'Cancel Project',
				cls: 'mod-warning'
			});
			cancelBtn.onclick = async () => {
				if (confirm(`Cancel project "${instance.name}"? This will delete it.`)) {
					try {
						await instanceService.cancelInstance(instance.id);
						new Notice('Project cancelled');
						this.render();
					} catch (error) {
						new Notice(`Error cancelling project: ${error instanceof Error ? error.message : 'Unknown error'}`);
					}
				}
			};
		}
	}

	private getCostText(template: ProjectTemplate): string {
		const strategy = template.currencyCostStrategy;
		if (strategy.type === 'none') return 'None';
		if (strategy.type === 'fixed' && strategy.fixedCost) {
			return `${strategy.fixedCost.gp} gp`;
		}
		return 'Variable';
	}

	private getDurationText(template: ProjectTemplate): string {
		const strategy = template.durationStrategy;
		if (strategy.type === 'fixed' && strategy.fixedDays) {
			return `${strategy.fixedDays} day(s)`;
		}
		return 'Variable';
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
