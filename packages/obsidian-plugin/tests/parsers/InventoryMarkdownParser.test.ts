import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryMarkdownParser } from '../../src/parsers/InventoryMarkdownParser';
import type { App, TFile, CachedMetadata } from 'obsidian';
import { CurrencyManager } from '@quartermaster/core/services/CurrencyManager';
import type { InventoryContainer, InventoryItem, ItemCost } from '@quartermaster/core/models/types';

describe('InventoryMarkdownParser', () => {
	let parser: InventoryMarkdownParser;
	let mockApp: Partial<App>;
	let mockCurrencyManager: Partial<CurrencyManager>;
	let mockFile: Partial<TFile>;
	let mockFileContent: string;

	beforeEach(() => {
		vi.clearAllMocks();

		// Mock CurrencyManager
		mockCurrencyManager = {
			createZeroedCost: vi.fn(() => ({
				pp: 0,
				gp: 0,
				sp: 0,
				cp: 0
			}))
		};

		// Mock TFile
		mockFile = {
			path: 'Party Inventory.md',
			basename: 'Party Inventory',
			extension: 'md',
			stat: {
				ctime: Date.now(),
				mtime: Date.now(),
				size: 1024
			} as any,
			vault: null as any,
			parent: null as any,
			name: 'Party Inventory.md'
		};

		// Mock App
		mockApp = {
			vault: {
				read: vi.fn(async (file: TFile) => mockFileContent),
				getMarkdownFiles: vi.fn(() => [])
			} as any,
			metadataCache: {
				getFileCache: vi.fn((file: TFile) => null)
			} as any
		};

		parser = new InventoryMarkdownParser(mockApp as App, mockCurrencyManager as CurrencyManager);
	});

	describe('parseInventoryFile', () => {
		it('should parse player blocks with valid id', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-player
id: player-123
\`\`\`

**Currency:**
- Gold: 50
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.currency).toHaveProperty('player-123');
			expect(result.currency['player-123']).toBeDefined();
		});

		it('should parse container blocks with all properties', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
owner: player-1
name: Backpack
capacity: 300
\`\`\`
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.containers).toHaveLength(1);
			expect(result.containers[0]).toMatchObject({
				id: 'container-1',
				name: 'Backpack',
				ownerId: 'player-1',
				maxCapacity: 300,
				type: 'item',
				weightMultiplier: 1.0
			});
		});

		it('should parse items with wiki links', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Rope, Hempen (50 feet)]]
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				itemId: 'Rope, Hempen (50 feet)',
				containerId: 'container-1',
				quantity: 1
			});
		});

		it('should handle property overrides (quantity, weight)', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Rations (1 day)]]
  - quantity: 5
  - weight: 2
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items).toHaveLength(1);
			expect(result.items[0]).toMatchObject({
				itemId: 'Rations (1 day)',
				quantity: 5,
				weight: 2
			});
		});

		it('should parse currency sections with multiple denominations', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-player
id: player-1
\`\`\`

**Currency:**
- Platinum: 1
- Gold: 50
- Silver: 20
- Copper: 100
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.currency['player-1']).toMatchObject({
				pp: 1,
				gp: 50,
				sp: 20,
				cp: 100
			});
		});

		it('should handle shared inventory blocks', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-shared
\`\`\`

- [[Tent]]
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items).toHaveLength(1);
			expect(result.items[0].containerId).toBe('shared');
		});

		it('should return empty arrays for empty file', async () => {
			mockFileContent = `# Party Inventory

This is an empty inventory file.
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.containers).toEqual([]);
			expect(result.items).toEqual([]);
			expect(result.currency).toEqual({});
		});

		it('should handle missing player id (skip block)', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-player
\`\`\`

**Currency:**
- Gold: 50
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			// Currency should not be parsed without player id
			expect(Object.keys(result.currency)).toHaveLength(0);
		});

		it('should handle missing container name (skip container)', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
capacity: 300
\`\`\`

- [[Item]]
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			// Container without name should be skipped
			expect(result.containers).toHaveLength(0);
			// Items should not be parsed without valid container
			expect(result.items).toHaveLength(0);
		});

		it('should lookup item weight from vault files', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Rope, Hempen (50 feet)]]
`;

			const mockItemFile = {
				basename: 'Rope, Hempen (50 feet)',
				path: 'Items/Rope, Hempen (50 feet).md'
			} as TFile;

			(mockApp.vault!.getMarkdownFiles as any).mockReturnValue([mockItemFile]);
			(mockApp.metadataCache!.getFileCache as any).mockReturnValue({
				frontmatter: { weight: 10 }
			});

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items[0].weight).toBe(10);
		});

		it('should default to weight 0 when item file not found', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Unknown Item]]
`;

			(mockApp.vault!.getMarkdownFiles as any).mockReturnValue([]);

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items[0].weight).toBe(0);
		});

		it('should handle multiple players with sequential blocks', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-player
id: player-1
\`\`\`

**Currency:**
- Gold: 50

\`\`\`quartermaster-player
id: player-2
\`\`\`

**Currency:**
- Gold: 30
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(Object.keys(result.currency)).toHaveLength(2);
			expect(result.currency['player-1'].gp).toBe(50);
			expect(result.currency['player-2'].gp).toBe(30);
		});

		it('should handle containers without owner (shared)', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Shared Chest
capacity: 500
\`\`\`
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.containers).toHaveLength(1);
			expect(result.containers[0].ownerId).toBeUndefined();
		});
	});

	describe('parseContainer', () => {
		it('should extract all container properties', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
owner: player-1
name: Backpack
capacity: 300
\`\`\`
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);
			const container = result.containers[0];

			expect(container.id).toBe('container-1');
			expect(container.name).toBe('Backpack');
			expect(container.ownerId).toBe('player-1');
			expect(container.maxCapacity).toBe(300);
			expect(container.type).toBe('item');
			expect(container.weightMultiplier).toBe(1.0);
			expect(container.currentWeight).toBe(0);
			expect(container.createdAt).toBeDefined();
			expect(container.updatedAt).toBeDefined();
		});

		it('should handle missing optional properties', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-2
name: Sack
\`\`\`
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);
			const container = result.containers[0];

			expect(container.ownerId).toBeUndefined();
			expect(container.maxCapacity).toBe(0);
		});

		it('should parse capacity as integer', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 450
\`\`\`
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.containers[0].maxCapacity).toBe(450);
			expect(typeof result.containers[0].maxCapacity).toBe('number');
		});

		it('should return null when missing required fields', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
owner: player-1
capacity: 300
\`\`\`

- [[Item]]
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			// Container without id and name should be skipped
			expect(result.containers).toHaveLength(0);
		});
	});

	describe('parseItem', () => {
		it('should extract item name from wiki link', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Rope, Hempen (50 feet)]]
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items[0].itemId).toBe('Rope, Hempen (50 feet)');
		});

		it('should parse quantity from indented property', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Rations]]
  - quantity: 5
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items[0].quantity).toBe(5);
		});

		it('should parse weight from indented property', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Heavy Rock]]
  - weight: 50
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items[0].weight).toBe(50);
		});

		it('should handle both quantity and weight properties', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Custom Item]]
  - quantity: 3
  - weight: 15
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items[0].quantity).toBe(3);
			expect(result.items[0].weight).toBe(15);
		});

		it('should generate unique item IDs', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Item 1]]
- [[Item 2]]
- [[Item 3]]
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items).toHaveLength(3);
			const ids = result.items.map(item => item.id);
			const uniqueIds = new Set(ids);
			expect(uniqueIds.size).toBe(3); // All IDs should be unique
		});

		it('should return null for malformed item lines', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- Not a wiki link
- [[Valid Item]]
- Another non-link
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			// Only the valid wiki link should be parsed
			expect(result.items).toHaveLength(1);
			expect(result.items[0].itemId).toBe('Valid Item');
		});
	});

	describe('parseCurrency', () => {
		it('should parse all currency denominations', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-player
id: player-1
\`\`\`

**Currency:**
- Platinum: 10
- Gold: 50
- Silver: 20
- Copper: 100
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.currency['player-1']).toMatchObject({
				pp: 10,
				gp: 50,
				sp: 20,
				cp: 100
			});
		});

		it('should ignore unknown denominations', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-player
id: player-1
\`\`\`

**Currency:**
- Gold: 50
- Unknown: 999
- Silver: 20
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.currency['player-1'].gp).toBe(50);
			expect(result.currency['player-1'].sp).toBe(20);
			// Unknown denomination should not cause errors
			expect(result.currency['player-1']).not.toHaveProperty('unknown');
		});

		it('should handle mixed case denomination names', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-player
id: player-1
\`\`\`

**Currency:**
- GOLD: 50
- silver: 20
- Copper: 100
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.currency['player-1'].gp).toBe(50);
			expect(result.currency['player-1'].sp).toBe(20);
			expect(result.currency['player-1'].cp).toBe(100);
		});

		it('should stop at non-currency lines', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-player
id: player-1
\`\`\`

**Currency:**
- Gold: 50
- Silver: 20

Some other content
- Not currency: 100
`;

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.currency['player-1'].gp).toBe(50);
			expect(result.currency['player-1'].sp).toBe(20);
		});
	});

	describe('lookupItemWeight', () => {
		it('should find item by basename', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Rope]]
`;

			const mockItemFile = {
				basename: 'Rope',
				path: 'Items/Rope.md'
			} as TFile;

			(mockApp.vault!.getMarkdownFiles as any).mockReturnValue([mockItemFile]);
			(mockApp.metadataCache!.getFileCache as any).mockReturnValue({
				frontmatter: { weight: 5 }
			});

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items[0].weight).toBe(5);
		});

		it('should extract weight from frontmatter', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Heavy Armor]]
`;

			const mockItemFile = {
				basename: 'Heavy Armor',
				path: 'Items/Heavy Armor.md'
			} as TFile;

			(mockApp.vault!.getMarkdownFiles as any).mockReturnValue([mockItemFile]);
			(mockApp.metadataCache!.getFileCache as any).mockReturnValue({
				frontmatter: { weight: 65 }
			});

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items[0].weight).toBe(65);
		});

		it('should return 0 when file not found', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Nonexistent Item]]
`;

			(mockApp.vault!.getMarkdownFiles as any).mockReturnValue([]);

			const result = await parser.parseInventoryFile(mockFile as TFile);

			expect(result.items[0].weight).toBe(0);
		});

		it('should handle non-numeric weight values', async () => {
			mockFileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Item with String Weight]]
`;

			const mockItemFile = {
				basename: 'Item with String Weight',
				path: 'Items/Item.md'
			} as TFile;

			(mockApp.vault!.getMarkdownFiles as any).mockReturnValue([mockItemFile]);
			(mockApp.metadataCache!.getFileCache as any).mockReturnValue({
				frontmatter: { weight: '12.5' }
			});

			const result = await parser.parseInventoryFile(mockFile as TFile);

			// Should parse string to float
			expect(result.items[0].weight).toBe(12.5);
		});
	});
});
