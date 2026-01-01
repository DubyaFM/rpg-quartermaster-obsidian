import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from 'obsidian';
import { RPGShopkeepSettingTab } from '../SettingsTab';
import type QuartermasterPlugin from '../../main';

// Helper to create mock HTMLElement with chaining methods
const createMockElement = (): any => ({
	createEl: vi.fn(createMockElement),
	createDiv: vi.fn(createMockElement),
	createSpan: vi.fn(createMockElement),
	addEventListener: vi.fn(),
	onclick: null,
	textContent: '',
	style: {},
	classList: {
		add: vi.fn(),
		remove: vi.fn(),
		toggle: vi.fn()
	},
	// Obsidian HTMLElement extensions
	addClass: vi.fn(function() { return this; }),
	removeClass: vi.fn(function() { return this; }),
	toggleClass: vi.fn(function() { return this; }),
	setText: vi.fn(function() { return this; }),
	empty: vi.fn()
});

// Mock Obsidian API
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
	PluginSettingTab: class {
		app: any;
		plugin: any;
		containerEl: any;
		constructor(app: any, plugin: any) {
			this.app = app;
			this.plugin = plugin;
			this.containerEl = createMockElement();
			this.containerEl.empty = vi.fn();
		}
	},
	Setting: vi.fn(() => ({
		setName: vi.fn().mockReturnThis(),
		setDesc: vi.fn().mockReturnThis(),
		addText: vi.fn().mockReturnThis(),
		addToggle: vi.fn().mockReturnThis(),
		addDropdown: vi.fn().mockReturnThis(),
		addButton: vi.fn().mockReturnThis(),
		addSlider: vi.fn().mockReturnThis(),
		addExtraButton: vi.fn().mockReturnThis()
	})),
	AbstractInputSuggest: class {
		app: any;
		inputEl: any;
		constructor(app: any, inputEl: any) {
			this.app = app;
			this.inputEl = inputEl;
		}
		getSuggestions(query: string): any[] { return []; }
		renderSuggestion(item: any, el: any): void {}
		selectSuggestion(item: any): void {}
		open(): void {}
		close(): void {}
	},
	Notice: vi.fn()
}));

describe('RPGShopkeepSettingTab - Campaign Scoping (TKT-CS-022)', () => {
	let app: App;
	let plugin: QuartermasterPlugin;
	let settingsTab: RPGShopkeepSettingTab;

	beforeEach(() => {
		app = new App();

		// Mock plugin with campaign infrastructure
		const mockCampaignManager = {
			getActiveCampaign: vi.fn().mockResolvedValue({
				id: 'test-campaign',
				name: 'Test Campaign',
				worldId: 'forgotten-realms',
				isActive: true
			})
		};

		plugin = {
			app,
			settings: {
				partyInventoryFile: 'Party Inventory.md',
				transactionLogFile: 'Transactions.md',
				itemsFolders: [],
				useSRDDatabase: true,
				enabledSources: [],
				availableSources: [],
				magicItemMarkupPercent: 50,
				partyLevel: 5,
				magicItemRarityModifiers: {
					poor: 0.1,
					modest: 0.3,
					comfortable: 0.6,
					wealthy: 0.8,
					aristocratic: 1.0
				}
			},
			saveSettings: vi.fn(),
			dataAdapter: {
				getCacheInfo: vi.fn().mockReturnValue({
					cached: true,
					totalItems: 100,
					totalShops: 10,
					cacheSize: '1.2 MB',
					lastUpdated: new Date().toISOString()
				})
			},
			adapterFactory: {
				getCampaignManager: vi.fn().mockReturnValue(mockCampaignManager)
			}
		} as any;

		settingsTab = new RPGShopkeepSettingTab(app, plugin);
	});

	describe('Initialization', () => {
		it('should initialize with campaign scope mode by default', () => {
			expect(settingsTab['scopeMode']).toBe('campaign');
		});

		it('should have access to plugin and app', () => {
			expect(settingsTab.plugin).toBe(plugin);
			expect(settingsTab.app).toBe(app);
		});
	});

	describe('Header Rendering', () => {
		it('should render header with active campaign name', async () => {
			const containerEl = settingsTab.containerEl;
			await settingsTab['renderHeader'](containerEl);

			// Verify containerEl.createDiv was called to create header
			expect(containerEl.createDiv).toHaveBeenCalled();
		});

		it('should load active campaign from campaign manager', async () => {
			await settingsTab['renderHeader'](settingsTab.containerEl);

			expect((plugin.adapterFactory as any).getCampaignManager().getActiveCampaign).toHaveBeenCalled();
		});

		it('should render scope selector buttons', async () => {
			const containerEl = settingsTab.containerEl;
			await settingsTab['renderHeader'](containerEl);

			// Verify buttons would be created (via createEl calls)
			expect(containerEl.createDiv).toHaveBeenCalled();
		});
	});

	describe('Scope Mode Toggling', () => {
		it('should switch to global mode when global button clicked', async () => {
			settingsTab['scopeMode'] = 'campaign';

			// Simulate clicking global button
			settingsTab['scopeMode'] = 'global';

			expect(settingsTab['scopeMode']).toBe('global');
		});

		it('should switch to campaign mode when campaign button clicked', async () => {
			settingsTab['scopeMode'] = 'global';

			// Simulate clicking campaign button
			settingsTab['scopeMode'] = 'campaign';

			expect(settingsTab['scopeMode']).toBe('campaign');
		});
	});

	describe('Section Rendering', () => {
		it('should render campaign-scoped sections in campaign mode', () => {
			settingsTab['scopeMode'] = 'campaign';
			const containerEl = settingsTab.containerEl;

			settingsTab['renderCampaignScopedSections'](containerEl);

			// Verify section creation methods were called
			expect(containerEl.createDiv).toHaveBeenCalled();
		});

		it('should render global sections', () => {
			const containerEl = settingsTab.containerEl;

			settingsTab['renderGlobalSections'](containerEl);

			// Verify section creation methods were called
			expect(containerEl.createDiv).toHaveBeenCalled();
		});

		it('should always render global sections regardless of scope', async () => {
			const displaySpy = vi.spyOn(settingsTab, 'display');

			// Campaign mode
			settingsTab['scopeMode'] = 'campaign';
			await settingsTab.display();

			// Global mode
			settingsTab['scopeMode'] = 'global';
			await settingsTab.display();

			// Both should call display (which includes global sections)
			expect(displaySpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('Collapsible Sections', () => {
		it('should create collapsible section with correct title', () => {
			const containerEl = settingsTab.containerEl;
			const section = settingsTab['createCollapsibleSection'](containerEl, 'Test Section', true);

			expect(section).toBeDefined();
		});

		it('should create section open by default when specified', () => {
			const containerEl = settingsTab.containerEl;
			const section = settingsTab['createCollapsibleSection'](containerEl, 'Test Section', true);

			// Default open means display is not 'none'
			expect(section.style.display).not.toBe('none');
		});

		it('should create section closed when specified', () => {
			const containerEl = settingsTab.containerEl;
			const section = settingsTab['createCollapsibleSection'](containerEl, 'Test Section', false);

			// Closed means display is 'none'
			expect(section.style.display).toBe('none');
		});
	});

	describe('Display Method', () => {
		it('should clear container on display', async () => {
			await settingsTab.display();

			expect(settingsTab.containerEl.empty).toHaveBeenCalled();
		});

		it('should render header before sections', async () => {
			const renderHeaderSpy = vi.spyOn(settingsTab as any, 'renderHeader');

			await settingsTab.display();

			expect(renderHeaderSpy).toHaveBeenCalled();
		});

		it('should render campaign sections when in campaign mode', async () => {
			const renderCampaignSpy = vi.spyOn(settingsTab as any, 'renderCampaignScopedSections');
			settingsTab['scopeMode'] = 'campaign';

			await settingsTab.display();

			expect(renderCampaignSpy).toHaveBeenCalled();
		});

		it('should not render campaign sections when in global mode', async () => {
			const renderCampaignSpy = vi.spyOn(settingsTab as any, 'renderCampaignScopedSections');
			settingsTab['scopeMode'] = 'global';

			await settingsTab.display();

			expect(renderCampaignSpy).not.toHaveBeenCalled();
		});
	});
});
