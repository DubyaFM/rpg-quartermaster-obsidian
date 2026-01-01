// Faction Utilities
// Load and manage faction affiliations from YAML configuration
// Provides faction lookup and display utilities for shop management

import * as yaml from 'js-yaml';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Faction } from '../models/types';

/**
 * Internal cache for loaded factions
 */
let factionsCache: Faction[] | null = null;

/**
 * Load factions from factions.yaml file
 * Uses caching to avoid repeated file reads
 *
 * @returns Array of faction objects
 */
export function loadFactions(): Faction[] {
	// Return cached factions if already loaded
	if (factionsCache !== null) {
		return factionsCache;
	}

	try {
		// Load YAML file from plugin directory
		const yamlPath = join(__dirname, 'factions.yaml');
		const fileContents = readFileSync(yamlPath, 'utf8');
		const data = yaml.load(fileContents) as { factions: Faction[] };

		if (!data || !data.factions || !Array.isArray(data.factions)) {
			console.error('Invalid factions.yaml structure');
			return [];
		}

		// Cache the loaded factions
		factionsCache = data.factions;
		return factionsCache;
	} catch (error) {
		console.error('Error loading factions.yaml:', error);
		return [];
	}
}

/**
 * Get array of faction names for dropdown menus
 * Includes "None" option for independent shops
 *
 * @returns Array of faction name strings
 */
export function getFactionNames(): string[] {
	const factions = loadFactions();
	return factions.map(f => f.name);
}

/**
 * Get specific faction details by name
 *
 * @param factionName Name of the faction to retrieve
 * @returns Faction object or undefined if not found
 */
export function getFaction(factionName: string): Faction | undefined {
	const factions = loadFactions();
	return factions.find(f => f.name === factionName);
}

/**
 * Get faction description for display purposes
 *
 * @param factionName Name of the faction
 * @returns Faction description or empty string if not found
 */
export function getFactionDescription(factionName: string): string {
	const faction = getFaction(factionName);
	return faction ? faction.description : '';
}

/**
 * Get faction alignment for display purposes
 *
 * @param factionName Name of the faction
 * @returns Faction alignment or empty string if not found
 */
export function getFactionAlignment(factionName: string): string {
	const faction = getFaction(factionName);
	return faction ? faction.alignment : '';
}

/**
 * Check if a faction name is valid (exists in factions.yaml)
 *
 * @param factionName Name to validate
 * @returns True if faction exists, false otherwise
 */
export function isValidFaction(factionName: string): boolean {
	if (!factionName || factionName === '' || factionName === 'None') {
		return true; // Empty or "None" is valid (no affiliation)
	}
	return getFaction(factionName) !== undefined;
}

/**
 * Clear the factions cache
 * Useful for testing or if factions.yaml is modified during runtime
 */
export function clearFactionsCache(): void {
	factionsCache = null;
}
