/**
 * Tests for the pure cooling calculation core (src/core/coolingCalculator.ts).
 *
 * Covers cooling-core correctness Properties 1-11 from the design document plus
 * a worked-example vector and a zero-demand example. Property tests use
 * fast-check with >= 100 runs each (NUM_RUNS = 200, matching the heating suite)
 * and reuse the shared generators defined below.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

import {
  computeCoolingVolume,
  computeDeltaTCooling,
  effectiveDeltaTCooling,
  computeInternalGainLoad,
  computeEnvelopeLoad,
  computeCoolingWatts,
  wattsToBtu,
  wattsToKw,
  recommendUnit,
  computeCoolingCapacity,
} from './coolingCalculator';
import {
  BTU_CONVERSION_FACTOR,
  INSULATION_MULTIPLIER,
  ROOM_TYPE_MULTIPLIER,
  WALL_MULTIPLIER,
  WINDOW_MULTIPLIER,
} from './config';
import {
  COOLING_BASE_COEFFICIENT,
  HEAT_GAIN_PER_OCCUPANT,
  NOMINAL_CAPACITIES_KW,
  SUN_EXPOSURE_MULTIPLIER,
} from './coolingConfig';
import type {
  CoolingInputs,
  InsulationLevel,
  RoomType,
  SunExposure,
  WindowType,
} from './coolingTypes';

const NUM_RUNS = 200;

// ---------------------------------------------------------------------------
// Reusable fast-check generators for valid inputs
// ---------------------------------------------------------------------------

/** Dimension in (0, 30] with at most 2 decimal places (0.01 .. 30.00). */
const dimensionArb = fc.integer({ min: 1, max: 3000 }).map((n) => n / 100);

/** Outdoor summer temperature in [20.0, 50.0] with at most 1 decimal place. */
const outdoorTempArb = fc.integer({ min: 200, max: 500 }).map((n) => n / 10);

/** Desired indoor temperature in [16.0, 30.0] with at most 1 decimal place. */
const indoorTempArb = fc.integer({ min: 160, max: 300 }).map((n) => n / 10);

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

const sunExposureArb = fc.constantFrom<SunExposure>('Shaded', 'Average', 'Sunny');

const occupantArb = fc.integer({ min: 0, max: 20 });

const applianceArb = fc.integer({ min: 0, max: 10000 });

/** A fully valid CoolingInputs record. */
const coolingInputsArb: fc.Arbitrary<CoolingInputs> = fc.record({
  length: dimensionArb,
  width: dimensionArb,
  height: dimensionArb,
  outdoorSummerTempC: outdoorTempArb,
  desiredIndoorTempC: indoorTempArb,
  roomType: roomTypeArb,
  insulation: insulationArb,
  windowType: windowTypeArb,
  externalWalls: externalWallsArb,
  sunExposure: sunExposureArb,
  occupantCount: occupantArb,
  applianceHeatGain: applianceArb,
});

/** Recompute the raw (unrounded, unclamped) capacity using the config constants. */
function rawCapacity(inputs: CoolingInputs): number {
  const volume = computeCoolingVolume(inputs.length, inputs.width, inputs.height);
  const deltaT = computeDeltaTCooling(
    inputs.outdoorSummerTempC,
    inputs.desiredIndoorTempC,
  );
  const envelope =
    volume *
    Math.max(deltaT, 0) *
    COOLING_BASE_COEFFICIENT *
    INSULATION_MULTIPLIER[inputs.insulation] *
    WINDOW_MULTIPLIER[inputs.windowType] *
    WALL_MULTIPLIER[inputs.externalWalls] *
    ROOM_TYPE_MULTIPLIER[inputs.roomType] *
    SUN_EXPOSURE_MULTIPLIER[inputs.sunExposure];
  const internal =
    inputs.occupantCount * HEAT_GAIN_PER_OCCUPANT + inputs.applianceHeatGain;
  return envelope + internal;
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('cooling calculator core — property-based tests', () => {
  // Feature: air-conditioning-calculator, Property 1: Cooling volume is the rounded product of dimensions
  it('Property 1: cooling volume is length*width*height rounded to 2 dp', () => {
    fc.assert(
      fc.property(dimensionArb, dimensionArb, dimensionArb, (length, width, height) => {
        const expected = Math.round(length * width * height * 100) / 100;
        expect(computeCoolingVolume(length, width, height)).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 2: Delta_T_Cooling is outdoor minus indoor temperature
  it('Property 2: deltaTCooling equals outdoor - indoor', () => {
    fc.assert(
      fc.property(outdoorTempArb, indoorTempArb, (outdoor, indoor) => {
        expect(computeDeltaTCooling(outdoor, indoor)).toBe(outdoor - indoor);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 3: Effective_Delta_T_Cooling is never negative
  it('Property 3: effectiveDeltaTCooling is max(deltaT, 0) and never negative', () => {
    const anyDeltaArb = fc.integer({ min: -500, max: 500 }).map((n) => n / 10);
    fc.assert(
      fc.property(anyDeltaArb, (deltaT) => {
        const eff = effectiveDeltaTCooling(deltaT);
        expect(eff).toBe(Math.max(deltaT, 0));
        expect(eff).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 4: Internal_Gain_Load is the documented sum of gains
  it('Property 4: internal gain load equals occupants*HEAT_GAIN_PER_OCCUPANT + appliance', () => {
    fc.assert(
      fc.property(occupantArb, applianceArb, (occupants, appliance) => {
        expect(computeInternalGainLoad(occupants, appliance)).toBe(
          occupants * HEAT_GAIN_PER_OCCUPANT + appliance,
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 5: Cooling capacity is bounded, whole-watt, and equals the documented formula
  it('Property 5: watts is an integer in [0, 100000] equal to clamp(roundHalfUp(envelope + internal))', () => {
    fc.assert(
      fc.property(coolingInputsArb, (inputs) => {
        const { watts } = computeCoolingCapacity(inputs);
        expect(Number.isInteger(watts)).toBe(true);
        expect(watts).toBeGreaterThanOrEqual(0);
        expect(watts).toBeLessThanOrEqual(100000);
        const expected = Math.min(100000, Math.max(0, Math.round(rawCapacity(inputs))));
        expect(watts).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 6: Cooling calculation is deterministic
  it('Property 6: computing the full result twice yields identical results', () => {
    fc.assert(
      fc.property(coolingInputsArb, (inputs) => {
        const first = computeCoolingCapacity(inputs);
        const second = computeCoolingCapacity(inputs);
        expect(second).toEqual(first);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 7: Zero-demand inputs yield zero capacity
  it('Property 7: deltaT<=0 AND 0 occupants AND 0 appliances gives 0 watts', () => {
    // Generate an indoor temp >= outdoor temp so deltaT <= 0.
    const nonPositiveDeltaArb = fc
      .tuple(outdoorTempArb, indoorTempArb)
      .map(([outdoor, indoor]) => {
        const hi = Math.max(outdoor, indoor);
        // Force indoor >= outdoor: use the larger of the two as indoor.
        return { outdoorSummerTempC: outdoor, desiredIndoorTempC: hi };
      });
    fc.assert(
      fc.property(
        fc.record({
          length: dimensionArb,
          width: dimensionArb,
          height: dimensionArb,
          roomType: roomTypeArb,
          insulation: insulationArb,
          windowType: windowTypeArb,
          externalWalls: externalWallsArb,
          sunExposure: sunExposureArb,
        }),
        nonPositiveDeltaArb,
        (rest, temps) => {
          const inputs: CoolingInputs = {
            ...rest,
            ...temps,
            occupantCount: 0,
            applianceHeatGain: 0,
          };
          expect(computeCoolingCapacity(inputs).watts).toBe(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 8: Capacity is monotonic non-decreasing in volume
  it('Property 8: watts is non-decreasing as volume increases', () => {
    const baseVolumeArb = fc.integer({ min: 1, max: 20000 }).map((n) => n / 10);
    const incrementArb = fc.integer({ min: 1, max: 10000 }).map((n) => n / 10);
    const deltaTArb = fc.integer({ min: 0, max: 34 });
    fc.assert(
      fc.property(
        baseVolumeArb,
        incrementArb,
        deltaTArb,
        insulationArb,
        windowTypeArb,
        externalWallsArb,
        roomTypeArb,
        sunExposureArb,
        occupantArb,
        applianceArb,
        (
          volume,
          d,
          deltaTCooling,
          insulation,
          windowType,
          externalWalls,
          roomType,
          sunExposure,
          occupantCount,
          applianceHeatGain,
        ) => {
          const common = {
            deltaTCooling,
            insulation,
            windowType,
            externalWalls,
            roomType,
            sunExposure,
            occupantCount,
            applianceHeatGain,
          };
          const lower = computeCoolingWatts({ volume, ...common });
          const higher = computeCoolingWatts({ volume: volume + d, ...common });
          expect(higher).toBeGreaterThanOrEqual(lower);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 9: Capacity is monotonic non-decreasing in internal gains
  it('Property 9: watts is non-decreasing as occupants and/or appliance gain increase', () => {
    const occupantIncArb = fc.integer({ min: 0, max: 10 });
    const applianceIncArb = fc.integer({ min: 0, max: 5000 });
    fc.assert(
      fc.property(
        coolingInputsArb,
        occupantIncArb,
        applianceIncArb,
        (inputs, occInc, appInc) => {
          const before = computeCoolingCapacity(inputs).watts;
          const bumped: CoolingInputs = {
            ...inputs,
            occupantCount: Math.min(20, inputs.occupantCount + occInc),
            applianceHeatGain: Math.min(10000, inputs.applianceHeatGain + appInc),
          };
          const after = computeCoolingCapacity(bumped).watts;
          expect(after).toBeGreaterThanOrEqual(before);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 10: Unit recommendation selects the smallest sufficient standard size
  it('Property 10: recommendUnit picks the smallest nominal >= capacity, flagging overflow', () => {
    const largest = NOMINAL_CAPACITIES_KW[NOMINAL_CAPACITIES_KW.length - 1];
    const capacityArb = fc.integer({ min: 0, max: 100000 });
    fc.assert(
      fc.property(capacityArb, (capacity) => {
        const rec = recommendUnit(capacity);
        if (capacity > largest * 1000) {
          expect(rec.nominalKw).toBe(largest);
          expect(rec.exceedsLargest).toBe(true);
        } else {
          expect(rec.exceedsLargest).toBe(false);
          // The recommended size is sufficient...
          expect(rec.nominalKw * 1000).toBeGreaterThanOrEqual(capacity);
          // ...and it is the smallest sufficient nominal in the set.
          const smaller = NOMINAL_CAPACITIES_KW.filter(
            (kw) => kw < rec.nominalKw,
          );
          for (const kw of smaller) {
            expect(kw * 1000).toBeLessThan(capacity);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: air-conditioning-calculator, Property 11: Watt-to-unit conversions are proportional and correctly rounded
  it('Property 11: wattsToBtu = roundHalfUp(watts*factor); wattsToKw = watts/1000', () => {
    const wattsArb = fc.integer({ min: 0, max: 100000 });
    fc.assert(
      fc.property(wattsArb, (watts) => {
        expect(wattsToBtu(watts)).toBe(Math.round(watts * BTU_CONVERSION_FACTOR));
        expect(wattsToKw(watts)).toBe(watts / 1000);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — worked example and zero-demand boundary
// ---------------------------------------------------------------------------

describe('cooling calculator core — worked example', () => {
  it('Lounge 5x4x2.4 m, Average/Double_Glazed/2 walls, Average sun, 2 occupants, 35C->22C', () => {
    const inputs: CoolingInputs = {
      length: 5,
      width: 4,
      height: 2.4,
      outdoorSummerTempC: 35,
      desiredIndoorTempC: 22,
      roomType: 'Lounge',
      insulation: 'Average',
      windowType: 'Double_Glazed',
      externalWalls: 2,
      sunExposure: 'Average',
      occupantCount: 2,
      applianceHeatGain: 0,
    };

    const result = computeCoolingCapacity(inputs);

    // volume 48; deltaT 13; envelope 48*13*1.2(walls)*1.1(lounge) = 823.68;
    // internal 2*100 = 200; total 1023.68 -> 1024 W.
    expect(result.volume).toBe(48);
    expect(result.deltaTCooling).toBe(13);
    expect(result.watts).toBe(1024);
    expect(result.kw).toBe(1.024);
    expect(result.btu).toBe(3494);
    // Smallest nominal >= 1024 W is 2.0 kW.
    expect(result.recommendation).toEqual({ nominalKw: 2.0, exceedsLargest: false });
  });
});

describe('cooling calculator core — zero-demand boundary (Requirement 5.5)', () => {
  it('outdoor <= indoor with no occupants and no appliances gives 0 W', () => {
    const inputs: CoolingInputs = {
      length: 5,
      width: 4,
      height: 2.4,
      outdoorSummerTempC: 22,
      desiredIndoorTempC: 24,
      roomType: 'Lounge',
      insulation: 'Poor',
      windowType: 'Single_Glazed',
      externalWalls: 4,
      sunExposure: 'Sunny',
      occupantCount: 0,
      applianceHeatGain: 0,
    };
    expect(computeCoolingCapacity(inputs).watts).toBe(0);
  });

  it('internal gains alone still require cooling even when outdoor <= indoor', () => {
    const inputs: CoolingInputs = {
      length: 5,
      width: 4,
      height: 2.4,
      outdoorSummerTempC: 22,
      desiredIndoorTempC: 24,
      roomType: 'Lounge',
      insulation: 'Average',
      windowType: 'Double_Glazed',
      externalWalls: 1,
      sunExposure: 'Average',
      occupantCount: 3,
      applianceHeatGain: 500,
    };
    // envelope 0; internal 3*100 + 500 = 800 W.
    expect(computeCoolingCapacity(inputs).watts).toBe(800);
  });
});
