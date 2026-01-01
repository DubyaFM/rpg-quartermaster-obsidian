import { RPGShopkeepSettings } from '@quartermaster/core/models/types';
import { Shop, Item, Location, FactionEntity } from '@quartermaster/core/models/types';
import { NPCProfile } from '@quartermaster/core/models/npc';

/**
 * Centralized UUID management with dual-mode support.
 *
 * Memory-Only Mode (storeCrossPlatformIds = false):
 * - UUIDs generated at runtime
 * - Stored in Map, cleared on plugin unload
 * - Files remain clean (no ID fields in frontmatter)
 *
 * Persistent Mode (storeCrossPlatformIds = true):
 * - UUIDs stored in entity frontmatter
 * - Survives plugin reload
 * - Required for cross-platform sync
 */
export class UUIDRegistry {
	// Memory-only storage (when setting disabled)
	private shopRegistry: Map<string, string> = new Map();
	private npcRegistry: Map<string, string> = new Map();
	private itemRegistry: Map<string, string> = new Map();
	private locationRegistry: Map<string, string> = new Map();
	private factionRegistry: Map<string, string> = new Map();

	constructor(private settingsGetter: () => RPGShopkeepSettings) {}

	private get settings(): RPGShopkeepSettings {
		return this.settingsGetter();
	}

	/**
	 * Retrieves the UUID for a shop.
	 * In persistent mode, reads from the Shop object's id field.
	 * In memory-only mode, reads from the internal shopRegistry Map.
	 *
	 * @param path - The file path associated with the shop
	 * @param shop - The Shop object
	 * @returns The shop's UUID in format "shop-{uuid}"
	 */
	getShopId(path: string, shop: Shop): string {
		if (this.settings.storeCrossPlatformIds) {
			// Read from entity (will be persisted to frontmatter)
			return shop.id || this.generateShopId();
		} else {
			// Read from memory registry
			if (!this.shopRegistry.has(path)) {
				this.shopRegistry.set(path, this.generateShopId());
			}
			return this.shopRegistry.get(path)!;
		}
	}

	/**
	 * Sets the UUID for a shop.
	 * In persistent mode, writes to the Shop object's id field.
	 * In memory-only mode, writes to the internal shopRegistry Map.
	 *
	 * @param path - The file path associated with the shop
	 * @param shop - The Shop object to update
	 * @param uuid - The UUID to assign
	 */
	setShopId(path: string, shop: Shop, uuid: string): void {
		if (this.settings.storeCrossPlatformIds) {
			// Write to entity (will be persisted to frontmatter)
			shop.id = uuid;
		} else {
			// Write to memory only
			this.shopRegistry.set(path, uuid);
		}
	}

	/**
	 * Retrieves the UUID for an NPC.
	 * NPCs always use persistent IDs via the npcId field.
	 *
	 * @param path - The file path associated with the NPC
	 * @param npc - The NPCProfile object
	 * @returns The NPC's UUID in format "npc-{uuid}"
	 */
	getNpcId(path: string, npc: NPCProfile): string {
		// NPCs always have persistent IDs (npcId field already exists)
		return npc.npcId || this.generateNpcId();
	}

	/**
	 * Sets the UUID for an NPC.
	 * NPCs always use persistent IDs via the npcId field.
	 *
	 * @param path - The file path associated with the NPC
	 * @param npc - The NPCProfile object to update
	 * @param uuid - The UUID to assign
	 */
	setNpcId(path: string, npc: NPCProfile, uuid: string): void {
		// NPCs always use persistent IDs
		npc.npcId = uuid;
	}

	/**
	 * Retrieves the UUID for an item.
	 * In persistent mode, reads from the Item object's id field.
	 * In memory-only mode, reads from the internal itemRegistry Map.
	 *
	 * @param path - The file path associated with the item
	 * @param item - The Item object
	 * @returns The item's UUID in format "item-{uuid}"
	 */
	getItemId(path: string, item: Item): string {
		if (this.settings.storeCrossPlatformIds) {
			return item.id || this.generateItemId();
		} else {
			if (!this.itemRegistry.has(path)) {
				this.itemRegistry.set(path, this.generateItemId());
			}
			return this.itemRegistry.get(path)!;
		}
	}

	/**
	 * Sets the UUID for an item.
	 * In persistent mode, writes to the Item object's id field.
	 * In memory-only mode, writes to the internal itemRegistry Map.
	 *
	 * @param path - The file path associated with the item
	 * @param item - The Item object to update
	 * @param uuid - The UUID to assign
	 */
	setItemId(path: string, item: Item, uuid: string): void {
		if (this.settings.storeCrossPlatformIds) {
			item.id = uuid;
		} else {
			this.itemRegistry.set(path, uuid);
		}
	}

	/**
	 * Retrieves the UUID for a location.
	 * Locations always use persistent IDs via the locationId field.
	 *
	 * @param path - The file path associated with the location
	 * @param location - The Location object
	 * @returns The location's UUID in format "location-{uuid}"
	 */
	getLocationId(path: string, location: Location): string {
		// Locations always have persistent IDs (locationId field is required)
		return location.locationId || this.generateLocationId();
	}

	/**
	 * Sets the UUID for a location.
	 * Locations always use persistent IDs via the locationId field.
	 *
	 * @param path - The file path associated with the location
	 * @param location - The Location object to update
	 * @param uuid - The UUID to assign
	 */
	setLocationId(path: string, location: Location, uuid: string): void {
		// Locations always use persistent IDs
		location.locationId = uuid;
	}

	/**
	 * Retrieves the UUID for a faction.
	 * Factions always use persistent IDs via the factionId field.
	 *
	 * @param path - The file path associated with the faction
	 * @param faction - The FactionEntity object
	 * @returns The faction's UUID in format "faction-{uuid}"
	 */
	getFactionId(path: string, faction: FactionEntity): string {
		// Factions always have persistent IDs (factionId field is required)
		return faction.factionId || this.generateFactionId();
	}

	/**
	 * Sets the UUID for a faction.
	 * Factions always use persistent IDs via the factionId field.
	 *
	 * @param path - The file path associated with the faction
	 * @param faction - The FactionEntity object to update
	 * @param uuid - The UUID to assign
	 */
	setFactionId(path: string, faction: FactionEntity, uuid: string): void {
		// Factions always use persistent IDs
		faction.factionId = uuid;
	}

	/**
	 * Generates a new shop UUID.
	 * Format: "shop-{uuid}" where uuid is a standard RFC 4122 v4 UUID
	 *
	 * @returns A new shop UUID
	 */
	generateShopId(): string {
		return `shop-${crypto.randomUUID()}`;
	}

	/**
	 * Generates a new NPC UUID.
	 * Format: "npc-{uuid}" where uuid is a standard RFC 4122 v4 UUID
	 *
	 * @returns A new NPC UUID
	 */
	generateNpcId(): string {
		return `npc-${crypto.randomUUID()}`;
	}

	/**
	 * Generates a new item UUID.
	 * Format: "item-{uuid}" where uuid is a standard RFC 4122 v4 UUID
	 *
	 * @returns A new item UUID
	 */
	generateItemId(): string {
		return `item-${crypto.randomUUID()}`;
	}

	/**
	 * Generates a new transaction UUID.
	 * Format: "txn-{uuid}" where uuid is a standard RFC 4122 v4 UUID
	 *
	 * @returns A new transaction UUID
	 */
	generateTransactionId(): string {
		return `txn-${crypto.randomUUID()}`;
	}

	/**
	 * Generates a new location UUID.
	 * Format: "location-{uuid}" where uuid is a standard RFC 4122 v4 UUID
	 *
	 * @returns A new location UUID
	 */
	generateLocationId(): string {
		return `location-${crypto.randomUUID()}`;
	}

	/**
	 * Generates a new faction UUID.
	 * Format: "faction-{uuid}" where uuid is a standard RFC 4122 v4 UUID
	 *
	 * @returns A new faction UUID
	 */
	generateFactionId(): string {
		return `faction-${crypto.randomUUID()}`;
	}

	/**
	 * Generates a new project template UUID.
	 * Format: "template-{uuid}" where uuid is a standard RFC 4122 v4 UUID
	 *
	 * @returns A new project template UUID
	 */
	generateProjectTemplateId(): string {
		return `template-${crypto.randomUUID()}`;
	}

	/**
	 * Generates a new party member UUID.
	 * Format: "member-{uuid}" where uuid is a standard RFC 4122 v4 UUID
	 *
	 * @returns A new party member UUID
	 */
	generatePartyMemberId(): string {
		return `member-${crypto.randomUUID()}`;
	}

	/**
	 * Generates a new project instance UUID.
	 * Format: "project-{uuid}" where uuid is a standard RFC 4122 v4 UUID
	 *
	 * @returns A new project instance UUID
	 */
	generateProjectInstanceId(): string {
		return `project-${crypto.randomUUID()}`;
	}

	/**
	 * Clears all memory-only registries when the plugin is unloaded.
	 * This is called during plugin shutdown to clean up in-memory UUIDs.
	 * Persistent UUIDs remain untouched.
	 */
	clear(): void {
		this.shopRegistry.clear();
		this.npcRegistry.clear();
		this.itemRegistry.clear();
		this.locationRegistry.clear();
		this.factionRegistry.clear();
	}

	/**
	 * Exposes the shop registry for getById lookups in memory-only mode.
	 *
	 * @returns A Map of file paths to shop UUIDs
	 */
	get shopRegistryMap(): Map<string, string> {
		return this.shopRegistry;
	}

	/**
	 * Exposes the NPC registry for getById lookups in memory-only mode.
	 *
	 * @returns A Map of file paths to NPC UUIDs
	 */
	get npcRegistryMap(): Map<string, string> {
		return this.npcRegistry;
	}

	/**
	 * Exposes the item registry for getById lookups in memory-only mode.
	 *
	 * @returns A Map of file paths to item UUIDs
	 */
	get itemRegistryMap(): Map<string, string> {
		return this.itemRegistry;
	}

	/**
	 * Exposes the location registry for getById lookups in memory-only mode.
	 *
	 * @returns A Map of file paths to location UUIDs
	 */
	get locationRegistryMap(): Map<string, string> {
		return this.locationRegistry;
	}

	/**
	 * Exposes the faction registry for getById lookups in memory-only mode.
	 *
	 * @returns A Map of file paths to faction UUIDs
	 */
	get factionRegistryMap(): Map<string, string> {
		return this.factionRegistry;
	}
}
