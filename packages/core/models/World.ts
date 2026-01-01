/**
 * World entity model
 *
 * Represents a game world/setting (e.g., Forgotten Realms, Eberron, custom homebrew world).
 * Worlds group campaigns that share the same setting, currency system, and calendar.
 *
 * World definitions can be official presets (shipped with the plugin) or user-created custom worlds.
 */

/**
 * World model - Represents a game world/setting
 */
export interface World {
	/** Unique identifier for the world (format: "world-{slug}") */
	id: string;

	/** Human-readable name (e.g., "Forgotten Realms", "Eberron") */
	name: string;

	/** Optional description of the world/setting */
	description?: string;

	// System definitions

	/** Currency system ID (references config/currencies.yaml) */
	currencySystemId: string;

	/** Calendar system ID (references config/calendars.yaml) */
	calendarSystemId: string;

	// Library defaults

	/** Default library IDs to enable for new campaigns in this world */
	defaultLibraryIds: string[];

	// Metadata

	/** When this world was created (Unix timestamp in milliseconds) */
	createdAt: number;

	/** Whether this is a built-in preset world (true) or user-created (false) */
	isOfficial: boolean;
}

/**
 * Preset worlds shipped with the plugin
 *
 * These are official world presets that come pre-configured with appropriate
 * currency systems, calendars, and library defaults.
 */
export const PRESET_WORLDS: World[] = [
	{
		id: 'world-generic',
		name: 'Generic Fantasy',
		description: 'A generic fantasy setting suitable for any D&D 5e campaign',
		currencySystemId: 'dnd5e',
		calendarSystemId: 'gregorian',
		defaultLibraryIds: ['library-srd'],
		createdAt: 0,
		isOfficial: true
	},
	{
		id: 'world-forgotten-realms',
		name: 'Forgotten Realms',
		description: 'The classic D&D campaign setting of Faerûn',
		currencySystemId: 'dnd5e',
		calendarSystemId: 'harptos',
		defaultLibraryIds: ['library-srd'],
		createdAt: 0,
		isOfficial: true
	},
	{
		id: 'world-eberron',
		name: 'Eberron',
		description: 'Pulp noir fantasy with warforged, airships, and lightning rails',
		currencySystemId: 'dnd5e',
		calendarSystemId: 'gregorian', // Eberron uses a different calendar, but using Gregorian as fallback
		defaultLibraryIds: ['library-srd'],
		createdAt: 0,
		isOfficial: true
	},
	{
		id: 'world-sci-fi',
		name: 'Sci-Fi Universe',
		description: 'A science fiction setting with digital credits and standard calendar',
		currencySystemId: 'star_wars',
		calendarSystemId: 'gregorian',
		defaultLibraryIds: ['library-srd'],
		createdAt: 0,
		isOfficial: true
	}
];
