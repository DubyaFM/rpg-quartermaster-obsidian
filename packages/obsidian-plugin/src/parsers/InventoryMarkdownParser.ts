import { App, TFile, MetadataCache } from 'obsidian';
import { InventoryContainer, InventoryItem, ItemCost } from '@quartermaster/core/models/types';
import { CurrencyManager } from '@quartermaster/core/services/CurrencyManager';

/**
 * InventoryMarkdownParser - Parses Party Inventory markdown files
 *
 * Extracts containers, items, and currency data from markdown files
 * formatted with quartermaster code blocks.
 */
export class InventoryMarkdownParser {
    private app: App;
    private currencyManager: CurrencyManager;

    constructor(app: App, currencyManager: CurrencyManager) {
        this.app = app;
        this.currencyManager = currencyManager;
    }

    /**
     * Parse entire inventory file
     * Returns { containers, items, currency }
     */
    async parseInventoryFile(file: TFile): Promise<{
        containers: InventoryContainer[];
        items: InventoryItem[];
        currency: { [playerId: string]: ItemCost };
    }> {
        // Read file content
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        const containers: InventoryContainer[] = [];
        const items: InventoryItem[] = [];
        const currency: { [playerId: string]: ItemCost } = {};

        let currentPlayerId: string | null = null;
        let currentContainerId: string | null = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Detect player block
            if (line.startsWith('```quartermaster-player')) {
                const id = this.extractProperty(lines, i, 'id');
                if (id) currentPlayerId = id;
                continue;
            }

            // Detect container block
            if (line.startsWith('```quartermaster-container')) {
                const container = this.parseContainer(lines, i);
                if (container) {
                    containers.push(container);
                    currentContainerId = container.id;
                }
                continue;
            }

            // Detect shared block
            if (line.startsWith('```quartermaster-shared')) {
                currentPlayerId = 'shared';
                currentContainerId = 'shared';
                continue;
            }

            // Parse currency section
            if (line === '**Currency:**' && currentPlayerId) {
                currency[currentPlayerId] = this.parseCurrency(lines, i + 1);
                continue;
            }

            // Parse item
            if (line.startsWith('- [[') && currentContainerId) {
                const item = await this.parseItem(lines, i, currentContainerId);
                if (item) items.push(item);
            }
        }

        return { containers, items, currency };
    }

    /**
     * Extract property from code block (e.g., id: uuid)
     */
    private extractProperty(lines: string[], blockIdx: number, key: string): string | null {
        // Look for "key: value" in lines after blockIdx until closing ```
        for (let i = blockIdx + 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '```') break;
            if (line.startsWith(`${key}:`)) {
                return line.substring(key.length + 1).trim();
            }
        }
        return null;
    }

    /**
     * Parse container code block
     */
    private parseContainer(lines: string[], startIdx: number): InventoryContainer | null {
        const id = this.extractProperty(lines, startIdx, 'id');
        const name = this.extractProperty(lines, startIdx, 'name');
        const ownerId = this.extractProperty(lines, startIdx, 'owner');
        const capacity = this.extractProperty(lines, startIdx, 'capacity');

        if (!id || !name) return null;

        return {
            id,
            name,
            type: 'item' as any, // Default type
            maxCapacity: capacity ? parseInt(capacity, 10) : 0,
            currentWeight: 0, // Calculated later
            weightMultiplier: 1.0,
            ownerId: ownerId || undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    /**
     * Parse item from markdown line
     */
    private async parseItem(lines: string[], lineIdx: number, containerId: string): Promise<InventoryItem | null> {
        const line = lines[lineIdx].trim();

        // Extract [[Item Name]]
        const match = line.match(/\[\[([^\]]+)\]\]/);
        if (!match) return null;

        const itemId = match[1];

        // Check for property overrides (indented bullets)
        let quantity = 1;
        let weight = 0;

        // Look ahead for indented properties
        for (let i = lineIdx + 1; i < lines.length; i++) {
            const nextLine = lines[i];
            if (!nextLine.startsWith('  - ')) break; // Stop at non-indented

            const propMatch = nextLine.match(/- (quantity|weight):\s*(\d+)/);
            if (propMatch) {
                const [, prop, value] = propMatch;
                if (prop === 'quantity') quantity = parseInt(value, 10);
                if (prop === 'weight') weight = parseInt(value, 10);
            }
        }

        // If no weight override, lookup from item file
        if (weight === 0) {
            weight = await this.lookupItemWeight(itemId);
        }

        return {
            id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate UUID
            itemId,
            containerId,
            quantity,
            weight,
            acquiredAt: new Date().toISOString()
        };
    }

    /**
     * Parse currency section
     */
    private parseCurrency(lines: string[], startIdx: number): ItemCost {
        const currency = this.currencyManager.createZeroedCost();

        // Map full denomination names to abbreviation keys
        const denominationMap: Record<string, keyof ItemCost> = {
            'platinum': 'pp',
            'gold': 'gp',
            'silver': 'sp',
            'copper': 'cp'
        };

        for (let i = startIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line.startsWith('- ')) break; // End of currency section

            const match = line.match(/- (\w+):\s*(\d+)/);
            if (match) {
                const [, denom, amount] = match;
                const key = denominationMap[denom.toLowerCase()];
                if (key) {
                    currency[key] = parseInt(amount, 10);
                }
            }
        }

        return currency;
    }

    /**
     * Lookup item weight from vault file frontmatter
     */
    private async lookupItemWeight(itemId: string): Promise<number> {
        // Search for file with matching name
        const files = this.app.vault.getMarkdownFiles();
        const file = files.find(f => f.basename === itemId);

        if (!file) return 0; // Default weight if not found

        // Get cached frontmatter
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter;

        if (frontmatter?.weight) {
            return typeof frontmatter.weight === 'number' ? frontmatter.weight : parseFloat(frontmatter.weight);
        }

        return 0;
    }
}
