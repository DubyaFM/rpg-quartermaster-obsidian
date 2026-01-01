/**
 * Reputation Target Extractor
 *
 * Extracts unique reputation target entities from existing jobs
 * to provide auto-suggest functionality for consistent naming.
 *
 * @module ReputationTargetExtractor
 */

import type { Job, ReputationTargetType } from '../models/Job';

/**
 * Extracted reputation target with metadata
 */
export interface ReputationTarget {
	/** The entity name (e.g., "Harpers", "Waterdeep", "Lord Neverember") */
	entity: string;

	/** The type of target (Location, Faction, NPC) */
	type: ReputationTargetType;

	/** How many times this target has been used across all jobs */
	usageCount: number;
}

/**
 * Service for extracting and analyzing reputation targets from jobs
 */
export class ReputationTargetExtractor {
	/**
	 * Extracts all unique reputation targets from a list of jobs
	 *
	 * @param jobs - All jobs to analyze
	 * @returns Array of unique targets with usage counts
	 */
	extractUniqueTargets(jobs: Job[]): ReputationTarget[] {
		const targetMap = new Map<string, ReputationTarget>();

		jobs.forEach(job => {
			job.reputationImpacts.forEach(impact => {
				const normalizedEntity = this.normalizeEntity(impact.targetEntity);
				const key = `${impact.targetType}:${normalizedEntity}`;

				if (targetMap.has(key)) {
					const existing = targetMap.get(key)!;
					existing.usageCount++;
				} else {
					targetMap.set(key, {
						entity: normalizedEntity,
						type: impact.targetType,
						usageCount: 1
					});
				}
			});
		});

		// Sort by usage count (descending), then alphabetically
		return Array.from(targetMap.values()).sort((a, b) => {
			if (b.usageCount !== a.usageCount) {
				return b.usageCount - a.usageCount;
			}
			return a.entity.localeCompare(b.entity);
		});
	}

	/**
	 * Gets unique targets filtered by type
	 *
	 * @param jobs - All jobs to analyze
	 * @param type - Target type to filter by
	 * @returns Array of unique entity names for the given type
	 */
	getTargetsByType(jobs: Job[], type: ReputationTargetType): string[] {
		const targets = this.extractUniqueTargets(jobs);
		return targets
			.filter(target => target.type === type)
			.map(target => target.entity);
	}

	/**
	 * Gets all unique entity names (regardless of type)
	 *
	 * Useful when type hasn't been selected yet
	 *
	 * @param jobs - All jobs to analyze
	 * @returns Array of unique entity names
	 */
	getAllEntityNames(jobs: Job[]): string[] {
		const targets = this.extractUniqueTargets(jobs);
		const entitySet = new Set<string>();

		targets.forEach(target => entitySet.add(target.entity));

		return Array.from(entitySet).sort();
	}

	/**
	 * Normalizes entity name for comparison
	 *
	 * Extracts page name from wikilinks and trims whitespace
	 *
	 * @param entity - Raw entity string (may contain wikilink)
	 * @returns Normalized entity name
	 */
	private normalizeEntity(entity: string): string {
		// Extract from wikilink if present
		// [[Page Name]] or [[Page Name|Display Text]] -> "Page Name"
		const wikilinkMatch = entity.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
		if (wikilinkMatch) {
			return wikilinkMatch[1].trim();
		}
		return entity.trim();
	}

	/**
	 * Formats entity as wikilink if it doesn't already have brackets
	 *
	 * @param entity - Entity name
	 * @param type - Target type (used to suggest folder structure)
	 * @returns Formatted wikilink
	 */
	formatAsWikilink(entity: string, type: ReputationTargetType): string {
		// Already a wikilink, return as-is
		if (entity.startsWith('[[') && entity.endsWith(']]')) {
			return entity;
		}

		// Suggest folder structure based on type
		const folderHints: Record<ReputationTargetType, string> = {
			Location: 'Locations/',
			Faction: 'Factions/',
			NPC: 'NPCs/'
		};

		const folder = folderHints[type];
		return `[[${folder}${entity}]]`;
	}
}
