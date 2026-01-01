import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigService } from '../services/ConfigService';
import { IConfigAdapter, RawShopConfig, RawCustomTemplatesConfig, RawShopkeepConfig } from '../interfaces/IConfigAdapter';
import { ISettingsAdapter } from '../interfaces/ISettingsAdapter';
import { DEFAULT_SETTINGS } from '../models/types';

// Mock config adapter
const mockConfigAdapter: IConfigAdapter = {
	loadShopConfig: vi.fn(),
	loadServicesConfig: vi.fn(),
	loadFactionsConfig: vi.fn(),
	loadLootTablesConfig: vi.fn(),
	loadCustomTemplates: vi.fn(),
	loadShopkeepConfig: vi.fn(),
	saveCustomTemplates: vi.fn(),
	configExists: vi.fn(),
	getConfigPath: vi.fn().mockReturnValue('/mock/config/path'),
	loadTemplateByName: vi.fn(),
	saveNamedTemplate: vi.fn(),
	deleteNamedTemplate: vi.fn()
};

// Mock settings adapter
const mockSettingsAdapter: ISettingsAdapter = {
	getSettings: vi.fn().mockReturnValue(DEFAULT_SETTINGS),
	saveSettings: vi.fn(),
	onSettingsChange: vi.fn()
};

// Mock shop config data
const mockShopConfig: RawShopConfig = {
	shops: {
		blacksmith: {
			poor: {
				maxItems: 10,
				rarityChances: { common: 90, uncommon: 10, rare: 0, veryRare: 0, legendary: 0 },
				basicItemTypes: { weapon: 80, armor: 70 },
				magicItemCountWeights: { 0: 80, 1: 15, 2: 5 },
				defaultMagicItemModifier: 0.5,
				fundsOnHand: '5d10+20'
			},
			wealthy: {
				maxItems: 30,
				rarityChances: { common: 100, uncommon: 80, rare: 40, veryRare: 10, legendary: 0 },
				basicItemTypes: { weapon: 90, armor: 90 },
				magicItemCountWeights: { 2: 30, 3: 40, 4: 30 },
				defaultMagicItemModifier: 1.2,
				fundsOnHand: '20d10+200',
				overrideMagicItemChances: {
					common: 100,
					uncommon: 50,
					rare: 25,
					veryRare: 10,
					legendary: 2
				}
			}
		}
	}
};

// Mock custom templates
const mockCustomTemplates: RawCustomTemplatesConfig = {
	templates: {
		blacksmith: {
			poor: {
				maxItems: 15,
				specificItems: [
					{ itemName: 'Longsword', spawnChance: 100, stockRange: { min: 5, max: 10 } }
				]
			}
		}
	}
};

describe('ConfigService', () => {
	let configService: ConfigService;

	beforeEach(() => {
		vi.clearAllMocks();
		configService = new ConfigService(mockConfigAdapter, mockSettingsAdapter);
	});

	describe('getShopConfig', () => {
		it('should load and return shop config', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);

			const config = await configService.getShopConfig('blacksmith', 'poor');

			expect(config).toBeDefined();
			expect(config.type).toBe('blacksmith');
			expect(config.wealthLevel).toBe('poor');
			expect(config.maxItems).toBe(10);
		});

		it('should calculate effective magic item chances', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);
			(mockSettingsAdapter.getSettings as any).mockReturnValue({
				...DEFAULT_SETTINGS,
				partyLevel: 5,
				magicItemRarityModifiers: {
					poor: 0.1,
					modest: 0.3,
					comfortable: 0.6,
					wealthy: 0.8,
					aristocratic: 1.0
				}
			});

			const config = await configService.getShopConfig('blacksmith', 'poor');

			expect(config).toHaveProperty('effectiveMagicItemChances');
			const effectiveChances = (config as any).effectiveMagicItemChances;
			expect(effectiveChances).toBeDefined();
			expect(effectiveChances.common).toBeGreaterThan(0);
		});

		it('should use override chances when provided', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);

			const config = await configService.getShopConfig('blacksmith', 'wealthy');

			const effectiveChances = (config as any).effectiveMagicItemChances;
			expect(effectiveChances.common).toBe(100);
			expect(effectiveChances.uncommon).toBe(50);
			expect(effectiveChances.rare).toBe(25);
		});

		it('should cache shop config after first load', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);

			await configService.getShopConfig('blacksmith', 'poor');
			await configService.getShopConfig('blacksmith', 'wealthy');

			// Should only call loadShopConfig once (cached)
			expect(mockConfigAdapter.loadShopConfig).toHaveBeenCalledTimes(1);
		});

		it('should throw error if shop config not found', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(null);

			await expect(configService.getShopConfig('blacksmith', 'poor'))
				.rejects.toThrow('Shop configuration file could not be loaded');
		});

		it('should throw error if shop type not found', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);

			await expect(configService.getShopConfig('tavern', 'poor'))
				.rejects.toThrow('No configuration found for shop type: tavern');
		});

		it('should throw error if wealth level not found', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);

			await expect(configService.getShopConfig('blacksmith', 'aristocratic'))
				.rejects.toThrow('No configuration found for blacksmith at aristocratic wealth level');
		});
	});

	describe('getShopConfigWithTemplate', () => {
		it('should merge custom template with default config', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);

			// Mock settings to use custom template
			(mockSettingsAdapter.getSettings as any).mockReturnValue({
				...DEFAULT_SETTINGS,
				shopTemplatePreferences: { blacksmith: 'blacksmith-custom' }
			});

			// Mock loadTemplateByName to return new-format template
			(mockConfigAdapter.loadTemplateByName as any).mockResolvedValue({
				name: 'blacksmith-custom',
				shopType: 'blacksmith',
				wealthLevels: {
					poor: {
						maxItems: 15,
						specificItems: [
							{ itemName: 'Longsword', spawnChance: 100, stockRange: { min: 5, max: 10 } }
						]
					}
				}
			});

			const config = await configService.getShopConfigWithTemplate('blacksmith', 'poor');

			expect(config.maxItems).toBe(15); // From custom template
			expect(config.specificItems).toBeDefined();
			expect(config.specificItems!.length).toBe(1);
		});

		it('should use default config if no custom template', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue({ templates: {} });

			const config = await configService.getShopConfigWithTemplate('blacksmith', 'wealthy');

			expect(config.maxItems).toBe(30); // From default config
		});

		it('should recalculate magic chances after template merge', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue(mockCustomTemplates);

			const config = await configService.getShopConfigWithTemplate('blacksmith', 'poor');

			expect(config).toHaveProperty('effectiveMagicItemChances');
		});
	});

	describe('getCustomTemplate', () => {
		it('should return custom template if exists', async () => {
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue(mockCustomTemplates);

			const template = await configService.getCustomTemplate('blacksmith', 'poor');

			expect(template).toBeDefined();
			expect(template!.maxItems).toBe(15);
		});

		it('should return null if no custom template', async () => {
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue({ templates: {} });

			const template = await configService.getCustomTemplate('blacksmith', 'poor');

			expect(template).toBeNull();
		});

		it('should map fundsOnHand to fundsOnHandDice', async () => {
			const templatesWithFundsOnHand: RawCustomTemplatesConfig = {
				templates: {
					blacksmith: {
						poor: {
							fundsOnHand: '10d10+50' as any
						}
					}
				}
			};
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue(templatesWithFundsOnHand);

			const template = await configService.getCustomTemplate('blacksmith', 'poor');

			expect(template).toHaveProperty('fundsOnHandDice');
			expect(template!.fundsOnHandDice).toBe('10d10+50');
			expect(template).not.toHaveProperty('fundsOnHand');
		});
	});

	describe('saveCustomTemplate', () => {
		it('should save custom template', async () => {
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue({ templates: {} });

			const newTemplate = {
				maxItems: 20,
				fundsOnHandDice: '15d10+100'
			};

			await configService.saveCustomTemplate('tavern', 'comfortable', newTemplate);

			expect(mockConfigAdapter.saveCustomTemplates).toHaveBeenCalled();
			const savedTemplates = (mockConfigAdapter.saveCustomTemplates as any).mock.calls[0][0];
			expect(savedTemplates.templates.tavern.comfortable).toBeDefined();
		});

		it('should map fundsOnHandDice to fundsOnHand when saving', async () => {
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue({ templates: {} });

			const newTemplate = {
				maxItems: 25,
				fundsOnHandDice: '20d10+200'
			};

			await configService.saveCustomTemplate('alchemist', 'wealthy', newTemplate);

			const savedTemplates = (mockConfigAdapter.saveCustomTemplates as any).mock.calls[0][0];
			expect(savedTemplates.templates.alchemist.wealthy.fundsOnHand).toBe('20d10+200');
			expect(savedTemplates.templates.alchemist.wealthy.fundsOnHand).not.toBeUndefined();
		});

		it('should invalidate cache after save', async () => {
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue({ templates: {} });

			await configService.saveCustomTemplate('blacksmith', 'poor', { maxItems: 12 });

			// Next call should reload
			await configService.getAllCustomTemplates();

			expect(mockConfigAdapter.loadCustomTemplates).toHaveBeenCalledTimes(2);
		});
	});

	describe('deleteCustomTemplate', () => {
		it('should delete custom template', async () => {
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue(mockCustomTemplates);

			await configService.deleteCustomTemplate('blacksmith', 'poor');

			expect(mockConfigAdapter.saveCustomTemplates).toHaveBeenCalled();
			const savedTemplates = (mockConfigAdapter.saveCustomTemplates as any).mock.calls[0][0];
			expect(savedTemplates.templates.blacksmith?.poor).toBeUndefined();
		});

		it('should remove shop type if no more templates', async () => {
			const singleTemplate: RawCustomTemplatesConfig = {
				templates: {
					blacksmith: {
						poor: { maxItems: 10 }
					}
				}
			};
			(mockConfigAdapter.loadCustomTemplates as any).mockResolvedValue(singleTemplate);

			await configService.deleteCustomTemplate('blacksmith', 'poor');

			const savedTemplates = (mockConfigAdapter.saveCustomTemplates as any).mock.calls[0][0];
			expect(savedTemplates.templates.blacksmith).toBeUndefined();
		});
	});

	describe('getServices', () => {
		it('should load and return services', async () => {
			const mockServices = {
				tavern: [
					{ name: 'Room (Common)', price: { cp: 0, sp: 5, gp: 0, pp: 0 } }
				]
			};
			(mockConfigAdapter.loadServicesConfig as any).mockResolvedValue(mockServices);

			const services = await configService.getServices('tavern');

			expect(services).toHaveLength(1);
			expect(services[0].name).toBe('Room (Common)');
		});

		it('should cache services', async () => {
			(mockConfigAdapter.loadServicesConfig as any).mockResolvedValue({ tavern: [] });

			await configService.getServices('tavern');
			await configService.getServices('inn');

			expect(mockConfigAdapter.loadServicesConfig).toHaveBeenCalledTimes(1);
		});
	});

	describe('getFactions', () => {
		it('should load and return factions', async () => {
			const mockFactions = {
				factions: [
					{ name: 'Harpers', description: 'Secret society' }
				]
			};
			(mockConfigAdapter.loadFactionsConfig as any).mockResolvedValue(mockFactions);

			const factions = await configService.getFactions();

			expect(factions).toHaveLength(1);
			expect(factions[0].name).toBe('Harpers');
		});
	});

	describe('getShopkeepConfig', () => {
		it('should load and return shopkeeper config', async () => {
			const mockShopkeepConfig: RawShopkeepConfig = {
				names: {
					male: ['John', 'Bob'],
					female: ['Jane', 'Alice'],
					neutral: ['Alex', 'Sam']
				},
				surnames: ['Smith', 'Jones'],
				genders: ['male', 'female', 'non-binary'],
				species: {
					tier1: [{ name: 'Human', weight: 25 }],
					tier2: [{ name: 'Dwarf', weight: 15 }],
					tier3: [{ name: 'Elf', weight: 3.57 }],
					tier4: [{ name: 'Tabaxi', weight: 0.71 }]
				},
				dispositions: [
					{ type: 'neutral', weight: 50, description: 'Neutral', dc: 10 }
				],
				quirks: ['Always smiling'],
				motivations: ['Saving for retirement']
			};
			(mockConfigAdapter.loadShopkeepConfig as any).mockResolvedValue(mockShopkeepConfig);

			const config = await configService.getShopkeepConfig();

			expect(config).toBeDefined();
			expect(config!.names.male).toContain('John');
			expect(config!.species.tier1[0].name).toBe('Human');
		});

		it('should cache shopkeeper config', async () => {
			(mockConfigAdapter.loadShopkeepConfig as any).mockResolvedValue({});

			await configService.getShopkeepConfig();
			await configService.getShopkeepConfig();

			expect(mockConfigAdapter.loadShopkeepConfig).toHaveBeenCalledTimes(1);
		});
	});

	describe('clearCache', () => {
		it('should clear all caches', async () => {
			(mockConfigAdapter.loadShopConfig as any).mockResolvedValue(mockShopConfig);
			(mockConfigAdapter.loadServicesConfig as any).mockResolvedValue({});
			(mockConfigAdapter.loadFactionsConfig as any).mockResolvedValue({ factions: [] });

			// Load some configs to populate caches
			await configService.getShopConfig('blacksmith', 'poor');
			await configService.getServices('tavern');
			await configService.getFactions();

			// Clear cache
			configService.clearCache();

			// Next calls should reload
			await configService.getShopConfig('blacksmith', 'poor');
			await configService.getServices('tavern');
			await configService.getFactions();

			expect(mockConfigAdapter.loadShopConfig).toHaveBeenCalledTimes(2);
			expect(mockConfigAdapter.loadServicesConfig).toHaveBeenCalledTimes(2);
			expect(mockConfigAdapter.loadFactionsConfig).toHaveBeenCalledTimes(2);
		});
	});
});
