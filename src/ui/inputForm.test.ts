/**
 * Property-based tests for the pure `applyRoomTypeDefaults` helper of the
 * Input_Form component.
 *
 * Covers design Correctness Properties 13 and 14. Each property is implemented
 * as a single `fast-check` property with a minimum of 100 runs and is tagged
 * with its design property comment on the line directly above the test. Room
 * types are generated with `fc.constantFrom` over the five documented types.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { applyRoomTypeDefaults } from './inputForm';
import { ROOM_TYPE_DEFAULT_TEMP_C } from '../core/config';
import type { RoomType } from '../core/types';

/** The five documented Room_Type options (Requirement 2.1). */
const ROOM_TYPES = ['Lounge', 'Bedroom', 'Kitchen', 'Bathroom', 'Hallway'] as const;

const roomTypeArb: fc.Arbitrary<RoomType> = fc.constantFrom<RoomType>(...ROOM_TYPES);

const NUM_RUNS = 100;

// ===========================================================================
// Property 13
// ===========================================================================

describe('Property 13: room-type default temperature applied when not manually edited', () => {
  // Feature: radiator-heat-calculator, Property 13: Room-type default temperature is applied when not manually edited
  it('returns the documented default temperature for the room type when the field has not been manually edited', () => {
    fc.assert(
      fc.property(roomTypeArb, (roomType) => {
        const result = applyRoomTypeDefaults(roomType, false);
        expect(result.desiredTemp).toBe(ROOM_TYPE_DEFAULT_TEMP_C[roomType]);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ===========================================================================
// Property 14
// ===========================================================================

describe('Property 14: manually edited temperature is never overwritten by a room-type change', () => {
  // Feature: radiator-heat-calculator, Property 14: A manually edited temperature is never overwritten by a Room_Type change
  it('returns no desired-temperature override when the field has been manually edited', () => {
    fc.assert(
      fc.property(roomTypeArb, (roomType) => {
        const result = applyRoomTypeDefaults(roomType, true);
        expect(result.desiredTemp).toBeUndefined();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
