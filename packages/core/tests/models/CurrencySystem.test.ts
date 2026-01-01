import { describe, it, expect } from 'vitest';
import {
	PRESET_CURRENCY_SYSTEMS,
	type CurrencySystem,
	type CurrencyDenomination
} from '../../models/CurrencySystem';

describe('CurrencySystem Models', () => {
	describe('PRESET_CURRENCY_SYSTEMS', () => {
		it('should include D&D 5e Standard currency system', () => {
			const dnd5e = PRESET_CURRENCY_SYSTEMS.find(cs => cs.id === 'dnd5e-standard');

			expect(dnd5e).toBeDefined();
			expect(dnd5e?.name).toBe('D&D 5e Standard');
			expect(dnd5e?.defaultDenomination).toBe('gp');
		});

		it('should include D&D 5e Silver Standard currency system', () => {
			const silverStandard = PRESET_CURRENCY_SYSTEMS.find(cs => cs.id === 'dnd5e-silver-standard');

			expect(silverStandard).toBeDefined();
			expect(silverStandard?.name).toBe('D&D 5e Silver Standard');
			expect(silverStandard?.defaultDenomination).toBe('sp');
		});

		it('should include Pathfinder Standard currency system', () => {
			const pathfinder = PRESET_CURRENCY_SYSTEMS.find(cs => cs.id === 'pathfinder-standard');

			expect(pathfinder).toBeDefined();
			expect(pathfinder?.name).toBe('Pathfinder Standard');
			expect(pathfinder?.defaultDenomination).toBe('gp');
		});

		it('should include Star Wars Credits currency system', () => {
			const starWars = PRESET_CURRENCY_SYSTEMS.find(cs => cs.id === 'star-wars-credits');

			expect(starWars).toBeDefined();
			expect(starWars?.name).toBe('Star Wars Credits');
			expect(starWars?.defaultDenomination).toBe('cr');
		});

		it('should include Modern USD currency system', () => {
			const modernUsd = PRESET_CURRENCY_SYSTEMS.find(cs => cs.id === 'modern-usd');

			expect(modernUsd).toBeDefined();
			expect(modernUsd?.name).toBe('Modern USD');
			expect(modernUsd?.defaultDenomination).toBe('dollar');
		});

		it('should have at least 5 preset systems', () => {
			expect(PRESET_CURRENCY_SYSTEMS.length).toBeGreaterThanOrEqual(5);
		});

		it('should have unique IDs for all preset systems', () => {
			const ids = PRESET_CURRENCY_SYSTEMS.map(cs => cs.id);
			const uniqueIds = new Set(ids);

			expect(uniqueIds.size).toBe(ids.length);
		});
	});

	describe('D&D 5e Standard Currency System', () => {
		const dnd5e = PRESET_CURRENCY_SYSTEMS.find(cs => cs.id === 'dnd5e-standard')!;

		it('should have 5 denominations (pp, gp, ep, sp, cp)', () => {
			expect(dnd5e.denominations).toHaveLength(5);

			const codes = dnd5e.denominations.map(d => d.code);
			expect(codes).toContain('pp');
			expect(codes).toContain('gp');
			expect(codes).toContain('ep');
			expect(codes).toContain('sp');
			expect(codes).toContain('cp');
		});

		it('should have correct conversion rates relative to gold', () => {
			const pp = dnd5e.denominations.find(d => d.code === 'pp');
			const gp = dnd5e.denominations.find(d => d.code === 'gp');
			const ep = dnd5e.denominations.find(d => d.code === 'ep');
			const sp = dnd5e.denominations.find(d => d.code === 'sp');
			const cp = dnd5e.denominations.find(d => d.code === 'cp');

			expect(pp?.valueInBase).toBe(10);
			expect(gp?.valueInBase).toBe(1);
			expect(ep?.valueInBase).toBe(0.5);
			expect(sp?.valueInBase).toBe(0.1);
			expect(cp?.valueInBase).toBe(0.01);
		});

		it('should have standard D&D weight (0.02 lbs per coin)', () => {
			dnd5e.denominations.forEach(denomination => {
				expect(denomination.weight).toBe(0.02);
			});
		});

		it('should have proper denomination names', () => {
			const pp = dnd5e.denominations.find(d => d.code === 'pp');
			const gp = dnd5e.denominations.find(d => d.code === 'gp');
			const ep = dnd5e.denominations.find(d => d.code === 'ep');
			const sp = dnd5e.denominations.find(d => d.code === 'sp');
			const cp = dnd5e.denominations.find(d => d.code === 'cp');

			expect(pp?.name).toBe('Platinum');
			expect(gp?.name).toBe('Gold');
			expect(ep?.name).toBe('Electrum');
			expect(sp?.name).toBe('Silver');
			expect(cp?.name).toBe('Copper');
		});
	});

	describe('D&D 5e Silver Standard Currency System', () => {
		const silverStandard = PRESET_CURRENCY_SYSTEMS.find(cs => cs.id === 'dnd5e-silver-standard')!;

		it('should have 5 denominations (pp, gp, ep, sp, cp)', () => {
			expect(silverStandard.denominations).toHaveLength(5);
		});

		it('should have correct conversion rates relative to silver', () => {
			const pp = silverStandard.denominations.find(d => d.code === 'pp');
			const gp = silverStandard.denominations.find(d => d.code === 'gp');
			const ep = silverStandard.denominations.find(d => d.code === 'ep');
			const sp = silverStandard.denominations.find(d => d.code === 'sp');
			const cp = silverStandard.denominations.find(d => d.code === 'cp');

			expect(pp?.valueInBase).toBe(100);
			expect(gp?.valueInBase).toBe(10);
			expect(ep?.valueInBase).toBe(5);
			expect(sp?.valueInBase).toBe(1);
			expect(cp?.valueInBase).toBe(0.1);
		});
	});

	describe('Star Wars Credits Currency System', () => {
		const starWars = PRESET_CURRENCY_SYSTEMS.find(cs => cs.id === 'star-wars-credits')!;

		it('should have only one denomination (credit)', () => {
			expect(starWars.denominations).toHaveLength(1);

			const credit = starWars.denominations[0];
			expect(credit.code).toBe('cr');
			expect(credit.name).toBe('Credit');
		});

		it('should have credit value of 1 (base unit)', () => {
			const credit = starWars.denominations[0];
			expect(credit.valueInBase).toBe(1);
		});

		it('should have zero weight (digital currency)', () => {
			const credit = starWars.denominations[0];
			expect(credit.weight).toBe(0);
		});
	});

	describe('CurrencySystem Interface', () => {
		it('should allow creating custom currency systems', () => {
			const customSystem: CurrencySystem = {
				id: 'custom-fantasy',
				name: 'Custom Fantasy Currency',
				denominations: [
					{ code: 'diamond', name: 'Diamond Coin', valueInBase: 100, weight: 0.01 },
					{ code: 'ruby', name: 'Ruby Coin', valueInBase: 10, weight: 0.01 },
					{ code: 'jade', name: 'Jade Coin', valueInBase: 1, weight: 0.01 }
				],
				defaultDenomination: 'jade'
			};

			expect(customSystem.id).toBe('custom-fantasy');
			expect(customSystem.denominations).toHaveLength(3);
			expect(customSystem.defaultDenomination).toBe('jade');
		});
	});

	describe('CurrencyDenomination Interface', () => {
		it('should allow creating custom denominations', () => {
			const denomination: CurrencyDenomination = {
				code: 'test',
				name: 'Test Coin',
				valueInBase: 5,
				weight: 0.03
			};

			expect(denomination.code).toBe('test');
			expect(denomination.name).toBe('Test Coin');
			expect(denomination.valueInBase).toBe(5);
			expect(denomination.weight).toBe(0.03);
		});
	});

	describe('Preset validation', () => {
		it('should have valid default denominations for all systems', () => {
			PRESET_CURRENCY_SYSTEMS.forEach(system => {
				const hasDefaultDenomination = system.denominations.some(
					d => d.code === system.defaultDenomination
				);

				expect(hasDefaultDenomination).toBe(true);
			});
		});

		it('should have non-empty denominations arrays for all systems', () => {
			PRESET_CURRENCY_SYSTEMS.forEach(system => {
				expect(system.denominations.length).toBeGreaterThan(0);
			});
		});

		it('should have unique denomination codes within each system', () => {
			PRESET_CURRENCY_SYSTEMS.forEach(system => {
				const codes = system.denominations.map(d => d.code);
				const uniqueCodes = new Set(codes);

				expect(uniqueCodes.size).toBe(codes.length);
			});
		});

		it('should have positive or zero weights for all denominations', () => {
			PRESET_CURRENCY_SYSTEMS.forEach(system => {
				system.denominations.forEach(denomination => {
					expect(denomination.weight).toBeGreaterThanOrEqual(0);
				});
			});
		});

		it('should have positive conversion rates for all denominations', () => {
			PRESET_CURRENCY_SYSTEMS.forEach(system => {
				system.denominations.forEach(denomination => {
					expect(denomination.valueInBase).toBeGreaterThan(0);
				});
			});
		});
	});
});
