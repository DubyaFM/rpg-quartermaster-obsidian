// Party Level Base Magic Item Chances
// Defines baseline magic item rarity chances for each party level (1-20)
// These values are multiplied by defaultMagicItemModifier and wealth modifiers to get effective chances

export interface PartyLevelMagicChances {
	common: number;
	uncommon: number;
	rare: number;
	veryRare: number;
	legendary: number;
}

export const PARTY_LEVEL_BASE_MAGIC_CHANCES: Record<number, PartyLevelMagicChances> = {
	1: { common: 30, uncommon: 10, rare: 0, veryRare: 0, legendary: 0 },
	2: { common: 35, uncommon: 12, rare: 0, veryRare: 0, legendary: 0 },
	3: { common: 40, uncommon: 18, rare: 5, veryRare: 0, legendary: 0 },
	4: { common: 45, uncommon: 25, rare: 10, veryRare: 0, legendary: 0 },
	5: { common: 50, uncommon: 35, rare: 15, veryRare: 5, legendary: 0 },
	6: { common: 55, uncommon: 40, rare: 20, veryRare: 8, legendary: 0 },
	7: { common: 60, uncommon: 45, rare: 25, veryRare: 10, legendary: 0 },
	8: { common: 65, uncommon: 50, rare: 30, veryRare: 12, legendary: 2 },
	9: { common: 70, uncommon: 55, rare: 35, veryRare: 15, legendary: 3 },
	10: { common: 75, uncommon: 60, rare: 40, veryRare: 18, legendary: 5 },
	11: { common: 78, uncommon: 65, rare: 45, veryRare: 22, legendary: 8 },
	12: { common: 80, uncommon: 70, rare: 50, veryRare: 27, legendary: 10 },
	13: { common: 83, uncommon: 75, rare: 55, veryRare: 32, legendary: 12 },
	14: { common: 85, uncommon: 80, rare: 60, veryRare: 37, legendary: 15 },
	15: { common: 90, uncommon: 85, rare: 65, veryRare: 42, legendary: 18 },
	16: { common: 90, uncommon: 88, rare: 70, veryRare: 50, legendary: 22 },
	17: { common: 90, uncommon: 90, rare: 75, veryRare: 60, legendary: 30 },
	18: { common: 90, uncommon: 90, rare: 80, veryRare: 70, legendary: 38 },
	19: { common: 90, uncommon: 90, rare: 85, veryRare: 80, legendary: 45 },
	20: { common: 90, uncommon: 90, rare: 90, veryRare: 90, legendary: 50 }
};

/**
 * Get party level base magic chances with clamping
 * If level is out of range, returns closest valid level
 * @param level Party level (1-20)
 * @returns Base magic item chances for that level
 */
export function getPartyLevelBaseChances(level: number): PartyLevelMagicChances {
	// Clamp to valid range
	const clampedLevel = Math.max(1, Math.min(20, Math.floor(level)));
	return PARTY_LEVEL_BASE_MAGIC_CHANCES[clampedLevel];
}
