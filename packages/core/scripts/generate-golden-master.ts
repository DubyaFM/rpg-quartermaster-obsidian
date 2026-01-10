/**
 * Golden Master Generation Script
 *
 * Generates the authoritative golden master fixture for chain event determinism tests.
 * Run this script to capture the CURRENT behavior of the RNG and chain event system.
 *
 * Usage: ts-node generate-golden-master.ts
 */

import { Mulberry32 } from '../utils/Mulberry32';
import { WorldEventService } from '../services/WorldEventService';
import { CalendarDriver } from '../services/CalendarDriver';
import { IRngFactory } from '../interfaces/IRngFactory';
import { ISeededRandomizer } from '../interfaces/ISeededRandomizer';
import { IEventDefinitionAdapter } from '../interfaces/IEventDefinitionAdapter';
import {
  CalendarDefinition,
  AnyEventDefinition,
  ChainEvent,
  EventContext
} from '../models/types';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================================================
// Configuration
// ==========================================================================

const SEED = 12345;
const DAYS_TO_CAPTURE = 50;
const OUTPUT_FILE = path.join(__dirname, '../services/__tests__/fixtures/chain-golden.json');

// ==========================================================================
// Test Calendar
// ==========================================================================

const TEST_CALENDAR: CalendarDefinition = {
  id: 'test-calendar',
  name: 'Test Calendar',
  description: 'Calendar for chain event testing',
  weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  months: [
    { name: 'January', days: 30, order: 0 },
    { name: 'February', days: 28, order: 1 },
    { name: 'March', days: 30, order: 2 },
    { name: 'April', days: 30, order: 3 },
    { name: 'May', days: 30, order: 4 },
    { name: 'June', days: 30, order: 5 },
    { name: 'July', days: 30, order: 6 },
    { name: 'August', days: 30, order: 7 },
    { name: 'September', days: 30, order: 8 },
    { name: 'October', days: 30, order: 9 },
    { name: 'November', days: 30, order: 10 },
    { name: 'December', days: 32, order: 11 }
  ],
  holidays: [],
  startingYear: 1000,
  yearSuffix: 'TE'
};

// ==========================================================================
// Golden Master Chain Event
// ==========================================================================

const GOLDEN_CHAIN: ChainEvent = {
  id: 'golden-master-chain',
  name: 'Golden Master Weather',
  type: 'chain',
  priority: 1,
  effects: {},
  seed: SEED,
  states: [
    {
      name: 'Clear',
      weight: 60,
      duration: '3 days',
      effects: {
        weather: 'clear',
        visibility: 'good'
      }
    },
    {
      name: 'Cloudy',
      weight: 25,
      duration: '2 days',
      effects: {
        weather: 'cloudy',
        visibility: 'moderate'
      }
    },
    {
      name: 'Rainy',
      weight: 15,
      duration: '2 days',
      effects: {
        weather: 'rainy',
        visibility: 'poor'
      }
    }
  ]
};

// ==========================================================================
// Mock Implementations
// ==========================================================================

class MockRngFactory implements IRngFactory {
  create(seed: number): ISeededRandomizer {
    return new Mulberry32(seed);
  }
}

class MockEventDefinitionAdapter implements IEventDefinitionAdapter {
  private events: Map<string, AnyEventDefinition> = new Map();

  constructor(events: AnyEventDefinition[] = []) {
    for (const event of events) {
      this.events.set(event.id, event);
    }
  }

  async loadEventDefinitions(_context?: EventContext): Promise<AnyEventDefinition[]> {
    return Array.from(this.events.values());
  }

  async loadEventDefinitionById(id: string): Promise<AnyEventDefinition | null> {
    return this.events.get(id) || null;
  }

  async loadEventDefinitionsByIds(ids: string[]): Promise<(AnyEventDefinition | null)[]> {
    return ids.map(id => this.events.get(id) || null);
  }

  async listEventDefinitionIds(): Promise<string[]> {
    return Array.from(this.events.keys());
  }

  async hasEventDefinition(id: string): Promise<boolean> {
    return this.events.has(id);
  }
}

// ==========================================================================
// Golden Master Generation
// ==========================================================================

async function generateGoldenMaster(): Promise<void> {
  console.log('Generating Golden Master Fixture...');
  console.log(`Seed: ${SEED}`);
  console.log(`Days: 0-${DAYS_TO_CAPTURE}`);
  console.log('');

  // Step 1: Capture raw Mulberry32 values
  console.log('Step 1: Capturing Mulberry32 raw values...');
  const rng = new Mulberry32(SEED);
  const mulberry32Values: number[] = [];
  for (let i = 0; i < 10; i++) {
    mulberry32Values.push(rng.randomFloat());
  }
  console.log(`First Mulberry32 value: ${mulberry32Values[0]}`);

  // Step 2: Run WorldEventService and capture sequence
  console.log('Step 2: Running WorldEventService...');
  const driver = new CalendarDriver(TEST_CALENDAR);
  const rngFactory = new MockRngFactory();
  const service = new WorldEventService(driver, rngFactory);
  const adapter = new MockEventDefinitionAdapter([GOLDEN_CHAIN]);
  await service.initialize(adapter, 0);

  const expectedSequence: any[] = [];
  for (let day = 0; day <= DAYS_TO_CAPTURE; day++) {
    const events = service.getActiveEvents(day);
    const chainEvent = events.find(e => e.eventId === 'golden-master-chain');

    if (chainEvent) {
      const duration = chainEvent.endDay - chainEvent.startDay + 1;
      expectedSequence.push({
        day,
        state: chainEvent.state,
        startDay: chainEvent.startDay,
        endDay: chainEvent.endDay,
        duration,
        effects: chainEvent.effects
      });
    }
  }

  console.log(`Captured ${expectedSequence.length} day entries`);
  console.log(`First state: ${expectedSequence[0].state}`);

  // Step 3: Build fixture object
  const fixture = {
    "$schema": "Golden Master Fixture for Chain Event Determinism Tests",
    "description": "This fixture contains expected outputs for seed 12345 over days 0-50. DO NOT UPDATE THIS FILE unless you deliberately changed the RNG algorithm. If these tests fail, it means the RNG sequence has changed (butterfly effect).",
    "seed": SEED,
    "generatedWith": "Mulberry32 PRNG",
    "calendar": "test-calendar (360 days/year)",
    "event": {
      id: GOLDEN_CHAIN.id,
      name: GOLDEN_CHAIN.name,
      type: GOLDEN_CHAIN.type,
      seed: GOLDEN_CHAIN.seed,
      states: GOLDEN_CHAIN.states
    },
    "expectedSequence": expectedSequence,
    "mulberry32Values": {
      description: "First 10 raw Mulberry32 randomFloat() outputs for seed 12345",
      seed: SEED,
      values: mulberry32Values
    }
  };

  // Step 4: Write to file
  console.log('Step 3: Writing fixture file...');
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(fixture, null, 2));
  console.log(`✓ Golden master written to: ${OUTPUT_FILE}`);
  console.log('');
  console.log('Summary:');
  console.log(`  - Seed: ${SEED}`);
  console.log(`  - Days captured: ${expectedSequence.length}`);
  console.log(`  - First Mulberry32 value: ${mulberry32Values[0]}`);
  console.log(`  - First state: ${expectedSequence[0].state}`);
  console.log('');
  console.log('⚠️  IMPORTANT: This golden master is now the authoritative source.');
  console.log('   If tests fail in the future, it means the RNG has changed.');
}

// Run the generator
generateGoldenMaster().catch(err => {
  console.error('Error generating golden master:', err);
  process.exit(1);
});
