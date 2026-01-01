import { Modal, App, Setting, Notice, ButtonComponent } from 'obsidian';
import { InventoryContainer, InventoryItem } from '@quartermaster/core/models/types';
import type QuartermasterPlugin from '../main';

export class InventoryManagerModal extends Modal {
    plugin: QuartermasterPlugin;
    containers: InventoryContainer[] = [];
    items: InventoryItem[] = [];
    selectedContainer: InventoryContainer | null = null;

    // UI elements
    leftPanel?: HTMLElement;
    rightPanel?: HTMLElement;
    containerTreeEl?: HTMLElement;
    containerDetailsEl?: HTMLElement;

    constructor(app: App, plugin: QuartermasterPlugin) {
        super(app);
        this.plugin = plugin;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('quartermaster-inventory-modal');

        // Header
        contentEl.createEl('h2', { text: 'Party Inventory Manager' });

        // Create two-column layout
        const layout = contentEl.createDiv({ cls: 'inventory-layout' });
        this.leftPanel = layout.createDiv({ cls: 'inventory-left-panel' });
        this.rightPanel = layout.createDiv({ cls: 'inventory-right-panel' });

        // Load data
        await this.loadInventoryData();

        // Render panels
        this.renderContainerTree();
        this.renderContainerDetails();

        // Footer buttons
        const footer = contentEl.createDiv({ cls: 'modal-footer' });
        new Setting(footer)
            .addButton(btn => btn
                .setButtonText('Close')
                .onClick(() => this.close()));
    }

    /**
     * Load inventory data from plugin
     */
    private async loadInventoryData(): Promise<void> {
        try {
            this.containers = await this.plugin.dataAdapter.getAllContainers();
            const inventory = await this.plugin.dataAdapter.getPartyInventoryV2();
            this.items = inventory.items || [];
        } catch (error) {
            console.error('[Quartermaster] Failed to load inventory data:', error);
            new Notice('Failed to load inventory data');
        }
    }

    /**
     * Render container tree (left panel)
     */
    private renderContainerTree(): void {
        if (!this.leftPanel) return;
        this.leftPanel.empty();

        this.leftPanel.createEl('h3', { text: 'Containers' });
        this.containerTreeEl = this.leftPanel.createDiv({ cls: 'container-tree' });

        if (this.containers.length === 0) {
            this.containerTreeEl.createEl('p', {
                text: 'No containers found. Items will be added to Party Inventory when the file is created.',
                cls: 'empty-state'
            });
            return;
        }

        // Group containers by owner
        const grouped = this.groupContainersByOwner();

        // Render each group
        for (const [ownerName, ownerContainers] of Object.entries(grouped)) {
            this.renderOwnerGroup(ownerName, ownerContainers);
        }
    }

    /**
     * Group containers by owner (party member)
     */
    private groupContainersByOwner(): { [ownerName: string]: InventoryContainer[] } {
        const grouped: { [ownerName: string]: InventoryContainer[] } = {
            'Shared': []
        };

        for (const container of this.containers) {
            if (!container.ownerId || container.ownerId === 'shared') {
                grouped['Shared'].push(container);
            } else {
                // Try to get party member name
                const ownerName = container.ownerId; // Simplified - would lookup party member
                if (!grouped[ownerName]) {
                    grouped[ownerName] = [];
                }
                grouped[ownerName].push(container);
            }
        }

        return grouped;
    }

    /**
     * Render owner group with containers
     */
    private renderOwnerGroup(ownerName: string, containers: InventoryContainer[]): void {
        if (!this.containerTreeEl) return;

        // Owner header
        const ownerDiv = this.containerTreeEl.createDiv({ cls: 'owner-group' });
        const ownerHeader = ownerDiv.createDiv({ cls: 'owner-header' });
        ownerHeader.createEl('strong', { text: ownerName });

        // Container list
        const containerList = ownerDiv.createDiv({ cls: 'container-list' });

        for (const container of containers) {
            this.renderContainerItem(containerList, container, 0);
        }
    }

    /**
     * Render individual container item
     */
    private renderContainerItem(parent: HTMLElement, container: InventoryContainer, depth: number): void {
        const containerDiv = parent.createDiv({ cls: 'container-item' });
        containerDiv.style.paddingLeft = `${depth * 20}px`;

        // Make clickable
        containerDiv.addClass('clickable');
        containerDiv.onclick = () => {
            this.selectedContainer = container;
            this.renderContainerDetails();

            // Visual feedback
            parent.querySelectorAll('.container-item').forEach(el => el.removeClass('selected'));
            containerDiv.addClass('selected');
        };

        // Container name and item count
        const nameSpan = containerDiv.createSpan({ cls: 'container-name' });
        nameSpan.textContent = container.name;

        const itemCount = this.items.filter(item => item.containerId === container.id).length;
        const countBadge = containerDiv.createSpan({ cls: 'item-count-badge' });
        countBadge.textContent = `${itemCount}`;

        // Render nested containers (if any)
        const nested = this.containers.filter(c => c.parentContainerId === container.id);
        for (const child of nested) {
            this.renderContainerItem(parent, child, depth + 1);
        }
    }

    /**
     * Render container details (right panel)
     */
    private renderContainerDetails(): void {
        if (!this.rightPanel) return;
        this.rightPanel.empty();

        if (!this.selectedContainer) {
            this.rightPanel.createEl('p', {
                text: 'Select a container to view its contents',
                cls: 'empty-state'
            });
            return;
        }

        // Container header
        this.rightPanel.createEl('h3', { text: this.selectedContainer.name });

        // Capacity info
        const capacityDiv = this.rightPanel.createDiv({ cls: 'capacity-info' });
        const currentWeight = this.calculateContainerWeight(this.selectedContainer.id);
        capacityDiv.textContent = `Capacity: ${currentWeight} / ${this.selectedContainer.maxCapacity} lbs`;

        // Items list
        const itemsDiv = this.rightPanel.createDiv({ cls: 'items-list' });
        const containerItems = this.items.filter(item => item.containerId === this.selectedContainer!.id);

        if (containerItems.length === 0) {
            itemsDiv.createEl('p', { text: 'No items in this container', cls: 'empty-state' });
            return;
        }

        // Render each item
        for (const item of containerItems) {
            this.renderItemRow(itemsDiv, item);
        }
    }

    /**
     * Calculate total weight in container
     */
    private calculateContainerWeight(containerId: string): number {
        const containerItems = this.items.filter(item => item.containerId === containerId);
        return containerItems.reduce((total, item) => total + (item.weight * item.quantity), 0);
    }

    /**
     * Render individual item row
     */
    private renderItemRow(parent: HTMLElement, item: InventoryItem): void {
        const itemDiv = parent.createDiv({ cls: 'item-row' });

        // Item name
        const nameDiv = itemDiv.createDiv({ cls: 'item-name' });
        nameDiv.textContent = item.itemId;

        // Quantity and weight
        const metaDiv = itemDiv.createDiv({ cls: 'item-meta' });
        metaDiv.textContent = `×${item.quantity} (${item.weight * item.quantity} lbs)`;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
