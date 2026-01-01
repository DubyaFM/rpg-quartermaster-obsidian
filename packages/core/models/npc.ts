/**
 * NPC (Non-Player Character) data models and interfaces
 * Serves as the foundation for shopkeeps, hirelings, and general NPCs
 */

/**
 * NPCRole enum defines the different roles an NPC can have
 * An NPC can have multiple roles simultaneously
 */
export enum NPCRole {
	SHOPKEEP = 'shopkeep',
	HIRELING = 'hireling',
	FACTION_CONTACT = 'contact',
	QUEST_GIVER = 'quest_giver',
	GENERAL = 'general'
}

/**
 * NPCRelationship defines a connection between two NPCs
 * Relationships are bidirectional and stored in both NPC files
 */
export interface NPCRelationship {
	// UUID reference (preferred)
	targetNpcId?: string;  // "npc-abc123..."

	/** Link to related NPC in [[Wikilink]] format */
	npcLink: string;
	/** Type of relationship (e.g., family, ally, rival, friend, parent, employer, etc.) */
	type: string;
	/** Optional description of the relationship */
	description?: string;

	// Runtime cache (NOT persisted)
	resolvedNpc?: NPCProfile;
}

/**
 * NPCProfile is the complete data model for all NPCs in the system
 * This replaces the legacy Shopkeep interface with a more extensible model
 */
export interface NPCProfile {
	// ===== Identity =====
	/** Unique identifier for cross-platform sync */
	npcId: string;
	/** Full name of the NPC */
	name: string;
	/** D&D 5e species/race */
	species: string;
	/** Gender identity */
	gender: string;
	/** Age in years (optional) */
	age?: number;
	/** Preferred pronouns (optional) */
	pronouns?: string;

	// ===== Appearance =====
	/** Physical description for roleplay */
	physicalDescription?: string;
	/** Distinguishing features or characteristics */
	distinguishingFeatures?: string;

	// ===== Personality & Social =====
	/** Social disposition affecting interactions and pricing */
	disposition: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful';
	/** Personality quirk or motivation */
	quirk: string;
	/** D&D alignment (optional) */
	alignment?: string;
	/** Persuasion DC for bargaining, derived from disposition */
	bargainDC: number;

	// ===== Affiliations =====
	/** Faction membership (references factions.yaml) */
	faction?: string;
	/**
	 * Faction role information for dynamic faction rosters
	 * Supports multiple formats:
	 * - String: "Harpers: Agent" or "Agent (Harpers)"
	 * - Object: { faction: "[[Harpers]]", role: "Agent", rank: "Lieutenant" }
	 */
	factionRole?: string | {
		faction: string;
		role?: string;
		rank?: string;
	};
	/** Current location or district */
	location?: string;
	/** Associated bastion/stronghold (future feature) */
	bastion?: string;

	// ===== Roles =====
	/** Roles this NPC fulfills (shopkeep, hireling, etc.) */
	roles: NPCRole[];

	// ===== Relationships =====
	/** Connections to other NPCs */
	relationships: NPCRelationship[];

	// ===== Capabilities =====
	/** D&D skill proficiencies (for hirelings/combat) */
	skills?: string[];
	/** Tool proficiencies */
	toolProficiencies?: string[];
	/** Known languages */
	languages?: string[];
	/** Special abilities or features */
	specialAbilities?: string[];

	// ===== Game State =====
	/** Current status of the NPC */
	status: 'active' | 'retired' | 'deceased' | 'missing';
	/** Party's standing with this NPC (-100 to +100) */
	partyReputation?: number;

	// ===== Metadata =====
	/** Creation date (ISO 8601 format) */
	created: string;
	/** Last interaction date (ISO 8601 format) */
	lastInteraction?: string;
	/** DM notes (stored in markdown body, not frontmatter) */
	notes?: string;
}

/**
 * Partial NPC data for creation/updates
 * Makes all fields optional except those required for generation
 */
export type NPCProfileInput = Partial<NPCProfile> & {
	name: string;
	species: string;
	gender: string;
	disposition: NPCProfile['disposition'];
	quirk: string;
};

/**
 * NPCExport format for web app migration
 * Structured for SQLite database import
 */
export interface NPCExport {
	npc: Omit<NPCProfile, 'relationships' | 'roles' | 'skills' | 'toolProficiencies' | 'languages' | 'specialAbilities'>;
	roles: NPCRole[];
	relationships: Array<{
		targetNpcId: string;
		type: NPCRelationship['type'];
		description?: string;
	}>;
	capabilities: Array<{
		type: 'skill' | 'tool' | 'language' | 'ability';
		name: string;
	}>;
}
