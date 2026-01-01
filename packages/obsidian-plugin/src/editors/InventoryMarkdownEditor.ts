import { App, TFile, Notice } from 'obsidian';
import { InventoryContainer, InventoryItem, ItemCost } from '@quartermaster/core/models/types';
import { CurrencyManager } from '@quartermaster/core/services/CurrencyManager';

export class InventoryMarkdownEditor {
    private app: App;
    private currencyManager: CurrencyManager;
    private partyInventoryPath: string;

    constructor(app: App, currencyManager: CurrencyManager, partyInventoryPath: string) {
        this.app = app;
        this.currencyManager = currencyManager;
        this.partyInventoryPath = partyInventoryPath;
    }

    /**
     * Safe file modification with race condition protection
     */
    private async safeModifyFile(modifyFn: (lines: string[]) => Promise<string[]> | string[]): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(this.partyInventoryPath);
        if (!(file instanceof TFile)) {
            throw new Error(`Party inventory file not found: ${this.partyInventoryPath}`);
        }

        // Check file mtime before read
        const beforeMtime = file.stat.mtime;

        // Read current content
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');

        // Apply modifications
        const modifiedLines = await modifyFn(lines);

        // Check mtime hasn't changed
        const currentFile = this.app.vault.getAbstractFileByPath(this.partyInventoryPath);
        if (currentFile instanceof TFile && currentFile.stat.mtime !== beforeMtime) {
            throw new Error('File was modified during edit - aborting to prevent data loss');
        }

        // Write back
        await this.app.vault.modify(file, modifiedLines.join('\n'));
    }

    /**
     * Add item to container
     */
    async addItem(containerId: string, item: InventoryItem): Promise<void> {
        await this.safeModifyFile(async (lines) => {
            // Find container block
            let containerIdx = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('```quartermaster-container')) {
                    const idLine = lines.slice(i, i + 5).find(l => l.includes('id:'));
                    if (idLine && idLine.includes(containerId)) {
                        containerIdx = i;
                        break;
                    }
                }
            }

            if (containerIdx === -1) {
                throw new Error(`Container ${containerId} not found in inventory`);
            }

            // Find end of code block
            let insertIdx = containerIdx;
            for (let i = containerIdx + 1; i < lines.length; i++) {
                if (lines[i].trim() === '```') {
                    insertIdx = i + 1;
                    break;
                }
            }

            // Insert item line
            const itemLine = `- [[${item.itemId}]]`;
            const newLines = [...lines];
            newLines.splice(insertIdx, 0, itemLine);

            // Add property overrides if needed
            if (item.quantity > 1) {
                newLines.splice(insertIdx + 1, 0, `  - quantity: ${item.quantity}`);
            }
            if (item.weight > 0) {
                newLines.splice(insertIdx + (item.quantity > 1 ? 2 : 1), 0, `  - weight: ${item.weight}`);
            }

            return newLines;
        });
    }

    /**
     * Remove item from container
     */
    async removeItem(containerId: string, itemId: string): Promise<void> {
        await this.safeModifyFile(async (lines) => {
            const newLines = [...lines];

            // Find the item line
            for (let i = 0; i < newLines.length; i++) {
                if (newLines[i].includes(`[[${itemId}]]`)) {
                    // Remove this line
                    newLines.splice(i, 1);

                    // Remove following property lines (indented with "  - ")
                    while (i < newLines.length && newLines[i].trim().startsWith('- ') && newLines[i].startsWith('  ')) {
                        newLines.splice(i, 1);
                    }
                    break;
                }
            }

            return newLines;
        });
    }

    /**
     * Update currency section for a player
     */
    async updateCurrency(playerId: string, currency: ItemCost): Promise<void> {
        await this.safeModifyFile(async (lines) => {
            const newLines = [...lines];

            // Find player block
            let playerIdx = -1;
            for (let i = 0; i < newLines.length; i++) {
                if (newLines[i].includes('```quartermaster-player')) {
                    const idLine = newLines.slice(i, i + 5).find(l => l.includes('id:'));
                    if (idLine && idLine.includes(playerId)) {
                        playerIdx = i;
                        break;
                    }
                }
            }

            if (playerIdx === -1) {
                throw new Error(`Player ${playerId} not found in inventory`);
            }

            // Find **Currency:** section
            let currencyIdx = -1;
            for (let i = playerIdx; i < newLines.length; i++) {
                if (newLines[i].trim() === '**Currency:**') {
                    currencyIdx = i;
                    break;
                }
                if (newLines[i].includes('```quartermaster-')) {
                    break; // Stop at next block
                }
            }

            if (currencyIdx === -1) {
                throw new Error(`Currency section not found for player ${playerId}`);
            }

            // Remove old currency lines
            let removeCount = 0;
            for (let i = currencyIdx + 1; i < newLines.length; i++) {
                if (newLines[i].trim().startsWith('- ')) {
                    removeCount++;
                } else {
                    break;
                }
            }
            newLines.splice(currencyIdx + 1, removeCount);

            // Add new currency lines
            const denoms = this.currencyManager.getSortedDenominations();
            const currencyLines: string[] = [];
            for (const denom of denoms) {
                const amount = (currency as any)[denom.abbreviation.replace('p', '')] || 0;
                const name = denom.id.charAt(0).toUpperCase() + denom.id.slice(1);
                currencyLines.push(`- ${name}: ${amount}`);
            }
            newLines.splice(currencyIdx + 1, 0, ...currencyLines);

            return newLines;
        });
    }

    /**
     * Add player block with auto-generated currency
     */
    async addPlayerBlock(playerId: string, playerName: string): Promise<void> {
        await this.safeModifyFile(async (lines) => {
            const newLines = [...lines];

            // Add at end
            newLines.push('');
            newLines.push('```quartermaster-player');
            newLines.push(`id: ${playerId}`);
            newLines.push('```');
            newLines.push('');
            newLines.push('**Currency:**');

            // Add all denominations with zeros
            const denoms = this.currencyManager.getSortedDenominations();
            for (const denom of denoms) {
                const name = denom.id.charAt(0).toUpperCase() + denom.id.slice(1);
                newLines.push(`- ${name}: 0`);
            }

            return newLines;
        });
    }

    /**
     * Add container block
     */
    async addContainerBlock(container: InventoryContainer): Promise<void> {
        await this.safeModifyFile(async (lines) => {
            const newLines = [...lines];

            // Find player's section if owner specified
            let insertIdx = newLines.length;
            if (container.ownerId) {
                for (let i = 0; i < newLines.length; i++) {
                    if (newLines[i].includes('```quartermaster-player')) {
                        const idLine = newLines.slice(i, i + 5).find(l => l.includes('id:'));
                        if (idLine && idLine.includes(container.ownerId)) {
                            // Find next empty line after currency section
                            for (let j = i + 1; j < newLines.length; j++) {
                                if (newLines[j].trim() === '' || newLines[j].includes('```quartermaster-')) {
                                    insertIdx = j;
                                    break;
                                }
                            }
                            break;
                        }
                    }
                }
            }

            // Insert container block
            newLines.splice(insertIdx, 0, '');
            newLines.splice(insertIdx + 1, 0, '```quartermaster-container');
            newLines.splice(insertIdx + 2, 0, `id: ${container.id}`);
            if (container.ownerId) {
                newLines.splice(insertIdx + 3, 0, `owner: ${container.ownerId}`);
            }
            newLines.splice(insertIdx + (container.ownerId ? 4 : 3), 0, `name: ${container.name}`);
            newLines.splice(insertIdx + (container.ownerId ? 5 : 4), 0, `capacity: ${container.maxCapacity}`);
            newLines.splice(insertIdx + (container.ownerId ? 6 : 5), 0, '```');
            newLines.splice(insertIdx + (container.ownerId ? 7 : 6), 0, '');

            return newLines;
        });
    }
}
