// Modal for linking to an existing character file
import { Modal, App, Setting, Notice, TFile } from 'obsidian';
import { PartyMember } from '@quartermaster/core/models/types';
import type QuartermasterPlugin from '../main';

export class LinkPartyMemberModal extends Modal {
	plugin: QuartermasterPlugin;
	selectedFile?: TFile;
	parsedMember?: Partial<PartyMember>;
	missingFields: string[] = [];
	onSuccess?: () => void;

	constructor(app: App, plugin: QuartermasterPlugin, onSuccess?: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Link to Character File' });

		// File selector
		const files = this.app.vault.getMarkdownFiles();

		new Setting(contentEl)
			.setName('Select Character File')
			.setDesc('Choose the markdown file containing character data')
			.addDropdown(dropdown => {
				dropdown.addOption('', '-- Select a file --');
				files.forEach(file => {
					dropdown.addOption(file.path, file.path);
				});
				dropdown.onChange(async (path) => {
					if (path) {
						const file = this.app.vault.getAbstractFileByPath(path);
						if (file instanceof TFile) {
							await this.parseFile(file);
						}
					}
				});
			});

		// Preview section (populated after file selection)
		const previewDiv = contentEl.createDiv({ cls: 'party-member-preview' });

		// Action buttons
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => this.close()))
			.addButton(btn => btn
				.setButtonText('Link Character')
				.setCta()
				.setDisabled(!this.selectedFile)
				.onClick(async () => {
					await this.linkCharacter();
				}));
	}

	private async parseFile(file: TFile): Promise<void> {
		this.selectedFile = file;

		const cache = this.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;

		if (!fm) {
			new Notice('Selected file has no frontmatter');
			return;
		}

		// Parse available data
		this.parsedMember = {
			id: fm.id,
			name: fm.name,
			linkedFile: file.path,
			level: fm.level,
			xp: fm.xp,
			strength: fm.strength,
			dexterity: fm.dexterity,
			constitution: fm.constitution,
			intelligence: fm.intelligence,
			wisdom: fm.wisdom,
			charisma: fm.charisma,
			size: fm.size,
			bonuses: fm.bonuses || [],
			dataSource: {
				type: fm.dataSource?.type || fm.dataSourceType || 'obsidian_frontmatter',
				linkedFile: file.path
			}
		};

		// Check for missing required fields
		this.missingFields = [];
		if (!this.parsedMember.id) this.missingFields.push('id');
		if (!this.parsedMember.name) this.missingFields.push('name');
		if (this.parsedMember.strength === undefined) this.missingFields.push('strength');
		if (this.parsedMember.size === undefined) this.missingFields.push('size');

		// Re-render to show preview and missing fields form
		this.renderPreview();
	}

	private renderPreview(): void {
		const previewDiv = this.contentEl.querySelector('.party-member-preview') as HTMLElement;
		if (!previewDiv) return;

		previewDiv.empty();

		if (!this.parsedMember) return;

		previewDiv.createEl('h3', { text: 'Character Data' });

		// Show parsed data
		const dataList = previewDiv.createEl('ul');
		dataList.createEl('li', { text: `Name: ${this.parsedMember.name || '(missing)'}` });
		dataList.createEl('li', { text: `STR: ${this.parsedMember.strength ?? '(missing)'}` });
		dataList.createEl('li', { text: `Size: ${this.parsedMember.size || '(missing)'}` });

		// Show form for missing fields
		if (this.missingFields.length > 0) {
			previewDiv.createEl('h4', { text: 'Missing Required Data' });
			previewDiv.createEl('p', {
				text: 'The following fields will be added to the file:',
				cls: 'setting-item-description'
			});

			// Add inputs for missing fields
			if (this.missingFields.includes('id')) {
				new Setting(previewDiv)
					.setName('ID')
					.setDesc('Will auto-generate UUID')
					.setDisabled(true);
			}
			if (this.missingFields.includes('name')) {
				new Setting(previewDiv)
					.setName('Name')
					.addText(text => text
						.setPlaceholder('Character name')
						.onChange(value => {
							if (this.parsedMember) this.parsedMember.name = value;
						}));
			}
			if (this.missingFields.includes('strength')) {
				new Setting(previewDiv)
					.setName('Strength')
					.addText(text => text
						.setPlaceholder('10')
						.onChange(value => {
							if (this.parsedMember) this.parsedMember.strength = parseInt(value) || 10;
						}));
			}
			if (this.missingFields.includes('size')) {
				new Setting(previewDiv)
					.setName('Size')
					.addDropdown(dropdown => dropdown
						.addOption('Medium', 'Medium')
						.addOption('Small', 'Small')
						.addOption('Large', 'Large')
						.addOption('Tiny', 'Tiny')
						.addOption('Huge', 'Huge')
						.addOption('Gargantuan', 'Gargantuan')
						.onChange(value => {
							if (this.parsedMember) this.parsedMember.size = value as any;
						}));
			}
		}
	}

	private async linkCharacter(): Promise<void> {
		if (!this.selectedFile || !this.parsedMember) {
			new Notice('Please select a file first');
			return;
		}

		try {
			// Generate ID if missing
			if (!this.parsedMember.id) {
				this.parsedMember.id = this.plugin.uuidRegistry.generatePartyMemberId();
			}

			// Fill in defaults for missing fields
			if (!this.parsedMember.name) {
				new Notice('Name is required');
				return;
			}
			if (this.parsedMember.strength === undefined) this.parsedMember.strength = 10;
			if (!this.parsedMember.size) this.parsedMember.size = 'Medium';
			if (!this.parsedMember.dataSource) {
				this.parsedMember.dataSource = { type: 'obsidian_frontmatter', linkedFile: this.selectedFile.path };
			}

			// Ensure linkedFile is set
			this.parsedMember.linkedFile = this.selectedFile.path;

			// Update file with missing frontmatter
			if (this.missingFields.length > 0) {
				await this.plugin.dataAdapter.updatePartyMember(this.parsedMember as PartyMember);
				new Notice(`Updated "${this.parsedMember.name}" with missing data`);
			} else {
				// Just save/register it
				// Note: We're updating the existing file, not creating a new one
				await this.plugin.dataAdapter.updatePartyMember(this.parsedMember as PartyMember);
				new Notice(`Linked to "${this.parsedMember.name}"`);
			}

			if (this.onSuccess) {
				this.onSuccess();
			}

			this.close();
		} catch (error) {
			console.error('Failed to link character:', error);
			new Notice(`Failed to link character: ${error.message}`);
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
