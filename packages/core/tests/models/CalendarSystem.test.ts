import { describe, it, expect } from 'vitest';
import { CalendarSystem, CalendarMonth, PRESET_CALENDAR_SYSTEMS } from '../../models/CalendarSystem';

describe('CalendarSystem Model', () => {
	describe('CalendarMonth Interface', () => {
		it('should allow creation of valid calendar month', () => {
			const month: CalendarMonth = {
				name: 'January',
				days: 31,
				season: 'Winter'
			};

			expect(month.name).toBe('January');
			expect(month.days).toBe(31);
			expect(month.season).toBe('Winter');
		});

		it('should allow optional season field', () => {
			const month: CalendarMonth = {
				name: 'Day',
				days: 1
			};

			expect(month.name).toBe('Day');
			expect(month.days).toBe(1);
			expect(month.season).toBeUndefined();
		});
	});

	describe('CalendarSystem Interface', () => {
		it('should allow creation of valid calendar system', () => {
			const system: CalendarSystem = {
				id: 'test-calendar',
				name: 'Test Calendar',
				months: [
					{ name: 'Month1', days: 30, season: 'Spring' },
					{ name: 'Month2', days: 30, season: 'Summer' }
				],
				daysPerWeek: 7,
				weekdayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
			};

			expect(system.id).toBe('test-calendar');
			expect(system.name).toBe('Test Calendar');
			expect(system.months.length).toBe(2);
			expect(system.daysPerWeek).toBe(7);
			expect(system.weekdayNames.length).toBe(7);
		});
	});

	describe('PRESET_CALENDAR_SYSTEMS', () => {
		it('should be defined and not empty', () => {
			expect(PRESET_CALENDAR_SYSTEMS).toBeDefined();
			expect(PRESET_CALENDAR_SYSTEMS.length).toBeGreaterThan(0);
		});

		it('should contain Gregorian calendar', () => {
			const gregorian = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'gregorian');

			expect(gregorian).toBeDefined();
			expect(gregorian?.name).toBe('Gregorian Calendar');
			expect(gregorian?.months.length).toBe(12);
			expect(gregorian?.daysPerWeek).toBe(7);
			expect(gregorian?.weekdayNames.length).toBe(7);
		});

		it('should contain Calendar of Harptos', () => {
			const harptos = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'faerun-harptos');

			expect(harptos).toBeDefined();
			expect(harptos?.name).toBe('Calendar of Harptos (Forgotten Realms)');
			expect(harptos?.daysPerWeek).toBe(10);
			expect(harptos?.weekdayNames.length).toBe(10);
		});

		it('should contain Absalom Reckoning', () => {
			const absalom = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'golarion-absalom');

			expect(absalom).toBeDefined();
			expect(absalom?.name).toBe('Absalom Reckoning (Pathfinder)');
			expect(absalom?.months.length).toBe(12);
			expect(absalom?.daysPerWeek).toBe(7);
		});

		it('should contain Simple Day Counter', () => {
			const simple = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'simple-counter');

			expect(simple).toBeDefined();
			expect(simple?.name).toBe('Simple Day Counter');
			expect(simple?.months.length).toBe(1);
			expect(simple?.months[0].days).toBe(1);
			expect(simple?.daysPerWeek).toBe(1);
		});

		it('should have unique IDs for all presets', () => {
			const ids = PRESET_CALENDAR_SYSTEMS.map(cal => cal.id);
			const uniqueIds = new Set(ids);

			expect(ids.length).toBe(uniqueIds.size);
		});

		it('should have valid structure for all presets', () => {
			PRESET_CALENDAR_SYSTEMS.forEach(system => {
				expect(system.id).toBeDefined();
				expect(system.id.length).toBeGreaterThan(0);
				expect(system.name).toBeDefined();
				expect(system.name.length).toBeGreaterThan(0);
				expect(system.months).toBeDefined();
				expect(system.months.length).toBeGreaterThan(0);
				expect(system.daysPerWeek).toBeGreaterThan(0);
				expect(system.weekdayNames).toBeDefined();
				expect(system.weekdayNames.length).toBe(system.daysPerWeek);

				// Validate each month
				system.months.forEach(month => {
					expect(month.name).toBeDefined();
					expect(month.name.length).toBeGreaterThan(0);
					expect(month.days).toBeGreaterThan(0);
					// season is optional
				});

				// Validate each weekday name
				system.weekdayNames.forEach(name => {
					expect(name).toBeDefined();
					expect(name.length).toBeGreaterThan(0);
				});
			});
		});

		it('should have correct Gregorian month structure', () => {
			const gregorian = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'gregorian');

			if (!gregorian) {
				throw new Error('Gregorian calendar not found');
			}

			expect(gregorian.months[0].name).toBe('January');
			expect(gregorian.months[0].days).toBe(31);
			expect(gregorian.months[0].season).toBe('Winter');

			expect(gregorian.months[1].name).toBe('February');
			expect(gregorian.months[1].days).toBe(28);
			expect(gregorian.months[1].season).toBe('Winter');

			expect(gregorian.months[11].name).toBe('December');
			expect(gregorian.months[11].days).toBe(31);
			expect(gregorian.months[11].season).toBe('Winter');
		});

		it('should have correct Harptos festival days', () => {
			const harptos = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'faerun-harptos');

			if (!harptos) {
				throw new Error('Harptos calendar not found');
			}

			// Check for festival days (1-day months)
			const festivalDays = harptos.months.filter(m => m.days === 1);
			expect(festivalDays.length).toBeGreaterThan(0);

			// Verify specific festival days exist
			expect(harptos.months.some(m => m.name === 'Midwinter')).toBe(true);
			expect(harptos.months.some(m => m.name === 'Greengrass')).toBe(true);
			expect(harptos.months.some(m => m.name === 'Midsummer')).toBe(true);
			expect(harptos.months.some(m => m.name === 'Highharvestide')).toBe(true);
			expect(harptos.months.some(m => m.name === 'Feast of the Moon')).toBe(true);
		});

		it('should have correct Pathfinder deity-named months', () => {
			const absalom = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'golarion-absalom');

			if (!absalom) {
				throw new Error('Absalom calendar not found');
			}

			// Verify deity-named months exist
			expect(absalom.months.some(m => m.name === 'Abadius')).toBe(true);
			expect(absalom.months.some(m => m.name === 'Calistril')).toBe(true);
			expect(absalom.months.some(m => m.name === 'Pharast')).toBe(true);
			expect(absalom.months.some(m => m.name === 'Sarenith')).toBe(true);

			// Verify special weekday names
			expect(absalom.weekdayNames.includes('Moonday')).toBe(true);
			expect(absalom.weekdayNames.includes('Toilday')).toBe(true);
			expect(absalom.weekdayNames.includes('Fireday')).toBe(true);
		});

		it('should calculate correct total days per year for Gregorian calendar', () => {
			const gregorian = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'gregorian');

			if (!gregorian) {
				throw new Error('Gregorian calendar not found');
			}

			const totalDays = gregorian.months.reduce((sum, month) => sum + month.days, 0);
			expect(totalDays).toBe(365); // Non-leap year
		});

		it('should calculate correct total days per year for Harptos calendar', () => {
			const harptos = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'faerun-harptos');

			if (!harptos) {
				throw new Error('Harptos calendar not found');
			}

			const totalDays = harptos.months.reduce((sum, month) => sum + month.days, 0);
			expect(totalDays).toBe(365); // Harptos also has 365 days
		});

		it('should calculate correct total days per year for Absalom calendar', () => {
			const absalom = PRESET_CALENDAR_SYSTEMS.find(cal => cal.id === 'golarion-absalom');

			if (!absalom) {
				throw new Error('Absalom calendar not found');
			}

			const totalDays = absalom.months.reduce((sum, month) => sum + month.days, 0);
			expect(totalDays).toBe(365); // Non-leap year
		});
	});
});
