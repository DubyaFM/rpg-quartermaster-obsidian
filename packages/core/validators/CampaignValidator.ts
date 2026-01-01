/**
 * Campaign Profile Validator
 *
 * Validates campaign profiles before save operations.
 * Ensures data integrity and prevents invalid campaigns.
 *
 * Validation Rules:
 * - ID matches format `campaign-{uuid}`
 * - Name is non-empty string (max 100 chars)
 * - WorldId matches format `world-{slug}`
 * - PathMappings contains required keys: shops, party, transactions
 * - ActiveLibraryIds are valid UUIDs (if provided)
 * - CreatedAt and lastAccessedAt are valid timestamps
 * - isActive is boolean
 */

import { CampaignProfile } from '../services/CampaignManager';

/**
 * Campaign validation error
 * Thrown when validation fails
 */
export class CampaignValidationError extends Error {
	constructor(
		public field: string,
		public message: string
	) {
		super(`Campaign validation failed: ${field} - ${message}`);
		this.name = 'CampaignValidationError';
	}
}

/**
 * Validation result
 */
export interface ValidationResult {
	valid: boolean;
	errors: CampaignValidationError[];
}

/**
 * UUID validation regex (v4)
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Campaign ID format regex
 * Format: "campaign-{uuid-v4}"
 */
const CAMPAIGN_ID_REGEX = /^campaign-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * World ID format regex
 * Format: "world-{slug}" where slug is lowercase alphanumeric with hyphens
 */
const WORLD_ID_REGEX = /^world-[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Library ID format regex
 * Format: "library-{uuid-v4}" or "srd" (SRD is special case)
 */
const LIBRARY_ID_REGEX = /^(library-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|srd)$/i;

/**
 * Campaign Validator
 *
 * Provides validation utilities for campaign profiles.
 * Can be used for both creation and updates.
 */
export class CampaignValidator {
	/**
	 * Validate a complete campaign profile
	 *
	 * @param profile - Campaign profile to validate
	 * @param isUpdate - If true, allows missing fields that have defaults
	 * @returns Validation result with errors if any
	 */
	static validate(profile: Partial<CampaignProfile>, isUpdate = false): ValidationResult {
		const errors: CampaignValidationError[] = [];

		// Validate ID (required for updates, optional for creates)
		if (profile.id !== undefined) {
			if (!this.isValidCampaignId(profile.id)) {
				errors.push(new CampaignValidationError(
					'id',
					`Must match format "campaign-{uuid}". Got: "${profile.id}"`
				));
			}
		} else if (isUpdate) {
			errors.push(new CampaignValidationError('id', 'Campaign ID is required for updates'));
		}

		// Validate name (required)
		if (profile.name !== undefined) {
			const nameErrors = this.validateName(profile.name);
			errors.push(...nameErrors);
		} else if (!isUpdate) {
			errors.push(new CampaignValidationError('name', 'Campaign name is required'));
		}

		// Validate worldId (required)
		if (profile.worldId !== undefined) {
			if (!this.isValidWorldId(profile.worldId)) {
				errors.push(new CampaignValidationError(
					'worldId',
					`Must match format "world-{slug}". Got: "${profile.worldId}"`
				));
			}
		} else if (!isUpdate) {
			errors.push(new CampaignValidationError('worldId', 'World ID is required'));
		}

		// Validate pathMappings (optional, but if provided must contain required keys)
		if (profile.pathMappings !== undefined) {
			const pathErrors = this.validatePathMappings(profile.pathMappings);
			errors.push(...pathErrors);
		}

		// Validate activeLibraryIds (optional, but if provided must be valid UUIDs)
		if (profile.activeLibraryIds !== undefined) {
			const libraryErrors = this.validateLibraryIds(profile.activeLibraryIds);
			errors.push(...libraryErrors);
		}

		// Validate createdAt (optional, but if provided must be valid timestamp)
		if (profile.createdAt !== undefined) {
			if (!this.isValidTimestamp(profile.createdAt)) {
				errors.push(new CampaignValidationError(
					'createdAt',
					`Must be a valid Unix timestamp (milliseconds). Got: ${profile.createdAt}`
				));
			}
		}

		// Validate lastAccessedAt (optional, but if provided must be valid timestamp)
		if (profile.lastAccessedAt !== undefined) {
			if (!this.isValidTimestamp(profile.lastAccessedAt)) {
				errors.push(new CampaignValidationError(
					'lastAccessedAt',
					`Must be a valid Unix timestamp (milliseconds). Got: ${profile.lastAccessedAt}`
				));
			}
		}

		// Validate isActive (optional, but if provided must be boolean)
		if (profile.isActive !== undefined) {
			if (typeof profile.isActive !== 'boolean') {
				errors.push(new CampaignValidationError(
					'isActive',
					`Must be a boolean. Got: ${typeof profile.isActive}`
				));
			}
		}

		// Validate description (optional, but if provided must be reasonable length)
		if (profile.description !== undefined && profile.description.length > 500) {
			errors.push(new CampaignValidationError(
				'description',
				`Description must be 500 characters or less. Got: ${profile.description.length} characters`
			));
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Validate campaign ID format
	 *
	 * @param id - Campaign ID to validate
	 * @returns True if valid
	 */
	static isValidCampaignId(id: string): boolean {
		return CAMPAIGN_ID_REGEX.test(id);
	}

	/**
	 * Validate world ID format
	 *
	 * @param worldId - World ID to validate
	 * @returns True if valid
	 */
	static isValidWorldId(worldId: string): boolean {
		return WORLD_ID_REGEX.test(worldId);
	}

	/**
	 * Validate UUID format (v4)
	 *
	 * @param uuid - UUID to validate
	 * @returns True if valid v4 UUID
	 */
	static isValidUUID(uuid: string): boolean {
		return UUID_V4_REGEX.test(uuid);
	}

	/**
	 * Validate library ID format
	 *
	 * @param libraryId - Library ID to validate
	 * @returns True if valid
	 */
	static isValidLibraryId(libraryId: string): boolean {
		return LIBRARY_ID_REGEX.test(libraryId);
	}

	/**
	 * Validate timestamp
	 *
	 * @param timestamp - Timestamp to validate (Unix milliseconds)
	 * @returns True if valid
	 */
	static isValidTimestamp(timestamp: number): boolean {
		// Must be a number
		if (typeof timestamp !== 'number' || isNaN(timestamp)) {
			return false;
		}

		// Must be positive
		if (timestamp < 0) {
			return false;
		}

		// Must be reasonable (after year 2000, before year 2100)
		const MIN_TIMESTAMP = 946684800000; // 2000-01-01
		const MAX_TIMESTAMP = 4102444800000; // 2100-01-01

		return timestamp >= MIN_TIMESTAMP && timestamp <= MAX_TIMESTAMP;
	}

	/**
	 * Validate campaign name
	 *
	 * @param name - Campaign name to validate
	 * @returns Array of validation errors (empty if valid)
	 */
	static validateName(name: string): CampaignValidationError[] {
		const errors: CampaignValidationError[] = [];

		if (typeof name !== 'string') {
			errors.push(new CampaignValidationError('name', 'Must be a string'));
			return errors;
		}

		if (name.trim().length === 0) {
			errors.push(new CampaignValidationError('name', 'Cannot be empty'));
		}

		if (name.length > 100) {
			errors.push(new CampaignValidationError('name', `Must be 100 characters or less. Got: ${name.length} characters`));
		}

		// Check for invalid characters (basic sanity check)
		if (/[\x00-\x1F\x7F]/.test(name)) {
			errors.push(new CampaignValidationError('name', 'Contains invalid control characters'));
		}

		return errors;
	}

	/**
	 * Validate path mappings
	 *
	 * Required keys: shops, party, transactions
	 * Optional keys: npcs, locations, factions, jobs, projects, activity-log, calendar, items, libraries
	 *
	 * @param pathMappings - Path mappings to validate
	 * @returns Array of validation errors (empty if valid)
	 */
	static validatePathMappings(pathMappings: Record<string, string>): CampaignValidationError[] {
		const errors: CampaignValidationError[] = [];

		if (typeof pathMappings !== 'object' || pathMappings === null) {
			errors.push(new CampaignValidationError('pathMappings', 'Must be an object'));
			return errors;
		}

		// Required keys
		const requiredKeys = ['shops', 'party', 'transactions'];
		const missingKeys = requiredKeys.filter(key => !(key in pathMappings));

		if (missingKeys.length > 0) {
			errors.push(new CampaignValidationError(
				'pathMappings',
				`Missing required keys: ${missingKeys.join(', ')}`
			));
		}

		// Validate all paths are non-empty strings
		for (const [key, value] of Object.entries(pathMappings)) {
			if (typeof value !== 'string') {
				errors.push(new CampaignValidationError(
					`pathMappings.${key}`,
					`Path must be a string. Got: ${typeof value}`
				));
			} else if (value.trim().length === 0) {
				errors.push(new CampaignValidationError(
					`pathMappings.${key}`,
					'Path cannot be empty'
				));
			}
		}

		return errors;
	}

	/**
	 * Validate library IDs
	 *
	 * @param libraryIds - Array of library IDs to validate
	 * @returns Array of validation errors (empty if valid)
	 */
	static validateLibraryIds(libraryIds: string[]): CampaignValidationError[] {
		const errors: CampaignValidationError[] = [];

		if (!Array.isArray(libraryIds)) {
			errors.push(new CampaignValidationError('activeLibraryIds', 'Must be an array'));
			return errors;
		}

		// Validate each library ID
		libraryIds.forEach((id, index) => {
			if (typeof id !== 'string') {
				errors.push(new CampaignValidationError(
					`activeLibraryIds[${index}]`,
					`Must be a string. Got: ${typeof id}`
				));
			} else if (!this.isValidLibraryId(id)) {
				errors.push(new CampaignValidationError(
					`activeLibraryIds[${index}]`,
					`Invalid library ID format: "${id}". Must be "library-{uuid}" or "srd"`
				));
			}
		});

		// Check for duplicates
		const seen = new Set<string>();
		libraryIds.forEach((id, index) => {
			if (seen.has(id)) {
				errors.push(new CampaignValidationError(
					`activeLibraryIds[${index}]`,
					`Duplicate library ID: "${id}"`
				));
			}
			seen.add(id);
		});

		return errors;
	}

	/**
	 * Validate campaign profile and throw if invalid
	 *
	 * @param profile - Campaign profile to validate
	 * @param isUpdate - If true, allows missing fields that have defaults
	 * @throws CampaignValidationError if validation fails
	 */
	static validateOrThrow(profile: Partial<CampaignProfile>, isUpdate = false): void {
		const result = this.validate(profile, isUpdate);

		if (!result.valid) {
			// Throw the first error (most important)
			throw result.errors[0];
		}
	}

	/**
	 * Get validation errors as formatted strings
	 *
	 * @param profile - Campaign profile to validate
	 * @param isUpdate - If true, allows missing fields that have defaults
	 * @returns Array of error messages
	 */
	static getValidationErrors(profile: Partial<CampaignProfile>, isUpdate = false): string[] {
		const result = this.validate(profile, isUpdate);
		return result.errors.map(err => `${err.field}: ${err.message}`);
	}
}
