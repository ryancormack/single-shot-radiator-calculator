/**
 * Property-based (and a few example) tests for the pure cooling validation
 * layer (`validateCoolingInputs`).
 *
 * Covers design Correctness Properties 12-14, each implemented as a single
 * `fast-check` property with a minimum of 100 runs (NUM_RUNS = 200) and tagged
 * with its design property comment. Generators intelligently constrain the
 * input space into clearly "valid" and "invalid" categories per field.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateCoolingInputs } from './coolingValidate';
import type { RawCoolingInputs } from '../core/coolingTypes';

// ---------------------------------------------------------------------------
// Option sets (mirrored from the domain types) and a base valid RawCoolingInputs.
// ---------------------------------------------------------------------------

const ROOM_TYPES = ['Lounge', 'Bedroom', 'Kitchen', 'Bathroom', 'Hallway'] as const;
const INSULATION_LEVELS = ['Poor', 'Average', 'Good'] as const;
const WINDOW_TYPES = ['Single_Glazed', 'Double_Glazed', 'Triple_Glazed'] as const;
const SUN_EXPOSURES = ['Shaded', 'Average', 'Sunny'] as const;

const ALL_ENUM_VALUES: readonly string[] = [
  ...ROOM_TYPES,
  ...INSULATION_LEVELS,
  ...WINDOW_TYPES,
  ...SUN_EXPOSURES,
];

/** A fully valid raw payload used as the baseline for single-field tests. */
const BASE_VALID: RawCoolingInputs = {
  length: '5',
  width: '4',
  height: '2.4',
  outdoorSummerTemp: '35',
  desiredIndoorTemp: '22',
  roomType: 'Lounge',
  insulation: 'Average',
  windowType: 'Double_Glazed',
  externalWalls: '2',
  sunExposure: 'Average',
  occupantCount: '2',
  applianceHeatGain: '0',
};

const NUM_RUNS = 200;

// ---------------------------------------------------------------------------
// String builders that avoid floating-point noise.
// ---------------------------------------------------------------------------

/**
 * Build a clean decimal string from an integer count of 10^dp units.
 * e.g. fromUnits(2999, 2) -> "29.99"; fromUnits(5, 0) -> "5".
 */
function fromUnits(units: number, dp: number): string {
  if (dp === 0) {
    return String(units);
  }
  const scale = 10 ** dp;
  const whole = Math.floor(units / scale);
  const frac = units % scale;
  return `${whole}.${String(frac).padStart(dp, '0')}`;
}

// ---------------------------------------------------------------------------
// VALID-value generators (each guaranteed to be accepted by validateCoolingInputs).
// ---------------------------------------------------------------------------

/** Valid dimension: number in (0, 30] with 0, 1 or 2 decimal places. */
const validDimensionArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 2 })
  .chain((dp) => {
    const scale = 10 ** dp;
    return fc.integer({ min: 1, max: 30 * scale }).map((units) => fromUnits(units, dp));
  });

/** Valid outdoor temp: number in [20.0, 50.0] with 0 or 1 decimal place. */
const validOutdoorArb: fc.Arbitrary<string> = fc.integer({ min: 0, max: 1 }).chain((dp) => {
  const scale = 10 ** dp;
  return fc.integer({ min: 20 * scale, max: 50 * scale }).map((u) => fromUnits(u, dp));
});

/** Valid indoor temp: number in [16.0, 30.0] with 0 or 1 decimal place. */
const validIndoorArb: fc.Arbitrary<string> = fc.integer({ min: 0, max: 1 }).chain((dp) => {
  const scale = 10 ** dp;
  return fc.integer({ min: 16 * scale, max: 30 * scale }).map((u) => fromUnits(u, dp));
});

/** Valid external wall count: whole number 0..4. */
const validWallsArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 4 })
  .map((n) => String(n));

/** Valid occupant count: whole number 0..20. */
const validOccupantsArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 20 })
  .map((n) => String(n));

/** Valid appliance heat gain: whole number 0..10000. */
const validApplianceArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 10000 })
  .map((n) => String(n));

const validRoomTypeArb = fc.constantFrom(...ROOM_TYPES);
const validInsulationArb = fc.constantFrom(...INSULATION_LEVELS);
const validWindowArb = fc.constantFrom(...WINDOW_TYPES);
const validSunArb = fc.constantFrom(...SUN_EXPOSURES);

// ---------------------------------------------------------------------------
// INVALID-value generators (each guaranteed to be rejected).
// ---------------------------------------------------------------------------

/** Non-numeric / malformed strings rejected by the strict decimal matcher. */
const nonNumericArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', '   ', 'abc', '1.2.3', '12a', '1e3', 'NaN', 'Infinity', '+', '-', '.', '0x1f'),
  fc.string({ maxLength: 6 }).filter((s) => !/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(s.trim())),
);

/** Invalid dimension: out of (0,30], > 2 dp, or non-numeric. */
const invalidDimensionArb: fc.Arbitrary<string> = fc.oneof(
  nonNumericArb,
  fc.constantFrom('0', '0.00', '-1', '-5.5', '-0.01'),
  fc.integer({ min: 3001, max: 99999 }).map((u) => fromUnits(u, 2)),
  fc.integer({ min: 31, max: 500 }).map((n) => String(n)),
  fc.integer({ min: 1, max: 3 }).chain((extra) => {
    const dp = 2 + extra;
    const scale = 10 ** dp;
    return fc.integer({ min: 1, max: 30 * scale }).map((u) => fromUnits(u, dp));
  }),
);

/** Invalid outdoor temp: out of [20,50], > 1 dp, or non-numeric. */
const invalidOutdoorArb: fc.Arbitrary<string> = fc.oneof(
  nonNumericArb,
  fc.integer({ min: 0, max: 199 }).map((u) => fromUnits(u, 1)),
  fc.constantFrom('-5', '0', '19.9'),
  fc.integer({ min: 501, max: 9999 }).map((u) => fromUnits(u, 1)),
  fc.constantFrom('51', '100'),
  fc.integer({ min: 2, max: 3 }).chain((dp) => {
    const scale = 10 ** dp;
    return fc.integer({ min: 20 * scale, max: 50 * scale }).map((u) => fromUnits(u, dp));
  }),
);

/** Invalid indoor temp: out of [16,30], > 1 dp, or non-numeric. */
const invalidIndoorArb: fc.Arbitrary<string> = fc.oneof(
  nonNumericArb,
  fc.integer({ min: 0, max: 159 }).map((u) => fromUnits(u, 1)),
  fc.constantFrom('-5', '0', '15.9'),
  fc.integer({ min: 301, max: 9999 }).map((u) => fromUnits(u, 1)),
  fc.constantFrom('31', '100'),
  fc.integer({ min: 2, max: 3 }).chain((dp) => {
    const scale = 10 ** dp;
    return fc.integer({ min: 16 * scale, max: 30 * scale }).map((u) => fromUnits(u, dp));
  }),
);

/** Invalid external walls: out of [0,4], any decimal, or non-numeric. */
const invalidWallsArb: fc.Arbitrary<string> = fc.oneof(
  nonNumericArb,
  fc.integer({ min: 5, max: 999 }).map((n) => String(n)),
  fc.integer({ min: -999, max: -1 }).map((n) => String(n)),
  fc.constantFrom('2.0', '1.5', '3.9', '0.5', '4.0'),
);

/** Invalid occupant count: out of [0,20], any decimal, or non-numeric. */
const invalidOccupantsArb: fc.Arbitrary<string> = fc.oneof(
  nonNumericArb,
  fc.integer({ min: 21, max: 9999 }).map((n) => String(n)),
  fc.integer({ min: -999, max: -1 }).map((n) => String(n)),
  fc.constantFrom('2.0', '1.5', '10.5', '0.5'),
);

/** Invalid appliance heat gain: out of [0,10000], any decimal, or non-numeric. */
const invalidApplianceArb: fc.Arbitrary<string> = fc.oneof(
  nonNumericArb,
  fc.integer({ min: 10001, max: 99999 }).map((n) => String(n)),
  fc.integer({ min: -9999, max: -1 }).map((n) => String(n)),
  fc.constantFrom('100.0', '500.5', '2000.25'),
);

/** A string guaranteed not to be a member of any enum option set. */
const invalidEnumArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', '   ', 'lounge', 'sunny', 'GOOD', 'Single Glazed', 'None', 'Foo', 'Quad_Glazed'),
  fc.string({ maxLength: 8 }).filter((s) => !ALL_ENUM_VALUES.includes(s.trim())),
);

// ---------------------------------------------------------------------------
// Helpers for the single-field acceptance property (12).
// ---------------------------------------------------------------------------

interface Candidate {
  expectValid: boolean;
  value: string;
}

function candidateArb(
  validArb: fc.Arbitrary<string>,
  invalidArb: fc.Arbitrary<string>,
): fc.Arbitrary<Candidate> {
  return fc.oneof(
    validArb.map((value) => ({ expectValid: true, value })),
    invalidArb.map((value) => ({ expectValid: false, value })),
  );
}

/** Assert acceptance/rejection of a single field, all others held valid. */
function assertSingleField(field: keyof RawCoolingInputs, candidate: Candidate): void {
  const raw: RawCoolingInputs = { ...BASE_VALID, [field]: candidate.value };
  const result = validateCoolingInputs(raw);

  if (candidate.expectValid) {
    expect(result.valid).toBe(true);
    expect(result.errors.find((e) => e.field === field)).toBeUndefined();
    expect(result.inputs).toBeDefined();
  } else {
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === field)).toBe(true);
    expect(result.inputs).toBeUndefined();
  }
}

/** All field-generator pairs, keyed by field name, for the mixed generator. */
const FIELD_GENERATORS: Record<
  keyof RawCoolingInputs,
  { valid: fc.Arbitrary<string>; invalid: fc.Arbitrary<string> }
> = {
  length: { valid: validDimensionArb, invalid: invalidDimensionArb },
  width: { valid: validDimensionArb, invalid: invalidDimensionArb },
  height: { valid: validDimensionArb, invalid: invalidDimensionArb },
  outdoorSummerTemp: { valid: validOutdoorArb, invalid: invalidOutdoorArb },
  desiredIndoorTemp: { valid: validIndoorArb, invalid: invalidIndoorArb },
  externalWalls: { valid: validWallsArb, invalid: invalidWallsArb },
  occupantCount: { valid: validOccupantsArb, invalid: invalidOccupantsArb },
  applianceHeatGain: { valid: validApplianceArb, invalid: invalidApplianceArb },
  roomType: { valid: validRoomTypeArb, invalid: invalidEnumArb },
  insulation: { valid: validInsulationArb, invalid: invalidEnumArb },
  windowType: { valid: validWindowArb, invalid: invalidEnumArb },
  sunExposure: { valid: validSunArb, invalid: invalidEnumArb },
};

const FIELD_ORDER = Object.keys(FIELD_GENERATORS) as (keyof RawCoolingInputs)[];

// ===========================================================================
// Property 12
// ===========================================================================

describe('Property 12: valid inputs are accepted and parsed', () => {
  // Feature: air-conditioning-calculator, Property 12: Valid inputs are accepted and parsed
  for (const field of FIELD_ORDER) {
    it(`accepts "${field}" iff it is within its documented range and precision`, () => {
      const gens = FIELD_GENERATORS[field];
      fc.assert(
        fc.property(candidateArb(gens.valid, gens.invalid), (candidate) => {
          assertSingleField(field, candidate);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  }

  it('accepts a fully valid payload with a parsed inputs record', () => {
    fc.assert(
      fc.property(
        fc.record({
          length: validDimensionArb,
          width: validDimensionArb,
          height: validDimensionArb,
          outdoorSummerTemp: validOutdoorArb,
          desiredIndoorTemp: validIndoorArb,
          roomType: validRoomTypeArb,
          insulation: validInsulationArb,
          windowType: validWindowArb,
          externalWalls: validWallsArb,
          sunExposure: validSunArb,
          occupantCount: validOccupantsArb,
          applianceHeatGain: validApplianceArb,
        }),
        (raw) => {
          const result = validateCoolingInputs(raw);
          expect(result.valid).toBe(true);
          expect(result.errors).toEqual([]);
          expect(result.inputs).toBeDefined();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ===========================================================================
// Properties 13 & 14 share a generator producing a RawCoolingInputs where an
// arbitrary (non-empty) subset of fields is invalid, along with that subset.
// ===========================================================================

interface TaggedValue {
  invalid: boolean;
  value: string;
}

function fieldTag(
  validArb: fc.Arbitrary<string>,
  invalidArb: fc.Arbitrary<string>,
  forceInvalid: boolean,
): fc.Arbitrary<TaggedValue> {
  if (forceInvalid) {
    return invalidArb.map((value) => ({ invalid: true, value }));
  }
  return fc.boolean().chain((makeInvalid) =>
    (makeInvalid ? invalidArb : validArb).map((value) => ({ invalid: makeInvalid, value })),
  );
}

interface MixedCase {
  raw: RawCoolingInputs;
  invalidFields: (keyof RawCoolingInputs)[];
}

/** Generator: at least one field invalid; reports which fields are invalid. */
const mixedInvalidArb: fc.Arbitrary<MixedCase> = fc
  .integer({ min: 0, max: FIELD_ORDER.length - 1 })
  .chain((forcedIndex) => {
    const recordSpec = {} as Record<keyof RawCoolingInputs, fc.Arbitrary<TaggedValue>>;
    FIELD_ORDER.forEach((field, i) => {
      const gens = FIELD_GENERATORS[field];
      recordSpec[field] = fieldTag(gens.valid, gens.invalid, i === forcedIndex);
    });
    return fc.record(recordSpec).map((tagged) => {
      const raw = {} as RawCoolingInputs;
      const invalidFields: (keyof RawCoolingInputs)[] = [];
      for (const field of FIELD_ORDER) {
        const t = tagged[field];
        raw[field] = t.value;
        if (t.invalid) {
          invalidFields.push(field);
        }
      }
      return { raw, invalidFields };
    });
  });

// ===========================================================================
// Property 13
// ===========================================================================

describe('Property 13: invalid inputs are rejected with the offending field flagged', () => {
  // Feature: air-conditioning-calculator, Property 13: Out-of-range or malformed inputs are rejected with the offending field flagged
  it('returns valid === false with no inputs payload and flags every invalid field', () => {
    fc.assert(
      fc.property(mixedInvalidArb, ({ raw, invalidFields }) => {
        const result = validateCoolingInputs(raw);
        expect(result.valid).toBe(false);
        expect(result.inputs).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
        for (const field of invalidFields) {
          expect(result.errors.some((e) => e.field === field)).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ===========================================================================
// Property 14
// ===========================================================================

describe('Property 14: all invalid fields reported simultaneously', () => {
  // Feature: air-conditioning-calculator, Property 14: All invalid fields are reported simultaneously
  it('reports a distinct error for every invalid field when two or more are invalid', () => {
    // Force at least two invalid fields by invalidating two distinct indices.
    const twoInvalidArb = fc
      .tuple(
        fc.integer({ min: 0, max: FIELD_ORDER.length - 1 }),
        fc.integer({ min: 0, max: FIELD_ORDER.length - 1 }),
      )
      .filter(([a, b]) => a !== b)
      .chain(([i, j]) => {
        const recordSpec = {} as Record<keyof RawCoolingInputs, fc.Arbitrary<TaggedValue>>;
        FIELD_ORDER.forEach((field, idx) => {
          const gens = FIELD_GENERATORS[field];
          recordSpec[field] = fieldTag(gens.valid, gens.invalid, idx === i || idx === j);
        });
        return fc.record(recordSpec).map((tagged) => {
          const raw = {} as RawCoolingInputs;
          const invalidFields: (keyof RawCoolingInputs)[] = [];
          for (const field of FIELD_ORDER) {
            raw[field] = tagged[field].value;
            if (tagged[field].invalid) invalidFields.push(field);
          }
          return { raw, invalidFields };
        });
      });

    fc.assert(
      fc.property(twoInvalidArb, ({ raw, invalidFields }) => {
        const result = validateCoolingInputs(raw);
        expect(result.valid).toBe(false);
        const reported = new Set(result.errors.map((e) => e.field));
        for (const field of invalidFields) {
          expect(reported.has(field)).toBe(true);
        }
        // Distinct: at least as many distinct reported fields as forced invalid.
        expect(reported.size).toBeGreaterThanOrEqual(2);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ===========================================================================
// Example / boundary unit tests (complement the properties above).
// ===========================================================================

describe('validateCoolingInputs example cases', () => {
  it('accepts a fully valid payload and returns a parsed inputs payload', () => {
    const result = validateCoolingInputs(BASE_VALID);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual({
      length: 5,
      width: 4,
      height: 2.4,
      outdoorSummerTempC: 35,
      desiredIndoorTempC: 22,
      externalWalls: 2,
      occupantCount: 2,
      applianceHeatGain: 0,
      roomType: 'Lounge',
      insulation: 'Average',
      windowType: 'Double_Glazed',
      sunExposure: 'Average',
    });
  });

  it('accepts outdoor temp boundaries 20.0 and 50.0 but rejects 19.9 and 50.1', () => {
    expect(validateCoolingInputs({ ...BASE_VALID, outdoorSummerTemp: '20.0' }).valid).toBe(true);
    expect(validateCoolingInputs({ ...BASE_VALID, outdoorSummerTemp: '50.0' }).valid).toBe(true);
    expect(validateCoolingInputs({ ...BASE_VALID, outdoorSummerTemp: '19.9' }).valid).toBe(false);
    expect(validateCoolingInputs({ ...BASE_VALID, outdoorSummerTemp: '50.1' }).valid).toBe(false);
  });

  it('accepts indoor temp boundaries 16.0 and 30.0 but rejects 15.9 and 30.1', () => {
    expect(validateCoolingInputs({ ...BASE_VALID, desiredIndoorTemp: '16.0' }).valid).toBe(true);
    expect(validateCoolingInputs({ ...BASE_VALID, desiredIndoorTemp: '30.0' }).valid).toBe(true);
    expect(validateCoolingInputs({ ...BASE_VALID, desiredIndoorTemp: '15.9' }).valid).toBe(false);
    expect(validateCoolingInputs({ ...BASE_VALID, desiredIndoorTemp: '30.1' }).valid).toBe(false);
  });

  it('rejects occupant counts outside 0..20 and any fractional value', () => {
    expect(validateCoolingInputs({ ...BASE_VALID, occupantCount: '0' }).valid).toBe(true);
    expect(validateCoolingInputs({ ...BASE_VALID, occupantCount: '20' }).valid).toBe(true);
    expect(validateCoolingInputs({ ...BASE_VALID, occupantCount: '21' }).valid).toBe(false);
    expect(validateCoolingInputs({ ...BASE_VALID, occupantCount: '2.0' }).valid).toBe(false);
  });

  it('rejects appliance heat gain outside 0..10000 and any fractional value', () => {
    expect(validateCoolingInputs({ ...BASE_VALID, applianceHeatGain: '0' }).valid).toBe(true);
    expect(validateCoolingInputs({ ...BASE_VALID, applianceHeatGain: '10000' }).valid).toBe(true);
    expect(validateCoolingInputs({ ...BASE_VALID, applianceHeatGain: '10001' }).valid).toBe(false);
    expect(validateCoolingInputs({ ...BASE_VALID, applianceHeatGain: '500.5' }).valid).toBe(false);
  });

  it('rejects an invalid sun exposure value', () => {
    expect(validateCoolingInputs({ ...BASE_VALID, sunExposure: 'Blazing' }).valid).toBe(false);
  });

  it('reports every invalid field at once', () => {
    const result = validateCoolingInputs({
      ...BASE_VALID,
      length: '',
      outdoorSummerTemp: '99',
      sunExposure: 'Nope',
      occupantCount: '-1',
    });
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(['length', 'occupantCount', 'outdoorSummerTemp', 'sunExposure']);
    expect(result.inputs).toBeUndefined();
  });
});
