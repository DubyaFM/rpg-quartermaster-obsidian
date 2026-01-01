/**
 * FactionService
 *
 * Service layer for faction entity management.
 * Generates dynamic tables (roster, presence, activities) for faction files.
 *
 * NOTE: This is platform-agnostic. File I/O is handled by FactionFileHandler in adapter layer.
 */

import { FactionEntity, RenownComponent, RenownRank } from '../models/types';

// ============================================================================
// Dynamic Table Generation
// ============================================================================

export interface RosterEntry {
	name: string;
	link: string;  // [[NPC Name]]
	role?: string;  // e.g., "Agent", "Leader", "Member"
	rank?: string;  // e.g., "Captain", "Lieutenant"
	location?: string;  // Where this member is stationed
	status?: string;  // e.g., "Active", "Missing", "Retired"
}

export interface PresenceEntry {
	location: string;
	link: string;  // [[Location Name]]
	influence?: string;  // "High", "Medium", "Low"
	operations?: string;  // Description of faction activities here
}

export interface ActivityEntry {
	description: string;
	location?: string;
	status?: string;  // "Ongoing", "Planned", "Completed"
	priority?: string;  // "High", "Medium", "Low"
}

/**
 * Generates markdown table for faction roster (members/NPCs).
 *
 * @param roster - Array of roster entries
 * @returns Markdown table string
 */
export function generateRosterTable(roster: RosterEntry[]): string {
	if (!roster || roster.length === 0) {
		return '_No known members._\n';
	}

	let markdown = '| Member | Role | Rank | Location | Status |\n';
	markdown += '|--------|------|------|----------|--------|\n';

	for (const member of roster) {
		const role = member.role || '—';
		const rank = member.rank || '—';
		const location = member.location || '—';
		const status = member.status || 'Active';
		markdown += `| ${member.link} | ${role} | ${rank} | ${location} | ${status} |\n`;
	}

	return markdown;
}

/**
 * Generates markdown table for faction presence (locations where faction is active).
 *
 * @param presence - Array of presence entries
 * @returns Markdown table string
 */
export function generatePresenceTable(presence: PresenceEntry[]): string {
	if (!presence || presence.length === 0) {
		return '_No known presence._\n';
	}

	let markdown = '| Location | Influence | Operations |\n';
	markdown += '|----------|-----------|------------|\n';

	for (const entry of presence) {
		const influence = entry.influence || '—';
		const operations = entry.operations || '—';
		markdown += `| ${entry.link} | ${influence} | ${operations} |\n`;
	}

	return markdown;
}

/**
 * Generates markdown table for faction activities.
 *
 * @param activities - Array of activity entries
 * @returns Markdown table string
 */
export function generateActivitiesTable(activities: ActivityEntry[]): string {
	if (!activities || activities.length === 0) {
		return '_No current activities._\n';
	}

	let markdown = '| Activity | Location | Status | Priority |\n';
	markdown += '|----------|----------|--------|----------|\n';

	for (const activity of activities) {
		const location = activity.location || '—';
		const status = activity.status || 'Ongoing';
		const priority = activity.priority || 'Medium';
		markdown += `| ${activity.description} | ${location} | ${status} | ${priority} |\n`;
	}

	return markdown;
}

// ============================================================================
// Faction Body Builder
// ============================================================================

export interface FactionBodyData {
	description?: string;
	alignment?: string;
	roster: RosterEntry[];
	presence: PresenceEntry[];
	activities: ActivityEntry[];
}

/**
 * Builds the full markdown body for a faction file.
 * Includes description, alignment, and all dynamic tables.
 *
 * @param data - Faction body data (description and entity lists)
 * @returns Full markdown body string
 */
export function buildFactionBody(data: FactionBodyData): string {
	let body = '';

	// Description section
	if (data.description && data.description.trim()) {
		body += `${data.description}\n\n`;
	}

	// Alignment
	if (data.alignment && data.alignment.trim()) {
		body += `**Alignment**: ${data.alignment}\n\n`;
	}

	// Roster section
	body += '## Roster\n\n';
	body += generateRosterTable(data.roster);
	body += '\n';

	// Presence section
	body += '## Presence\n\n';
	body += generatePresenceTable(data.presence);
	body += '\n';

	// Activities section
	body += '## Current Activities\n\n';
	body += generateActivitiesTable(data.activities);
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
 * @param renown - The renown component from the faction
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
// Default Rank Ladders
// ============================================================================

/**
 * Default rank ladder for factions (positive reputation).
 * Used when creating new faction files.
 */
export const DEFAULT_FACTION_RANK_LADDER: RenownRank[] = [
	{ threshold: 0, title: 'Stranger' },
	{ threshold: 3, title: 'Acquaintance' },
	{ threshold: 10, title: 'Agent', perk: 'Minor faction support' },
	{ threshold: 25, title: 'Operative', perk: 'Access to faction resources' },
	{ threshold: 50, title: 'Champion', perk: 'Significant faction backing and influence' }
];

/**
 * Negative reputation rank ladder (for hostile factions).
 * Scores are negative, so threshold 0 is neutral, -10 is "Suspect", etc.
 */
export const NEGATIVE_FACTION_RANK_LADDER: RenownRank[] = [
	{ threshold: 0, title: 'Neutral' },
	{ threshold: -10, title: 'Suspect' },
	{ threshold: -25, title: 'Wanted', perk: 'Faction actively opposes party' },
	{ threshold: -50, title: 'Enemy', perk: 'Hunted by faction assassins' }
];

/**
 * Combined rank ladder (supports both positive and negative reputation).
 * Useful for factions where party reputation can swing both ways.
 */
export const COMBINED_FACTION_RANK_LADDER: RenownRank[] = [
	{ threshold: -50, title: 'Enemy', perk: 'Hunted by faction assassins' },
	{ threshold: -25, title: 'Wanted', perk: 'Faction actively opposes party' },
	{ threshold: -10, title: 'Suspect' },
	{ threshold: 0, title: 'Neutral' },
	{ threshold: 3, title: 'Acquaintance' },
	{ threshold: 10, title: 'Agent', perk: 'Minor faction support' },
	{ threshold: 25, title: 'Operative', perk: 'Access to faction resources' },
	{ threshold: 50, title: 'Champion', perk: 'Significant faction backing and influence' }
];

// ============================================================================
// Faction Creation Helpers
// ============================================================================

/**
 * Creates a new empty FactionEntity object with default values.
 *
 * @param name - Faction name
 * @param description - Faction description
 * @param alignment - Faction alignment (e.g., "Lawful Good", "Neutral Evil")
 * @returns New FactionEntity object
 */
export function createNewFaction(
	name: string,
	description: string,
	alignment: string
): FactionEntity {
	return {
		factionId: generateFactionId(),
		name,
		description,
		alignment,
		created: new Date().toISOString(),
		lastUpdated: new Date().toISOString()
	};
}

/**
 * Creates a new FactionEntity with renown tracking enabled.
 *
 * @param name - Faction name
 * @param description - Faction description
 * @param alignment - Faction alignment
 * @param rankLadderType - Which rank ladder to use ('positive', 'negative', 'combined')
 * @param customRankLadder - Optional custom rank ladder (overrides rankLadderType)
 * @returns New FactionEntity with renown tracking
 */
export function createFactionWithRenown(
	name: string,
	description: string,
	alignment: string,
	rankLadderType: 'positive' | 'negative' | 'combined' = 'positive',
	customRankLadder?: RenownRank[]
): FactionEntity {
	const faction = createNewFaction(name, description, alignment);

	// Determine which rank ladder to use
	let rankLadder: RenownRank[];
	if (customRankLadder) {
		rankLadder = customRankLadder;
	} else {
		switch (rankLadderType) {
			case 'negative':
				rankLadder = NEGATIVE_FACTION_RANK_LADDER;
				break;
			case 'combined':
				rankLadder = COMBINED_FACTION_RANK_LADDER;
				break;
			case 'positive':
			default:
				rankLadder = DEFAULT_FACTION_RANK_LADDER;
				break;
		}
	}

	faction.renownTracking = {
		enabled: true,
		partyScore: 0,
		rankLadder
	};

	return faction;
}

/**
 * Generates a unique faction ID.
 * Uses timestamp + random suffix for uniqueness.
 *
 * @returns Unique faction ID string
 */
function generateFactionId(): string {
	// Use crypto.randomUUID() for RFC 4122 v4 UUID format
	// Format: "faction-{uuid}"
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return `faction-${crypto.randomUUID()}`;
	}
	// Fallback for environments without crypto.randomUUID (older browsers/Node)
	const timestamp = Date.now();
	const randomSuffix = Math.random().toString(36).substring(2, 15);
	return `faction-${timestamp}-${randomSuffix}`;
}

// ============================================================================
// Alignment Helpers
// ============================================================================

/**
 * Valid D&D 5e alignment options.
 */
export const VALID_ALIGNMENTS = [
	'Lawful Good',
	'Neutral Good',
	'Chaotic Good',
	'Lawful Neutral',
	'True Neutral',
	'Chaotic Neutral',
	'Lawful Evil',
	'Neutral Evil',
	'Chaotic Evil',
	'Unaligned'
] as const;

export type Alignment = typeof VALID_ALIGNMENTS[number];

/**
 * Validates if a given alignment string is a valid D&D alignment.
 *
 * @param alignment - The alignment string to validate
 * @returns True if valid, false otherwise
 */
export function isValidAlignment(alignment: string): alignment is Alignment {
	return VALID_ALIGNMENTS.includes(alignment as Alignment);
}
