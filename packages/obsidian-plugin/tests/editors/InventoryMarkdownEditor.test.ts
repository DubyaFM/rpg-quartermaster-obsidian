import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InventoryMarkdownEditor } from '../../src/editors/InventoryMarkdownEditor';
import type { App, TFile } from 'obsidian';
import { CurrencyManager } from '@quartermaster/core/services/CurrencyManager';
import type { InventoryContainer, InventoryItem, ItemCost } from '@quartermaster/core/models/types';

describe('InventoryMarkdownEditor', () => {
	let editor: InventoryMarkdownEditor;
	let mockApp: Partial<App>;
	let mockCurrencyManager: Partial<CurrencyManager>;
	let mockFile: Partial<TFile>;
	let fileContent: string;
	let fileMtime: number;

	const basicInventory = `# Party Inventory

\`\`\`quartermaster-player
id: player-1
\`\`\`

**Currency:**
- Gold: 50
- Silver: 20

\`\`\`quartermaster-container
id: container-1
owner: player-1
name: Backpack
capacity: 300
\`\`\`

- [[Rope]]
`;

	beforeEach(() => {
		vi.clearAllMocks();
		fileMtime = Date.now();
		fileContent = basicInventory;

		// Mock CurrencyManager
		mockCurrencyManager = {
			getSortedDenominations: vi.fn(() => [
				{ id: 'platinum', abbreviation: 'pp', conversionRate: 1000, order: 0 },
				{ id: 'gold', abbreviation: 'gp', conversionRate: 100, order: 1 },
				{ id: 'silver', abbreviation: 'sp', conversionRate: 10, order: 2 },
				{ id: 'copper', abbreviation: 'cp', conversionRate: 1, order: 3 }
			])
		};

		// Mock TFile
		mockFile = {
			path: 'Party Inventory.md',
			basename: 'Party Inventory',
			extension: 'md',
			stat: {
				ctime: Date.now(),
				mtime: fileMtime,
				size: 1024
			} as any,
			vault: null as any,
			parent: null as any,
			name: 'Party Inventory.md'
		};

		// Mock App
		mockApp = {
			vault: {
				read: vi.fn(async (file: TFile) => fileContent),
				modify: vi.fn(async (file: TFile, data: string) => {
					fileContent = data;
				}),
				getAbstractFileByPath: vi.fn((path: string) => {
					// Return updated file with current mtime
					return {
						...mockFile,
						stat: { ...mockFile.stat, mtime: fileMtime }
					} as TFile;
				})
			} as any
		};

		editor = new InventoryMarkdownEditor(
			mockApp as App,
			mockCurrencyManager as CurrencyManager,
			'Party Inventory.md'
		);
	});

	describe('safeModifyFile', () => {
		it('should successfully modify file when mtime unchanged', async () => {
			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'Test Item',
				containerId: 'container-1',
				quantity: 1,
				weight: 5,
				acquiredAt: new Date().toISOString()
			};

			await editor.addItem('container-1', item);

			expect(mockApp.vault!.modify).toHaveBeenCalled();
			expect(fileContent).toContain('[[Test Item]]');
		});

		it('should throw error when file modified externally (race condition)', async () => {
			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'Test Item',
				containerId: 'container-1',
				quantity: 1,
				weight: 5,
				acquiredAt: new Date().toISOString()
			};

			// Simulate external modification by changing mtime during read
			(mockApp.vault!.read as any).mockImplementation(async () => {
				fileMtime = Date.now() + 1000; // Change mtime
				return fileContent;
			});

			await expect(
				editor.addItem('container-1', item)
			).rejects.toThrow('File was modified during edit');
		});

		it('should throw error when file not found', async () => {
			(mockApp.vault!.getAbstractFileByPath as any).mockReturnValue(null);

			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'Test Item',
				containerId: 'container-1',
				quantity: 1,
				weight: 5,
				acquiredAt: new Date().toISOString()
			};

			await expect(
				editor.addItem('container-1', item)
			).rejects.toThrow('Party inventory file not found');
		});

		it('should properly join lines with newlines', async () => {
			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'Test Item',
				containerId: 'container-1',
				quantity: 1,
				weight: 0,
				acquiredAt: new Date().toISOString()
			};

			await editor.addItem('container-1', item);

			// Check that file content has proper line breaks
			const lines = fileContent.split('\n');
			expect(lines.length).toBeGreaterThan(1);
		});
	});

	describe('addItem', () => {
		it('should add basic item to container', async () => {
			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'New Item',
				containerId: 'container-1',
				quantity: 1,
				weight: 0,
				acquiredAt: new Date().toISOString()
			};

			await editor.addItem('container-1', item);

			expect(fileContent).toContain('- [[New Item]]');
		});

		it('should add item with quantity property', async () => {
			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'Rations',
				containerId: 'container-1',
				quantity: 5,
				weight: 0,
				acquiredAt: new Date().toISOString()
			};

			await editor.addItem('container-1', item);

			expect(fileContent).toContain('- [[Rations]]');
			expect(fileContent).toContain('  - quantity: 5');
		});

		it('should add item with weight property', async () => {
			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'Heavy Rock',
				containerId: 'container-1',
				quantity: 1,
				weight: 50,
				acquiredAt: new Date().toISOString()
			};

			await editor.addItem('container-1', item);

			expect(fileContent).toContain('- [[Heavy Rock]]');
			expect(fileContent).toContain('  - weight: 50');
		});

		it('should add item with both quantity and weight', async () => {
			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'Custom Item',
				containerId: 'container-1',
				quantity: 3,
				weight: 15,
				acquiredAt: new Date().toISOString()
			};

			await editor.addItem('container-1', item);

			expect(fileContent).toContain('- [[Custom Item]]');
			expect(fileContent).toContain('  - quantity: 3');
			expect(fileContent).toContain('  - weight: 15');
		});

		it('should throw error when container not found', async () => {
			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'Test Item',
				containerId: 'nonexistent-container',
				quantity: 1,
				weight: 0,
				acquiredAt: new Date().toISOString()
			};

			await expect(
				editor.addItem('nonexistent-container', item)
			).rejects.toThrow('Container nonexistent-container not found');
		});

		it('should insert item after container code block', async () => {
			fileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Existing Item]]
`;

			const item: InventoryItem = {
				id: 'item-1',
				itemId: 'New Item',
				containerId: 'container-1',
				quantity: 1,
				weight: 0,
				acquiredAt: new Date().toISOString()
			};

			await editor.addItem('container-1', item);

			const lines = fileContent.split('\n');
			const codeBlockEndIdx = lines.findIndex(line => line.trim() === '```' && lines[lines.indexOf(line) - 1].includes('capacity'));
			const newItemIdx = lines.findIndex(line => line.includes('[[New Item]]'));

			expect(newItemIdx).toBeGreaterThan(codeBlockEndIdx);
		});
	});

	describe('removeItem', () => {
		it('should remove item and properties', async () => {
			fileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Item to Remove]]
  - quantity: 5
  - weight: 10
- [[Keep This Item]]
`;

			await editor.removeItem('container-1', 'Item to Remove');

			expect(fileContent).not.toContain('[[Item to Remove]]');
			expect(fileContent).not.toContain('quantity: 5');
			expect(fileContent).not.toContain('weight: 10');
			expect(fileContent).toContain('[[Keep This Item]]');
		});

		it('should remove only target item from multiple items', async () => {
			fileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Item 1]]
- [[Item 2]]
- [[Item 3]]
`;

			await editor.removeItem('container-1', 'Item 2');

			expect(fileContent).toContain('[[Item 1]]');
			expect(fileContent).not.toContain('[[Item 2]]');
			expect(fileContent).toContain('[[Item 3]]');
		});

		it('should handle item not found gracefully', async () => {
			fileContent = basicInventory;

			// Should not throw, just do nothing
			await editor.removeItem('container-1', 'Nonexistent Item');

			expect(fileContent).toBe(basicInventory);
		});

		it('should remove all indented properties after item', async () => {
			fileContent = `# Party Inventory

\`\`\`quartermaster-container
id: container-1
name: Backpack
capacity: 300
\`\`\`

- [[Complex Item]]
  - quantity: 5
  - weight: 10
  - custom: value
- [[Next Item]]
`;

			await editor.removeItem('container-1', 'Complex Item');

			expect(fileContent).not.toContain('[[Complex Item]]');
			expect(fileContent).not.toContain('quantity: 5');
			expect(fileContent).not.toContain('weight: 10');
			expect(fileContent).not.toContain('custom: value');
			expect(fileContent).toContain('[[Next Item]]');
		});
	});

	describe('updateCurrency', () => {
		it('should update all currency denominations', async () => {
			const newCurrency: ItemCost = {
				pp: 5,
				gp: 100,
				sp: 50,
				cp: 200
			};

			await editor.updateCurrency('player-1', newCurrency);

			expect(fileContent).toContain('Platinum: 5');
			expect(fileContent).toContain('Gold: 100');
			expect(fileContent).toContain('Silver: 50');
			expect(fileContent).toContain('Copper: 200');
		});

		it('should replace existing currency values', async () => {
			fileContent = `# Party Inventory

\`\`\`quartermaster-player
id: player-1
\`\`\`

**Currency:**
- Gold: 50
- Silver: 20
`;

			const newCurrency: ItemCost = {
				pp: 0,
				gp: 75,
				sp: 30,
				cp: 0
			};

			await editor.updateCurrency('player-1', newCurrency);

			expect(fileContent).not.toContain('Gold: 50');
			expect(fileContent).not.toContain('Silver: 20');
			expect(fileContent).toContain('Gold: 75');
			expect(fileContent).toContain('Silver: 30');
		});

		it('should format denomination names correctly', async () => {
			const newCurrency: ItemCost = {
				pp: 1,
				gp: 50,
				sp: 20,
				cp: 100
			};

			await editor.updateCurrency('player-1', newCurrency);

			// Should capitalize first letter
			expect(fileContent).toContain('- Platinum: 1');
			expect(fileContent).toContain('- Gold: 50');
			expect(fileContent).toContain('- Silver: 20');
			expect(fileContent).toContain('- Copper: 100');
		});

		it('should throw error when player not found', async () => {
			const newCurrency: ItemCost = {
				pp: 0,
				gp: 50,
				sp: 0,
				cp: 0
			};

			await expect(
				editor.updateCurrency('nonexistent-player', newCurrency)
			).rejects.toThrow('Player nonexistent-player not found');
		});

		it('should throw error when currency section missing', async () => {
			fileContent = `# Party Inventory

\`\`\`quartermaster-player
id: player-1
\`\`\`

No currency section here.
`;

			const newCurrency: ItemCost = {
				pp: 0,
				gp: 50,
				sp: 0,
				cp: 0
			};

			await expect(
				editor.updateCurrency('player-1', newCurrency)
			).rejects.toThrow('Currency section not found');
		});
	});

	describe('addPlayerBlock', () => {
		it('should append player block to end of file', async () => {
			fileContent = `# Party Inventory

Existing content.
`;

			await editor.addPlayerBlock('player-2', 'Player Two');

			expect(fileContent).toContain('```quartermaster-player');
			expect(fileContent).toContain('id: player-2');
			expect(fileContent).toContain('**Currency:**');
		});

		it('should initialize all denominations with zeros', async () => {
			await editor.addPlayerBlock('player-2', 'Player Two');

			expect(fileContent).toContain('Platinum: 0');
			expect(fileContent).toContain('Gold: 0');
			expect(fileContent).toContain('Silver: 0');
			expect(fileContent).toContain('Copper: 0');
		});

		it('should use sorted denominations from CurrencyManager', async () => {
			await editor.addPlayerBlock('player-2', 'Player Two');

			const lines = fileContent.split('\n');
			const currencyStartIdx = lines.findIndex(line => line.includes('**Currency:**'));

			// Check order: Platinum, Gold, Silver, Copper
			const platinumIdx = lines.findIndex((line, idx) => idx > currencyStartIdx && line.includes('Platinum'));
			const goldIdx = lines.findIndex((line, idx) => idx > currencyStartIdx && line.includes('Gold'));
			const silverIdx = lines.findIndex((line, idx) => idx > currencyStartIdx && line.includes('Silver'));
			const copperIdx = lines.findIndex((line, idx) => idx > currencyStartIdx && line.includes('Copper'));

			expect(platinumIdx).toBeLessThan(goldIdx);
			expect(goldIdx).toBeLessThan(silverIdx);
			expect(silverIdx).toBeLessThan(copperIdx);
		});
	});

	describe('addContainerBlock', () => {
		it('should add container with owner', async () => {
			const container: InventoryContainer = {
				id: 'container-2',
				name: 'Sack',
				type: 'item',
				maxCapacity: 150,
				currentWeight: 0,
				weightMultiplier: 1.0,
				ownerId: 'player-1',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			await editor.addContainerBlock(container);

			expect(fileContent).toContain('```quartermaster-container');
			expect(fileContent).toContain('id: container-2');
			expect(fileContent).toContain('owner: player-1');
			expect(fileContent).toContain('name: Sack');
			expect(fileContent).toContain('capacity: 150');
		});

		it('should add container without owner (shared)', async () => {
			const container: InventoryContainer = {
				id: 'container-shared',
				name: 'Shared Chest',
				type: 'item',
				maxCapacity: 500,
				currentWeight: 0,
				weightMultiplier: 1.0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			await editor.addContainerBlock(container);

			expect(fileContent).toContain('```quartermaster-container');
			expect(fileContent).toContain('id: container-shared');
			expect(fileContent).not.toContain('owner:');
			expect(fileContent).toContain('name: Shared Chest');
			expect(fileContent).toContain('capacity: 500');
		});

		it('should insert container in correct owner section', async () => {
			fileContent = `# Party Inventory

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

			const container: InventoryContainer = {
				id: 'container-2',
				name: 'Backpack',
				type: 'item',
				maxCapacity: 300,
				currentWeight: 0,
				weightMultiplier: 1.0,
				ownerId: 'player-1',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			await editor.addContainerBlock(container);

			const lines = fileContent.split('\n');
			const player1Idx = lines.findIndex(line => line.includes('id: player-1'));
			const player2Idx = lines.findIndex(line => line.includes('id: player-2'));
			const containerIdx = lines.findIndex(line => line.includes('id: container-2'));

			// Container should be between player-1 and player-2
			expect(containerIdx).toBeGreaterThan(player1Idx);
			expect(containerIdx).toBeLessThan(player2Idx);
		});

		it('should create valid code block structure', async () => {
			const container: InventoryContainer = {
				id: 'test-container',
				name: 'Test Container',
				type: 'item',
				maxCapacity: 200,
				currentWeight: 0,
				weightMultiplier: 1.0,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};

			await editor.addContainerBlock(container);

			const lines = fileContent.split('\n');
			const startIdx = lines.findIndex(line => line.includes('```quartermaster-container'));
			const endIdx = lines.findIndex((line, idx) => idx > startIdx && line.trim() === '```');

			expect(startIdx).toBeGreaterThan(-1);
			expect(endIdx).toBeGreaterThan(startIdx);

			// Verify properties are between the code fences
			const containerBlock = lines.slice(startIdx, endIdx + 1).join('\n');
			expect(containerBlock).toContain('id: test-container');
			expect(containerBlock).toContain('name: Test Container');
			expect(containerBlock).toContain('capacity: 200');
		});
	});
});
