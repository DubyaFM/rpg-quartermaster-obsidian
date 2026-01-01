/**
 * RelationshipManager - Manages bidirectional NPC relationships
 * Ensures relationships are consistent on both sides
 */

import { NPCProfile, NPCRelationship } from '../models/npc';

export class RelationshipManager {
	/**
	 * Add a relationship between two NPCs (bidirectional)
	 * Updates both NPCs to include the relationship
	 */
	addRelationship(
		npc1: NPCProfile,
		npc2: NPCProfile,
		type: string,
		description?: string
	): {
		npc1: NPCProfile;
		npc2: NPCProfile;
	} {
		// Create relationship for NPC1 -> NPC2
		const rel1: NPCRelationship = {
			npcLink: `[[${npc2.name}]]`,
			type,
			description
		};

		// Create inverse relationship for NPC2 -> NPC1
		const rel2: NPCRelationship = {
			npcLink: `[[${npc1.name}]]`,
			type: this.getInverseRelationType(type),
			description
		};

		// Add relationships if they don't already exist
		if (!this.hasRelationship(npc1, npc2.name)) {
			npc1.relationships.push(rel1);
		}

		if (!this.hasRelationship(npc2, npc1.name)) {
			npc2.relationships.push(rel2);
		}

		return { npc1, npc2 };
	}

	/**
	 * Remove a relationship between two NPCs (bidirectional)
	 * Updates both NPCs to remove the relationship
	 */
	removeRelationship(
		npc1: NPCProfile,
		npc2: NPCProfile
	): {
		npc1: NPCProfile;
		npc2: NPCProfile;
	} {
		// Remove relationship from NPC1
		npc1.relationships = npc1.relationships.filter(
			rel => !this.isRelationshipTo(rel, npc2.name)
		);

		// Remove relationship from NPC2
		npc2.relationships = npc2.relationships.filter(
			rel => !this.isRelationshipTo(rel, npc1.name)
		);

		return { npc1, npc2 };
	}

	/**
	 * Update a relationship between two NPCs
	 * Updates the relationship type and description on both sides
	 */
	updateRelationship(
		npc1: NPCProfile,
		npc2: NPCProfile,
		newType: string,
		newDescription?: string
	): {
		npc1: NPCProfile;
		npc2: NPCProfile;
	} {
		// Find and update relationship in NPC1
		const rel1 = npc1.relationships.find(r => this.isRelationshipTo(r, npc2.name));
		if (rel1) {
			rel1.type = newType;
			rel1.description = newDescription;
		}

		// Find and update inverse relationship in NPC2
		const rel2 = npc2.relationships.find(r => this.isRelationshipTo(r, npc1.name));
		if (rel2) {
			rel2.type = this.getInverseRelationType(newType);
			rel2.description = newDescription;
		}

		return { npc1, npc2 };
	}

	/**
	 * Check if an NPC has a relationship with another NPC
	 */
	hasRelationship(npc: NPCProfile, targetName: string): boolean {
		return npc.relationships.some(rel => this.isRelationshipTo(rel, targetName));
	}

	/**
	 * Get all relationships of a specific type for an NPC
	 */
	getRelationshipsByType(npc: NPCProfile, type: string): NPCRelationship[] {
		return npc.relationships.filter(rel => rel.type === type);
	}

	/**
	 * Check if a relationship points to a specific NPC
	 */
	private isRelationshipTo(relationship: NPCRelationship, targetName: string): boolean {
		// Handle both [[Name]] and Name formats
		const linkName = relationship.npcLink.replace(/\[\[|\]\]/g, '');
		return linkName === targetName;
	}

	/**
	 * Get the inverse relationship type
	 * e.g., "parent" -> "child", "employer" -> "employee"
	 */
	private getInverseRelationType(type: string): string {
		const inverseMap: Record<string, string> = {
			// Family
			'parent': 'child',
			'child': 'parent',
			'sibling': 'sibling',
			'spouse': 'spouse',
			'partner': 'partner',

			// Professional
			'employer': 'employee',
			'employee': 'employer',
			'mentor': 'apprentice',
			'apprentice': 'mentor',
			'colleague': 'colleague',

			// Social
			'friend': 'friend',
			'ally': 'ally',
			'rival': 'rival',
			'enemy': 'enemy',

			// Organizational
			'leader': 'follower',
			'follower': 'leader',
			'contact': 'contact',

			// Transactional
			'customer': 'vendor',
			'vendor': 'customer',
			'debtor': 'creditor',
			'creditor': 'debtor'
		};

		return inverseMap[type.toLowerCase()] || type;
	}

	/**
	 * Validate relationship consistency between two NPCs
	 * Returns true if relationships are bidirectional and consistent
	 */
	validateRelationship(npc1: NPCProfile, npc2: NPCProfile): {
		valid: boolean;
		issues: string[];
	} {
		const issues: string[] = [];

		// Check if NPC1 has relationship to NPC2
		const rel1 = npc1.relationships.find(r => this.isRelationshipTo(r, npc2.name));

		// Check if NPC2 has relationship to NPC1
		const rel2 = npc2.relationships.find(r => this.isRelationshipTo(r, npc1.name));

		// Both should exist or neither should exist
		if (rel1 && !rel2) {
			issues.push(`${npc1.name} has relationship to ${npc2.name}, but not vice versa`);
		} else if (!rel1 && rel2) {
			issues.push(`${npc2.name} has relationship to ${npc1.name}, but not vice versa`);
		}

		// If both exist, check if types are inverses
		if (rel1 && rel2) {
			const expectedInverse = this.getInverseRelationType(rel1.type);
			if (rel2.type !== expectedInverse) {
				issues.push(
					`Relationship type mismatch: ${npc1.name} -> ${npc2.name} is "${rel1.type}", ` +
					`but ${npc2.name} -> ${npc1.name} is "${rel2.type}" (expected "${expectedInverse}")`
				);
			}
		}

		return {
			valid: issues.length === 0,
			issues
		};
	}

	/**
	 * Repair broken relationships by making them bidirectional
	 * Returns list of NPCs that need to be updated
	 */
	repairRelationships(npcs: NPCProfile[]): {
		updates: Array<{ npc: NPCProfile; changes: string[] }>;
		summary: string;
	} {
		const updates: Array<{ npc: NPCProfile; changes: string[] }> = [];
		const npcMap = new Map(npcs.map(npc => [npc.name, npc]));

		for (const npc of npcs) {
			const changes: string[] = [];

			for (const rel of npc.relationships) {
				const targetName = rel.npcLink.replace(/\[\[|\]\]/g, '');
				const targetNPC = npcMap.get(targetName);

				if (!targetNPC) {
					changes.push(`Relationship to "${targetName}" points to non-existent NPC`);
					continue;
				}

				// Check if target has inverse relationship
				const hasInverse = targetNPC.relationships.some(
					r => this.isRelationshipTo(r, npc.name)
				);

				if (!hasInverse) {
					// Add inverse relationship
					const inverseRel: NPCRelationship = {
						npcLink: `[[${npc.name}]]`,
						type: this.getInverseRelationType(rel.type),
						description: rel.description
					};
					targetNPC.relationships.push(inverseRel);
					changes.push(`Added inverse relationship to ${targetName}`);

					// Also track the target NPC as needing update
					const existingUpdate = updates.find(u => u.npc.npcId === targetNPC.npcId);
					if (existingUpdate) {
						existingUpdate.changes.push(`Added relationship from ${npc.name}`);
					} else {
						updates.push({
							npc: targetNPC,
							changes: [`Added relationship from ${npc.name}`]
						});
					}
				}
			}

			if (changes.length > 0) {
				updates.push({ npc, changes });
			}
		}

		const summary = updates.length === 0
			? 'All relationships are bidirectional'
			: `Repaired ${updates.length} NPCs with broken relationships`;

		return { updates, summary };
	}
}
