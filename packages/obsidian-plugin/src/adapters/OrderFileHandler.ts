/**
 * OrderFileHandler - Handles custom order template YAML file operations
 * Loads and caches order templates from config folder
 */

import { App, TFile } from 'obsidian';
import { CustomOrder } from '@quartermaster/core/models/stronghold';
import * as yaml from 'js-yaml';

export class OrderFileHandler {
	private orderCache: Map<string, CustomOrder> = new Map();
	private cacheValid: boolean = false;

	constructor(private app: App) {}

	/**
	 * Load all custom orders from config folder
	 */
	async loadCustomOrders(folderPath: string): Promise<CustomOrder[]> {
		// Return cached orders if cache is valid
		if (this.cacheValid && this.orderCache.size > 0) {
			return Array.from(this.orderCache.values());
		}

		const orders: CustomOrder[] = [];
		const files = this.app.vault.getFiles();

		for (const file of files) {
			if (file.path.startsWith(folderPath) && file.extension === 'yaml') {
				try {
					const order = await this.loadOrder(file);
					if (order) {
						orders.push(order);
						this.orderCache.set(order.id, order);
					}
				} catch (error) {
					console.error(`Error loading custom order from ${file.path}:`, error);
				}
			}
		}

		this.cacheValid = true;
		return orders;
	}

	/**
	 * Load a single custom order from a file
	 */
	async loadOrder(file: TFile): Promise<CustomOrder | null> {
		try {
			const content = await this.app.vault.read(file);
			const data = yaml.load(content) as any;

			if (!data || !data.id) {
				return null;
			}

			const order: CustomOrder = {
				id: data.id,
				name: data.name || 'Unnamed Order',
				description: data.description || '',
				orderType: data.orderType || 'facility',
				associatedFacilityIds: data.associatedFacilityIds || [],
				timeRequired: data.timeRequired || 0,
				goldCost: {
					type: data.goldCost?.type || 'none',
					amount: data.goldCost?.amount,
					prompt: data.goldCost?.prompt
				},
				results: data.results || [],
				metadata: {
					createdDate: data.metadata?.createdDate || new Date().toISOString(),
					lastModified: data.metadata?.lastModified || new Date().toISOString()
				}
			};

			return order;
		} catch (error) {
			console.error(`Error parsing custom order from ${file.path}:`, error);
			return null;
		}
	}

	/**
	 * Save a custom order to YAML file
	 */
	async saveCustomOrder(order: CustomOrder, folderPath: string): Promise<void> {
		const fileName = `${order.id}.yaml`;
		const filePath = `${folderPath}/${fileName}`;

		// Prepare order data
		const data = {
			id: order.id,
			name: order.name,
			description: order.description,
			orderType: order.orderType,
			associatedFacilityIds: order.associatedFacilityIds,
			timeRequired: order.timeRequired,
			goldCost: order.goldCost,
			results: order.results,
			metadata: {
				...order.metadata,
				lastModified: new Date().toISOString()
			}
		};

		// Convert to YAML
		const content = yaml.dump(data, {
			indent: 2,
			lineWidth: -1,
			noRefs: true
		});

		// Check if file exists
		const existingFile = this.app.vault.getAbstractFileByPath(filePath);

		if (existingFile && existingFile instanceof TFile) {
			// Update existing file
			await this.app.vault.modify(existingFile, content);
		} else {
			// Create new file
			await this.ensureFolder(folderPath);
			await this.app.vault.create(filePath, content);
		}

		// Update cache
		this.orderCache.set(order.id, order);
	}

	/**
	 * Delete a custom order file
	 */
	async deleteOrder(orderId: string, folderPath: string): Promise<void> {
		const filePath = `${folderPath}/${orderId}.yaml`;
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (file && file instanceof TFile) {
			await this.app.vault.delete(file);
			this.orderCache.delete(orderId);
		}
	}

	/**
	 * Invalidate order cache (call when files change)
	 */
	invalidateCache(): void {
		this.cacheValid = false;
	}

	/**
	 * Clear order cache completely
	 */
	clearCache(): void {
		this.orderCache.clear();
		this.cacheValid = false;
	}

	/**
	 * Get order from cache
	 */
	getCachedOrder(orderId: string): CustomOrder | undefined {
		return this.orderCache.get(orderId);
	}

	/**
	 * Check if cache is valid
	 */
	isCacheValid(): boolean {
		return this.cacheValid;
	}

	/**
	 * Ensure folder exists, create if needed
	 */
	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}
}
