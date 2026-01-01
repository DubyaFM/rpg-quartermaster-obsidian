// Shopkeep Generator Utility
// Generic D&D NPC generator for tavern keepers, shop owners, and merchants
// Can be reused in other D&D campaign management tools

import { Shopkeep } from '../models/types';
import { IRandomizer } from '../interfaces/IRandomizer';
import { RawShopkeepConfig } from '../interfaces/IConfigAdapter';

export interface NPCTables {
	maleNames: string[];
	femaleNames: string[];
	neutralNames?: string[];
	surnames: string[];
	genders: string[];
	species: string[];
	dispositions: Array<{
		type: string;
		weight: number;
		dc: number;
	}>;
	quirks: string[];
	motivations: string[];
}

/**
 * Flatten tiered species config into weighted species list
 * Converts tier structure (tier1, tier2, tier3, tier4) into flat array of weighted species
 *
 * @param speciesTiers Species organized by tiers with weights
 * @returns Array of species objects with name and weight
 */
export function flattenSpeciesTiers(speciesTiers: RawShopkeepConfig['species']): Array<{ name: string; weight: number }> {
	const allSpecies: Array<{ name: string; weight: number }> = [];

	// Combine all tiers into single array
	if (speciesTiers.tier1) allSpecies.push(...speciesTiers.tier1);
	if (speciesTiers.tier2) allSpecies.push(...speciesTiers.tier2);
	if (speciesTiers.tier3) allSpecies.push(...speciesTiers.tier3);
	if (speciesTiers.tier4) allSpecies.push(...speciesTiers.tier4);

	return allSpecies;
}

/**
 * Generate a random NPC shopkeep with personality traits (new weighted format)
 * @param randomizer Randomizer implementation for generating random values
 * @param config Shopkeeper configuration with weighted species tiers
 * @returns Shopkeep object with name, species, gender, disposition, quirk, and bargain DC
 */
export function generateRandomShopkeep(randomizer: IRandomizer, config: RawShopkeepConfig): Shopkeep;
/**
 * Generate a random NPC shopkeep with personality traits (legacy format)
 * @param randomizer Randomizer implementation for generating random values
 * @param tables NPC generation tables with names, species, dispositions, quirks
 * @returns Shopkeep object with name, species, gender, disposition, quirk, and bargain DC
 */
export function generateRandomShopkeep(randomizer: IRandomizer, tables: NPCTables): Shopkeep;
export function generateRandomShopkeep(randomizer: IRandomizer, configOrTables: RawShopkeepConfig | NPCTables): Shopkeep {
	// Check if using new config format (has .names property) or legacy format
	const isNewFormat = 'names' in configOrTables;

	let maleNames: string[], femaleNames: string[], neutralNames: string[];
	let surnames: string[], genders: string[];
	let speciesOptions: string[] | Array<{ name: string; weight: number }>;
	let dispositions: Array<{ type: string; weight: number; dc: number }>;
	let quirks: string[], motivations: string[];

	if (isNewFormat) {
		// New format: RawShopkeepConfig
		const config = configOrTables as RawShopkeepConfig;
		maleNames = config.names.male;
		femaleNames = config.names.female;
		neutralNames = config.names.neutral;
		surnames = config.surnames;
		genders = config.genders;
		speciesOptions = flattenSpeciesTiers(config.species); // Weighted species
		dispositions = config.dispositions;
		quirks = config.quirks;
		motivations = config.motivations;
	} else {
		// Legacy format: NPCTables
		const tables = configOrTables as NPCTables;
		maleNames = tables.maleNames;
		femaleNames = tables.femaleNames;
		neutralNames = tables.neutralNames || tables.maleNames;
		surnames = tables.surnames;
		genders = tables.genders;
		speciesOptions = tables.species; // Simple string array
		dispositions = tables.dispositions;
		quirks = tables.quirks;
		motivations = tables.motivations;
	}

	// Randomly select gender first using randomizer
	const gender = randomizer.randomChoice(genders);

	// Select name based on gender
	let firstName: string;
	if (gender === 'male') {
		firstName = randomizer.randomChoice(maleNames);
	} else if (gender === 'female') {
		firstName = randomizer.randomChoice(femaleNames);
	} else {
		firstName = randomizer.randomChoice(neutralNames);
	}

	// Add surname
	const surname = randomizer.randomChoice(surnames);
	const fullName = `${firstName} ${surname}`;

	// Select species (weighted if new format, random if legacy)
	let species: string;
	if (Array.isArray(speciesOptions) && speciesOptions.length > 0) {
		if (typeof speciesOptions[0] === 'object' && 'name' in speciesOptions[0]) {
			// Weighted species selection (new format)
			const speciesWeighted = speciesOptions as Array<{ name: string; weight: number }>;
			const weights = speciesWeighted.map(s => s.weight);
			const selectedSpecies = randomizer.weightedChoice(speciesWeighted, weights);
			species = selectedSpecies.name;
		} else {
			// Simple random selection (legacy format)
			species = randomizer.randomChoice(speciesOptions as string[]);
		}
	} else {
		species = 'Human'; // Fallback
	}

	// Select disposition using weighted random
	const dispositionWeights = dispositions.map(d => d.weight);
	const dispositionObj = randomizer.weightedChoice(dispositions, dispositionWeights);
	const disposition = dispositionObj.type as 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful';
	const bargainDC = dispositionObj.dc;

	// Select quirk (80% quirk, 20% motivation for variety)
	const useMotivation = randomizer.chance(20); // 20% chance
	const quirk = useMotivation
		? randomizer.randomChoice(motivations)
		: randomizer.randomChoice(quirks);

	return {
		name: fullName,
		species: species,
		gender: gender,
		disposition: disposition,
		quirk: quirk,
		bargainDC: bargainDC
	};
}

/**
 * Re-roll a specific trait of an existing shopkeep (new weighted format)
 * @param randomizer Randomizer implementation for generating random values
 * @param shopkeep Existing shopkeep to modify
 * @param trait Trait to re-roll
 * @param config Shopkeeper configuration with weighted species
 * @returns Modified shopkeep with new trait value
 */
export function rerollShopkeepTrait(
	randomizer: IRandomizer,
	shopkeep: Shopkeep,
	trait: 'name' | 'species' | 'gender' | 'disposition' | 'quirk',
	config: RawShopkeepConfig
): Shopkeep;
/**
 * Re-roll a specific trait of an existing shopkeep (legacy format)
 * @param randomizer Randomizer implementation for generating random values
 * @param shopkeep Existing shopkeep to modify
 * @param trait Trait to re-roll
 * @param tables NPC generation tables
 * @returns Modified shopkeep with new trait value
 */
export function rerollShopkeepTrait(
	randomizer: IRandomizer,
	shopkeep: Shopkeep,
	trait: 'name' | 'species' | 'gender' | 'disposition' | 'quirk',
	tables: NPCTables
): Shopkeep;
export function rerollShopkeepTrait(
	randomizer: IRandomizer,
	shopkeep: Shopkeep,
	trait: 'name' | 'species' | 'gender' | 'disposition' | 'quirk',
	configOrTables: RawShopkeepConfig | NPCTables
): Shopkeep {
	const updated = { ...shopkeep };
	const isNewFormat = 'names' in configOrTables;

	switch (trait) {
		case 'name':
			const gender = updated.gender;
			let firstName: string;
			if (isNewFormat) {
				const config = configOrTables as RawShopkeepConfig;
				if (gender === 'male') {
					firstName = randomizer.randomChoice(config.names.male);
				} else if (gender === 'female') {
					firstName = randomizer.randomChoice(config.names.female);
				} else {
					firstName = randomizer.randomChoice(config.names.neutral);
				}
				const surname = randomizer.randomChoice(config.surnames);
				updated.name = `${firstName} ${surname}`;
			} else {
				const tables = configOrTables as NPCTables;
				if (gender === 'male') {
					firstName = randomizer.randomChoice(tables.maleNames);
				} else if (gender === 'female') {
					firstName = randomizer.randomChoice(tables.femaleNames);
				} else {
					firstName = randomizer.randomChoice(tables.neutralNames || tables.maleNames);
				}
				const surname = randomizer.randomChoice(tables.surnames);
				updated.name = `${firstName} ${surname}`;
			}
			break;

		case 'species':
			if (isNewFormat) {
				const config = configOrTables as RawShopkeepConfig;
				const speciesWeighted = flattenSpeciesTiers(config.species);
				const weights = speciesWeighted.map(s => s.weight);
				const selectedSpecies = randomizer.weightedChoice(speciesWeighted, weights);
				updated.species = selectedSpecies.name;
			} else {
				const tables = configOrTables as NPCTables;
				updated.species = randomizer.randomChoice(tables.species);
			}
			break;

		case 'gender':
			if (isNewFormat) {
				const config = configOrTables as RawShopkeepConfig;
				updated.gender = randomizer.randomChoice(config.genders);
				// Re-generate name to match new gender
				let newFirstName: string;
				if (updated.gender === 'male') {
					newFirstName = randomizer.randomChoice(config.names.male);
				} else if (updated.gender === 'female') {
					newFirstName = randomizer.randomChoice(config.names.female);
				} else {
					newFirstName = randomizer.randomChoice(config.names.neutral);
				}
				const currentSurname = updated.name.split(' ').slice(1).join(' ');
				updated.name = `${newFirstName} ${currentSurname}`;
			} else {
				const tables = configOrTables as NPCTables;
				updated.gender = randomizer.randomChoice(tables.genders);
				// Re-generate name to match new gender
				let newFirstName: string;
				if (updated.gender === 'male') {
					newFirstName = randomizer.randomChoice(tables.maleNames);
				} else if (updated.gender === 'female') {
					newFirstName = randomizer.randomChoice(tables.femaleNames);
				} else {
					newFirstName = randomizer.randomChoice(tables.neutralNames || tables.maleNames);
				}
				const currentSurname = updated.name.split(' ').slice(1).join(' ');
				updated.name = `${newFirstName} ${currentSurname}`;
			}
			break;

		case 'disposition':
			if (isNewFormat) {
				const config = configOrTables as RawShopkeepConfig;
				const dispositionWeights = config.dispositions.map(d => d.weight);
				const dispositionObj = randomizer.weightedChoice(config.dispositions, dispositionWeights);
				updated.disposition = dispositionObj.type as 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful';
				updated.bargainDC = dispositionObj.dc;
			} else {
				const tables = configOrTables as NPCTables;
				const dispositionWeights = tables.dispositions.map(d => d.weight);
				const dispositionObj = randomizer.weightedChoice(tables.dispositions, dispositionWeights);
				updated.disposition = dispositionObj.type as 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful';
				updated.bargainDC = dispositionObj.dc;
			}
			break;

		case 'quirk':
			const useMotivation = randomizer.chance(20); // 20% chance
			if (isNewFormat) {
				const config = configOrTables as RawShopkeepConfig;
				updated.quirk = useMotivation
					? randomizer.randomChoice(config.motivations)
					: randomizer.randomChoice(config.quirks);
			} else {
				const tables = configOrTables as NPCTables;
				updated.quirk = useMotivation
					? randomizer.randomChoice(tables.motivations)
					: randomizer.randomChoice(tables.quirks);
			}
			break;
	}

	return updated;
}
