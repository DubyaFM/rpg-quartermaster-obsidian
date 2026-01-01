/**
 * NPCRegistry provides caching and lookup services for NPCs
 * Reduces file I/O by maintaining an in-memory cache
 */

import { NPCProfile, NPCRole } from '../models/npc';

export class NPCRegistry {
	private cache: Map<string, NPCProfile> = new Map();
	private pathToIdMap: Map<string, string> = new Map();

	/**
	 * Add or update an NPC in the registry
	 */
	register(npc: NPCProfile, filePath?: string): void {
		this.cache.set(npc.npcId, npc);

		if (filePath) {
			this.pathToIdMap.set(filePath, npc.npcId);
		}
	}

	/**
	 * Get an NPC by ID
	 */
	get(npcId: string): NPCProfile | undefined {
		return this.cache.get(npcId);
	}

	/**
	 * Get an NPC by file path
	 */
	getByPath(filePath: string): NPCProfile | undefined {
		const npcId = this.pathToIdMap.get(filePath);
		return npcId ? this.cache.get(npcId) : undefined;
	}

	/**
	 * Get an NPC by name (first match)
	 */
	getByName(name: string): NPCProfile | undefined {
		for (const npc of this.cache.values()) {
			if (npc.name === name) {
				return npc;
			}
		}
		return undefined;
	}

	/**
	 * Get all NPCs with a specific role
	 */
	getByRole(role: NPCRole): NPCProfile[] {
		const results: NPCProfile[] = [];
		for (const npc of this.cache.values()) {
			if (npc.roles.includes(role)) {
				results.push(npc);
			}
		}
		return results;
	}

	/**
	 * Get all NPCs in a specific faction
	 */
	getByFaction(faction: string): NPCProfile[] {
		const results: NPCProfile[] = [];
		for (const npc of this.cache.values()) {
			if (npc.faction === faction) {
				results.push(npc);
			}
		}
		return results;
	}

	/**
	 * Get all NPCs at a specific location
	 */
	getByLocation(location: string): NPCProfile[] {
		const results: NPCProfile[] = [];
		for (const npc of this.cache.values()) {
			if (npc.location === location) {
				results.push(npc);
			}
		}
		return results;
	}

	/**
	 * Get all NPCs with a specific status
	 */
	getByStatus(status: NPCProfile['status']): NPCProfile[] {
		const results: NPCProfile[] = [];
		for (const npc of this.cache.values()) {
			if (npc.status === status) {
				results.push(npc);
			}
		}
		return results;
	}

	/**
	 * Search NPCs by name (partial match, case-insensitive)
	 */
	search(query: string): NPCProfile[] {
		const lowerQuery = query.toLowerCase();
		const results: NPCProfile[] = [];

		for (const npc of this.cache.values()) {
			if (npc.name.toLowerCase().includes(lowerQuery)) {
				results.push(npc);
			}
		}

		return results;
	}

	/**
	 * Advanced filter with multiple criteria
	 */
	filter(criteria: {
		role?: NPCRole;
		faction?: string;
		location?: string;
		status?: NPCProfile['status'];
		disposition?: NPCProfile['disposition'];
	}): NPCProfile[] {
		let results = Array.from(this.cache.values());

		if (criteria.role !== undefined) {
			results = results.filter(npc => npc.roles.includes(criteria.role!));
		}

		if (criteria.faction !== undefined) {
			results = results.filter(npc => npc.faction === criteria.faction);
		}

		if (criteria.location !== undefined) {
			results = results.filter(npc => npc.location === criteria.location);
		}

		if (criteria.status !== undefined) {
			results = results.filter(npc => npc.status === criteria.status);
		}

		if (criteria.disposition !== undefined) {
			results = results.filter(npc => npc.disposition === criteria.disposition);
		}

		return results;
	}

	/**
	 * Remove an NPC from the registry
	 */
	remove(npcId: string): void {
		this.cache.delete(npcId);

		// Remove from pathToIdMap
		for (const [path, id] of this.pathToIdMap.entries()) {
			if (id === npcId) {
				this.pathToIdMap.delete(path);
				break;
			}
		}
	}

	/**
	 * Clear all cached NPCs
	 */
	clear(): void {
		this.cache.clear();
		this.pathToIdMap.clear();
	}

	/**
	 * Get all NPCs in the registry
	 */
	getAll(): NPCProfile[] {
		return Array.from(this.cache.values());
	}

	/**
	 * Get count of cached NPCs
	 */
	size(): number {
		return this.cache.size;
	}

	/**
	 * Check if an NPC is in the registry
	 */
	has(npcId: string): boolean {
		return this.cache.has(npcId);
	}

	/**
	 * Get NPCs sorted by last interaction (most recent first)
	 */
	getRecentlyInteracted(limit?: number): NPCProfile[] {
		const npcs = Array.from(this.cache.values())
			.filter(npc => npc.lastInteraction !== undefined)
			.sort((a, b) => {
				const dateA = new Date(a.lastInteraction!).getTime();
				const dateB = new Date(b.lastInteraction!).getTime();
				return dateB - dateA; // Most recent first
			});

		return limit ? npcs.slice(0, limit) : npcs;
	}

	/**
	 * Get NPCs with high party reputation (threshold: >= 50)
	 */
	getAllies(): NPCProfile[] {
		return Array.from(this.cache.values())
			.filter(npc => (npc.partyReputation ?? 0) >= 50);
	}

	/**
	 * Get NPCs with low party reputation (threshold: <= -50)
	 */
	getEnemies(): NPCProfile[] {
		return Array.from(this.cache.values())
			.filter(npc => (npc.partyReputation ?? 0) <= -50);
	}

	/**
	 * Update an NPC's reputation
	 */
	updateReputation(npcId: string, change: number): void {
		const npc = this.cache.get(npcId);
		if (npc) {
			const current = npc.partyReputation ?? 0;
			npc.partyReputation = Math.max(-100, Math.min(100, current + change));
		}
	}
}
