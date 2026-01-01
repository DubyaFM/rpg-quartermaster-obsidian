/**
 * NPC Generator
 * Extends shopkeeper generation to create full NPCProfile objects
 */

import { NPCProfile, NPCRole, NPCProfileInput } from '../models/npc';
import { IRandomizer } from '../interfaces/IRandomizer';
import { RawShopkeepConfig } from '../interfaces/IConfigAdapter';
import { generateRandomShopkeep, NPCTables } from './shopkeeper';

/**
 * Generate a simple unique ID
 * Format: npc_timestamp_random
 */
function generateId(): string {
	return `npc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a complete NPC with all properties
 * @param randomizer Randomizer implementation
 * @param config Shopkeeper configuration (contains name/species/disposition data)
 * @param options Optional properties to customize the NPC
 * @returns Complete NPCProfile
 */
export function generateNPC(
	randomizer: IRandomizer,
	config: RawShopkeepConfig,
	options?: Partial<NPCProfileInput>
): NPCProfile {
	// Use existing shopkeeper generator for base properties
	const shopkeep = generateRandomShopkeep(randomizer, config);

	// Generate unique ID for the NPC
	const npcId = generateId();

	// Build complete NPC profile
	const npc: NPCProfile = {
		// From shopkeeper generation
		npcId,
		name: options?.name || shopkeep.name,
		species: options?.species || shopkeep.species,
		gender: options?.gender || shopkeep.gender,
		disposition: options?.disposition || shopkeep.disposition,
		quirk: options?.quirk || shopkeep.quirk,
		bargainDC: shopkeep.bargainDC,

		// Optional identity fields
		age: options?.age,
		pronouns: options?.pronouns || inferPronouns(shopkeep.gender),

		// Appearance (empty by default, DM can fill in)
		physicalDescription: options?.physicalDescription,
		distinguishingFeatures: options?.distinguishingFeatures,

		// Alignment (random if not provided)
		alignment: options?.alignment || generateAlignment(randomizer),

		// Affiliations
		faction: options?.faction,
		location: options?.location,
		bastion: options?.bastion,

		// Roles
		roles: options?.roles || [NPCRole.GENERAL],

		// Relationships (empty by default)
		relationships: options?.relationships || [],

		// Capabilities (empty by default, can be customized)
		skills: options?.skills,
		toolProficiencies: options?.toolProficiencies,
		languages: options?.languages || ['Common'],
		specialAbilities: options?.specialAbilities,

		// Game state
		status: options?.status || 'active',
		partyReputation: options?.partyReputation || 0,

		// Metadata
		created: new Date().toISOString(),
		lastInteraction: options?.lastInteraction,
		notes: options?.notes
	};

	return npc;
}

/**
 * Generate an NPC specifically for shopkeep role
 * Includes shopkeep role and optional shop-specific customization
 */
export function generateShopkeepNPC(
	randomizer: IRandomizer,
	config: RawShopkeepConfig,
	options?: {
		shopType?: string;
		location?: string;
		faction?: string;
	}
): NPCProfile {
	const npc = generateNPC(randomizer, config, {
		roles: [NPCRole.SHOPKEEP],
		location: options?.location,
		faction: options?.faction
	});

	// Add tool proficiencies based on shop type
	if (options?.shopType) {
		npc.toolProficiencies = getToolProficienciesForShopType(options.shopType);
	}

	return npc;
}

/**
 * Convert legacy Shopkeep to NPCProfile
 * Used for migration from old shop files
 */
export function shopkeepToNPC(shopkeep: {
	name: string;
	species: string;
	gender: string;
	disposition: 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful';
	quirk: string;
	bargainDC: number;
}): NPCProfile {
	return {
		npcId: generateId(),
		name: shopkeep.name,
		species: shopkeep.species,
		gender: shopkeep.gender,
		disposition: shopkeep.disposition,
		quirk: shopkeep.quirk,
		bargainDC: shopkeep.bargainDC,
		pronouns: inferPronouns(shopkeep.gender),
		roles: [NPCRole.SHOPKEEP],
		relationships: [],
		languages: ['Common'],
		status: 'active',
		partyReputation: 0,
		created: new Date().toISOString()
	};
}

/**
 * Infer pronouns from gender
 */
function inferPronouns(gender: string): string {
	switch (gender.toLowerCase()) {
		case 'male':
			return 'he/him';
		case 'female':
			return 'she/her';
		case 'non-binary':
		case 'nonbinary':
			return 'they/them';
		default:
			return 'they/them';
	}
}

/**
 * Generate random D&D alignment
 */
function generateAlignment(randomizer: IRandomizer): string {
	const alignments = [
		'Lawful Good', 'Neutral Good', 'Chaotic Good',
		'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
		'Lawful Evil', 'Neutral Evil', 'Chaotic Evil'
	];

	// Weight towards neutral and good alignments for NPCs
	const weights = [
		10, 15, 8,  // Good (weighted towards Neutral Good)
		12, 20, 10, // Neutral (weighted towards True Neutral)
		5, 8, 2     // Evil (less common)
	];

	return randomizer.weightedChoice(alignments, weights);
}

/**
 * Get tool proficiencies based on shop type
 */
function getToolProficienciesForShopType(shopType: string): string[] {
	const proficiencies: Record<string, string[]> = {
		blacksmith: ["Smith's Tools", "Tinker's Tools"],
		alchemist: ["Alchemist's Supplies", "Herbalism Kit"],
		magic: ["Arcana"],
		general: ["Merchant's Tools"],
		tavern: ["Brewer's Supplies", "Cook's Utensils"],
		inn: ["Brewer's Supplies", "Cook's Utensils"],
		temple: ["Herbalism Kit"],
		marketplace: ["Merchant's Tools"],
		travel: ["Navigator's Tools", "Cartographer's Tools"]
	};

	return proficiencies[shopType.toLowerCase()] || [];
}

/**
 * Generate a random hireling NPC with appropriate skills
 */
export function generateHirelingNPC(
	randomizer: IRandomizer,
	config: RawShopkeepConfig,
	type: 'unskilled' | 'skilled' | 'expert',
	options?: {
		skills?: string[];
		toolProficiencies?: string[];
		level?: number;
	}
): NPCProfile {
	const npc = generateNPC(randomizer, config, {
		roles: [NPCRole.HIRELING]
	});

	// Add capabilities based on hireling type
	if (type === 'skilled' || type === 'expert') {
		npc.skills = options?.skills || generateRandomSkills(randomizer, type === 'expert' ? 3 : 1);
		npc.toolProficiencies = options?.toolProficiencies || [];
	}

	if (type === 'expert') {
		npc.specialAbilities = generateExpertAbilities(randomizer);
	}

	return npc;
}

/**
 * Generate random D&D skills
 */
function generateRandomSkills(randomizer: IRandomizer, count: number): string[] {
	const allSkills = [
		'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics',
		'Deception', 'History', 'Insight', 'Intimidation',
		'Investigation', 'Medicine', 'Nature', 'Perception',
		'Performance', 'Persuasion', 'Religion', 'Sleight of Hand',
		'Stealth', 'Survival'
	];

	const skills: string[] = [];
	const available = [...allSkills];

	for (let i = 0; i < count && available.length > 0; i++) {
		const index = randomizer.randomInt(0, available.length - 1);
		skills.push(available[index]);
		available.splice(index, 1);
	}

	return skills;
}

/**
 * Generate expert hireling abilities
 */
function generateExpertAbilities(randomizer: IRandomizer): string[] {
	const abilities = [
		'Sneak Attack',
		'Extra Attack',
		'Evasion',
		'Uncanny Dodge',
		'Fast Hands',
		'Second Wind',
		'Action Surge',
		'Spellcasting (Cantrips)'
	];

	// Select 1-2 abilities
	const count = randomizer.randomInt(1, 2);
	const selected: string[] = [];

	for (let i = 0; i < count; i++) {
		const ability = randomizer.randomChoice(abilities.filter(a => !selected.includes(a)));
		selected.push(ability);
	}

	return selected;
}
