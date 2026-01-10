// Effect Types for Calendar & World Events
// Defines all effect categories applied by events to the game world

/**
 * Economic Effects - Impacts on shop pricing, availability, and restocking
 * Applied by events like market days, sieges, festivals, etc.
 */
export interface EconomicEffects {
	/**
	 * Global price multiplier for all items
	 * Stacks multiplicatively with other multipliers
	 * Examples: 1.5 (50% price increase), 0.75 (25% discount)
	 */
	price_mult_global?: number;

	/**
	 * Price multipliers per item tag
	 * Allows targeted price changes (e.g., "food: 2.0" doubles food prices)
	 * Stacks multiplicatively with global multiplier and other tag multipliers
	 * Example: { "weapon": 1.2, "armor": 0.9, "food": 2.5 }
	 */
	price_mult_tag?: Record<string, number>;

	/**
	 * Whether shops are closed during this event
	 * Conflict resolution: any_true (any event can force closure)
	 * Examples: religious holidays, sieges, curfews
	 */
	shop_closed?: boolean;

	/**
	 * Prevents shops from restocking during this event
	 * Conflict resolution: any_true (any event can block restocking)
	 * Examples: supply chain disruption, wartime rationing, blockades
	 */
	restock_block?: boolean;
}

/**
 * Environmental Effects - Physical world state changes
 * Applied by events like weather, seasons, celestial events
 */
export interface EnvironmentalEffects {
	/**
	 * Current light level in the environment
	 * Ordinal scale: 'bright' > 'dim' > 'dark'
	 * Conflict resolution: darkest wins (Math.min on ordinal scale)
	 * Solar baseline provides Layer 0, events overlay on Layer 1+
	 * Examples: 'dark' (nighttime, eclipse), 'dim' (overcast, fog), 'bright' (clear day)
	 */
	light_level?: 'bright' | 'dim' | 'dark';

	/**
	 * Forced season override
	 * Overrides natural season calculation from calendar
	 * Used for magical effects or supernatural events
	 * Examples: "eternal winter", "fey crossing"
	 */
	season_set?: string;
}

/**
 * UI Effects - Visual and presentational changes
 * Applied by events to provide player feedback and thematic immersion
 */
export interface UIEffects {
	/**
	 * Banner message displayed in HUD
	 * Conflict resolution: last_wins (sorted by priority then event ID)
	 * Examples: "Market Day - All prices reduced!", "Festival of the Moon"
	 */
	ui_banner?: string;

	/**
	 * Theme override for UI styling
	 * Allows events to change visual presentation
	 * Examples: "spooky" (Halloween), "festive" (holidays), "somber" (memorial)
	 */
	ui_theme?: string;
}

/**
 * Combined Effects Type
 * Union of all effect categories
 * Used as the base type for event effect definitions
 */
export type CombinedEffects = EconomicEffects & EnvironmentalEffects & UIEffects;

/**
 * Resolved Effects
 * Post-conflict-resolution effect state
 * Includes metadata about how effects were resolved
 */
export interface ResolvedEffects extends CombinedEffects {
	/**
	 * Absolute day this resolution is for
	 */
	resolvedDay: number;

	/**
	 * Time of day in minutes from midnight (optional)
	 */
	resolvedTimeOfDay?: number;

	/**
	 * Event context used for resolution
	 */
	resolvedContext?: {
		location?: string;
		faction?: string;
		season?: string;
		region?: string;
		tags?: string[];
	};

	/**
	 * Metadata about competing effects (for UI tooltips)
	 * Maps effect key to list of event IDs that contributed
	 * Example: { "price_mult_global": ["market_day", "siege"], "shop_closed": ["curfew"] }
	 */
	competingEffects?: Record<string, string[]>;

	/**
	 * Resolution strategy applied for each effect
	 * Maps effect key to strategy name
	 * Example: { "price_mult_global": "multiply", "shop_closed": "any_true" }
	 */
	resolutionStrategies?: Record<string, string>;
}

/**
 * Effect Key Registry
 * Defines all valid effect keys and their categories
 * Used for validation and auto-completion
 */
export const EFFECT_KEY_REGISTRY = {
	// Economic Effects
	economic: {
		price_mult_global: 'number',
		price_mult_tag: 'Record<string, number>',
		shop_closed: 'boolean',
		restock_block: 'boolean',
	},
	// Environmental Effects
	environmental: {
		light_level: "'bright' | 'dim' | 'dark'",
		season_set: 'string',
	},
	// UI Effects
	ui: {
		ui_banner: 'string',
		ui_theme: 'string',
	},
} as const;

/**
 * Effect Categories
 * Enum-like object for categorizing effects
 */
export const EFFECT_CATEGORIES = {
	ECONOMIC: 'economic',
	ENVIRONMENTAL: 'environmental',
	UI: 'ui',
} as const;

export type EffectCategory = typeof EFFECT_CATEGORIES[keyof typeof EFFECT_CATEGORIES];

/**
 * Get all valid effect keys
 * Returns a flat array of all effect key names
 */
export function getAllEffectKeys(): string[] {
	return Object.values(EFFECT_KEY_REGISTRY).flatMap(category => Object.keys(category));
}

/**
 * Validate effect key
 * Returns true if the key is a valid effect key
 */
export function isValidEffectKey(key: string): boolean {
	return getAllEffectKeys().includes(key);
}

/**
 * Get effect category
 * Returns the category for a given effect key
 */
export function getEffectCategory(key: string): EffectCategory | null {
	for (const [category, keys] of Object.entries(EFFECT_KEY_REGISTRY)) {
		if (key in keys) {
			return category as EffectCategory;
		}
	}
	return null;
}

/**
 * Effect Context - Filtering parameters for querying active effects
 * Used by consumers (shops, UI, etc.) to request effects relevant to their context
 *
 * Design Notes:
 * - Supports hierarchical location matching (e.g., "Waterdeep.North Ward" matches "Waterdeep")
 * - Multiple filters can be combined (AND logic)
 * - Undefined filters are ignored (no filtering applied for that dimension)
 */
export interface EffectContext {
	/** Location identifier (supports hierarchy: "city.district.building") */
	location?: string;
	/** Faction identifier */
	faction?: string;
	/** NPC identifier (for NPC-specific effects) */
	npc?: string;
	/** Additional tags for custom filtering */
	tags?: string[];
}
