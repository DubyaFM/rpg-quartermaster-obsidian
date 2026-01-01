// Dice rolling calculator for D&D-style dice notation
// Platform-agnostic - uses IRandomizer interface

import { IRandomizer } from '../interfaces/IRandomizer';
import { ItemCost, FundsOnHandDice } from '../models/types';
import type { CurrencyConfig } from '../models/currency-config.js';
import { convertFromCopper, convertFromBaseUnit } from './currency';

/**
 * Roll dice and sum the results
 * @param randomizer Randomizer implementation for generating random values
 * @param count Number of dice to roll
 * @param sides Number of sides on each die (4, 6, 8, 10, 12, 20, 100)
 * @returns Sum of all dice rolls
 */
export function rollDice(randomizer: IRandomizer, count: number, sides: number): number {
	let total = 0;
	for (let i = 0; i < count; i++) {
		// Roll 1 to sides (inclusive)
		total += randomizer.randomInt(1, sides);
	}
	return total;
}

/**
 * Evaluates a dice roll and returns the result as currency distributed across denominations.
 * Supports any currency system by using a base unit multiplier.
 *
 * The function rolls the specified dice, adds any bonus, multiplies by the baseUnitMultiplier,
 * and converts the result into the appropriate currency denominations using the provided config.
 *
 * @param randomizer Randomizer implementation for generating random values
 * @param diceConfig Dice configuration with count, sides, bonus, and legacy currency type
 * @param config Currency configuration for converting to proper denominations
 * @param baseUnitMultiplier Multiplier for the base unit to represent the currency value of the dice roll
 * @returns ItemCost object with amounts distributed across denominations
 *
 * @description
 * The baseUnitMultiplier parameter allows the function to be currency-agnostic:
 * - For D&D 5e rolling "gold on hand" (e.g., "10d10 gp"): pass multiplier=100
 *   (since 1 gp = 100 cp, the rolled amount gets multiplied by 100 to get copper value)
 * - For single-denomination systems (e.g., rolling credits directly): pass multiplier=1
 * - For other systems: calculate the base unit multiplier from the conversion rate
 *
 * @example D&D 5e - Rolling for gold pieces (where 1 gp = 100 cp)
 * const randomizer = new StandardRandomizer();
 * const config = getDnd5eCurrencyConfig();
 * // Roll 2d6+10 gold pieces
 * const result = evaluateDiceGold(randomizer, {count: 2, sides: 6, bonus: 10, currency: 'gp'}, config, 100);
 * // If roll is 8: (8 + 10) * 100 = 1800 copper
 * // Returns: { pp: 1, gp: 8, sp: 0, cp: 0 }
 *
 * @example Credits system - Rolling for credits directly (base unit)
 * const creditsConfig = getCreditsConfig();
 * // Roll 3d10 credits directly
 * const result = evaluateDiceGold(randomizer, {count: 3, sides: 10, bonus: 0, currency: 'cr'}, creditsConfig, 1);
 * // If roll is 15: 15 * 1 = 15 credits
 * // Returns: { cr: 15 }
 *
 * @example Custom system - Using non-standard conversion
 * // For a system where you want to roll "10 silver pieces" worth of value
 * // and 1 silver = 10 base units, pass multiplier=10
 * const result = evaluateDiceGold(randomizer, diceConfig, customConfig, 10);
 */
export function evaluateDiceGold(
	randomizer: IRandomizer,
	diceConfig: FundsOnHandDice,
	config: CurrencyConfig,
	baseUnitMultiplier: number = 1
): ItemCost {
	// Roll the dice
	const rolled = rollDice(randomizer, diceConfig.count, diceConfig.sides);
	const total = rolled + diceConfig.bonus;

	// Multiply by the base unit multiplier to get the value in base units
	const baseUnits = total * baseUnitMultiplier;

	// Convert base units to multi-currency representation
	return convertFromBaseUnit(baseUnits, config);
}
