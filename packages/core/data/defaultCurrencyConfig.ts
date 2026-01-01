/**
 * Default Currency Configuration
 *
 * Provides a code-based fallback for the D&D 5e currency system when the
 * currencies.yaml configuration file is not available. This is useful for:
 * - Unit testing without file I/O dependencies
 * - Initialization before config files are loaded
 * - Providing a safe default if config loading fails
 *
 * This configuration matches the "dnd5e" system defined in config/currencies.yaml
 * and implements the D&D 5e Standard currency rules with platinum, gold, silver,
 * and copper pieces at their standard conversion rates.
 *
 * @module core/data/defaultCurrencyConfig
 * @see config/currencies.yaml - Source configuration file
 * @see packages/core/models/currency-config.ts - TypeScript type definitions
 */

import type { CurrencyConfig } from '../models/currency-config.js';

/**
 * Default D&D 5e currency configuration
 *
 * Provides a complete, ready-to-use currency system matching the D&D 5e Standard
 * from the official currencies.yaml configuration file.
 *
 * Configuration details:
 * - **System**: dnd5e (D&D 5e Standard)
 * - **Base Unit**: Copper pieces (cp)
 * - **Denominations**:
 *   - Platinum (pp): 1000 cp
 *   - Gold (gp): 100 cp
 *   - Silver (sp): 10 cp
 *   - Copper (cp): 1 cp
 * - **Weight**: Constant 0.02 lbs per coin (50 coins = 1 pound, per D&D 5e encumbrance rules)
 * - **Formatting**: Comma-separated list (e.g., "10 pp, 50 gp, 3 sp")
 *   - Separator: ", "
 *   - Symbol position: suffix (e.g., "10 gp")
 *   - Hide zero values: true (omit denominations with 0 coins)
 */
export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
	systems: {
		dnd5e: {
			name: 'D&D 5e Standard',
			formatting: {
				separator: ', ',
				showZero: false,
				symbolPosition: 'suffix'
			},
			weightSettings: {
				strategy: 'constant',
				constantValue: 0.02,
				unit: 'lbs'
			},
			denominations: [
				{
					id: 'platinum',
					abbreviation: 'pp',
					conversionRate: 1000,
					order: 0,
					symbol: 'pp'
				},
				{
					id: 'gold',
					abbreviation: 'gp',
					conversionRate: 100,
					order: 1,
					symbol: 'gp'
				},
				{
					id: 'silver',
					abbreviation: 'sp',
					conversionRate: 10,
					order: 2,
					symbol: 'sp'
				},
				{
					id: 'copper',
					abbreviation: 'cp',
					conversionRate: 1,
					order: 3,
					symbol: 'cp'
				}
			],
			baseUnit: 'cp'
		}
	},
	defaultSystem: 'dnd5e'
};

/**
 * Gets the default D&D 5e currency configuration
 *
 * Returns a fresh copy of the default configuration object that can be used
 * as a fallback when the currencies.yaml file is not available or during
 * testing when file I/O should be avoided.
 *
 * @returns {CurrencyConfig} Complete currency configuration with D&D 5e Standard system
 *
 * @example
 * // Use in initialization code
 * const config = getDefaultCurrencyConfig();
 *
 * @example
 * // Use as fallback in config loader
 * async function loadCurrencyConfig(): Promise<CurrencyConfig> {
 *   try {
 *     return await loadFromFile('currencies.yaml');
 *   } catch (error) {
 *     console.warn('Failed to load currency config, using default');
 *     return getDefaultCurrencyConfig();
 *   }
 * }
 *
 * @example
 * // Use in unit tests to avoid file dependencies
 * describe('Currency calculations', () => {
 *   let config: CurrencyConfig;
 *
 *   beforeEach(() => {
 *     config = getDefaultCurrencyConfig();
 *   });
 *
 *   test('should convert copper to gold', () => {
 *     // Test with known configuration
 *   });
 * });
 */
export function getDefaultCurrencyConfig(): CurrencyConfig {
	return DEFAULT_CURRENCY_CONFIG;
}
