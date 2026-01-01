// Handles item scanning from vault
import { App, TFile, TAbstractFile } from 'obsidian';
import { Item, RPGShopkeepSettings, FileReference, DiagnosticsInfo } from '@quartermaster/core/models/types';
import { parseCostString, convertToCopper, convertFromCopper } from '@quartermaster/core/calculators/currency';
import {
	isMagicItem,
	extractSpellLevel,
	getScrollCraftingCost,
	calculateMagicItemPrice
} from '@quartermaster/core/calculators/magicItemPricing';
import { SRD_ITEMS, SRDItemData } from '@quartermaster/core/data/srdItems';
import {
	extractItemTypes,
	extractRarities,
	buildTypeRarityMatrix,
	getItemMetadataSummary
} from '@quartermaster/core/parsers/itemMetadataParser';
import type { CurrencyConfig } from '@quartermaster/core/models/currency-config';
import { DEFAULT_CURRENCY_CONFIG } from '@quartermaster/core/data/defaultCurrencyConfig';

/**
 * Interface for cached item metadata
 */
interface ItemMetadataCache {
	types: string[];
	rarities: string[];
	matrix: Record<string, Record<string, number>>;
	totalItems: number;
	lastUpdated: number; // Timestamp
}

export class ItemVaultHandler {
	private itemTypeCache: ItemMetadataCache | null = null;

	/**
	 * In-memory cache of parsed Item objects
	 * Key: UUID (if available) or file.path (backward compatibility)
	 * Value: parsed Item
	 */
	private itemCache: Map<string, Item> | null = null;

	/**
	 * Timestamp when cache was last built (milliseconds since epoch)
	 */
	private itemCacheTimestamp: number = 0;

	/**
	 * Cache TTL in milliseconds (1 minute)
	 * Cache is considered stale after this duration
	 */
	private readonly CACHE_TTL_MS = 60000;

	/**
	 * Cache of variant families (all resolved variants for a parent item)
	 * Key: file.path of parent item, Value: array of resolved variants
	 */
	private variantFamilyCache: Map<string, Item[]> | null = null;

	/**
	 * Diagnostics from last vault scan
	 * Used by Health Check UI to show exclusion details
	 */
	private lastDiagnostics: DiagnosticsInfo | null = null;

	constructor(
		private app: App,
		private settings: RPGShopkeepSettings,
		private plugin?: any
	) {}

	/**
	 * Get all items from vault, using cache if available
	 *
	 * Cache behavior:
	 * - First call: Scans vault, builds cache
	 * - Subsequent calls: Returns cached items (if cache not stale)
	 * - After file changes: Cache invalidated, rebuilds on next call
	 *
	 * @returns Array of parsed Item objects
	 */
	async getAvailableItems(): Promise<Item[]> {
		// Check if cache is valid
		if (this.itemCache && !this.isCacheStale()) {
			return Array.from(this.itemCache.values());
		}

		// Cache miss or stale - rebuild

		// CRITICAL: Wait for metadata cache to be ready
		await this.ensureMetadataCacheReady();

		// Use default currency config for item parsing
		// (full config will be loaded from currencies.yaml when needed)
		const currencyConfig = DEFAULT_CURRENCY_CONFIG;

		const startTime = Date.now();

		// Get all markdown files from vault
		let files = this.app.vault.getMarkdownFiles();

		// Filter files by configured folders
		if (!this.settings.itemsFolders || this.settings.itemsFolders.length === 0) {
			throw new Error('No item folders configured. Please set item folders in Quartermaster settings.');
		}

		files = files.filter(f => {
			return this.settings.itemsFolders.some(folderConfig => {
				const folderPath = folderConfig.path;

				// Check if file is in this folder
				if (!f.path.startsWith(folderPath + '/')) {
					return false;
				}

				// If excludeSubfolders is true, only include files directly in this folder
				if (folderConfig.excludeSubfolders) {
					// Get the path after the folder
					const relativePath = f.path.substring(folderPath.length + 1);
					// Check if there are any more slashes (indicating a subfolder)
					return !relativePath.includes('/');
				}

				return true;
			});
		});
		const itemMap = new Map<string, Item>();

		// Initialize diagnostics tracker
		const diagnostics: DiagnosticsInfo = {
			scanned: files.length,
			noFrontmatter: 0,
			notDetected: 0,
			invalidCost: 0,
			sourceFiltered: 0,
			parseErrors: 0,
			success: 0,
			timestamp: Date.now(),
			examples: {
				noFrontmatter: [],
				notDetected: [],
				invalidCost: [],
				sourceFiltered: [],
				parseErrors: []
			}
		};

		// Parse each file using MetadataCache
		for (const file of files) {
			try {
				const item = await this.parseItemFile(file, diagnostics);
				if (item) {
					// Get or generate UUID for item
					const uuidRegistry = (this.plugin as any).uuidRegistry;
					if (uuidRegistry) {
						item.id = uuidRegistry.getItemId(file.path, item);
					}

					// Use UUID as cache key if available, otherwise use path (backward compatibility)
					const cacheKey = item.id || file.path;
					itemMap.set(cacheKey, item);
					diagnostics.success++;
				}
			} catch (error) {
				diagnostics.parseErrors++;

				// Collect example (max 5)
				if (diagnostics.examples!.parseErrors!.length < 5) {
					diagnostics.examples!.parseErrors!.push(file.path);
				}

				console.warn(`[ItemVaultHandler] Failed to parse ${file.path}:`, error);
			}
		}

		// Store cache
		this.itemCache = itemMap;
		this.itemCacheTimestamp = Date.now();
		this.lastDiagnostics = diagnostics;

		const elapsed = Date.now() - startTime;
		console.log(`[ItemVaultHandler] Cache built: ${diagnostics.success}/${diagnostics.scanned} items in ${elapsed}ms`);
		console.log('[ItemVaultHandler] Exclusion breakdown:', {
			noFrontmatter: diagnostics.noFrontmatter,
			notDetected: diagnostics.notDetected,
			invalidCost: diagnostics.invalidCost,
			sourceFiltered: diagnostics.sourceFiltered,
			parseErrors: diagnostics.parseErrors
		});

		// Merge vault items with SRD items
		// Vault items take precedence (already in itemMap)
		const srdItemsAdded = [];
		for (const srdItem of SRD_ITEMS) {
			const srdPath = `srd:${srdItem.name.toLowerCase().replace(/\s+/g, '-')}`;

			// Skip if vault already has an item with this name
			const existsInVault = Array.from(itemMap.values()).some(
				vaultItem => vaultItem.name.toLowerCase() === srdItem.name.toLowerCase()
			);

			if (!existsInVault) {
				const item: Item = {
					name: srdItem.name,
					cost: parseCostString(srdItem.cost, currencyConfig),
					type: srdItem.type,
					rarity: srdItem.rarity,
					description: srdItem.description,
					source: 'SRD',
					file: {
						path: srdPath,
						name: srdItem.name,
						basename: srdItem.name
					},
					category: srdItem.type
				};
				itemMap.set(srdPath, item);
				srdItemsAdded.push(srdItem.name);
			}
		}

		console.log(`[ItemVaultHandler] Added ${srdItemsAdded.length} SRD items not in vault`);

		return Array.from(itemMap.values());
	}

	/**
	 * Get item by UUID.
	 * Searches the item cache for matching ID.
	 *
	 * @param id - The UUID to search for (format: "item-{uuid}")
	 * @returns The matching Item or null if not found
	 */
	async getItemById(id: string): Promise<Item | null> {
		const items = await this.getAvailableItems();
		return items.find(item => item.id === id) || null;
	}

	/**
	 * Ensure MetadataCache is fully initialized before scanning
	 * Prevents false "no frontmatter" errors when cache isn't ready
	 */
	private async ensureMetadataCacheReady(): Promise<void> {
		// Wait for 'resolved' event to ensure cache is fully populated
		// This is fired when Obsidian has finished loading all file metadata
		return new Promise<void>(resolve => {
			// Check if we can access metadata - if yes, cache is likely ready
			const testFiles = this.app.vault.getMarkdownFiles();
			if (testFiles.length > 0) {
				const testCache = this.app.metadataCache.getFileCache(testFiles[0]);
				if (testCache !== null) {
					// Cache is responding, we're good to go
					resolve();
					return;
				}
			}

			// Wait for resolved event
			this.app.metadataCache.on('resolved', () => {
				resolve();
			});
		});
	}

	/**
	 * Check if cache is stale (older than TTL)
	 */
	private isCacheStale(): boolean {
		const ageMs = this.getCacheAge();
		return ageMs > this.CACHE_TTL_MS;
	}

	/**
	 * Get age of cache in milliseconds
	 */
	private getCacheAge(): number {
		if (!this.itemCache || this.itemCacheTimestamp === 0) {
			return Infinity;
		}
		return Date.now() - this.itemCacheTimestamp;
	}

	/**
	 * Get all resolved variants for a parent variant item.
	 *
	 * Returns an array of Item objects with calculated costs for each variant alias.
	 * Results are cached for performance.
	 *
	 * @param parentItem - The generic variant item (e.g., "Armor of Gleaming")
	 * @returns Array of resolved variant items with costs
	 */
	async getVariantFamily(parentItem: Item): Promise<Item[]> {
		const cacheKey = parentItem.file.path;

		// Check cache first
		if (this.variantFamilyCache?.has(cacheKey)) {
			return this.variantFamilyCache.get(cacheKey)!;
		}

		// Resolve all variants
		const { resolveVariant } = await import('@quartermaster/core/services/variantResolver');
		const allItems = await this.getAvailableItems();
		const variants: Item[] = [];
		const currencyConfig = DEFAULT_CURRENCY_CONFIG;

		if (parentItem.variantAliases && parentItem.variantAliases.length > 0) {
			for (const alias of parentItem.variantAliases) {
				const resolved = resolveVariant(parentItem, alias, allItems, currencyConfig);
				if (resolved) {
					variants.push(resolved);
				}
			}
		}

		// Initialize cache if needed
		if (!this.variantFamilyCache) {
			this.variantFamilyCache = new Map();
		}

		// Cache the result
		this.variantFamilyCache.set(cacheKey, variants);

		return variants;
	}

	async indexSources(): Promise<string[]> {
		// Ensure metadata cache is ready before scanning
		await this.ensureMetadataCacheReady();

		// Get all markdown files from designated folders (same logic as getAvailableItems)
		let files = this.app.vault.getMarkdownFiles();

		// Filter files by configured folders
		if (!this.settings.itemsFolders || this.settings.itemsFolders.length === 0) {
			throw new Error('No item folders configured. Please set item folders in Quartermaster settings.');
		}

		files = files.filter(f => {
			return this.settings.itemsFolders.some(folderConfig => {
				const folderPath = folderConfig.path;

				// Check if file is in this folder
				if (!f.path.startsWith(folderPath + '/')) {
					return false;
				}

				// If excludeSubfolders is true, only include files directly in this folder
				if (folderConfig.excludeSubfolders) {
					const relativePath = f.path.substring(folderPath.length + 1);
					return !relativePath.includes('/');
				}

				return true;
			});
		});

		const sources = new Set<string>();

		// Parse each file with source filtering BYPASSED
		for (const file of files) {
			try {
				const item = await this.parseItemFile(file, undefined, true); // bypassSourceFilter = true
				if (item) {
					if (Array.isArray(item.source)) {
						item.source.forEach(s => sources.add(this.normalizeSourceName(s)));
					} else if (item.source) {
						sources.add(this.normalizeSourceName(item.source));
					}
				}
			} catch (error) {
				// Silently skip files with errors
				continue;
			}
		}

		return Array.from(sources);
	}

	/**
	 * Normalize source name by removing page numbers and extra metadata
	 * E.g., "Player's Handbook p. 123" -> "Player's Handbook"
	 * E.g., "DMG (2024) p. 45. Available in SRD" -> "DMG (2024)"
	 */
	private normalizeSourceName(source: string): string {
		if (!source) return source;

		// Remove everything after " p." or " p " (page indicators)
		let normalized = source.replace(/\s+p\.\s*\d+.*$/i, '');
		normalized = normalized.replace(/\s+p\s+\d+.*$/i, '');

		// Remove anything after ". Available" (like ". Available in the SRD")
		normalized = normalized.replace(/\.\s*Available.*$/i, '');

		// Trim any trailing whitespace or periods
		normalized = normalized.trim().replace(/\.$/, '');

		return normalized;
	}

	/**
	 * Parse a single file into an Item object
	 * Tracks exclusion reasons in diagnostics object if provided
	 *
	 * @param file - Markdown file to parse
	 * @param diagnostics - Optional tracker for exclusion reasons
	 * @returns Parsed Item or null if excluded
	 */
	private async parseItemFile(file: TFile, diagnostics?: DiagnosticsInfo, bypassSourceFilter: boolean = false): Promise<Item | null> {
		const cache = this.app.metadataCache.getFileCache(file);

		// Use default currency config for item parsing
		// (full config will be loaded from currencies.yaml when needed)
		const currencyConfig = DEFAULT_CURRENCY_CONFIG;

		// Exclusion Gate 1: Cache not ready or no frontmatter
		if (!cache) {
			// Cache not populated - shouldn't happen after ensureMetadataCacheReady()
			console.warn(`[ItemVaultHandler] Cache not ready for ${file.path}`);
			if (diagnostics) {
				diagnostics.parseErrors++;
				if (diagnostics.examples!.parseErrors!.length < 5) {
					diagnostics.examples!.parseErrors!.push(file.path);
				}
			}
			return null;
		}

		// Check for frontmatter block - use frontmatterPosition as evidence
		if (!cache.frontmatter && !cache.frontmatterPosition) {
			// No frontmatter block in file
			if (diagnostics) {
				diagnostics.noFrontmatter++;
				if (diagnostics.examples!.noFrontmatter!.length < 5) {
					diagnostics.examples!.noFrontmatter!.push(file.path);
				}
			}
			return null;
		}

		// Malformed YAML: has position but no parsed object
		if (cache.frontmatterPosition && !cache.frontmatter) {
			console.warn(`[ItemVaultHandler] Malformed frontmatter in ${file.path}`);
			if (diagnostics) {
				diagnostics.parseErrors++;
				if (diagnostics.examples!.parseErrors!.length < 5) {
					diagnostics.examples!.parseErrors!.push(file.path);
				}
			}
			return null;
		}

		const fm = cache.frontmatter;

		// All files in designated folders are treated as items (no detection method needed)
		// Get tags for additional checks
		const tags = fm.tags || [];

		// Check if this is a generic variant item (e.g., "Armor of Cold Resistance")
		const isVariant = tags.some((t: string) =>
			typeof t === 'string' && t.includes('/generic-variant')
		);

		// Parse cost - treat empty strings as missing costs
		const costStr = fm.cost || fm.price || fm.value;
		const hasValidCostStr = costStr && String(costStr).trim() !== '';

		let cost = null;
		if (hasValidCostStr) {
			cost = parseCostString(costStr, currencyConfig);

			// Exclusion Gate 3: Invalid cost format
			if (!cost) {
				if (diagnostics) {
					diagnostics.invalidCost++;
					if (diagnostics.examples!.invalidCost!.length < 5) {
						diagnostics.examples!.invalidCost!.push(file.path);
					}
				}
				return null;
			}
		}

		// If no valid cost and not a variant, attempt to calculate magic item price
		if (!hasValidCostStr && !isVariant) {
			// Extract item metadata for magic item detection
			const itemRarity = this.extractRarity(fm, tags);
			const itemType = this.extractItemType(fm, tags);
			const isConsumable = this.isConsumableItem(fm, tags);

			// Create a temporary item object for magic item detection
			const tempItem = {
				rarity: itemRarity,
				type: itemType,
				isConsumable,
				name: fm.name || file.basename
			} as Item;

			// Check if this is a magic item (has rarity)
			if (isMagicItem(tempItem)) {
				const markupPercent = this.settings.magicItemMarkupPercent || 50;

				// Handle scrolls with special pricing
				if (itemType === 'scroll') {
					const spellLevel = extractSpellLevel(tempItem.name);
					if (spellLevel !== null) {
						const baseCost = getScrollCraftingCost(spellLevel, currencyConfig);
						if (baseCost) {
							const totalCopper = convertToCopper(baseCost);
							const markedUpCopper = Math.floor(totalCopper * (1 + markupPercent / 100));
							cost = convertFromCopper(markedUpCopper);
						}
					}
				} else {
					// Use standard magic item pricing
					cost = calculateMagicItemPrice(tempItem, markupPercent, currencyConfig);


				}
			}

			// If still no cost, this is a non-magic item without a price
			// Keep it for All Items Viewer but mark with zero cost
			// (will be filtered out during shop generation)
			if (!cost) {
				cost = { copper: 0, silver: 0, gold: 0, platinum: 0 };
			}
		}

		// For variant items without cost, use placeholder (will be calculated when variant is selected)
		if (!cost) {
			cost = { copper: 0, silver: 0, gold: 0, platinum: 0 };
		}

		// Exclusion Gate 4: Source filtering
		const source = fm.source || 'Unknown';
		// Only apply source filtering if not bypassed
		if (!bypassSourceFilter && !this.isSourceEnabled(source)) {
			if (diagnostics) {
				diagnostics.sourceFiltered++;
				if (diagnostics.examples!.sourceFiltered!.length < 5) {
					diagnostics.examples!.sourceFiltered!.push(file.path);
				}
			}
			return null;
		}

		// Get display name from alias, name property, or filename
		// Obsidian stores aliases in frontmatter.aliases array
		let displayName = file.basename;
		if (fm.aliases && Array.isArray(fm.aliases) && fm.aliases.length > 0) {
			displayName = fm.aliases[0];
		} else if (fm.name) {
			displayName = fm.name;
		}

		// Determine if this is a consumable item (affects pricing)
		const isConsumable = this.isConsumableItem(fm, tags);

		// Extract type from tags or frontmatter
		const itemType = this.extractItemType(fm, tags);

		// Extract rarity from tags or frontmatter
		const itemRarity = this.extractRarity(fm, tags);

		return {
			name: displayName,
			cost,
			type: itemType,
			rarity: itemRarity,
			description: fm.description || '',
			source,
			// Read UUID if present in frontmatter
			id: fm.id,
			file: this.convertToFileReference(file),
			category: itemType,  // Use type for category to avoid redundancy
			isVariant,
			variantAliases: isVariant ? (fm.aliases || []) : undefined,
			isConsumable
		};
	}

	private isSourceEnabled(source: string | string[]): boolean {
		if (this.settings.enabledSources.length === 0) return true;

		const sources = Array.isArray(source) ? source : [source];
		// Normalize both the item's sources and enabled sources for comparison
		return sources.some(s =>
			this.settings.enabledSources.includes(this.normalizeSourceName(s))
		);
	}

	private extractCategory(file: TFile): string {
		const parts = file.path.split('/');
		return parts.length > 1 ? parts[parts.length - 2] : 'misc';
	}

	private convertToFileReference(file: TFile): FileReference {
		return {
			path: file.path,
			name: file.name,
			// Store TFile for Obsidian-specific operations
			_obsidianFile: file
		};
	}

	private extractItemType(frontmatter: any, tags: string[]): string {
		// First check if there's an explicit type in frontmatter
		if (frontmatter.type) {
			return frontmatter.type;
		}

		// Parse type from tags - format: item/TYPE/subtype or item/wondrous/TYPE
		// Examples:
		//   - item/weapon/simple -> weapon
		//   - item/armor/medium -> armor
		//   - item/potion -> potion
		//   - item/wondrous/ring -> ring (or wondrous)
		//   - item/gear/ammunition -> ammunition (NOT gear)

		for (const tag of tags) {
			if (typeof tag !== 'string') continue;

			const lowerTag = tag.toLowerCase();

			// Check for specific high-priority type patterns
			if (lowerTag.includes('item/weapon')) return 'weapon';
			if (lowerTag.includes('item/armor')) return 'armor';
			if (lowerTag.includes('item/potion')) return 'potion';
			if (lowerTag.includes('item/scroll')) return 'scroll';
			if (lowerTag.includes('item/consumable')) return 'consumable';

			// For gear items, extract the subtype (e.g., item/gear/ammunition -> ammunition)
			if (lowerTag.includes('item/gear')) {
				const parts = lowerTag.split('/');
				// If there's a subtype (item/gear/ammunition), use it
				if (parts.length >= 3 && parts[2] && parts[2] !== 'generic-variant') {
					return parts[2]; // e.g., "ammunition", "tool", "clothing"
				}
				// If no subtype (item/gear or item/gear/), return 'gear'
				if (parts.length >= 2 && parts[1] === 'gear') {
					return 'gear';
				}
			}

			// For wondrous items, try to extract the subtype
			if (lowerTag.includes('item/wondrous/')) {
				const parts = lowerTag.split('/');
				if (parts.length >= 3 && parts[2] !== 'generic-variant') {
					return parts[2]; // e.g., "ring", "rod", "staff"
				}
				return 'wondrous';
			}
		}

		// Second pass: Generic item tag extraction (only if no specific type found above)
		for (const tag of tags) {
			if (typeof tag !== 'string') continue;

			const lowerTag = tag.toLowerCase();

			// Generic item tag - try to extract type after "item/"
			// Exclude metadata tags: age, rarity, attunement, wondrous, generic-variant, gear
			if (lowerTag.startsWith('item/')) {
				const parts = lowerTag.split('/');
				if (parts.length >= 2) {
					const excludedTypes = ['wondrous', 'generic-variant', 'rarity', 'attunement', 'age', 'gear'];
					if (!excludedTypes.includes(parts[1])) {
						return parts[1];
					}
				}
			}
		}

		// Default to misc if no type found
		return 'misc';
	}

	private extractRarity(frontmatter: any, tags: string[]): string {
		// First check if there's an explicit rarity in frontmatter
		if (frontmatter.rarity) {
			return frontmatter.rarity;
		}

		// Parse rarity from tags - format: item/rarity/RARITY
		// Examples:
		//   - item/rarity/common -> common
		//   - item/rarity/rare -> rare
		//   - item/rarity/legendary -> legendary

		for (const tag of tags) {
			if (typeof tag !== 'string') continue;

			const lowerTag = tag.toLowerCase();

			// Check for rarity tag pattern
			if (lowerTag.startsWith('item/rarity/')) {
				const parts = lowerTag.split('/');
				if (parts.length >= 3) {
					// Handle "very rare" (might be "very-rare" or "veryrare" in tags)
					const rarityPart = parts[2];
					if (rarityPart === 'very-rare' || rarityPart === 'veryrare') {
						return 'very rare';
					}
					return rarityPart; // e.g., "common", "uncommon", "rare", "legendary"
				}
			}
		}

		// Default to 'none' if no rarity found (indicates non-magical item)
		return 'none';
	}

	private isConsumableItem(frontmatter: any, tags: string[]): boolean {
		// Check if item type indicates consumable
		const type = frontmatter.type?.toLowerCase() || '';
		if (type.includes('potion') || type.includes('scroll') || type.includes('consumable')) {
			return true;
		}

		// Check tags for consumable indicators
		const consumableTags = ['item/consumable', 'item/potion', 'item/scroll'];
		return tags.some((t: string) => {
			if (typeof t !== 'string') return false;
			const lowerTag = t.toLowerCase();
			return consumableTags.some(ct => lowerTag.includes(ct));
		});
	}

	/**
	 * Get item metadata (types, rarities, matrix) with caching
	 * First call scans vault and caches results
	 * Subsequent calls return cached data unless forceRefresh is true
	 *
	 * @param forceRefresh If true, ignore cache and re-scan vault
	 * @returns Object with types, rarities, matrix, and total item count
	 *
	 * @example
	 * // First call - scans vault (slow)
	 * const metadata = await handler.getItemMetadata();
	 *
	 * // Subsequent calls - uses cache (fast)
	 * const metadata2 = await handler.getItemMetadata();
	 *
	 * // Force refresh - re-scans vault
	 * const metadata3 = await handler.getItemMetadata(true);
	 */
	async getItemMetadata(forceRefresh: boolean = false): Promise<{
		types: string[];
		rarities: string[];
		matrix: Record<string, Record<string, number>>;
		totalItems: number;
	}> {
		// Return cached data if available and not forcing refresh
		if (!forceRefresh && this.itemTypeCache) {
			console.log('ItemVaultHandler: Using cached item metadata');
			return {
				types: this.itemTypeCache.types,
				rarities: this.itemTypeCache.rarities,
				matrix: this.itemTypeCache.matrix,
				totalItems: this.itemTypeCache.totalItems
			};
		}

		// Scan vault for items
		console.log('ItemVaultHandler: Scanning vault for item metadata...');
		const items = await this.getAvailableItems();

		// Extract metadata using core parser
		const summary = getItemMetadataSummary(items);

		// Cache the results
		this.itemTypeCache = {
			types: summary.types,
			rarities: summary.rarities,
			matrix: summary.matrix,
			totalItems: summary.totalItems,
			lastUpdated: Date.now()
		};

		console.log(`ItemVaultHandler: Cached metadata for ${summary.totalItems} items (${summary.typeCount} types, ${summary.rarityCount} rarities)`);

		return {
			types: summary.types,
			rarities: summary.rarities,
			matrix: summary.matrix,
			totalItems: summary.totalItems
		};
	}

	private invalidationTimeout: NodeJS.Timeout | null = null;
	private pendingInvalidations: string[] = [];

	/**
	 * Set up event listeners to automatically invalidate cache on file changes
	 * Call this once during plugin initialization
	 */
	setupCacheInvalidation(): void {
		// Helper to check if file is in configured folders
		const isInConfiguredFolders = (filePath: string): boolean => {
			if (!this.settings.itemsFolders || this.settings.itemsFolders.length === 0) {
				return false;
			}
			return this.settings.itemsFolders.some(folderConfig => {
				const folderPath = folderConfig.path;

				// Check if file is in this folder
				if (!filePath.startsWith(folderPath + '/')) {
					return false;
				}

				// If excludeSubfolders is true, only include files directly in this folder
				if (folderConfig.excludeSubfolders) {
					const relativePath = filePath.substring(folderPath.length + 1);
					return !relativePath.includes('/');
				}

				return true;
			});
		};

		// Debounced invalidation - batches multiple events within 300ms
		const debouncedInvalidate = (reason: string) => {
			this.pendingInvalidations.push(reason);

			if (this.invalidationTimeout) {
				clearTimeout(this.invalidationTimeout);
			}

			this.invalidationTimeout = setTimeout(() => {
				this.invalidateItemCache();
				this.pendingInvalidations = [];
				this.invalidationTimeout = null;
			}, 300);
		};

		// Invalidate on metadata change (frontmatter edited)
		this.app.metadataCache.on('changed', (file: TFile) => {
			if (isInConfiguredFolders(file.path) && this.itemCache?.has(file.path)) {
				debouncedInvalidate(`metadata changed: ${file.path}`);
			}
		});

		// Invalidate on file deletion
		this.app.vault.on('delete', (file: TAbstractFile) => {
			if (file instanceof TFile && isInConfiguredFolders(file.path) && this.itemCache?.has(file.path)) {
				debouncedInvalidate(`deleted: ${file.path}`);
			}
		});

		// Invalidate on file creation (potential new item)
		this.app.vault.on('create', (file: TAbstractFile) => {
			if (file instanceof TFile && file.extension === 'md' && isInConfiguredFolders(file.path)) {
				debouncedInvalidate(`created: ${file.path}`);
			}
		});

		// Invalidate on file rename (path changes)
		this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			if (file instanceof TFile && (
				(isInConfiguredFolders(oldPath) && this.itemCache?.has(oldPath)) ||
				(file.extension === 'md' && isInConfiguredFolders(file.path))
			)) {
				debouncedInvalidate(`renamed: ${oldPath} → ${file.path}`);
			}
		});
	}

	/**
	 * Manually invalidate the item cache
	 * Next call to getAvailableItems() will rebuild cache
	 */
	invalidateItemCache(): void {
		this.itemCache = null;
		this.itemCacheTimestamp = 0;
		this.variantFamilyCache = null; // Also invalidate variant cache
		// Cache invalidated silently - rebuild happens on next getAvailableItems()
	}

	/**
	 * Manually rebuild cache (forces full vault scan)
	 * Used by Health Check UI to get fresh diagnostics
	 *
	 * @returns Number of items successfully cached
	 */
	async rebuildCache(): Promise<number> {
		this.invalidateItemCache();
		const items = await this.getAvailableItems();
		return items.length;
	}

	/**
	 * Get information about current cache state
	 * Used by Settings UI to display cache status
	 *
	 * @returns Cache status object with diagnostics
	 */
	getItemCacheInfo(): {
		cached: boolean;
		itemCount: number;
		ageMs: number;
		diagnostics?: DiagnosticsInfo;
	} {
		if (!this.itemCache) {
			return {
				cached: false,
				itemCount: 0,
				ageMs: 0
			};
		}

		return {
			cached: true,
			itemCount: this.itemCache.size,
			ageMs: this.getCacheAge(),
			diagnostics: this.lastDiagnostics || undefined
		};
	}

	/**
	 * Invalidate the item metadata cache
	 * Call this when items are added/removed/modified in the vault
	 *
	 * @example
	 * // After importing new items
	 * handler.invalidateCache();
	 *
	 * // Next call to getItemMetadata will re-scan vault
	 * const freshMetadata = await handler.getItemMetadata();
	 */
	invalidateCache(): void {
		console.log('ItemVaultHandler: Cache invalidated');
		this.itemTypeCache = null;
	}

	/**
	 * Check if metadata cache exists and how old it is
	 * Useful for UI to decide whether to suggest a refresh
	 *
	 * @returns Cache info or null if no cache
	 */
	getCacheInfo(): { age: number; itemCount: number } | null {
		if (!this.itemTypeCache) {
			return null;
		}

		return {
			age: Date.now() - this.itemTypeCache.lastUpdated,
			itemCount: this.itemTypeCache.totalItems
		};
	}
}
