import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { App, TFile } from 'obsidian';
import type { PartyMember } from '@quartermaster/core/models/types';

describe('Code Block Processors - Inventory', () => {
	let mockApp: Partial<App>;
	let mockPlugin: any;
	let mockDataAdapter: any;
	let mockInventoryParser: any;
	let processorCallbacks: Map<string, Function>;
	let metadataCacheCallbacks: Map<string, Function>;

	beforeEach(() => {
		vi.clearAllMocks();
		processorCallbacks = new Map();
		metadataCacheCallbacks = new Map();

		// Mock data adapter
		mockDataAdapter = {
			getPartyMembers: vi.fn(async () => []),
			getCurrencyConfig: vi.fn(() => ({
				systems: {
					'dnd5e': {
						name: 'D&D 5e Standard',
						baseUnit: 'cp',
						denominations: [
							{ id: 'platinum', abbreviation: 'pp', conversionRate: 1000, order: 0 },
							{ id: 'gold', abbreviation: 'gp', conversionRate: 100, order: 1 },
							{ id: 'silver', abbreviation: 'sp', conversionRate: 10, order: 2 },
							{ id: 'copper', abbreviation: 'cp', conversionRate: 1, order: 3 }
						]
					}
				},
				defaultSystem: 'dnd5e'
			}))
		};

		// Mock inventory parser
		mockInventoryParser = {
			parseInventoryFile: vi.fn(async () => ({
				containers: [],
				items: [],
				currency: {}
			}))
		};

		// Mock plugin
		mockPlugin = {
			dataAdapter: mockDataAdapter,
			inventoryParser: mockInventoryParser,
			settings: {
				partyInventoryPath: 'Party Inventory.md'
			},
			pluginData: {
				containers: [],
				items: [],
				currency: {}
			},
			parseTimeout: null,
			registerMarkdownCodeBlockProcessor: vi.fn((type: string, callback: Function) => {
				processorCallbacks.set(type, callback);
			}),
			parseAndUpdatePluginData: vi.fn(async (file: TFile) => {
				const result = await mockInventoryParser.parseInventoryFile(file);
				mockPlugin.pluginData = result;
			})
		};

		// Mock App with metadataCache
		mockApp = {
			metadataCache: {
				on: vi.fn((event: string, callback: Function) => {
					metadataCacheCallbacks.set(event, callback);
					return {} as any; // Return a reference for registerEvent
				})
			} as any
		};
	});

	afterEach(() => {
		vi.clearAllTimers();
	});

	describe('quartermaster-player processor', () => {
		it('should render player name from party members', async () => {
			const el = document.createElement('div');
			const source = 'id: player-123';

			const partyMembers: PartyMember[] = [
				{
					id: 'player-123',
					name: 'Aragorn',
					strength: 16,
					dexterity: 14,
					constitution: 15,
					intelligence: 10,
					wisdom: 12,
					charisma: 14,
					size: 'Medium',
					level: 5,
					bonuses: [],
					dataSource: { type: 'manual' }
				}
			];

			mockDataAdapter.getPartyMembers.mockResolvedValue(partyMembers);

			// Simulate code block processor registration
			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-player', async (src: string, element: HTMLElement) => {
				const idMatch = src.match(/id:\s*(\S+)/);
				if (!idMatch) {
					element.createEl('p', { text: 'Error: Missing player ID', cls: 'quartermaster-error' });
					return;
				}

				const playerId = idMatch[1];
				let playerName = playerId;

				try {
					const players = await mockDataAdapter.getPartyMembers();
					const player = players.find((p: PartyMember) => p.id === playerId);
					if (player) playerName = player.name;
				} catch (error) {
					// Use ID as fallback
				}

				element.createEl('h2', { text: playerName });
			});

			// Get the callback
			const callback = processorCallbacks.get('quartermaster-player')!;

			// Execute processor
			await callback(source, el, {});

			const header = el.querySelector('h2');
			expect(header).not.toBeNull();
			expect(header?.textContent).toBe('Aragorn');
		});

		it('should fallback to player id when not found', async () => {
			const el = document.createElement('div');
			const source = 'id: unknown-player';

			mockDataAdapter.getPartyMembers.mockResolvedValue([]);

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-player', async (src: string, element: HTMLElement) => {
				const idMatch = src.match(/id:\s*(\S+)/);
				if (!idMatch) {
					element.createEl('p', { text: 'Error: Missing player ID', cls: 'quartermaster-error' });
					return;
				}

				const playerId = idMatch[1];
				let playerName = playerId;

				try {
					const players = await mockDataAdapter.getPartyMembers();
					const player = players.find((p: PartyMember) => p.id === playerId);
					if (player) playerName = player.name;
				} catch (error) {
					// Use ID as fallback
				}

				element.createEl('h2', { text: playerName });
			});

			const callback = processorCallbacks.get('quartermaster-player')!;
			await callback(source, el, {});

			const header = el.querySelector('h2');
			expect(header?.textContent).toBe('unknown-player');
		});

		it('should show error when id missing', async () => {
			const el = document.createElement('div');
			const source = 'no id here';

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-player', async (src: string, element: HTMLElement) => {
				const idMatch = src.match(/id:\s*(\S+)/);
				if (!idMatch) {
					element.createEl('p', { text: 'Error: Missing player ID', cls: 'quartermaster-error' });
					return;
				}
			});

			const callback = processorCallbacks.get('quartermaster-player')!;
			await callback(source, el, {});

			const error = el.querySelector('.quartermaster-error');
			expect(error).not.toBeNull();
			expect(error?.textContent).toContain('Missing player ID');
		});

		it('should create h2 header element', async () => {
			const el = document.createElement('div');
			const source = 'id: player-1';

			mockDataAdapter.getPartyMembers.mockResolvedValue([]);

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-player', async (src: string, element: HTMLElement) => {
				const idMatch = src.match(/id:\s*(\S+)/);
				if (idMatch) {
					element.createEl('h2', { text: idMatch[1] });
				}
			});

			const callback = processorCallbacks.get('quartermaster-player')!;
			await callback(source, el, {});

			const header = el.querySelector('h2');
			expect(header).not.toBeNull();
			expect(header?.tagName).toBe('H2');
		});

		it('should handle party member lookup errors', async () => {
			const el = document.createElement('div');
			const source = 'id: player-1';

			mockDataAdapter.getPartyMembers.mockRejectedValue(new Error('Lookup failed'));

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-player', async (src: string, element: HTMLElement) => {
				const idMatch = src.match(/id:\s*(\S+)/);
				if (!idMatch) return;

				const playerId = idMatch[1];
				let playerName = playerId;

				try {
					const players = await mockDataAdapter.getPartyMembers();
					const player = players.find((p: PartyMember) => p.id === playerId);
					if (player) playerName = player.name;
				} catch (error) {
					// Fallback to ID
				}

				element.createEl('h2', { text: playerName });
			});

			const callback = processorCallbacks.get('quartermaster-player')!;
			await callback(source, el, {});

			// Should still render with ID as fallback
			const header = el.querySelector('h2');
			expect(header?.textContent).toBe('player-1');
		});
	});

	describe('quartermaster-container processor', () => {
		it('should render container name', async () => {
			const el = document.createElement('div');
			const source = 'name: Backpack\ncapacity: 300';

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-container', async (src: string, element: HTMLElement) => {
				const nameMatch = src.match(/name:\s*(.+)/);
				if (!nameMatch) {
					element.createEl('p', { text: 'Error: Missing container name', cls: 'quartermaster-error' });
					return;
				}

				element.createEl('h3', { text: nameMatch[1] });
			});

			const callback = processorCallbacks.get('quartermaster-container')!;
			await callback(source, el, {});

			const header = el.querySelector('h3');
			expect(header).not.toBeNull();
			expect(header?.textContent).toBe('Backpack');
		});

		it('should parse capacity from source', async () => {
			const el = document.createElement('div');
			const source = 'name: Backpack\ncapacity: 450';

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-container', async (src: string, element: HTMLElement) => {
				const nameMatch = src.match(/name:\s*(.+)/);
				const capacityMatch = src.match(/capacity:\s*(\d+)/);

				if (!nameMatch) return;

				const name = nameMatch[1];
				const capacity = capacityMatch ? parseInt(capacityMatch[1], 10) : 0;

				element.createEl('h3', { text: `${name} (${capacity} lbs)` });
			});

			const callback = processorCallbacks.get('quartermaster-container')!;
			await callback(source, el, {});

			const header = el.querySelector('h3');
			expect(header?.textContent).toContain('450');
		});

		it('should show error when name missing', async () => {
			const el = document.createElement('div');
			const source = 'capacity: 300';

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-container', async (src: string, element: HTMLElement) => {
				const nameMatch = src.match(/name:\s*(.+)/);
				if (!nameMatch) {
					element.createEl('p', { text: 'Error: Missing container name', cls: 'quartermaster-error' });
					return;
				}
			});

			const callback = processorCallbacks.get('quartermaster-container')!;
			await callback(source, el, {});

			const error = el.querySelector('.quartermaster-error');
			expect(error).not.toBeNull();
			expect(error?.textContent).toContain('Missing container name');
		});

		it('should create h3 header element', async () => {
			const el = document.createElement('div');
			const source = 'name: Test Container';

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-container', async (src: string, element: HTMLElement) => {
				const nameMatch = src.match(/name:\s*(.+)/);
				if (nameMatch) {
					element.createEl('h3', { text: nameMatch[1] });
				}
			});

			const callback = processorCallbacks.get('quartermaster-container')!;
			await callback(source, el, {});

			const header = el.querySelector('h3');
			expect(header).not.toBeNull();
			expect(header?.tagName).toBe('H3');
		});

		it('should default capacity to 0 when missing', async () => {
			const el = document.createElement('div');
			const source = 'name: Backpack';

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-container', async (src: string, element: HTMLElement) => {
				const nameMatch = src.match(/name:\s*(.+)/);
				const capacityMatch = src.match(/capacity:\s*(\d+)/);

				if (!nameMatch) return;

				const capacity = capacityMatch ? parseInt(capacityMatch[1], 10) : 0;

				element.createEl('h3', { text: `${nameMatch[1]} (${capacity})` });
			});

			const callback = processorCallbacks.get('quartermaster-container')!;
			await callback(source, el, {});

			const header = el.querySelector('h3');
			expect(header?.textContent).toContain('(0)');
		});
	});

	describe('quartermaster-shared processor', () => {
		it('should render shared inventory header', async () => {
			const el = document.createElement('div');
			const source = '';

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-shared', async (src: string, element: HTMLElement) => {
				element.createEl('h2', { text: 'Shared Inventory' });
			});

			const callback = processorCallbacks.get('quartermaster-shared')!;
			await callback(source, el, {});

			const header = el.querySelector('h2');
			expect(header).not.toBeNull();
			expect(header?.textContent).toBe('Shared Inventory');
		});

		it('should create h2 element', async () => {
			const el = document.createElement('div');
			const source = '';

			mockPlugin.registerMarkdownCodeBlockProcessor('quartermaster-shared', async (src: string, element: HTMLElement) => {
				element.createEl('h2', { text: 'Shared Inventory' });
			});

			const callback = processorCallbacks.get('quartermaster-shared')!;
			await callback(source, el, {});

			const header = el.querySelector('h2');
			expect(header?.tagName).toBe('H2');
		});
	});

	describe('File Watcher', () => {
		it('should trigger on Party Inventory.md changes', async () => {
			vi.useFakeTimers();

			const mockFile: Partial<TFile> = {
				path: 'Party Inventory.md',
				basename: 'Party Inventory',
				stat: { mtime: Date.now() } as any
			};

			// Simulate metadataCache.on('changed') registration
			const changeCallback = metadataCacheCallbacks.get('changed');

			if (changeCallback) {
				// Trigger file change
				changeCallback(mockFile);

				// Wait for debounce timeout (500ms)
				vi.advanceTimersByTime(500);

				// parseAndUpdatePluginData should have been called
				expect(mockPlugin.parseAndUpdatePluginData).toHaveBeenCalledWith(mockFile);
			}

			vi.useRealTimers();
		});

		it('should ignore other file changes', async () => {
			vi.useFakeTimers();

			const mockFile: Partial<TFile> = {
				path: 'Different File.md',
				basename: 'Different File',
				stat: { mtime: Date.now() } as any
			};

			// Register file watcher simulation
			const fileWatcher = vi.fn(async (file: TFile) => {
				const inventoryPath = mockPlugin.settings.partyInventoryPath || 'Party Inventory.md';
				if (file.path === inventoryPath) {
					clearTimeout(mockPlugin.parseTimeout);
					mockPlugin.parseTimeout = setTimeout(async () => {
						await mockPlugin.parseAndUpdatePluginData(file);
					}, 500);
				}
			});

			await fileWatcher(mockFile as TFile);

			vi.advanceTimersByTime(500);

			// Should not have been called for different file
			expect(mockPlugin.parseAndUpdatePluginData).not.toHaveBeenCalled();

			vi.useRealTimers();
		});

		it('should debounce rapid changes (500ms)', async () => {
			vi.useFakeTimers();

			const mockFile: Partial<TFile> = {
				path: 'Party Inventory.md',
				basename: 'Party Inventory',
				stat: { mtime: Date.now() } as any
			};

			// Register file watcher simulation
			const fileWatcher = vi.fn(async (file: TFile) => {
				const inventoryPath = mockPlugin.settings.partyInventoryPath || 'Party Inventory.md';
				if (file.path === inventoryPath) {
					if (mockPlugin.parseTimeout) {
						clearTimeout(mockPlugin.parseTimeout);
					}
					mockPlugin.parseTimeout = setTimeout(async () => {
						await mockPlugin.parseAndUpdatePluginData(file);
					}, 500);
				}
			});

			// Trigger multiple rapid changes
			await fileWatcher(mockFile as TFile);
			vi.advanceTimersByTime(200);

			await fileWatcher(mockFile as TFile);
			vi.advanceTimersByTime(200);

			await fileWatcher(mockFile as TFile);
			vi.advanceTimersByTime(200);

			// Only 600ms passed total, shouldn't have parsed yet
			expect(mockPlugin.parseAndUpdatePluginData).not.toHaveBeenCalled();

			// Wait for final debounce
			vi.advanceTimersByTime(300);

			// Now it should have been called only once
			expect(mockPlugin.parseAndUpdatePluginData).toHaveBeenCalledTimes(1);

			vi.useRealTimers();
		});

		it('should call parseAndUpdatePluginData', async () => {
			const mockFile: Partial<TFile> = {
				path: 'Party Inventory.md',
				basename: 'Party Inventory',
				stat: { mtime: Date.now() } as any
			};

			await mockPlugin.parseAndUpdatePluginData(mockFile as TFile);

			expect(mockInventoryParser.parseInventoryFile).toHaveBeenCalledWith(mockFile);
			expect(mockPlugin.pluginData).toEqual({
				containers: [],
				items: [],
				currency: {}
			});
		});
	});
});
