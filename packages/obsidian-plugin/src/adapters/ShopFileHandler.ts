// Handles shop file operations (save, load, update, list)
import { App, Plugin, TFile } from 'obsidian';
import { Shop, ShopItem } from '@quartermaster/core/models/types';

export class ShopFileHandler {
	constructor(private app: App, private plugin?: Plugin) {}

	async getShop(path: string): Promise<Shop> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Shop file not found: ${path}`);
		}

		const content = await this.app.vault.read(file);
		const cache = this.app.metadataCache.getFileCache(file);

		if (!cache?.frontmatter) {
			throw new Error('Shop file has no frontmatter');
		}

		const shop: Shop = {
			name: cache.frontmatter.name,
			type: cache.frontmatter.type,
			wealthLevel: cache.frontmatter.wealthLevel,
			baseStock: cache.frontmatter.baseStock || [],
			specialStock: cache.frontmatter.specialStock || [],
			inventory: cache.frontmatter.inventory || [], // Legacy support
			location: cache.frontmatter.location,
			faction: cache.frontmatter.faction,
			lastRestocked: cache.frontmatter.lastRestocked,
			orders: cache.frontmatter.orders,

			// NPC Shopkeep (new system)
			shopkeepNPC: cache.frontmatter.shopkeepNPC,
			shopkeepNpcId: cache.frontmatter.shopkeepNpcId,

			// Legacy fields (for backward compatibility)
			shopkeep: cache.frontmatter.shopkeep,
			npcLink: cache.frontmatter.npcLink
		};

		// Get or generate UUID
		if (this.plugin) {
			const uuidRegistry = (this.plugin as any).uuidRegistry;
			if (uuidRegistry) {
				shop.id = uuidRegistry.getShopId(path, shop);

				// If persistent mode and UUID was generated, it will be saved on next save
				// (lazy backfill - don't force immediate save)
			}
		}

		return shop;
	}

	async saveShop(shop: Shop, folderPath: string): Promise<void> {
		// Implementation from shopPersistence.ts saveShopToNote
		const content = this.generateShopMarkdown(shop);
		const filename = this.generateFilename(shop.name, folderPath);

		await this.ensureFolder(folderPath);
		await this.app.vault.create(filename, content);
	}

	async updateShop(path: string, updates: Partial<Shop>): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!file || !(file instanceof TFile)) {
			throw new Error(`Shop file not found: ${path}`);
		}

		const shop = await this.getShop(path);
		const updatedShop = { ...shop, ...updates };
		const content = this.generateShopMarkdown(updatedShop);

		await this.app.vault.modify(file, content);
	}

	async listShops(folderPath: string): Promise<string[]> {
		const folder = this.app.vault.getAbstractFileByPath(folderPath);
		if (!folder) return [];

		const files = this.app.vault.getMarkdownFiles()
			.filter(f => f.path.startsWith(folderPath))
			.map(f => f.path);

		return files;
	}

	private generateShopMarkdown(shop: Shop): string {
		// Strip availableVariants from inventory items before saving
		// (they can be recalculated on load, no need to bloat the file)
		const stripVariants = (items: ShopItem[]) => items.map(item => {
			if (item.availableVariants) {
				const { availableVariants, ...itemWithoutVariants } = item;
				return itemWithoutVariants;
			}
			return item;
		});

		const baseStockForSave = stripVariants(shop.baseStock);
		const specialStockForSave = stripVariants(shop.specialStock);

		// Frontmatter
		const frontmatter: any = {
			name: shop.name,
			type: shop.type,
			wealthLevel: shop.wealthLevel,
			baseStock: baseStockForSave,
			specialStock: specialStockForSave,
			location: shop.location || '',
			faction: shop.faction || '',
			lastRestocked: shop.lastRestocked || '',
			orders: shop.orders || []
		};

		// Conditional UUID persistence
		if (this.plugin) {
			const settings = (this.plugin as any).settings;
			if (settings?.storeCrossPlatformIds && shop.id) {
				frontmatter.id = shop.id;
			}
		}

		// Always save both wikilink and UUID for NPC references (if present)
		if (shop.shopkeepNPC) {
			frontmatter.shopkeepNPC = shop.shopkeepNPC;
		}
		if (shop.shopkeepNpcId) {
			frontmatter.shopkeepNpcId = shop.shopkeepNpcId;
		}

		// Save legacy shopkeep for backward compatibility
		if (shop.shopkeep) {
			frontmatter.shopkeep = shop.shopkeep;
		}

		let content = '---\n';
		for (const [key, value] of Object.entries(frontmatter)) {
			content += `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}\n`;
		}
		content += '---\n\n';

		// Body (kept minimal - full implementation would go here)
		content += `# ${shop.name}\n\n`;
		content += `A ${shop.type} shop.\n\n`;

		if (shop.shopkeep) {
			content += `## Shopkeep\n**${shop.shopkeep.name}** - ${shop.shopkeep.species}\n\n`;
		}

		return content;
	}

	private generateFilename(shopName: string, folder: string): string {
		const clean = shopName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '-');
		const folderPath = folder.endsWith('/') ? folder : folder + '/';
		return `${folderPath}${clean}-shop.md`;
	}

	private async ensureFolder(path: string): Promise<void> {
		const folder = this.app.vault.getAbstractFileByPath(path);
		if (!folder) {
			await this.app.vault.createFolder(path);
		}
	}

	/**
	 * Get shop by UUID.
	 * In persistent mode: searches frontmatter for matching ID.
	 * In memory mode: checks registry for path-to-UUID mappings.
	 */
	async getShopById(id: string): Promise<Shop | null> {
		if (!this.plugin) return null;

		const uuidRegistry = (this.plugin as any).uuidRegistry;
		if (!uuidRegistry) return null;

		const settings = (this.plugin as any).settings;

		// Persistent mode: search frontmatter
		if (settings?.storeCrossPlatformIds) {
			const shops = await this.listShops('');
			for (const path of shops) {
				try {
					const file = this.app.vault.getAbstractFileByPath(path);
					if (!file) continue;

					const cache = this.app.metadataCache.getFileCache(file as TFile);
					if (cache?.frontmatter?.id === id) {
						return this.getShop(path);
					}
				} catch (error) {
					console.error(`Error checking shop at ${path}:`, error);
				}
			}
		} else {
			// Memory mode: check registry
			for (const [path, uuid] of uuidRegistry.shopRegistryMap.entries()) {
				if (uuid === id) {
					return this.getShop(path);
				}
			}
		}

		return null;
	}
}
