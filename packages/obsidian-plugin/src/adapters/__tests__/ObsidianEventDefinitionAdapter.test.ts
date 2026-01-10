/**
 * ObsidianEventDefinitionAdapter Tests
 *
 * Tests event definition loading from YAML and JSON sources:
 * - Calendar holidays (config/calendars/*.yaml)
 * - Event modules (config/events/*.yaml)
 * - Campaign events (campaigns/{id}/events.json)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObsidianEventDefinitionAdapter } from '../ObsidianEventDefinitionAdapter';

// Mock Obsidian App and vault adapter
const mockVaultAdapter = {
	exists: vi.fn(),
	read: vi.fn(),
	list: vi.fn(),
	write: vi.fn()
};

const mockApp = {
	vault: {
		adapter: mockVaultAdapter,
		getAbstractFileByPath: vi.fn(),
		read: vi.fn(),
		modify: vi.fn(),
		create: vi.fn()
	}
} as any;

describe('ObsidianEventDefinitionAdapter', () => {
	let adapter: ObsidianEventDefinitionAdapter;

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks();

		// Create adapter instance
		adapter = new ObsidianEventDefinitionAdapter(mockApp, '/test-plugin');
	});

	describe('loadEventDefinitions', () => {
		it('should return empty array when no source directories exist', async () => {
			// Setup: All directories don't exist
			mockVaultAdapter.exists.mockResolvedValue(false);

			const definitions = await adapter.loadEventDefinitions();

			expect(definitions).toEqual([]);
			expect(mockVaultAdapter.exists).toHaveBeenCalledWith('/test-plugin/config/calendars');
			expect(mockVaultAdapter.exists).toHaveBeenCalledWith('/test-plugin/config/events');
		});

		it('should load holidays from calendar YAML files', async () => {
			// Setup: Calendar directory exists with one file
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('calendars'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/calendars/harptos.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
id: harptos
name: Calendar of Harptos
holidays:
  - name: Midwinter
    description: Festival day
    month: 0
    day: 31
    notifyOnArrival: true
  - name: Greengrass
    description: Spring festival
    month: 4
    day: 1
`);

			const definitions = await adapter.loadEventDefinitions();

			expect(definitions.length).toBe(2);
			expect(definitions[0].type).toBe('fixed');
			expect(definitions[0].name).toBe('Midwinter');
			expect(definitions[0].id).toBe('holiday-harptos-midwinter');
		});

		it('should load event modules from YAML files', async () => {
			// Setup: Events directory exists with weather module
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				if (path.includes('events')) return Promise.resolve(true);
				return Promise.resolve(false);
			});

			mockVaultAdapter.list.mockImplementation((path: string) => {
				if (path.includes('events')) {
					return Promise.resolve({
						files: ['/test-plugin/config/events/weather.yaml'],
						folders: []
					});
				}
				return Promise.resolve({ files: [], folders: [] });
			});

			mockVaultAdapter.read.mockResolvedValue(`
events:
  - id: weather-storm
    name: Storm
    type: chain
    seed: 12345
    priority: 50
    effects:
      priceMultiplier: 1.2
    states:
      - name: Clear
        weight: 70
        duration: 3d6 days
        effects: {}
      - name: Storm
        weight: 30
        duration: 1d4 days
        effects:
          priceMultiplier: 1.3
`);

			const definitions = await adapter.loadEventDefinitions();

			expect(definitions.length).toBe(1);
			expect(definitions[0].type).toBe('chain');
			expect(definitions[0].id).toBe('weather-storm');
			expect(definitions[0].name).toBe('Storm');
		});

		it('should load campaign-specific events from JSON', async () => {
			// Setup: Campaigns directory exists
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				if (path === 'campaigns') return Promise.resolve(true);
				if (path === 'campaigns/campaign-1/events.json') return Promise.resolve(true);
				return Promise.resolve(false);
			});

			mockVaultAdapter.list.mockImplementation((path: string) => {
				if (path === 'campaigns') {
					return Promise.resolve({
						files: [],
						folders: ['campaigns/campaign-1']
					});
				}
				return Promise.resolve({ files: [], folders: [] });
			});

			mockVaultAdapter.read.mockResolvedValue(JSON.stringify({
				events: [
					{
						id: 'campaign-siege',
						name: 'City Siege',
						type: 'fixed',
						date: { month: 5, day: 15 },
						priority: 100,
						effects: { priceMultiplier: 2.0 }
					}
				]
			}));

			const definitions = await adapter.loadEventDefinitions();

			expect(definitions.length).toBe(1);
			expect(definitions[0].id).toBe('campaign-siege');
			expect(definitions[0].type).toBe('fixed');
		});
	});

	describe('loadEventDefinitionById', () => {
		it('should return null for non-existent event', async () => {
			mockVaultAdapter.exists.mockResolvedValue(false);

			const definition = await adapter.loadEventDefinitionById('non-existent');

			expect(definition).toBeNull();
		});

		it('should return cached event on second call', async () => {
			// Setup: Load initial event
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('events'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/events/test.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
id: test-event
name: Test Event
type: interval
interval: 7
priority: 30
effects: {}
`);

			// First call loads from file
			const definition1 = await adapter.loadEventDefinitionById('test-event');
			expect(definition1).not.toBeNull();
			expect(definition1!.id).toBe('test-event');

			// Second call uses cache (read not called again)
			vi.clearAllMocks();
			const definition2 = await adapter.loadEventDefinitionById('test-event');
			expect(definition2).not.toBeNull();
			expect(mockVaultAdapter.read).not.toHaveBeenCalled();
		});
	});

	describe('loadEventDefinitionsByIds', () => {
		it('should return array with null for missing events', async () => {
			mockVaultAdapter.exists.mockResolvedValue(false);

			const definitions = await adapter.loadEventDefinitionsByIds(['event-1', 'event-2']);

			expect(definitions).toEqual([null, null]);
		});

		it('should preserve order and include nulls', async () => {
			// Setup: Load one event
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('events'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/events/test.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
id: exists
name: Exists
type: interval
interval: 5
priority: 20
effects: {}
`);

			const definitions = await adapter.loadEventDefinitionsByIds(['missing', 'exists', 'also-missing']);

			expect(definitions.length).toBe(3);
			expect(definitions[0]).toBeNull();
			expect(definitions[1]).not.toBeNull();
			expect(definitions[1]!.id).toBe('exists');
			expect(definitions[2]).toBeNull();
		});
	});

	describe('listEventDefinitionIds', () => {
		it('should return array of all event IDs', async () => {
			// Setup: Multiple events
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('events'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/events/events.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
events:
  - id: event-1
    name: Event 1
    type: interval
    interval: 7
    priority: 10
    effects: {}
  - id: event-2
    name: Event 2
    type: interval
    interval: 14
    priority: 10
    effects: {}
`);

			const ids = await adapter.listEventDefinitionIds();

			expect(ids).toEqual(['event-1', 'event-2']);
		});
	});

	describe('hasEventDefinition', () => {
		it('should return false for non-existent event', async () => {
			mockVaultAdapter.exists.mockResolvedValue(false);

			const exists = await adapter.hasEventDefinition('non-existent');

			expect(exists).toBe(false);
		});

		it('should return true for existing event', async () => {
			// Setup: Load event
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('events'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/events/test.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
id: exists
name: Exists
type: interval
interval: 5
priority: 20
effects: {}
`);

			const exists = await adapter.hasEventDefinition('exists');

			expect(exists).toBe(true);
		});
	});

	describe('invalidateDefinitionCache', () => {
		it('should clear cache and force reload', async () => {
			// Setup: Load event
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('events'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/events/test.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
id: test
name: Test
type: interval
interval: 5
priority: 20
effects: {}
`);

			// Load event (populates cache)
			await adapter.loadEventDefinitions();

			// Clear cache
			await adapter.invalidateDefinitionCache();

			// Verify cache is empty
			const cacheInfo = adapter.getDefinitionCacheInfo();
			expect(cacheInfo).toBeNull();

			// Next load should read from file again
			vi.clearAllMocks();
			await adapter.loadEventDefinitions();
			expect(mockVaultAdapter.read).toHaveBeenCalled();
		});
	});

	describe('getDefinitionCacheInfo', () => {
		it('should return null when cache is empty', () => {
			const info = adapter.getDefinitionCacheInfo();

			expect(info).toBeNull();
		});

		it('should return cache status after loading', async () => {
			// Setup: Load event
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('events'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/events/test.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
id: test
name: Test
type: interval
interval: 5
priority: 20
effects: {}
`);

			await adapter.loadEventDefinitions();

			const info = adapter.getDefinitionCacheInfo();

			expect(info).not.toBeNull();
			expect(info!.cached).toBe(true);
			expect(info!.definitionCount).toBe(1);
			expect(info!.ageMs).toBeGreaterThanOrEqual(0);
		});
	});

	describe('context filtering', () => {
		it('should filter events by location', async () => {
			// Setup: Events with location filters
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('events'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/events/regional.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
events:
  - id: waterdeep-market
    name: Waterdeep Market Day
    type: interval
    interval: 7
    priority: 30
    effects: {}
    locations: [waterdeep]
  - id: neverwinter-festival
    name: Neverwinter Festival
    type: fixed
    date: { month: 3, day: 1 }
    priority: 30
    effects: {}
    locations: [neverwinter]
`);

			const definitions = await adapter.loadEventDefinitions({ location: 'waterdeep' });

			expect(definitions.length).toBe(1);
			expect(definitions[0].id).toBe('waterdeep-market');
		});

		it('should filter events by faction', async () => {
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('events'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/events/factions.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
events:
  - id: harpers-gathering
    name: Harpers Gathering
    type: interval
    interval: 30
    priority: 40
    effects: {}
    factions: [harpers]
  - id: zhentarim-operation
    name: Zhentarim Operation
    type: interval
    interval: 14
    priority: 40
    effects: {}
    factions: [zhentarim]
`);

			const definitions = await adapter.loadEventDefinitions({ faction: 'harpers' });

			expect(definitions.length).toBe(1);
			expect(definitions[0].id).toBe('harpers-gathering');
		});
	});

	describe('event validation', () => {
		it('should skip invalid event definitions', async () => {
			mockVaultAdapter.exists.mockImplementation((path: string) => {
				return Promise.resolve(path.includes('events'));
			});

			mockVaultAdapter.list.mockResolvedValue({
				files: ['/test-plugin/config/events/invalid.yaml'],
				folders: []
			});

			mockVaultAdapter.read.mockResolvedValue(`
events:
  - id: valid-event
    name: Valid Event
    type: interval
    interval: 7
    priority: 10
    effects: {}
  - id: missing-type
    name: Invalid Event
    priority: 10
    effects: {}
  - name: Missing ID
    type: interval
    interval: 7
    priority: 10
    effects: {}
`);

			const definitions = await adapter.loadEventDefinitions();

			// Only the valid event should be loaded
			expect(definitions.length).toBe(1);
			expect(definitions[0].id).toBe('valid-event');
		});
	});
});
