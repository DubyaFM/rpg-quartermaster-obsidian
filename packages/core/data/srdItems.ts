// SRD Item Database - Fallback items for vaults without custom items
// Based on D&D 5e SRD (Systems Reference Document)

export interface SRDItemData {
	name: string;
	cost: string;
	type: string;
	rarity: string;
	description: string;
	weight?: number;  // Weight in pounds (lb)
}

/**
 * Core SRD items available as fallback when vault has insufficient items
 * Includes weapons, armor, adventuring gear, and common magic items
 */
export const SRD_ITEMS: SRDItemData[] = [
	// WEAPONS - Simple Melee
	{
		name: "Club",
		cost: "1 sp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d4 bludgeoning, light",
		weight: 2
	},
	{
		name: "Dagger",
		cost: "2 gp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d4 piercing, finesse, light, thrown (range 20/60)",
		weight: 1
	},
	{
		name: "Greatclub",
		cost: "2 sp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d8 bludgeoning, two-handed",
		weight: 10
	},
	{
		name: "Handaxe",
		cost: "5 gp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d6 slashing, light, thrown (range 20/60)",
		weight: 2
	},
	{
		name: "Javelin",
		cost: "5 sp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d6 piercing, thrown (range 30/120)",
		weight: 2
	},
	{
		name: "Light Hammer",
		cost: "2 gp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d4 bludgeoning, light, thrown (range 20/60)",
		weight: 2
	},
	{
		name: "Mace",
		cost: "5 gp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d6 bludgeoning",
		weight: 4
	},
	{
		name: "Quarterstaff",
		cost: "2 sp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d6 bludgeoning, versatile (1d8)",
		weight: 4
	},
	{
		name: "Sickle",
		cost: "1 gp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d4 slashing, light",
		weight: 2
	},
	{
		name: "Spear",
		cost: "1 gp",
		type: "weapon",
		rarity: "common",
		description: "Simple melee weapon, 1d6 piercing, thrown (range 20/60), versatile (1d8)",
		weight: 3
	},

	// WEAPONS - Simple Ranged
	{
		name: "Light Crossbow",
		cost: "25 gp",
		type: "weapon",
		rarity: "common",
		description: "Simple ranged weapon, 1d8 piercing, ammunition (range 80/320), loading, two-handed",
		weight: 5
	},
	{
		name: "Dart",
		cost: "5 cp",
		type: "weapon",
		rarity: "common",
		description: "Simple ranged weapon, 1d4 piercing, finesse, thrown (range 20/60)",
		weight: 0.25
	},
	{
		name: "Shortbow",
		cost: "25 gp",
		type: "weapon",
		rarity: "common",
		description: "Simple ranged weapon, 1d6 piercing, ammunition (range 80/320), two-handed",
		weight: 2
	},
	{
		name: "Sling",
		cost: "1 sp",
		type: "weapon",
		rarity: "common",
		description: "Simple ranged weapon, 1d4 bludgeoning, ammunition (range 30/120)",
		weight: 0
	},

	// WEAPONS - Martial Melee
	{
		name: "Battleaxe",
		cost: "10 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d8 slashing, versatile (1d10)",
		weight: 4
	},
	{
		name: "Flail",
		cost: "10 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d8 bludgeoning",
		weight: 2
	},
	{
		name: "Glaive",
		cost: "20 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d10 slashing, heavy, reach, two-handed",
		weight: 6
	},
	{
		name: "Greataxe",
		cost: "30 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d12 slashing, heavy, two-handed",
		weight: 7
	},
	{
		name: "Greatsword",
		cost: "50 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 2d6 slashing, heavy, two-handed",
		weight: 6
	},
	{
		name: "Halberd",
		cost: "20 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d10 slashing, heavy, reach, two-handed",
		weight: 6
	},
	{
		name: "Lance",
		cost: "10 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d12 piercing, reach, special",
		weight: 6
	},
	{
		name: "Longsword",
		cost: "15 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d8 slashing, versatile (1d10)",
		weight: 3
	},
	{
		name: "Maul",
		cost: "10 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 2d6 bludgeoning, heavy, two-handed",
		weight: 10
	},
	{
		name: "Morningstar",
		cost: "15 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d8 piercing",
		weight: 4
	},
	{
		name: "Pike",
		cost: "5 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d10 piercing, heavy, reach, two-handed",
		weight: 18
	},
	{
		name: "Rapier",
		cost: "25 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d8 piercing, finesse",
		weight: 2
	},
	{
		name: "Scimitar",
		cost: "25 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d6 slashing, finesse, light",
		weight: 3
	},
	{
		name: "Shortsword",
		cost: "10 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d6 piercing, finesse, light",
		weight: 2
	},
	{
		name: "Trident",
		cost: "5 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d6 piercing, thrown (range 20/60), versatile (1d8)",
		weight: 4
	},
	{
		name: "War Pick",
		cost: "5 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d8 piercing",
		weight: 2
	},
	{
		name: "Warhammer",
		cost: "15 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d8 bludgeoning, versatile (1d10)",
		weight: 2
	},
	{
		name: "Whip",
		cost: "2 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial melee weapon, 1d4 slashing, finesse, reach",
		weight: 3
	},

	// WEAPONS - Martial Ranged
	{
		name: "Blowgun",
		cost: "10 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial ranged weapon, 1 piercing, ammunition (range 25/100), loading",
		weight: 1
	},
	{
		name: "Hand Crossbow",
		cost: "75 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial ranged weapon, 1d6 piercing, ammunition (range 30/120), light, loading",
		weight: 3
	},
	{
		name: "Heavy Crossbow",
		cost: "50 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial ranged weapon, 1d10 piercing, ammunition (range 100/400), heavy, loading, two-handed",
		weight: 18
	},
	{
		name: "Longbow",
		cost: "50 gp",
		type: "weapon",
		rarity: "common",
		description: "Martial ranged weapon, 1d8 piercing, ammunition (range 150/600), heavy, two-handed",
		weight: 2
	},

	// ARMOR - Light
	{
		name: "Padded Armor",
		cost: "5 gp",
		type: "armor",
		rarity: "common",
		description: "Light armor, AC 11 + Dex modifier, disadvantage on Stealth",
		weight: 8
	},
	{
		name: "Leather Armor",
		cost: "10 gp",
		type: "armor",
		rarity: "common",
		description: "Light armor, AC 11 + Dex modifier",
		weight: 10
	},
	{
		name: "Studded Leather Armor",
		cost: "45 gp",
		type: "armor",
		rarity: "common",
		description: "Light armor, AC 12 + Dex modifier",
		weight: 13
	},

	// ARMOR - Medium
	{
		name: "Hide Armor",
		cost: "10 gp",
		type: "armor",
		rarity: "common",
		description: "Medium armor, AC 12 + Dex modifier (max 2)",
		weight: 12
	},
	{
		name: "Chain Shirt",
		cost: "50 gp",
		type: "armor",
		rarity: "common",
		description: "Medium armor, AC 13 + Dex modifier (max 2)",
		weight: 20
	},
	{
		name: "Scale Mail",
		cost: "50 gp",
		type: "armor",
		rarity: "common",
		description: "Medium armor, AC 14 + Dex modifier (max 2), disadvantage on Stealth",
		weight: 45
	},
	{
		name: "Breastplate",
		cost: "400 gp",
		type: "armor",
		rarity: "common",
		description: "Medium armor, AC 14 + Dex modifier (max 2)",
		weight: 20
	},
	{
		name: "Half Plate",
		cost: "750 gp",
		type: "armor",
		rarity: "common",
		description: "Medium armor, AC 15 + Dex modifier (max 2), disadvantage on Stealth",
		weight: 40
	},

	// ARMOR - Heavy
	{
		name: "Ring Mail",
		cost: "30 gp",
		type: "armor",
		rarity: "common",
		description: "Heavy armor, AC 14, disadvantage on Stealth",
		weight: 40
	},
	{
		name: "Chain Mail",
		cost: "75 gp",
		type: "armor",
		rarity: "common",
		description: "Heavy armor, AC 16, Str 13 required, disadvantage on Stealth",
		weight: 55
	},
	{
		name: "Splint Armor",
		cost: "200 gp",
		type: "armor",
		rarity: "common",
		description: "Heavy armor, AC 17, Str 15 required, disadvantage on Stealth",
		weight: 60
	},
	{
		name: "Plate Armor",
		cost: "1500 gp",
		type: "armor",
		rarity: "common",
		description: "Heavy armor, AC 18, Str 15 required, disadvantage on Stealth",
		weight: 65
	},

	// ARMOR - Shields
	{
		name: "Shield",
		cost: "10 gp",
		type: "armor",
		rarity: "common",
		description: "Shield, +2 AC",
		weight: 6
	},

	// ADVENTURING GEAR
	{
		name: "Backpack",
		cost: "2 gp",
		type: "misc",
		rarity: "common",
		description: "Can hold 30 lbs of gear",
		weight: 5
	},
	{
		name: "Bedroll",
		cost: "1 gp",
		type: "misc",
		rarity: "common",
		description: "Sleeping gear for rest",
		weight: 7
	},
	{
		name: "Rope, Hempen (50 feet)",
		cost: "1 gp",
		type: "misc",
		rarity: "common",
		description: "50 feet of hempen rope, 2 hit points",
		weight: 10
	},
	{
		name: "Rope, Silk (50 feet)",
		cost: "10 gp",
		type: "misc",
		rarity: "common",
		description: "50 feet of silk rope, 2 hit points",
		weight: 5
	},
	{
		name: "Torch",
		cost: "1 cp",
		type: "misc",
		rarity: "common",
		description: "Provides bright light in 20-foot radius, dim light for additional 20 feet, burns for 1 hour",
		weight: 1
	},
	{
		name: "Lantern, Hooded",
		cost: "5 gp",
		type: "misc",
		rarity: "common",
		description: "Casts bright light in 30-foot radius, dim light for additional 30 feet, burns for 6 hours on a pint of oil",
		weight: 2
	},
	{
		name: "Lantern, Bullseye",
		cost: "10 gp",
		type: "misc",
		rarity: "common",
		description: "Casts bright light in 60-foot cone, dim light for additional 60 feet, burns for 6 hours on a pint of oil",
		weight: 2
	},
	{
		name: "Oil (flask)",
		cost: "1 sp",
		type: "misc",
		rarity: "common",
		description: "Fuel for lanterns, or can be thrown as improvised weapon dealing 1d4 fire damage",
		weight: 1
	},
	{
		name: "Rations (1 day)",
		cost: "5 sp",
		type: "food",
		rarity: "common",
		description: "Dried foods suitable for extended travel",
		weight: 2
	},
	{
		name: "Waterskin",
		cost: "2 sp",
		type: "misc",
		rarity: "common",
		description: "Holds 4 pints of liquid",
		weight: 5
	},
	{
		name: "Tinderbox",
		cost: "5 sp",
		type: "misc",
		rarity: "common",
		description: "Useful for starting fires",
		weight: 1
	},
	{
		name: "Crowbar",
		cost: "2 gp",
		type: "misc",
		rarity: "common",
		description: "Grants advantage on Strength checks where leverage applies",
		weight: 5
	},
	{
		name: "Hammer",
		cost: "1 gp",
		type: "misc",
		rarity: "common",
		description: "Tool for construction or hammering pitons",
		weight: 3
	},
	{
		name: "Piton",
		cost: "5 cp",
		type: "misc",
		rarity: "common",
		description: "Used for climbing or securing rope",
		weight: 0.25
	},
	{
		name: "Grappling Hook",
		cost: "2 gp",
		type: "misc",
		rarity: "common",
		description: "Used with rope for climbing",
		weight: 4
	},
	{
		name: "Manacles",
		cost: "2 gp",
		type: "misc",
		rarity: "common",
		description: "Iron restraints, DC 20 to break or escape",
		weight: 6
	},
	{
		name: "Chain (10 feet)",
		cost: "5 gp",
		type: "misc",
		rarity: "common",
		description: "10 feet of chain, 10 hit points, DC 20 to break",
		weight: 10
	},
	{
		name: "Climbing Kit",
		cost: "25 gp",
		type: "misc",
		rarity: "common",
		description: "Includes pitons, boot tips, gloves, and harness",
		weight: 12
	},
	{
		name: "Healer's Kit",
		cost: "5 gp",
		type: "misc",
		rarity: "common",
		description: "10 uses, stabilize dying creature without medicine check",
		weight: 3
	},
	{
		name: "Thieves' Tools",
		cost: "25 gp",
		type: "misc",
		rarity: "common",
		description: "Required for picking locks and disarming traps",
		weight: 1
	},
	{
		name: "Disguise Kit",
		cost: "25 gp",
		type: "misc",
		rarity: "common",
		description: "Cosmetics, hair dye, props for creating disguises",
		weight: 3
	},
	{
		name: "Herbalism Kit",
		cost: "5 gp",
		type: "misc",
		rarity: "common",
		description: "Pouches, vials, and tools for creating herbal remedies",
		weight: 3
	},
	{
		name: "Component Pouch",
		cost: "25 gp",
		type: "misc",
		rarity: "common",
		description: "Small watertight pouch with compartments for spell components",
		weight: 2
	},
	{
		name: "Spellbook",
		cost: "50 gp",
		type: "misc",
		rarity: "common",
		description: "Blank book with 100 pages for recording spells",
		weight: 3
	},

	// POTIONS - Common
	{
		name: "Potion of Healing",
		cost: "50 gp",
		type: "potion",
		rarity: "common",
		description: "Heals 2d4+2 hit points when consumed",
		weight: 0.5
	},
	{
		name: "Potion of Climbing",
		cost: "50 gp",
		type: "potion",
		rarity: "common",
		description: "Grants climbing speed equal to walking speed for 1 hour",
		weight: 0.5
	},

	// SCROLLS - Common
	{
		name: "Spell Scroll (Cantrip)",
		cost: "25 gp",
		type: "scroll",
		rarity: "common",
		description: "Contains a single cantrip spell",
		weight: 0.1
	},
	{
		name: "Spell Scroll (1st Level)",
		cost: "50 gp",
		type: "scroll",
		rarity: "common",
		description: "Contains a single 1st-level spell",
		weight: 0.1
	},

	// MAGIC ITEMS - Uncommon
	{
		name: "Potion of Greater Healing",
		cost: "150 gp",
		type: "potion",
		rarity: "uncommon",
		description: "Heals 4d4+4 hit points when consumed",
		weight: 0.5
	},
	{
		name: "Spell Scroll (2nd Level)",
		cost: "150 gp",
		type: "scroll",
		rarity: "uncommon",
		description: "Contains a single 2nd-level spell",
		weight: 0.1
	},
	{
		name: "Spell Scroll (3rd Level)",
		cost: "300 gp",
		type: "scroll",
		rarity: "uncommon",
		description: "Contains a single 3rd-level spell",
		weight: 0.1
	},
	{
		name: "Bag of Holding",
		cost: "500 gp",
		type: "misc",
		rarity: "uncommon",
		description: "Holds 500 lbs in a 64 cubic foot space, weighs 15 lbs",
		weight: 15
	},
	{
		name: "Immovable Rod",
		cost: "500 gp",
		type: "misc",
		rarity: "uncommon",
		description: "Can be fixed in place, holds up to 8,000 lbs",
		weight: 1
	},

	// MAGIC ITEMS - Rare
	{
		name: "Potion of Superior Healing",
		cost: "500 gp",
		type: "potion",
		rarity: "rare",
		description: "Heals 8d4+8 hit points when consumed",
		weight: 0.5
	},
	{
		name: "Spell Scroll (4th Level)",
		cost: "500 gp",
		type: "scroll",
		rarity: "rare",
		description: "Contains a single 4th-level spell",
		weight: 0.1
	},
	{
		name: "Spell Scroll (5th Level)",
		cost: "1000 gp",
		type: "scroll",
		rarity: "rare",
		description: "Contains a single 5th-level spell",
		weight: 0.1
	},

	// AMMUNITION
	{
		name: "Arrows (20)",
		cost: "1 gp",
		type: "misc",
		rarity: "common",
		description: "20 arrows for bows",
		weight: 1
	},
	{
		name: "Crossbow Bolts (20)",
		cost: "1 gp",
		type: "misc",
		rarity: "common",
		description: "20 bolts for crossbows",
		weight: 1.5
	},
	{
		name: "Sling Bullets (20)",
		cost: "4 cp",
		type: "misc",
		rarity: "common",
		description: "20 bullets for slings",
		weight: 1.5
	},
	{
		name: "Blowgun Needles (50)",
		cost: "1 gp",
		type: "misc",
		rarity: "common",
		description: "50 needles for blowguns",
		weight: 1
	}
];
