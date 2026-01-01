/**
 * LocationService
 *
 * Service layer for location entity management.
 * Generates dynamic tables (residents, businesses, factions) for location files.
 *
 * NOTE: This is platform-agnostic. File I/O is handled by LocationFileHandler in adapter layer.
 */

import { Location, RenownComponent, RenownRank } from '../models/types';

// ============================================================================
// Dynamic Table Generation
// ============================================================================

export interface ResidentEntry {
	name: string;
	link: string;  // [[NPC Name]]
	species?: string;
	occupation?: string;
	faction?: string;
}

export interface BusinessEntry {
	name: string;
	link: string;  // [[Shop Name]]
	type: string;
	wealthLevel?: string;
	shopkeeper?: string;
}

export interface FactionPresenceEntry {
	name: string;
	link: string;  // [[Faction Name]]
	influence?: string;  // "High", "Medium", "Low"
	description?: string;
}

export interface JobEntry {
	title: string;
	link: string;  // [[Job Title]]
	reward?: string;
	status?: string;
	faction?: string;
}

/**
 * Generates markdown table for residents (NPCs living at this location).
 *
 * @param residents - Array of resident entries
 * @returns Markdown table string
 */
export function generateResidentsTable(residents: ResidentEntry[]): string {
	if (!residents || residents.length === 0) {
		return '_No known residents._\n';
	}

	let markdown = '| Resident | Species | Occupation | Faction |\n';
	markdown += '|----------|---------|------------|----------|\n';

	for (const resident of residents) {
		const species = resident.species || '—';
		const occupation = resident.occupation || '—';
		const faction = resident.faction || '—';
		markdown += `| ${resident.link} | ${species} | ${occupation} | ${faction} |\n`;
	}

	return markdown;
}

/**
 * Generates markdown table for businesses (shops at this location).
 *
 * @param businesses - Array of business entries
 * @returns Markdown table string
 */
export function generateBusinessesTable(businesses: BusinessEntry[]): string {
	if (!businesses || businesses.length === 0) {
		return '_No known businesses._\n';
	}

	let markdown = '| Business | Type | Wealth | Shopkeeper |\n';
	markdown += '|----------|------|--------|------------|\n';

	for (const business of businesses) {
		const wealthLevel = business.wealthLevel || '—';
		const shopkeeper = business.shopkeeper || '—';
		markdown += `| ${business.link} | ${business.type} | ${wealthLevel} | ${shopkeeper} |\n`;
	}

	return markdown;
}

/**
 * Generates markdown table for factions present at this location.
 *
 * @param factions - Array of faction presence entries
 * @returns Markdown table string
 */
export function generateFactionsTable(factions: FactionPresenceEntry[]): string {
	if (!factions || factions.length === 0) {
		return '_No known factions._\n';
	}

	let markdown = '| Faction | Influence | Notes |\n';
	markdown += '|---------|-----------|-------|\n';

	for (const faction of factions) {
		const influence = faction.influence || '—';
		const description = faction.description || '—';
		markdown += `| ${faction.link} | ${influence} | ${description} |\n`;
	}

	return markdown;
}

/**
 * Generates markdown table for active jobs at this location.
 *
 * @param jobs - Array of job entries
 * @returns Markdown table string
 */
export function generateJobsTable(jobs: JobEntry[]): string {
	if (!jobs || jobs.length === 0) {
		return '_No active jobs._\n';
	}

	let markdown = '| Job | Reward | Status | Faction |\n';
	markdown += '|-----|--------|--------|----------|\n';

	for (const job of jobs) {
		const reward = job.reward || '—';
		const status = job.status || 'Available';
		const faction = job.faction || '—';
		markdown += `| ${job.link} | ${reward} | ${status} | ${faction} |\n`;
	}

	return markdown;
}

// ============================================================================
// Location Body Builder
// ============================================================================

export interface LocationBodyData {
	description?: string;
	residents: ResidentEntry[];
	businesses: BusinessEntry[];
	factions: FactionPresenceEntry[];
	jobs: JobEntry[];
}

/**
 * Builds the full markdown body for a location file.
 * Includes description and all dynamic tables.
 *
 * @param data - Location body data (description and entity lists)
 * @returns Full markdown body string
 */
export function buildLocationBody(data: LocationBodyData): string {
	let body = '';

	// Description section
	if (data.description && data.description.trim()) {
		body += `${data.description}\n\n`;
	}

	// Residents section
	body += '## Residents\n\n';
	body += generateResidentsTable(data.residents);
	body += '\n';

	// Businesses section
	body += '## Businesses\n\n';
	body += generateBusinessesTable(data.businesses);
	body += '\n';

	// Factions section
	body += '## Factions Present\n\n';
	body += generateFactionsTable(data.factions);
	body += '\n';

	// Jobs section
	body += '## Active Jobs\n\n';
	body += generateJobsTable(data.jobs);
	body += '\n';

	return body;
}

// ============================================================================
// Renown Display Helpers
// ============================================================================

/**
 * Generates markdown section for renown tracking (if enabled).
 * Shows current party score, rank, and individual overrides.
 *
 * @param renown - The renown component from the location
 * @returns Markdown string for renown section
 */
export function generateRenownSection(renown?: RenownComponent): string {
	if (!renown || !renown.enabled) {
		return '';
	}

	let markdown = '## Renown\n\n';

	// Party score and rank
	const partyRank = getCurrentRankTitle(renown.partyScore, renown.rankLadder);
	markdown += `**Party Renown**: ${renown.partyScore} (${partyRank})\n\n`;

	// Individual overrides
	if (renown.individualScores && Object.keys(renown.individualScores).length > 0) {
		markdown += '**Individual Scores**:\n\n';
		markdown += '| Player | Score | Rank |\n';
		markdown += '|--------|-------|------|\n';

		for (const [playerName, score] of Object.entries(renown.individualScores)) {
			const rank = getCurrentRankTitle(score, renown.rankLadder);
			markdown += `| ${playerName} | ${score} | ${rank} |\n`;
		}

		markdown += '\n';
	}

	// Rank ladder
	markdown += '**Rank Ladder**:\n\n';
	markdown += '| Threshold | Title | Perk |\n';
	markdown += '|-----------|-------|------|\n';

	for (const rank of renown.rankLadder) {
		const perk = rank.perk || '—';
		markdown += `| ${rank.threshold} | ${rank.title} | ${perk} |\n`;
	}

	markdown += '\n';

	// Notes
	if (renown.notes && renown.notes.trim()) {
		markdown += `**GM Notes**: ${renown.notes}\n\n`;
	}

	return markdown;
}

/**
 * Helper: Gets the current rank title for a given score.
 *
 * @param score - The renown score
 * @param rankLadder - The rank ladder
 * @returns The rank title, or "Unranked" if no rank qualifies
 */
function getCurrentRankTitle(score: number, rankLadder: RenownRank[]): string {
	if (!rankLadder || rankLadder.length === 0) {
		return 'Unranked';
	}

	let currentRank: RenownRank | null = null;
	for (const rank of rankLadder) {
		if (score >= rank.threshold) {
			currentRank = rank;
		} else {
			break;
		}
	}

	return currentRank ? currentRank.title : 'Unranked';
}

// ============================================================================
// Location Hierarchy Helpers
// ============================================================================

/**
 * Builds a breadcrumb trail for a location based on its parent hierarchy.
 * Example: "Waterdeep > Dock Ward > Fishmonger's Alley"
 *
 * @param locationName - Current location name
 * @param parentChain - Array of parent location names (ordered from root to immediate parent)
 * @returns Breadcrumb string
 */
export function buildLocationBreadcrumb(
	locationName: string,
	parentChain: string[]
): string {
	if (!parentChain || parentChain.length === 0) {
		return locationName;
	}

	return [...parentChain, locationName].join(' > ');
}

/**
 * Generates markdown section for location hierarchy.
 * Shows parent location link and breadcrumb trail.
 *
 * @param parentLocation - Parent location link (e.g., "[[Waterdeep]]")
 * @param breadcrumb - Full breadcrumb trail
 * @returns Markdown string for hierarchy section
 */
export function generateHierarchySection(
	parentLocation?: string,
	breadcrumb?: string
): string {
	if (!parentLocation && !breadcrumb) {
		return '';
	}

	let markdown = '## Location Hierarchy\n\n';

	if (parentLocation) {
		markdown += `**Parent Location**: ${parentLocation}\n\n`;
	}

	if (breadcrumb) {
		markdown += `**Path**: ${breadcrumb}\n\n`;
	}

	return markdown;
}

// ============================================================================
// Default Rank Ladders
// ============================================================================

/**
 * Default rank ladder for locations (general reputation).
 * Used when creating new location files.
 */
export const DEFAULT_LOCATION_RANK_LADDER: RenownRank[] = [
	{ threshold: 0, title: 'Stranger' },
	{ threshold: 5, title: 'Known Face' },
	{ threshold: 10, title: 'Trusted Visitor', perk: 'Minor discounts from local merchants' },
	{ threshold: 20, title: 'Respected Resident', perk: 'Access to local guilds and organizations' },
	{ threshold: 30, title: 'Pillar of the Community', perk: 'Free lodging and local support' },
	{ threshold: 50, title: 'Hero of [Location]', perk: 'Significant influence and favors' }
];

/**
 * Creates a new empty Location object with default values.
 *
 * @param name - Location name
 * @param parentLocation - Optional parent location link
 * @returns New Location object
 */
export function createNewLocation(
	name: string,
	parentLocation?: string
): Location {
	return {
		locationId: generateLocationId(),
		name,
		parentLocation,
		created: new Date().toISOString(),
		lastUpdated: new Date().toISOString()
	};
}

/**
 * Creates a new Location with renown tracking enabled.
 *
 * @param name - Location name
 * @param parentLocation - Optional parent location link
 * @param customRankLadder - Optional custom rank ladder (uses default if not provided)
 * @returns New Location with renown tracking
 */
export function createLocationWithRenown(
	name: string,
	parentLocation?: string,
	customRankLadder?: RenownRank[]
): Location {
	const location = createNewLocation(name, parentLocation);

	location.renownTracking = {
		enabled: true,
		partyScore: 0,
		rankLadder: customRankLadder || DEFAULT_LOCATION_RANK_LADDER
	};

	return location;
}

/**
 * Generates a unique location ID.
 * Uses timestamp + random suffix for uniqueness.
 *
 * @returns Unique location ID string
 */
function generateLocationId(): string {
	// Use crypto.randomUUID() for RFC 4122 v4 UUID format
	// Format: "location-{uuid}"
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return `location-${crypto.randomUUID()}`;
	}
	// Fallback for environments without crypto.randomUUID (older browsers/Node)
	const timestamp = Date.now();
	const randomSuffix = Math.random().toString(36).substring(2, 15);
	return `location-${timestamp}-${randomSuffix}`;
}

// ============================================================================
// Location Hierarchy Validation
// ============================================================================

/**
 * Validates that setting a parent location won't create a circular reference.
 * Checks the entire parent chain to ensure no cycles exist.
 *
 * @param currentLocationName - The name of the location being edited
 * @param proposedParentName - The name of the proposed parent location
 * @param allLocations - Map of location name to Location object
 * @returns Object with isValid flag and optional error message
 */
export function validateLocationHierarchy(
	currentLocationName: string,
	proposedParentName: string | undefined,
	allLocations: Map<string, Location>
): { isValid: boolean; error?: string } {
	// If no parent, hierarchy is always valid
	if (!proposedParentName) {
		return { isValid: true };
	}

	// Can't be your own parent
	if (currentLocationName === proposedParentName) {
		return {
			isValid: false,
			error: 'circular reference: A location cannot be its own parent'
		};
	}

	// Check for circular reference by walking up the parent chain
	const visited = new Set<string>();
	let currentParent: string | undefined = proposedParentName;

	while (currentParent) {
		// If we encounter the current location in the parent chain, it's circular
		if (currentParent === currentLocationName) {
			return {
				isValid: false,
				error: `circular reference detected: setting "${proposedParentName}" as parent would create a cycle`
			};
		}

		// If we've seen this parent before, there's a cycle (not involving current location)
		if (visited.has(currentParent)) {
			return {
				isValid: false,
				error: `circular reference detected in parent chain: "${currentParent}" appears multiple times`
			};
		}

		visited.add(currentParent);

		// Get the next parent in the chain
		const parentLocation = allLocations.get(currentParent);
		if (!parentLocation) {
			// Parent doesn't exist in the map - this is okay, might be a new location
			break;
		}

		// Extract parent name from link format if needed
		currentParent = parentLocation.parentLocation
			? extractLinkTarget(parentLocation.parentLocation)
			: undefined;
	}

	return { isValid: true };
}

/**
 * Helper function to extract location name from wikilink or plain string
 * "[[Waterdeep]]" -> "Waterdeep"
 * "Waterdeep" -> "Waterdeep"
 */
function extractLinkTarget(value: string): string {
	const match = value.match(/\[\[(.+?)\]\]/);
	return match ? match[1] : value;
}
