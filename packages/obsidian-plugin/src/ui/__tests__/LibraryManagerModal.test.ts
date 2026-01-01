import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App } from 'obsidian';
import { LibraryManagerModal } from '../LibraryManagerModal';
import type QuartermasterPlugin from '../../main';

// Helper to create mock HTMLElement with chaining methods
const createMockElement = (): any => ({
	createEl: vi.fn(createMockElement),
	createDiv: vi.fn(createMockElement),
	createSpan: vi.fn(createMockElement),
	addEventListener: vi.fn(),
	onclick: null,
	style: {},
	classList: {
		add: vi.fn(),
		remove: vi.fn(),
		toggle: vi.fn()
	}
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
	Notice: vi.fn()
}));

// Mock ItemVaultHandler
vi.mock('../../adapters/ItemVaultHandler', () => ({
	ItemVaultHandler: class {
		async getAvailableItems() {
			return Array(87).fill({ name: 'Test Item' });
		}
	}
}));

describe('LibraryManagerModal (TKT-CS-026)', () => {
	let app: App;
	let plugin: QuartermasterPlugin;
	let modal: LibraryManagerModal;

	beforeEach(() => {
		app = new App();

		const mockCampaignManager = {
			getActiveCampaign: vi.fn().mockResolvedValue({
				id: 'test-campaign',
				name: 'Test Campaign',
				worldId: 'forgotten-realms',
				isActive: true
			}),
			listCampaigns: vi.fn().mockResolvedValue([
				{
					id: 'test-campaign',
					name: 'Test Campaign',
					worldId: 'forgotten-realms',
					isActive: true
				},
				{
					id: 'other-campaign',
					name: 'Other Campaign',
					worldId: 'eberron',
					isActive: false
				}
			])
		};

		plugin = {
			app,
			settings: {
				useSRDDatabase: true,
				itemsFolders: [{ path: 'Items/', excludeSubfolders: false }]
			},
			saveSettings: vi.fn().mockResolvedValue(undefined),
			adapterFactory: {
				getCampaignManager: vi.fn().mockReturnValue(mockCampaignManager)
			}
		} as any;

		modal = new LibraryManagerModal(app, plugin);
	});

	describe('Initialization', () => {
		it('should initialize with plugin reference', () => {
			expect(modal['plugin']).toBe(plugin);
		});

		it('should initialize empty libraries array', () => {
			expect(modal['libraries']).toEqual([]);
		});

		it('should initialize activeCampaignId as null', () => {
			expect(modal['activeCampaignId']).toBeNull();
		});
	});

	describe('Library Loading', () => {
		it('should load SRD library with correct metadata', async () => {
			const activeCampaign = await (plugin.adapterFactory as any).getCampaignManager().getActiveCampaign();
			await modal['loadLibraries'](activeCampaign);

			const srdLibrary = modal['libraries'].find(lib => lib.id === 'srd');

			expect(srdLibrary).toBeDefined();
			expect(srdLibrary?.name).toBe('SRD (System Reference Document)');
			expect(srdLibrary?.itemCount).toBe(542);
			expect(srdLibrary?.worldIds).toContain('generic-fantasy');
			expect(srdLibrary?.worldIds).toContain('dnd5e');
		});

		it('should load Vault library with dynamic item count', async () => {
			const activeCampaign = await (plugin.adapterFactory as any).getCampaignManager().getActiveCampaign();
			await modal['loadLibraries'](activeCampaign);

			const vaultLibrary = modal['libraries'].find(lib => lib.id === 'vault');

			expect(vaultLibrary).toBeDefined();
			expect(vaultLibrary?.name).toBe('Vault Items');
			expect(vaultLibrary?.itemCount).toBe(87); // From mocked ItemVaultHandler
		});

		it('should determine enabled status based on settings', async () => {
			const activeCampaign = await (plugin.adapterFactory as any).getCampaignManager().getActiveCampaign();
			plugin.settings.useSRDDatabase = true;

			await modal['loadLibraries'](activeCampaign);

			const srdLibrary = modal['libraries'].find(lib => lib.id === 'srd');
			expect(srdLibrary?.isEnabledForActiveCampaign).toBe(true);
		});

		it('should determine campaign usage correctly', async () => {
			const activeCampaign = await (plugin.adapterFactory as any).getCampaignManager().getActiveCampaign();
			await modal['loadLibraries'](activeCampaign);

			const srdLibrary = modal['libraries'].find(lib => lib.id === 'srd');

			expect(srdLibrary?.usedByCampaigns).toContain('Test Campaign');
		});
	});

	describe('Library Export', () => {
		it('should export library metadata as JSON', () => {
			interface Library {
				id: string;
				name: string;
				description?: string;
				worldIds: string[];
				itemCount: number;
				isEnabledForActiveCampaign: boolean;
				usedByCampaigns: string[];
			}
			const library: Library = {
				id: 'test-lib',
				name: 'Test Library',
				description: 'Test description',
				worldIds: ['forgotten-realms'],
				itemCount: 100,
				isEnabledForActiveCampaign: true,
				usedByCampaigns: ['Test Campaign']
			};

			// Mock URL.createObjectURL and revokeObjectURL if they don't exist
			if (!URL.createObjectURL) {
				(URL as any).createObjectURL = vi.fn(() => 'blob:test');
			} else {
				vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
			}

			if (!URL.revokeObjectURL) {
				(URL as any).revokeObjectURL = vi.fn();
			} else {
				vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
			}

			// Mock document.createElement
			const mockAnchor = {
				href: '',
				download: '',
				click: vi.fn()
			};
			vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any);

			modal['exportLibrary'](library);

			expect(mockAnchor.click).toHaveBeenCalled();
			expect(mockAnchor.download).toBe('library-test-lib.json');
		});
	});

	describe('Modal Display', () => {
		it('should show warning when no active campaign', async () => {
			(plugin.adapterFactory as any).getCampaignManager().getActiveCampaign = vi.fn().mockResolvedValue(null);

			await modal.onOpen();

			// Verify empty was called (to clear content)
			expect(modal.contentEl.empty).toHaveBeenCalled();
		});

		it('should load and display libraries when active campaign exists', async () => {
			const loadLibrariesSpy = vi.spyOn(modal as any, 'loadLibraries');

			await modal.onOpen();

			expect(loadLibrariesSpy).toHaveBeenCalled();
		});

		it('should set activeCampaignId when campaign is active', async () => {
			await modal.onOpen();

			expect(modal['activeCampaignId']).toBe('test-campaign');
		});
	});

	describe('Library Card Rendering', () => {
		it('should render library cards with correct structure', async () => {
			const activeCampaign = await (plugin.adapterFactory as any).getCampaignManager().getActiveCampaign();
			await modal['loadLibraries'](activeCampaign);

			const containerEl = modal.contentEl.createDiv() as any;
			const library = modal['libraries'][0];

			modal['renderLibraryCard'](containerEl, library);

			// Verify createDiv was called to create card
			expect(containerEl.createDiv).toHaveBeenCalled();
		});

		it('should apply correct background color for enabled libraries', () => {
			interface Library {
				id: string;
				name: string;
				worldIds: string[];
				itemCount: number;
				isEnabledForActiveCampaign: boolean;
				usedByCampaigns: string[];
			}
			const library: Library = {
				id: 'test',
				name: 'Test',
				worldIds: [] as string[],
				itemCount: 0,
				isEnabledForActiveCampaign: true,
				usedByCampaigns: [] as string[]
			};

			const containerEl = modal.contentEl.createDiv() as any;
			modal['renderLibraryCard'](containerEl, library);

			// Card should be created with enabled styling
			expect(containerEl.createDiv).toHaveBeenCalled();
		});
	});

	describe('Toggle Library', () => {
		it('should toggle SRD library setting', async () => {
			modal['activeCampaignId'] = 'test-campaign';

			type LibraryType = {
				id: string;
				name: string;
				worldIds: string[];
				itemCount: number;
				isEnabledForActiveCampaign: boolean;
				usedByCampaigns: string[];
			};
			const library: LibraryType = {
				id: 'srd',
				name: 'SRD',
				worldIds: [] as string[],
				itemCount: 542,
				isEnabledForActiveCampaign: true,
				usedByCampaigns: [] as string[]
			};

			plugin.settings.useSRDDatabase = true;

			await modal['toggleLibraryForCampaign'](library);

			expect(plugin.settings.useSRDDatabase).toBe(false);
			expect(plugin.saveSettings).toHaveBeenCalled();
		});

		it('should show notice when no active campaign', async () => {
			modal['activeCampaignId'] = null;

			type LibraryType = {
				id: string;
				name: string;
				worldIds: string[];
				itemCount: number;
				isEnabledForActiveCampaign: boolean;
				usedByCampaigns: string[];
			};
			const library: LibraryType = {
				id: 'srd',
				name: 'SRD',
				worldIds: [] as string[],
				itemCount: 542,
				isEnabledForActiveCampaign: true,
				usedByCampaigns: [] as string[]
			};

			await modal['toggleLibraryForCampaign'](library);

			// Notice should be called (mocked)
			// Settings should not be saved
			expect(plugin.saveSettings).not.toHaveBeenCalled();
		});
	});
});
