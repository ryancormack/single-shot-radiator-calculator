/**
 * Tests for the pure calculation core (src/core/calculator.ts).
 *
 * Covers the worked-example vector plus the seven calculation-core correctness
 * properties from the design document ("Correctness Properties"). Property
 * tests use fast-check with >= 100 runs each and reuse the shared generators
 * defined below.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  computeRoomVolume,
  computeDeltaT,
  computeWatts,
  wattsToBtu,
  computeHeatOutput,
} from './calculator';
import {
  OUTDOOR_DESIGN_TEMP_C,
  BASE_COEFFICIENT,
  BTU_CONVERSION_FACTOR,
  INSULATION_MULTIPLIER,
  WINDOW_MULTIPLIER,
  WALL_MULTIPLIER,
  ROOM_TYPE_MULTIPLIER,
} from './config';
import type {
  CalculatorInputs,
  InsulationLevel,
  RoomType,
  WindowType,
} from './types';

const NUM_RUNS = 200;

// ---------------------------------------------------------------------------
// Reusable fast-check generators for valid inputs
// ---------------------------------------------------------------------------

/** Dimension in (0, 30] with at most 2 decimal places (0.01 .. 30.00). */
const dimensionArb = fc.integer({ min: 1, max: 3000 }).map((n) => n / 100);

/** Desired indoor temperature in [10.0, 30.0] with at most 1 decimal place. */
const tempArb = fc.integer({ min: 100, max: 300 }).map((n) => n / 10);

const roomTypeArb = fc.constantFrom<RoomType>(
  'Lounge',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Hallway',
);

const insulationArb = fc.constantFrom<InsulationLevel>('Poor', 'Average', 'Good');

const windowTypeArb = fc.constantFrom<WindowType>(
  'Single_Glazed',
  'Double_Glazed',
  'Triple_Glazed',
);

const externalWallsArb = fc.integer({ min: 0, max: 4 });

/** A fully valid CalculatorInputs record. */
const calculatorInputsArb: fc.Arbitrary<CalculatorInputs> = fc.record({
  length: dimensionArb,
  width: dimensionArb,
  height: dimensionArb,
  desiredTempC: tempArb,
  roomType: roomTypeArb,
  insulation: insulationArb,
  windowType: windowTypeArb,
  externalWalls: externalWallsArb,
});

/** Recompute the raw (unrounded, unclamped) watts using the config constants. */
function rawWatts(inputs: CalculatorInputs, volume: number, deltaT: number): number {
  return (
    volume *
    deltaT *
    BASE_COEFFICIENT *
    INSULATION_MULTIPLIER[inputs.insulation] *
    WINDOW_MULTIPLIER[inputs.windowType] *
    WALL_MULTIPLIER[inputs.externalWalls] *
    ROOM_TYPE_MULTIPLIER[inputs.roomType]
  );
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('calculator core — property-based tests', () => {
  // Feature: radiator-heat-calculator, Property 1: Room volume is the rounded product of dimensions
  it('Property 1: room volume is length*width*height rounded to 2 dp', () => {
    fc.assert(
      fc.property(dimensionArb, dimensionArb, dimensionArb, (length, width, height) => {
        const expected = Math.round(length * width * height * 100) / 100;
        expect(computeRoomVolume(length, width, height)).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: radiator-heat-calculator, Property 2: Delta_T is desired temperature minus the outdoor design constant
  it('Property 2: deltaT equals desiredTempC - OUTDOOR_DESIGN_TEMP_C', () => {
    fc.assert(
      fc.property(tempArb, (desiredTempC) => {
        expect(computeDeltaT(desiredTempC)).toBe(desiredTempC - OUTDOOR_DESIGN_TEMP_C);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: radiator-heat-calculator, Property 3: Heat output is bounded and rounded to a whole watt
  it('Property 3: watts is an integer in [0, 100000] obtained by half-up rounding', () => {
    fc.assert(
      fc.property(calculatorInputsArb, (inputs) => {
        const { volume, deltaT, watts } = computeHeatOutput(inputs);
        expect(Number.isInteger(watts)).toBe(true);
        expect(watts).toBeGreaterThanOrEqual(0);
        expect(watts).toBeLessThanOrEqual(100000);
        const expected = Math.min(100000, Math.max(0, Math.round(rawWatts(inputs, volume, deltaT))));
        expect(watts).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: radiator-heat-calculator, Property 4: BTU/hr is the proportional, half-up-rounded conversion of watts
  it('Property 4: btu equals roundHalfUp(watts * BTU_CONVERSION_FACTOR)', () => {
    fc.assert(
      fc.property(calculatorInputsArb, (inputs) => {
        const { watts, btu } = computeHeatOutput(inputs);
        expect(btu).toBe(Math.round(watts * BTU_CONVERSION_FACTOR));
        expect(btu).toBe(wattsToBtu(watts));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: radiator-heat-calculator, Property 5: Calculation is deterministic
  it('Property 5: computing heat output twice yields identical results', () => {
    fc.assert(
      fc.property(calculatorInputsArb, (inputs) => {
        const first = computeHeatOutput(inputs);
        const second = computeHeatOutput(inputs);
        expect(second).toEqual(first);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: radiator-heat-calculator, Property 6: Delta_T sign determines output sign
  it('Property 6: deltaT===0 gives 0 watts; deltaT>0 gives >0 watts', () => {
    // Positive volume >= 1 and integer deltaT (0 or positive) ensure the raw
    // formula result is either exactly 0 or comfortably rounds above 0.
    const volumeArb = fc.integer({ min: 1, max: 27000 });
    const deltaTArb = fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 33 }));
    fc.assert(
      fc.property(
        volumeArb,
        deltaTArb,
        insulationArb,
        windowTypeArb,
        externalWallsArb,
        roomTypeArb,
        (volume, deltaT, insulation, windowType, externalWalls, roomType) => {
          const watts = computeWatts({
            volume,
            deltaT,
            insulation,
            windowType,
            externalWalls,
            roomType,
          });
          if (deltaT === 0) {
            expect(watts).toBe(0);
          } else {
            expect(watts).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: radiator-heat-calculator, Property 7: Heat output is monotonic non-decreasing in volume
  it('Property 7: watts is non-decreasing as volume increases', () => {
    const baseVolumeArb = fc.integer({ min: 1, max: 20000 }).map((n) => n / 10);
    const incrementArb = fc.integer({ min: 1, max: 10000 }).map((n) => n / 10);
    const deltaTArb = fc.integer({ min: 0, max: 33 });
    fc.assert(
      fc.property(
        baseVolumeArb,
        incrementArb,
        deltaTArb,
        insulationArb,
        windowTypeArb,
        externalWallsArb,
        roomTypeArb,
        (volume, d, deltaT, insulation, windowType, externalWalls, roomType) => {
          const common = { deltaT, insulation, windowType, externalWalls, roomType };
          const lower = computeWatts({ volume, ...common });
          const higher = computeWatts({ volume: volume + d, ...common });
          expect(higher).toBeGreaterThanOrEqual(lower);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit test — worked-example vector
// ---------------------------------------------------------------------------

describe('calculator core — worked example', () => {
  it('Lounge 5x4x2.4 m, Average/Double_Glazed/2 walls, 21C -> volume 48, watts 1521, btu 5190', () => {
    const inputs: CalculatorInputs = {
      length: 5,
      width: 4,
      height: 2.4,
      desiredTempC: 21,
      roomType: 'Lounge',
      insulation: 'Average',
      windowType: 'Double_Glazed',
      externalWalls: 2,
    };

    const result = computeHeatOutput(inputs);

    expect(result.volume).toBe(48);
    expect(result.deltaT).toBe(24);
    expect(result.watts).toBe(1521);
    expect(result.btu).toBe(5190);
  });
});
