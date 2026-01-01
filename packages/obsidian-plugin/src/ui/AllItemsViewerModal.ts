import { App, Modal, Setting } from 'obsidian';
import type QuartermasterPlugin from '../main';
import { Item } from '@quartermaster/core/models/types';
import { formatCurrency, convertToCopper } from '@quartermaster/core/calculators/currency';

export class AllItemsViewerModal extends Modal {
    private items: Item[] = [];
    private sortBy: 'name' | 'type' | 'cost' | 'rarity' = 'name';
    private filterText: string = '';
    private rarityOrder = ['common', 'uncommon', 'rare', 'very rare', 'legendary'];

    constructor(
        app: App,
        private plugin: QuartermasterPlugin
    ) {
        super(app);
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        this.modalEl.addClass('all-items-viewer');

        contentEl.createEl('h2', { text: 'Loading items...' });

        try {
            this.items = await this.plugin.dataAdapter.getAvailableItems();
            await this.enrichItemsWithVariants(this.items);
        } catch (error) {
            if (error.message && error.message.includes('No item folders configured')) {
                contentEl.empty();
                contentEl.createEl('h2', { text: 'Configuration Required' });
                contentEl.createEl('p', { text: '⚠️ Please configure item folders in Quartermaster settings first' });
                return;
            }
            throw error; // Re-throw other errors
        }

        this.renderUI();
    }

    /**
     * Enrich variant parent items with resolved variant families
     */
    private async enrichItemsWithVariants(items: Item[]): Promise<void> {
        for (const item of items) {
            if (item.isVariant && item.variantAliases && item.variantAliases.length > 0) {
                // Cast to any to add ShopItem-like fields
                const shopItem = item as any;
                shopItem.availableVariants = await this.plugin.dataAdapter.getVariantFamily(item);
                shopItem.selectedVariantIndex = 0; // Default to first variant
            }
        }
    }

    private renderUI() {
        const { contentEl } = this;
        contentEl.empty();

        const filteredItems = this.getFilteredAndSortedItems();

        contentEl.createEl('h2', { text: `All Items (${filteredItems.length} of ${this.items.length})` });

        const controlsEl = contentEl.createDiv({ cls: 'all-items-controls' });
        this.renderControls(controlsEl);

        const tableEl = contentEl.createDiv({ cls: 'all-items-table' });
        this.renderTable(tableEl, filteredItems);
    }

    private renderControls(containerEl: HTMLElement) {
        new Setting(containerEl)
            .setName('Sort by:')
            .addDropdown(dropdown => dropdown
                .addOption('name', 'Name')
                .addOption('type', 'Type')
                .addOption('cost', 'Cost')
                .addOption('rarity', 'Rarity')
                .setValue(this.sortBy)
                .onChange(value => {
                    this.sortBy = value as any;
                    this.renderUI();
                }));

        new Setting(containerEl)
            .setName('Filter:')
            .addText(text => text
                .setPlaceholder('Search...')
                .setValue(this.filterText)
                .onChange(value => {
                    this.filterText = value;
                    this.renderUI();
                }));
    }

    private renderTable(containerEl: HTMLElement, items: Item[]) {
        // Header
        const headerEl = containerEl.createDiv({ cls: 'all-items-table-header' });
        headerEl.createEl('div', { text: 'Name' });
        headerEl.createEl('div', { text: 'Type' });
        headerEl.createEl('div', { text: 'Cost' });
        headerEl.createEl('div', { text: 'Rarity' });

        // Rows
        if (items.length === 0) {
            containerEl.createDiv({ text: 'No items match your filter.', cls: 'all-items-empty' });
            return;
        }

        for (const item of items) {
            const rowEl = containerEl.createDiv({ cls: 'all-items-row' });

            // Name column with link and variant dropdown
            const nameCell = rowEl.createDiv({ cls: 'all-items-cell' });
            this.renderItemLink(nameCell, item);

            // Add interactive variant dropdown if item has variants
            const shopItem = item as any;
            if (shopItem.availableVariants && shopItem.availableVariants.length > 1) {
                this.renderVariantDropdown(nameCell, shopItem);
            }

            const config = this.plugin.dataAdapter.getCurrencyConfig();
            rowEl.createEl('div', { text: item.type, cls: 'all-items-cell' });
            rowEl.createEl('div', { text: formatCurrency(item.cost, config), cls: 'all-items-cell' });
            rowEl.createEl('div', { text: item.rarity, cls: 'all-items-cell' });
        }
    }

    private getFilteredAndSortedItems(): Item[] {
        let items = [...this.items];

        // Filter
        if (this.filterText) {
            const searchStr = this.filterText.toLowerCase();
            items = items.filter(item =>
                item.name.toLowerCase().includes(searchStr) ||
                item.type.toLowerCase().includes(searchStr) ||
                item.rarity.toLowerCase().includes(searchStr)
            );
        }

        // Sort
        items.sort((a, b) => {
            switch (this.sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'type':
                    return a.type.localeCompare(b.type);
                case 'cost':
                    return convertToCopper(a.cost) - convertToCopper(b.cost);
                case 'rarity':
                    return (this.rarityOrder.indexOf(a.rarity.toLowerCase()) || 99) -
                           (this.rarityOrder.indexOf(b.rarity.toLowerCase()) || 99);
                default:
                    return 0;
            }
        });

        return items;
    }

    /**
     * Render item name as clickable link with hover preview
     */
    private renderItemLink(container: HTMLElement, item: Item) {
        if (item.file && item.file.path) {
            const linkEl = container.createEl('a', {
                cls: 'internal-link',
                href: item.file.path
            });
            linkEl.textContent = item.name;

            linkEl.addEventListener('mouseover', (event) => {
                this.app.workspace.trigger('hover-link', {
                    event,
                    source: 'quartermaster',
                    hoverParent: container,
                    targetEl: linkEl,
                    linktext: item.file.path
                });
            });
        } else {
            container.createSpan({ text: item.name });
        }
    }

    /**
     * Render interactive variant dropdown for testing pricing
     */
    private renderVariantDropdown(container: HTMLElement, item: any) {
        const dropdownContainer = container.createDiv({ cls: 'variant-dropdown-container' });
        const select = dropdownContainer.createEl('select', { cls: 'variant-dropdown' });
        select.title = 'Change variant to see different costs';

        if (item.availableVariants) {
            item.availableVariants.forEach((variant: Item, index: number) => {
                const option = select.createEl('option', {
                    value: index.toString(),
                    text: variant.name
                });
                if (index === (item.selectedVariantIndex || 0)) {
                    option.selected = true;
                }
            });
        }

        // Handle variant change - update item and re-render table
        select.onchange = () => {
            const selectedIndex = parseInt(select.value);
            if (!item.availableVariants || selectedIndex === item.selectedVariantIndex) {
                return;
            }

            const selectedVariant = item.availableVariants[selectedIndex];
            if (selectedVariant) {
                // Update item with new variant details
                item.name = selectedVariant.name;
                item.cost = selectedVariant.cost;
                item.baseItemName = selectedVariant.baseItemName;
                item.selectedVariantIndex = selectedIndex;

                // Re-render the UI to show updated cost
                this.renderUI();
            }
        };
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
