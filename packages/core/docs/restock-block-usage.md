# Restock Block Effect - Usage Guide

## Overview

The `restock_block` effect prevents shop inventory restocking during events like sieges, blockades, or supply shortages. This document shows how UI layers can integrate this feature.

## Core Functionality

### 1. Effect Recognition

The `restock_block` effect is a boolean any-true effect, meaning if **any** active event sets `restock_block: true`, restocking is blocked.

**Conflict Resolution Strategy:** `any_true`

**Example Event Definition:**
```yaml
- id: siege-of-brindol
  name: Siege of Brindol
  eventType: one-time
  effects:
    restock_block: true
    price_mult_global: 2.0
```

### 2. Checking if Restock is Blocked

The `EffectRegistry` provides helper methods for UI layers:

```typescript
import { EffectRegistry } from '@quartermaster/core/services/EffectRegistry';
import { WorldEventService } from '@quartermaster/core/services/WorldEventService';

// Get resolved effects for current day
const worldEventService = new WorldEventService(/* dependencies */);
const effectContext = worldEventService.getEffectContext(absoluteDay);

// Check if restocking is blocked
const registry = new EffectRegistry();
const isBlocked = registry.isRestockBlocked(effectContext);

if (isBlocked) {
  // Disable restock button
  // Show tooltip with blocking event names
  const blockingEvents = registry.getRestockBlockingEventNames(effectContext);
  console.log(`Restocking blocked by: ${blockingEvents.join(', ')}`);
}
```

### 3. Blocking Restock Action

The `restockShopInventory` function automatically checks for `restock_block`:

```typescript
import { restockShopInventory } from '@quartermaster/core/calculators/restock';

const result = restockShopInventory(
  randomizer,
  shop,
  allItems,
  currencyConfig,
  effectContext  // Pass effect context
);

if (result.blocked) {
  // Restock was blocked
  console.log(`Cannot restock: ${result.blockingEvents?.join(', ')}`);
  // Show error message to user
  return;
}

// Restock succeeded
console.log(formatRestockStats(result.stats));
```

### 4. UI Integration

**Restock Button:**
- **Normal State:** Enabled, shows "Restock Inventory"
- **Blocked State:** Disabled, grayed out
- **Tooltip (Blocked):** "Restocking blocked by: [Event Names]"

**Example Implementation (Pseudo-code):**
```typescript
// In your UI component
const effectContext = worldEventService.getEffectContext(currentDay);
const registry = new EffectRegistry();
const isRestockBlocked = registry.isRestockBlocked(effectContext);

// Render restock button
<Button
  disabled={isRestockBlocked}
  onClick={handleRestock}
  tooltip={
    isRestockBlocked
      ? `Restocking blocked by: ${registry.getRestockBlockingEventNames(effectContext).join(', ')}`
      : 'Restock shop inventory'
  }
>
  Restock Inventory
</Button>
```

## API Reference

### EffectRegistry Methods

#### `isRestockBlocked(effects: ResolvedEffects): boolean`

Check if restocking is blocked by active effects.

**Parameters:**
- `effects`: Resolved effects from `WorldEventService.getEffectContext()`

**Returns:** `true` if restocking is blocked, `false` otherwise

---

#### `getRestockBlockingEventNames(effects: ResolvedEffects): string[]`

Get names/IDs of events that are blocking restock.

**Parameters:**
- `effects`: Resolved effects from `WorldEventService.getEffectContext()`

**Returns:** Array of event IDs that contributed to the block

**Note:** For `any_true` resolution, this returns all events that specified `restock_block`, but only events with `restock_block: true` actually cause the block.

---

### restockShopInventory Return Value

The function now returns an extended result object:

```typescript
{
  shop: Shop;              // Updated shop (or original if blocked)
  stats: RestockStats;     // Restock statistics
  blocked?: boolean;       // True if restock was blocked
  blockingEvents?: string[]; // Event IDs that blocked restock
}
```

**When blocked:**
- `blocked` = `true`
- `blockingEvents` = array of event IDs
- `stats.totalItems` = `0`
- `shop.inventory` = unchanged

**When not blocked:**
- `blocked` = `false`
- `blockingEvents` = `undefined`
- `stats` = normal restock statistics
- `shop.inventory` = updated inventory

## Example Event Definitions

### Siege Event (Blocks Restock)
```yaml
- id: siege
  name: Siege of the City
  eventType: one-time
  effects:
    restock_block: true
    shop_closed: true
    price_mult_global: 2.5
```

### Trade Embargo (Blocks Restock)
```yaml
- id: trade-embargo
  name: Trade Embargo
  eventType: recurring
  effects:
    restock_block: true
    price_mult_tag:
      weapon: 1.5
      armor: 1.5
```

### Supply Shortage (Blocks Restock)
```yaml
- id: supply-shortage
  name: Supply Shortage
  eventType: state-machine
  effects:
    restock_block: true
    price_mult_global: 1.3
```

## Testing

Comprehensive tests are available in:
- `packages/core/tests/restock-block.test.ts` - Full integration tests
- `packages/core/tests/EffectRegistry.test.ts` - Effect resolution tests

Run tests:
```bash
npm test -- tests/restock-block.test.ts --run
```

## Common Use Cases

### 1. Single Blocking Event
One event blocks restocking:
```typescript
// Event: Siege (restock_block: true)
const result = restockShopInventory(randomizer, shop, items, config, effectContext);
// result.blocked = true
// result.blockingEvents = ['siege']
```

### 2. Multiple Blocking Events
Multiple events block restocking:
```typescript
// Events: Siege (restock_block: true), Embargo (restock_block: true)
const result = restockShopInventory(randomizer, shop, items, config, effectContext);
// result.blocked = true
// result.blockingEvents = ['siege', 'trade-embargo']
```

### 3. Mixed Events (Some Block, Some Don't)
Some events have `restock_block: false`, but one has `true`:
```typescript
// Events: Festival (restock_block: false), Siege (restock_block: true)
const result = restockShopInventory(randomizer, shop, items, config, effectContext);
// result.blocked = true (any_true resolution)
// result.blockingEvents = ['festival', 'siege'] (all events that specified the effect)
```

### 4. No Blocking Events
No active events with `restock_block`:
```typescript
// Events: Market Day (no restock_block effect)
const result = restockShopInventory(randomizer, shop, items, config, effectContext);
// result.blocked = false
// Normal restocking proceeds
```

## Architecture Notes

**Layer Responsibilities:**
- **Core Layer:** Effect aggregation, conflict resolution, restock blocking logic
- **Adapter Layer:** Fetch effect context from WorldEventService
- **UI Layer:** Check if blocked, display appropriate UI state, show tooltips

**Data Flow:**
1. WorldEventService aggregates active events
2. EffectRegistry resolves effects with conflict resolution
3. UI queries EffectRegistry to check block status
4. UI calls restockShopInventory with effect context
5. Function returns blocked status or performs restock

**No Cross-Layer Violations:**
- Core layer has no UI dependencies
- UI layer has no direct event management
- Adapter layer bridges the gap

---

**Implemented in:** TKT-CAL-035 (Phase 4 - Effect System)
**Related Tickets:** TKT-CAL-031 (Resolution Strategies), TKT-CAL-032 (EffectRegistry Tests), TKT-CAL-034 (Price Calculator)
