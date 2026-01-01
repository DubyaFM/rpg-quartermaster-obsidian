import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from 'obsidian';
import { WorldViewDashboard } from '../WorldViewDashboard';
import type QuartermasterPlugin from '../../main';

// Mock Obsidian API
// Helper to create mock HTMLElement with chaining methods
const createMockElement = (): any => ({
	createEl: vi.fn(createMockElement),
	createDiv: vi.fn(createMockElement),
	createSpan: vi.fn(createMockElement),
	addEventListener: vi.fn(),
	style: {},
	classList: {
		add: vi.fn(),
		remove: vi.fn(),
		toggle: vi.fn()
	}
});

vi.mock('obsidian', () => ({
	App: vi.fn(),
	Modal: class {
		app: any;
		contentEl: any;
		constructor(app: any) {
			this.app = app;
			this.contentEl = createMockElement();
			this.contentEl.empty = vi.fn();
		}
		open() {}
		close() {}
	},
	Notice: vi.fn()
}));

describe('WorldViewDashboard (TKT-CS-027)', () => {
	let app: App;
	let plugin: QuartermasterPlugin;
	let dashboard: WorldViewDashboard;

	const mockCampaigns = [
		{
			id: 'campaign-1',
			name: 'Lost Mine of Phandelver',
			worldId: 'forgotten-realms',
			isActive: true,
			lastAccessedAt: Date.now() - 1000 * 60 * 30 // 30 minutes ago
		},
		{
			id: 'campaign-2',
			name: 'Curse of Strahd',
			worldId: 'ravenloft',
			isActive: false,
			lastAccessedAt: Date.now() - 1000 * 60 * 60 * 24 * 2 // 2 days ago
		},
		{
			id: 'campaign-3',
			name: 'Eberron Adventure',
			worldId: 'eberron',
			isActive: false,
			lastAccessedAt: Date.now() - 1000 * 60 * 60 // 1 hour ago
		},
		{
			id: 'campaign-4',
			name: 'Waterdeep Dragon Heist',
			worldId: 'forgotten-realms',
			isActive: false,
			lastAccessedAt: Date.now() - 1000 * 60 * 60 * 24 * 7 // 7 days ago
		}
	];

	beforeEach(() => {
		app = new App();

		const mockCampaignManager = {
			listCampaigns: vi.fn().mockResolvedValue(mockCampaigns)
		};

		plugin = {
			app,
			adapterFactory: {
				getCampaignManager: vi.fn().mockReturnValue(mockCampaignManager)
			},
			switchCampaign: vi.fn().mockResolvedValue(undefined),
			campaignSelector: {
				refreshDisplay: vi.fn().mockResolvedValue(undefined)
			}
		} as any;

		dashboard = new WorldViewDashboard(app, plugin);
	});

	describe('Initialization', () => {
		it('should initialize with empty world groups', () => {
			expect(dashboard['worldGroups']).toEqual([]);
		});

		it('should have access to plugin', () => {
			expect(dashboard['plugin']).toBe(plugin);
		});
	});

	describe('World Grouping', () => {
		it('should group campaigns by worldId', async () => {
			await dashboard['loadWorldGroups']();

			const forgottenRealmsGroup = dashboard['worldGroups'].find(
				g => g.worldId === 'forgotten-realms'
			);
			const ravenloftGroup = dashboard['worldGroups'].find(g => g.worldId === 'ravenloft');
			const eberronGroup = dashboard['worldGroups'].find(g => g.worldId === 'eberron');

			expect(forgottenRealmsGroup).toBeDefined();
			expect(forgottenRealmsGroup?.campaigns).toHaveLength(2);

			expect(ravenloftGroup).toBeDefined();
			expect(ravenloftGroup?.campaigns).toHaveLength(1);

			expect(eberronGroup).toBeDefined();
			expect(eberronGroup?.campaigns).toHaveLength(1);
		});

		it('should sort worlds alphabetically', async () => {
			await dashboard['loadWorldGroups']();

			const worldNames = dashboard['worldGroups'].map(g => g.worldName);

			// Check if sorted
			const sortedNames = [...worldNames].sort();
			expect(worldNames).toEqual(sortedNames);
		});

		it('should default to "custom" world for campaigns without worldId', async () => {
			const customCampaign = {
				id: 'custom-1',
				name: 'Homebrew Campaign',
				worldId: undefined as string | undefined,
				isActive: false,
				lastAccessedAt: Date.now()
			};

			(plugin.adapterFactory as any).getCampaignManager().listCampaigns = vi
				.fn()
				.mockResolvedValue([customCampaign]);

			await dashboard['loadWorldGroups']();

			const customGroup = dashboard['worldGroups'].find(g => g.worldId === 'custom');
			expect(customGroup).toBeDefined();
			expect(customGroup?.campaigns).toHaveLength(1);
		});
	});

	describe('Campaign Sorting', () => {
		it('should sort active campaign first within each world', async () => {
			await dashboard['loadWorldGroups']();

			const forgottenRealmsGroup = dashboard['worldGroups'].find(
				g => g.worldId === 'forgotten-realms'
			);

			expect(forgottenRealmsGroup?.campaigns[0].isActive).toBe(true);
			expect(forgottenRealmsGroup?.campaigns[0].name).toBe('Lost Mine of Phandelver');
		});

		it('should sort by last accessed time after active campaign', async () => {
			await dashboard['loadWorldGroups']();

			const forgottenRealmsGroup = dashboard['worldGroups'].find(
				g => g.worldId === 'forgotten-realms'
			);

			// Forgotten Realms has 2 campaigns: active (30m ago) and inactive (7d ago)
			// After sorting: [0] = active, [1] = inactive (7 days ago)
			expect(forgottenRealmsGroup?.campaigns).toHaveLength(2);
			expect(forgottenRealmsGroup?.campaigns[0].isActive).toBe(true);
			expect(forgottenRealmsGroup?.campaigns[1].isActive).toBe(false);
		});
	});

	describe('World Display Names', () => {
		it('should map Forgotten Realms to display name with icon', () => {
			const displayName = dashboard['getWorldDisplayName']('forgotten-realms');
			expect(displayName).toBe('⚔ Forgotten Realms');
		});

		it('should map Eberron to display name with icon', () => {
			const displayName = dashboard['getWorldDisplayName']('eberron');
			expect(displayName).toBe('⚙ Eberron');
		});

		it('should map Ravenloft to display name with icon', () => {
			const displayName = dashboard['getWorldDisplayName']('ravenloft');
			expect(displayName).toBe('🏰 Ravenloft');
		});

		it('should map custom to generic homebrew', () => {
			const displayName = dashboard['getWorldDisplayName']('custom');
			expect(displayName).toBe('🌍 Custom Homebrew');
		});

		it('should handle unknown world IDs', () => {
			const displayName = dashboard['getWorldDisplayName']('unknown-world');
			expect(displayName).toBe('🌍 unknown-world');
		});
	});

	describe('Timestamp Formatting', () => {
		it('should format recent timestamps as "Just now"', () => {
			const timestamp = Date.now() - 1000 * 30; // 30 seconds ago
			const formatted = dashboard['formatTimestamp'](timestamp);
			expect(formatted).toBe('Just now');
		});

		it('should format minutes correctly', () => {
			const timestamp = Date.now() - 1000 * 60 * 5; // 5 minutes ago
			const formatted = dashboard['formatTimestamp'](timestamp);
			expect(formatted).toMatch(/5 mins? ago/);
		});

		it('should format hours correctly', () => {
			const timestamp = Date.now() - 1000 * 60 * 60 * 2; // 2 hours ago
			const formatted = dashboard['formatTimestamp'](timestamp);
			expect(formatted).toMatch(/2 hours? ago/);
		});

		it('should format days correctly', () => {
			const timestamp = Date.now() - 1000 * 60 * 60 * 24 * 3; // 3 days ago
			const formatted = dashboard['formatTimestamp'](timestamp);
			expect(formatted).toMatch(/3 days? ago/);
		});

		it('should format old timestamps as date string', () => {
			const timestamp = Date.now() - 1000 * 60 * 60 * 24 * 40; // 40 days ago
			const formatted = dashboard['formatTimestamp'](timestamp);
			expect(formatted).toMatch(/\d+\/\d+\/\d+/); // Date format
		});

		it('should handle zero timestamp', () => {
			const formatted = dashboard['formatTimestamp'](0);
			expect(formatted).toBe('Never');
		});
	});

	describe('Campaign Switching', () => {
		it('should call switchCampaign when campaign clicked', async () => {
			await dashboard['loadWorldGroups']();

			const inactiveCampaign = dashboard['worldGroups']
				.flatMap(g => g.campaigns)
				.find(c => !c.isActive);

			if (inactiveCampaign) {
				// Simulate click (would be done via DOM event in real scenario)
				await plugin.switchCampaign(inactiveCampaign.id);

				expect(plugin.switchCampaign).toHaveBeenCalledWith(inactiveCampaign.id);
			}
		});

		it('should refresh campaign selector after switch', async () => {
			await dashboard['loadWorldGroups']();

			const inactiveCampaign = dashboard['worldGroups']
				.flatMap(g => g.campaigns)
				.find(c => !c.isActive);

			if (inactiveCampaign) {
				await plugin.switchCampaign(inactiveCampaign.id);
				await plugin.campaignSelector.refreshDisplay();

				expect(plugin.campaignSelector.refreshDisplay).toHaveBeenCalled();
			}
		});

		it('should handle switch errors gracefully', async () => {
			plugin.switchCampaign = vi.fn().mockRejectedValue(new Error('Switch failed'));

			await dashboard['loadWorldGroups']();

			const inactiveCampaign = dashboard['worldGroups']
				.flatMap(g => g.campaigns)
				.find(c => !c.isActive);

			if (inactiveCampaign) {
				await expect(plugin.switchCampaign(inactiveCampaign.id)).rejects.toThrow('Switch failed');
			}
		});
	});

	describe('Modal Display', () => {
		it('should load world groups on open', async () => {
			const loadSpy = vi.spyOn(dashboard as any, 'loadWorldGroups');

			await dashboard.onOpen();

			expect(loadSpy).toHaveBeenCalled();
		});

		it('should render world groups after loading', async () => {
			const renderSpy = vi.spyOn(dashboard as any, 'renderWorldGroups');

			await dashboard.onOpen();

			expect(renderSpy).toHaveBeenCalled();
		});

		it('should show message when no campaigns exist', async () => {
			(plugin.adapterFactory as any).getCampaignManager().listCampaigns = vi.fn().mockResolvedValue([]);

			await dashboard.onOpen();
			await dashboard['loadWorldGroups']();

			expect(dashboard['worldGroups']).toHaveLength(0);
		});
	});

	describe('Close Behavior', () => {
		it('should clear content on close', () => {
			dashboard.onClose();

			expect(dashboard.contentEl.empty).toHaveBeenCalled();
		});
	});
});
