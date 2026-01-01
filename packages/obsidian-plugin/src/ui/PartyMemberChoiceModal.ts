// Modal for choosing how to add a party member (link to existing file or create new)
import { Modal, App, Setting } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { LinkPartyMemberModal } from './LinkPartyMemberModal';
import { NewPartyMemberModal } from './NewPartyMemberModal';

export class PartyMemberChoiceModal extends Modal {
	plugin: QuartermasterPlugin;
	onSuccess?: () => void;

	constructor(app: App, plugin: QuartermasterPlugin, onSuccess?: () => void) {
		super(app);
		this.plugin = plugin;
		this.onSuccess = onSuccess;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'Add Party Member' });
		contentEl.createEl('p', {
			text: 'Choose how to add this party member:',
			cls: 'setting-item-description'
		});

		// Link to existing file
		new Setting(contentEl)
			.setName('Link to Existing File')
			.setDesc('Link to an existing character file in your vault')
			.addButton(btn => btn
				.setButtonText('Browse Files')
				.setCta()
				.onClick(() => {
					this.close();
					new LinkPartyMemberModal(this.app, this.plugin, this.onSuccess).open();
				}));

		// Create new file
		new Setting(contentEl)
			.setName('Create New File')
			.setDesc('Create a new character file with all stats')
			.addButton(btn => btn
				.setButtonText('Create Character')
				.onClick(() => {
					this.close();
					new NewPartyMemberModal(this.app, this.plugin, this.onSuccess).open();
				}));

		// Cancel
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => this.close()));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
