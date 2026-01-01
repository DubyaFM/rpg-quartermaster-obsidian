// D&D 5e Random NPC Tables for Shopkeep Generation
// Feel free to customize these tables to fit your campaign setting!

export const NPC_TABLES = {
	// First names by gender
	maleNames: [
		'Aldric', 'Borin', 'Cedric', 'Darius', 'Eldon', 'Finn', 'Gareth', 'Hadrian',
		'Igor', 'Jasper', 'Kael', 'Lorian', 'Marcus', 'Nolan', 'Orin', 'Percival',
		'Quinlan', 'Rowan', 'Silas', 'Theron', 'Ulric', 'Varian', 'Wesley', 'Xander',
		'Yorick', 'Zane', 'Alastair', 'Barnaby', 'Corvus', 'Draven'
	],

	femaleNames: [
		'Aria', 'Brynn', 'Celia', 'Diana', 'Elara', 'Faye', 'Gwen', 'Helena',
		'Isla', 'Jade', 'Kira', 'Luna', 'Mira', 'Nessa', 'Ophelia', 'Petra',
		'Quinn', 'Rosalind', 'Sylvia', 'Thalia', 'Una', 'Vera', 'Wren', 'Xenia',
		'Yara', 'Zara', 'Astrid', 'Beatrice', 'Cassandra', 'Delilah'
	],

	neutralNames: [
		'Ash', 'Brook', 'Cedar', 'Dale', 'Echo', 'Fox', 'Gray', 'Haven',
		'Indigo', 'Jordan', 'Kit', 'Lake', 'Morgan', 'North', 'Ocean', 'Piper',
		'Quest', 'River', 'Sky', 'Taylor', 'Vale', 'Wren', 'Winter', 'Yarrow',
		'Zenith', 'Arbor', 'Beacon', 'Cloud', 'Dusk', 'Ember'
	],

	// Family names/surnames
	surnames: [
		'Ironforge', 'Goldleaf', 'Stonewell', 'Brightwater', 'Darkwood', 'Swiftwind',
		'Thornheart', 'Emberfall', 'Moonwhisper', 'Sunstrider', 'Frostbane', 'Stormcaller',
		'Ashwood', 'Blackthorn', 'Copperfield', 'Deepdelver', 'Eagleeye', 'Fairwind',
		'Greenhill', 'Highcliff', 'Ironside', 'Jewelcutter', 'Kindleflame', 'Longstride',
		'Merryweather', 'Nightshade', 'Oakenshield', 'Proudfoot', 'Quicksilver', 'Ravenwood'
	],

	// Species/races
	species: [
		'Human', 'Dwarf', 'Elf', 'Half-Elf', 'Halfling', 'Gnome',
		'Half-Orc', 'Tiefling', 'Dragonborn', 'Goliath', 'Tabaxi', 'Firbolg',
		'Kenku', 'Lizardfolk', 'Tortle', 'Aasimar', 'Genasi', 'Triton'
	],

	// Gender options
	genders: ['male', 'female', 'non-binary'],

	// Disposition - affects bargaining DC (based on D&D 5e social interaction DCs)
	dispositions: [
		{ type: 'hostile', weight: 5, description: 'Hostile', dc: 20 },
		{ type: 'unfriendly', weight: 15, description: 'Unfriendly', dc: 15 },
		{ type: 'neutral', weight: 50, description: 'Neutral', dc: 10 },
		{ type: 'friendly', weight: 20, description: 'Friendly', dc: 5 },
		{ type: 'helpful', weight: 10, description: 'Helpful', dc: 0 }
	],

	// Quirks and personality traits
	quirks: [
		'Always speaks in rhymes',
		'Has a pet rat that sits on their shoulder',
		'Constantly polishing their wares',
		'Obsessed with collecting coins from different kingdoms',
		'Never makes eye contact',
		'Laughs at inappropriate times',
		'Speaks very loudly',
		'Whispers everything',
		'Tells long-winded stories about their merchandise',
		'Haggles for the fun of it, even when prices are fair',
		'Insists on inspecting every coin carefully',
		'Has a terrible memory for names',
		'Always eating something',
		'Obsessed with cleanliness',
		'Superstitious about certain numbers',
		'Gives everyone a nickname',
		'Hums while working',
		'Collects unusual trinkets',
		'Has a distinctive accent',
		'Always comments on the weather',
		'Incredibly suspicious of strangers',
		'Overly trusting and naive',
		'Tells the same joke repeatedly',
		'Has a nervous tic',
		'Speaks to their merchandise',
		'Always has a drink in hand',
		'Compulsively counts things',
		'Obsessed with their appearance',
		'Gives unsolicited advice',
		'Has an unusual laugh'
	],

	// Motivations (alternative to quirks)
	motivations: [
		'Saving gold to retire comfortably',
		'Supporting a family member in need',
		'Trying to become the wealthiest merchant in town',
		'Seeking rare items to complete a collection',
		'Funding an adventuring expedition',
		'Paying off a substantial debt',
		'Building a trading empire',
		'Searching for information about a lost relative',
		'Trying to impress a romantic interest',
		'Seeking revenge against a rival merchant',
		'Funding a local temple or charity',
		'Saving for a magical education',
		'Building a legacy for their children',
		'Attempting to join a merchant guild',
		'Researching ancient artifacts'
	]
};

// Weighted random selection helper
export function weightedRandom<T extends { type: string; weight: number }>(items: T[]): T {
	const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
	let random = Math.random() * totalWeight;

	for (const item of items) {
		if (random < item.weight) {
			return item;
		}
		random -= item.weight;
	}

	return items[items.length - 1];
}

// Random selection helper
export function randomChoice<T>(array: T[]): T {
	return array[Math.floor(Math.random() * array.length)];
}
