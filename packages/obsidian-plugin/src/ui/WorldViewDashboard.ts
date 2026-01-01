import { App, Modal, Notice } from 'obsidian';
import type QuartermasterPlugin from '../main';

interface WorldGroup {
	worldId: string;
	worldName: string;
	campaigns: CampaignInfo[];
}

interface CampaignInfo {
	id: string;
	name: string;
	partyLevel?: number;
	partyGold?: string;
	currentDate?: string;
	lastAccessed: number;
	isActive: boolean;
}

/**
 * Dashboard showing all campaigns grouped by world
 */
export class WorldViewDashboard extends Modal {
	private plugin: QuartermasterPlugin;
	private worldGroups: WorldGroup[] = [];

	constructor(app: App, plugin: QuartermasterPlugin) {
		super(app);
		this.plugin = plugin;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: 'World View Dashboard' });

		const descDiv = contentEl.createDiv('world-view-description');
		descDiv.style.marginBottom = '16px';
		descDiv.style.color = 'var(--text-muted)';
		descDiv.createEl('p', {
			text: 'View all your campaigns organized by world. Click a campaign to switch to it.'
		});

		// Load and group campaigns
		await this.loadWorldGroups();

		// Render world groups
		this.renderWorldGroups(contentEl);
	}

	/**
	 * Load all campaigns and group them by world
	 */
	private async loadWorldGroups(): Promise<void> {
		const campaignManager = this.plugin.adapterFactory.getCampaignManager();
		const campaigns = await campaignManager.listCampaigns();

		// Group campaigns by worldId
		const worldMap = new Map<string, CampaignInfo[]>();

		for (const campaign of campaigns) {
			const info: CampaignInfo = {
				id: campaign.id,
				name: campaign.name,
				lastAccessed: campaign.lastAccessedAt || 0,
				isActive: campaign.isActive
			};

			// Get world ID (defaults to 'custom' if not set)
			const worldId = campaign.worldId || 'custom';

			if (!worldMap.has(worldId)) {
				worldMap.set(worldId, []);
			}

			worldMap.get(worldId)!.push(info);
		}

		// Convert map to array and sort campaigns within each world
		this.worldGroups = Array.from(worldMap.entries()).map(([worldId, campaigns]) => {
			// Sort: active first, then by last accessed
			campaigns.sort((a, b) => {
				if (a.isActive !== b.isActive) {
					return a.isActive ? -1 : 1;
				}
				return b.lastAccessed - a.lastAccessed;
			});

			return {
				worldId,
				worldName: this.getWorldDisplayName(worldId),
				campaigns
			};
		});

		// Sort world groups alphabetically
		this.worldGroups.sort((a, b) => a.worldName.localeCompare(b.worldName));
	}

	/**
	 * Get display name for a world ID
	 */
	private getWorldDisplayName(worldId: string): string {
		const worldNames: Record<string, string> = {
			'forgotten-realms': '⚔ Forgotten Realms',
			'eberron': '⚙ Eberron',
			'greyhawk': '🏰 Greyhawk',
			'dragonlance': '🐉 Dragonlance',
			'ravenloft': '🏰 Ravenloft',
			'spelljammer': '🚀 Spelljammer',
			'planescape': '🌀 Planescape',
			'dark-sun': '☀ Dark Sun',
			'generic-fantasy': '🗡 Generic Fantasy',
			'pathfinder-golarion': '🔮 Golarion (Pathfinder)',
			'custom': '🌍 Custom Homebrew'
		};

		return worldNames[worldId] || `🌍 ${worldId}`;
	}

	/**
	 * Render all world groups
	 */
	private renderWorldGroups(containerEl: HTMLElement): void {
		if (this.worldGroups.length === 0) {
			containerEl.createEl('p', {
				text: 'No campaigns found. Create a campaign to get started.',
				cls: 'mod-warning'
			});
			return;
		}

		const groupsContainer = containerEl.createDiv('world-groups-container');
		groupsContainer.style.maxHeight = '600px';
		groupsContainer.style.overflowY = 'auto';

		for (const worldGroup of this.worldGroups) {
			this.renderWorldGroup(groupsContainer, worldGroup);
		}
	}

	/**
	 * Render a single world group
	 */
	private renderWorldGroup(containerEl: HTMLElement, worldGroup: WorldGroup): void {
		const groupDiv = containerEl.createDiv('world-group');
		groupDiv.style.marginBottom = '24px';

		// World header
		const header = groupDiv.createEl('h3', {
			text: `${worldGroup.worldName} (${worldGroup.campaigns.length} campaign${worldGroup.campaigns.length === 1 ? '' : 's'})`
		});
		header.style.marginBottom = '12px';
		header.style.paddingBottom = '8px';
		header.style.borderBottom = '2px solid var(--background-modifier-border)';

		// Campaign list
		const campaignList = groupDiv.createDiv('world-campaigns-list');
		campaignList.style.paddingLeft = '16px';

		for (const campaign of worldGroup.campaigns) {
			this.renderCampaignItem(campaignList, campaign);
		}
	}

	/**
	 * Render a single campaign item
	 */
	private renderCampaignItem(containerEl: HTMLElement, campaign: CampaignInfo): void {
		const itemDiv = containerEl.createDiv('campaign-item');
		itemDiv.style.padding = '12px';
		itemDiv.style.marginBottom = '8px';
		itemDiv.style.borderRadius = '6px';
		itemDiv.style.border = '1px solid var(--background-modifier-border)';
		itemDiv.style.cursor = 'pointer';
		itemDiv.style.transition = 'all 0.2s ease';

		// Highlight active campaign
		if (campaign.isActive) {
			itemDiv.style.backgroundColor = 'var(--background-secondary)';
			itemDiv.style.borderColor = 'var(--text-accent)';
			itemDiv.style.borderWidth = '2px';
		}

		// Campaign name row
		const nameRow = itemDiv.createDiv('campaign-name-row');
		nameRow.style.display = 'flex';
		nameRow.style.justifyContent = 'space-between';
		nameRow.style.alignItems = 'center';
		nameRow.style.marginBottom = '8px';

		const nameDiv = nameRow.createDiv();
		const nameEl = nameDiv.createEl('strong', { text: campaign.name });
		if (campaign.isActive) {
			nameEl.style.color = 'var(--text-accent)';
			nameDiv.createSpan({ text: ' (Active)', attr: { style: 'color: var(--text-success); font-size: 0.9em;' } });
		}

		// Stats row
		const statsRow = itemDiv.createDiv('campaign-stats-row');
		statsRow.style.display = 'flex';
		statsRow.style.gap = '16px';
		statsRow.style.fontSize = '0.9em';
		statsRow.style.color = 'var(--text-muted)';

		// Party level (placeholder)
		if (campaign.partyLevel) {
			const levelSpan = statsRow.createSpan();
			levelSpan.createEl('strong', { text: 'Party Level: ' });
			levelSpan.createSpan({ text: campaign.partyLevel.toString() });
		}

		// Party gold (placeholder)
		if (campaign.partyGold) {
			const goldSpan = statsRow.createSpan();
			goldSpan.createEl('strong', { text: 'Gold: ' });
			goldSpan.createSpan({ text: campaign.partyGold });
		}

		// Current date (placeholder)
		if (campaign.currentDate) {
			const dateSpan = statsRow.createSpan();
			dateSpan.createEl('strong', { text: 'Date: ' });
			dateSpan.createSpan({ text: campaign.currentDate });
		}

		// Last accessed
		const lastAccessedDiv = itemDiv.createDiv('campaign-last-accessed');
		lastAccessedDiv.style.fontSize = '0.85em';
		lastAccessedDiv.style.color = 'var(--text-faint)';
		lastAccessedDiv.style.marginTop = '8px';
		lastAccessedDiv.textContent = `Last accessed: ${this.formatTimestamp(campaign.lastAccessed)}`;

		// Hover effect
		itemDiv.addEventListener('mouseenter', () => {
			if (!campaign.isActive) {
				itemDiv.style.backgroundColor = 'var(--background-modifier-hover)';
			}
		});

		itemDiv.addEventListener('mouseleave', () => {
			if (!campaign.isActive) {
				itemDiv.style.backgroundColor = 'transparent';
			}
		});

		// Click to switch campaign
		itemDiv.addEventListener('click', async () => {
			if (campaign.isActive) {
				new Notice('This campaign is already active');
				return;
			}

			try {
				await this.plugin.switchCampaign(campaign.id);
				new Notice(`Switched to campaign: ${campaign.name}`);
				this.close();

				// Refresh campaign selector if it exists
				if (this.plugin.campaignSelector) {
					await this.plugin.campaignSelector.refreshDisplay();
				}
			} catch (error) {
				new Notice(`Failed to switch campaign: ${error.message}`);
				console.error('Campaign switch error:', error);
			}
		});
	}

	/**
	 * Format timestamp for display
	 */
	private formatTimestamp(timestamp: number): string {
		if (!timestamp) {
			return 'Never';
		}

		const now = Date.now();
		const diff = now - timestamp;
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) {
			return 'Just now';
		} else if (minutes < 60) {
			return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
		} else if (hours < 24) {
			return `${hours} hour${hours === 1 ? '' : 's'} ago`;
		} else if (days < 30) {
			return `${days} day${days === 1 ? '' : 's'} ago`;
		} else {
			return new Date(timestamp).toLocaleDateString();
		}
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
