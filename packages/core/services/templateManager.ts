// Template Manager Service
// Handles merging custom templates with defaults and validation
// Platform-agnostic - no external dependencies

import { ShopGenerationConfig } from '../models/types';

/**
 * Merge a custom template configuration with default configuration
 * Custom values override defaults, but preserve any unspecified defaults
 *
 * @param customConfig Partial custom configuration (can override any field)
 * @param defaultConfig Complete default configuration from shopConfig.yaml
 * @returns Merged configuration with custom overrides applied
 *
 * @example
 * const merged = mergeTemplateWithDefaults(
 *   { totalItemRange: {min: 30, max: 50} },
 *   defaultBlacksmithWealthyConfig
 * );
 * // Returns config with custom item range but default rarities, types, etc.
 */
export function mergeTemplateWithDefaults(
	customConfig: Partial<ShopGenerationConfig>,
	defaultConfig: ShopGenerationConfig
): ShopGenerationConfig {
	// Start with default config
	const merged: ShopGenerationConfig = { ...defaultConfig };

	// Override with custom values
	if (customConfig.totalItemRange !== undefined) {
		merged.totalItemRange = customConfig.totalItemRange;
	}

	if (customConfig.maxItems !== undefined) {
		merged.maxItems = customConfig.maxItems;
	}

	if (customConfig.rarityChances !== undefined) {
		merged.rarityChances = { ...defaultConfig.rarityChances, ...customConfig.rarityChances };
	}

	if (customConfig.fundsOnHandDice !== undefined) {
		merged.fundsOnHandDice = customConfig.fundsOnHandDice;
	}

	if (customConfig.itemTypeChances !== undefined) {
		merged.itemTypeChances = customConfig.itemTypeChances;
	}

	if (customConfig.specificItems !== undefined) {
		merged.specificItems = customConfig.specificItems;
	}

	if (customConfig.templateName !== undefined) {
		merged.templateName = customConfig.templateName;
	}

	// Phase 6: New magic item system fields
	if (customConfig.basicItemTypes !== undefined) {
		merged.basicItemTypes = { ...defaultConfig.basicItemTypes, ...customConfig.basicItemTypes };
	}

	if (customConfig.magicItemCountWeights !== undefined) {
		merged.magicItemCountWeights = { ...defaultConfig.magicItemCountWeights, ...customConfig.magicItemCountWeights };
	}

	if (customConfig.defaultMagicItemModifier !== undefined) {
		merged.defaultMagicItemModifier = customConfig.defaultMagicItemModifier;
	}

	if (customConfig.overrideMagicItemChances !== undefined) {
		merged.overrideMagicItemChances = { ...defaultConfig.overrideMagicItemChances, ...customConfig.overrideMagicItemChances };
	}

	merged.isCustomTemplate = true;

	return merged;
}

/**
 * Calculate effective configuration by merging custom template with defaults
 * Convenience function that handles null/undefined custom config
 *
 * @param defaultConfig Complete default configuration
 * @param customConfig Optional custom configuration (null/undefined = use defaults)
 * @returns Effective configuration to use for generation
 */
export function calculateEffectiveConfig(
	defaultConfig: ShopGenerationConfig,
	customConfig?: Partial<ShopGenerationConfig> | null
): ShopGenerationConfig {
	if (!customConfig) {
		return defaultConfig;
	}

	return mergeTemplateWithDefaults(customConfig, defaultConfig);
}

/**
 * Validate a template configuration for common errors
 * Returns validation result with list of errors (empty if valid)
 *
 * @param config Configuration to validate
 * @returns Object with valid flag and array of error messages
 */
export function validateTemplateConfig(config: ShopGenerationConfig): {
	valid: boolean;
	errors: string[];
} {
	const errors: string[] = [];

	// Validate totalItemRange if specified
	if (config.totalItemRange) {
		if (config.totalItemRange.min < 0) {
			errors.push('totalItemRange.min must be >= 0');
		}
		if (config.totalItemRange.max < config.totalItemRange.min) {
			errors.push('totalItemRange.max must be >= totalItemRange.min');
		}
	}

	// Validate rarityChances (should be 0-100)
	const rarityChances = config.rarityChances ?? {};
	for (const [rarity, chance] of Object.entries(rarityChances as Record<string, number>)) {
		if (chance < 0 || chance > 100) {
			errors.push(`rarityChances.${rarity} must be between 0 and 100 (got ${chance})`);
		}
	}

	// Validate itemTypeChances if specified
	if (config.itemTypeChances) {
		for (const [type, chances] of Object.entries(config.itemTypeChances)) {
			for (const [rarity, chance] of Object.entries(chances)) {
				if (chance !== undefined && (chance < 0 || chance > 100)) {
					errors.push(`itemTypeChances.${type}.${rarity} must be between 0 and 100 (got ${chance})`);
				}
			}
		}
	}

	// Validate specificItems if specified
	if (config.specificItems) {
		for (let i = 0; i < config.specificItems.length; i++) {
			const item = config.specificItems[i];

			if (!item.itemName || item.itemName.trim() === '') {
				errors.push(`specificItems[${i}].itemName cannot be empty`);
			}

			if (item.spawnChance < 0 || item.spawnChance > 100) {
				errors.push(`specificItems[${i}].spawnChance must be between 0 and 100 (got ${item.spawnChance})`);
			}

			if (item.stockRange.min < 0) {
				errors.push(`specificItems[${i}].stockRange.min must be >= 0`);
			}

			if (item.stockRange.max < item.stockRange.min) {
				errors.push(`specificItems[${i}].stockRange.max must be >= stockRange.min`);
			}
		}
	}

	// Validate fundsOnHandDice if specified
	if (config.fundsOnHandDice) {
		const dice = config.fundsOnHandDice;

		if (dice.count < 0) {
			errors.push('fundsOnHandDice.count must be >= 0');
		}

		const validDiceSides = [4, 6, 8, 10, 12, 20, 100];
		if (!validDiceSides.includes(dice.sides)) {
			errors.push(`fundsOnHandDice.sides must be one of: ${validDiceSides.join(', ')} (got ${dice.sides})`);
		}

		if (dice.bonus < 0) {
			errors.push('fundsOnHandDice.bonus must be >= 0');
		}

		const validCurrencies = ['cp', 'sp', 'gp', 'pp'];
		if (!validCurrencies.includes(dice.currency)) {
			errors.push(`fundsOnHandDice.currency must be one of: ${validCurrencies.join(', ')} (got ${dice.currency})`);
		}
	}

	return {
		valid: errors.length === 0,
		errors
	};
}

/**
 * Validate that totalItemLimit doesn't exceed sum of maxItems
 * This is a softer validation - returns a warning rather than error
 *
 * @param config Configuration to check
 * @returns Warning message if limit is too low, null otherwise
 */
export function validateTotalItemLimit(config: ShopGenerationConfig): string | null {
	if (!config.totalItemRange) {
		return null;
	}

	const maxItemsSum = Object.values(config.maxItems ?? {}).reduce((sum, val) => sum + val, 0);

	if (config.totalItemRange.max < maxItemsSum) {
		return `Warning: totalItemRange.max (${config.totalItemRange.max}) is less than sum of maxItems (${maxItemsSum}). This may result in fewer items than expected.`;
	}

	return null;
}
