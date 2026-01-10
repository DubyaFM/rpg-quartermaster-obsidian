# Shop Closed Effect - UI Integration Guide

## Overview

The `shop_closed` effect is a boolean any-true effect that allows events to close shops. When any active event sets `shop_closed: true`, the shop should display as closed, block all transactions, and show a tooltip explaining why.

## Implementation: TKT-CAL-036

**Status:** ✅ Complete
**Effect Recognition:** Already implemented in EffectRegistry (TKT-CAL-031/032)
**Helper Methods:** Added in TKT-CAL-036

## Core API

### Check if Shop is Closed

```typescript
import { EffectRegistry } from '@quartermaster/core';
import { ResolvedEffects } from '@quartermaster/core/models/effectTypes';

const registry = new EffectRegistry();
const effects: ResolvedEffects = registry.getResolvedEffects(
  currentDay,
  activeEvents,
  context
);

// Check if shop is closed
const isClosed = registry.isShopClosed(effects);
```

### Get Closing Event Names

```typescript
// Get event IDs that are causing the shop to close
const closingEventIds = registry.getShopClosingEventNames(effects);

// For display purposes, you'll need to map event IDs to event names
// Example: ["holiday", "curfew"] -> ["Holiday Festival", "City Curfew"]
```

## Effect Resolution Strategy

**Strategy:** `any_true`

**Behavior:**
- If ANY active event sets `shop_closed: true`, the shop is closed
- Multiple events can close a shop simultaneously
- All contributing events are tracked in `competingEffects` metadata
- Priority does NOT matter for this effect (restrictive behavior wins)

**Example:**

```typescript
// Event 1: Normal day (shop_closed: false)
// Event 2: Holiday (shop_closed: true)
// Event 3: Market day (shop_closed: false)
// Result: shop_closed = true (any true wins)
```

## UI Integration Checklist

### Required UI Changes

- [ ] **Shop Header/Banner**
  - Display "Closed" badge/banner when `isShopClosed()` returns true
  - Use visual styling to indicate closed state (grayed out, red banner, etc.)

- [ ] **Transaction Blocking**
  - Disable "Buy" buttons when shop is closed
  - Disable "Sell" buttons when shop is closed
  - Prevent direct transaction API calls if shop is closed

- [ ] **Tooltip/Explanation**
  - Show tooltip on closed banner explaining why shop is closed
  - Display event names from `getShopClosingEventNames()`
  - Example: "Closed due to: Holiday Festival, City Curfew"

- [ ] **Navigation/Discovery**
  - Update shop list/map to show which shops are closed
  - Consider using icon or badge in shop listings
  - Filter or sort options to hide/show closed shops

### Implementation Example (Obsidian Plugin)

```typescript
// In ShopModal or ShopView component
import { EffectRegistry } from '@quartermaster/core';

class ShopModal extends Modal {
  async onOpen() {
    const registry = new EffectRegistry();
    const effects = registry.getResolvedEffects(
      this.currentDay,
      this.activeEvents,
      { location: this.shop.location }
    );

    // Check if shop is closed
    if (registry.isShopClosed(effects)) {
      // Display closed banner
      const banner = this.contentEl.createDiv({ cls: 'shop-closed-banner' });
      banner.setText('🚫 Shop Closed');

      // Add tooltip with reason
      const closingEvents = registry.getShopClosingEventNames(effects);
      if (closingEvents.length > 0) {
        banner.setAttribute(
          'title',
          `Closed due to: ${closingEvents.join(', ')}`
        );
      }

      // Disable transaction buttons
      this.disableTransactions();
    }
  }

  disableTransactions() {
    // Disable all buy/sell buttons
    this.buyButtons.forEach(btn => btn.setDisabled(true));
    this.sellButtons.forEach(btn => btn.setDisabled(true));
  }
}
```

### Implementation Example (React Frontend)

```tsx
// In Shop component
import { useEffect, useState } from 'react';
import { EffectRegistry } from '@quartermaster/core';

function ShopView({ shop, currentDay, activeEvents }) {
  const [isClosed, setIsClosed] = useState(false);
  const [closingReasons, setClosingReasons] = useState<string[]>([]);

  useEffect(() => {
    const registry = new EffectRegistry();
    const effects = registry.getResolvedEffects(
      currentDay,
      activeEvents,
      { location: shop.location }
    );

    setIsClosed(registry.isShopClosed(effects));
    setClosingReasons(registry.getShopClosingEventNames(effects));
  }, [currentDay, activeEvents, shop.location]);

  if (isClosed) {
    return (
      <div className="shop-closed">
        <div className="closed-banner">
          <span className="icon">🚫</span>
          <span>Shop Closed</span>
        </div>
        {closingReasons.length > 0 && (
          <div className="closed-reason">
            Closed due to: {closingReasons.join(', ')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="shop-open">
      {/* Normal shop UI with buy/sell buttons */}
    </div>
  );
}
```

## Event Definition Example

Events that close shops should include `shop_closed: true` in their effects:

```yaml
# events/holidays.yaml
- id: "winter-festival"
  name: "Winter Festival"
  type: fixed
  priority: 5
  date:
    month: 12
    day: 25
  effects:
    shop_closed: true
    ui_banner: "Winter Festival - Shops Closed"
    ui_theme: "festive"
  locations:
    - "waterdeep"
    - "neverwinter"
```

## Testing Recommendations

### Unit Tests (Core Layer)

- ✅ Effect recognition (already tested in EffectRegistry.test.ts)
- ✅ Any-true resolution strategy (already tested)
- ✅ Helper method behavior (added in TKT-CAL-036)

### Integration Tests (UI Layer)

- [ ] Shop displays closed banner when effect is active
- [ ] Buy/sell buttons are disabled when shop is closed
- [ ] Tooltip shows correct event names
- [ ] Multiple events can close shop simultaneously
- [ ] Shop reopens when events end

### Manual Testing Scenarios

1. **Single Event Closure**
   - Activate holiday event with `shop_closed: true`
   - Verify shop shows as closed
   - Verify tooltip shows holiday name

2. **Multiple Event Closure**
   - Activate multiple events with `shop_closed: true`
   - Verify shop shows as closed
   - Verify tooltip lists all closing events

3. **Mixed Events**
   - Activate events with both `shop_closed: true` and `shop_closed: false`
   - Verify shop is closed (any true wins)

4. **Location Filtering**
   - Activate event with location filter
   - Verify only shops in that location are closed
   - Verify shops in other locations remain open

## Related Tickets

- **TKT-CAL-031**: Effect Registry - Effect Aggregation (✅ Complete)
- **TKT-CAL-032**: Effect Registry - Conflict Resolution (✅ Complete)
- **TKT-CAL-034**: Add Restock Block Effect (✅ Complete)
- **TKT-CAL-035**: Add Restock Block Effect (✅ Complete)
- **TKT-CAL-036**: Add Shop Closed Effect (✅ Complete - This ticket)

## Next Steps

After implementing UI integration:

1. Update shop UI components in platform layers (Obsidian, Web, Mobile)
2. Add CSS styling for closed shop banner
3. Update shop list/map views to show closed status
4. Add user documentation for shop closed feature
5. Test with real event definitions from calendar system
