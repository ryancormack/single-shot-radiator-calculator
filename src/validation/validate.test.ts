/**
 * Property-based (and a few example) tests for the pure validation layer.
 *
 * Covers design Correctness Properties 8-12 for `validateInputs`, each
 * implemented as a single `fast-check` property with a minimum of 100 runs and
 * tagged with its design property comment. Generators intelligently constrain
 * the input space into clearly "valid" and "invalid" categories per field.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateInputs } from './validate';
import type { RawInputs } from '../core/types';

// ---------------------------------------------------------------------------
// Option sets (mirrored from the domain types) and a base valid RawInputs.
// ---------------------------------------------------------------------------

const ROOM_TYPES = ['Lounge', 'Bedroom', 'Kitchen', 'Bathroom', 'Hallway'] as const;
const INSULATION_LEVELS = ['Poor', 'Average', 'Good'] as const;
const WINDOW_TYPES = ['Single_Glazed', 'Double_Glazed', 'Triple_Glazed'] as const;

const ALL_ENUM_VALUES: readonly string[] = [
  ...ROOM_TYPES,
  ...INSULATION_LEVELS,
  ...WINDOW_TYPES,
];

/** A fully valid raw payload used as the baseline for single-field tests. */
const BASE_VALID: RawInputs = {
  length: '5',
  width: '4',
  height: '2.4',
  desiredTemp: '21',
  roomType: 'Lounge',
  insulation: 'Average',
  windowType: 'Double_Glazed',
  externalWalls: '2',
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
// VALID-value generators (each guaranteed to be accepted by validateInputs).
// ---------------------------------------------------------------------------

/** Valid dimension: number in (0, 30] with 0, 1 or 2 decimal places. */
const validDimensionArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 2 })
  .chain((dp) => {
    const scale = 10 ** dp;
    // units in [1, 30*scale] => value in (0, 30] with exactly `dp` places.
    return fc.integer({ min: 1, max: 30 * scale }).map((units) => fromUnits(units, dp));
  });

/** Valid desired temperature: number in [10.0, 30.0] with 0 or 1 decimal place. */
const validTempArb: fc.Arbitrary<string> = fc.integer({ min: 0, max: 1 }).chain((dp) => {
  const scale = 10 ** dp;
  return fc
    .integer({ min: 10 * scale, max: 30 * scale })
    .map((units) => fromUnits(units, dp));
});

/** Valid external wall count: whole number 0..4 (no decimals, no sign). */
const validWallsArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 4 })
  .map((n) => String(n));

const validRoomTypeArb = fc.constantFrom(...ROOM_TYPES);
const validInsulationArb = fc.constantFrom(...INSULATION_LEVELS);
const validWindowArb = fc.constantFrom(...WINDOW_TYPES);

// ---------------------------------------------------------------------------
// INVALID-value generators (each guaranteed to be rejected by validateInputs).
// ---------------------------------------------------------------------------

/** Non-numeric / malformed strings rejected by the strict decimal matcher. */
const nonNumericArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', '   ', 'abc', '1.2.3', '12a', '1e3', 'NaN', 'Infinity', '+', '-', '.', '0x1f'),
  fc.string({ maxLength: 6 }).filter((s) => !/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(s.trim())),
);

/** Invalid dimension: out of (0,30], > 2 dp, or non-numeric. */
const invalidDimensionArb: fc.Arbitrary<string> = fc.oneof(
  nonNumericArb,
  // <= 0
  fc.constantFrom('0', '0.00', '-1', '-5.5', '-0.01'),
  // > 30 (with <= 2 dp so only the range is the problem)
  fc.integer({ min: 3001, max: 99999 }).map((u) => fromUnits(u, 2)),
  fc.integer({ min: 31, max: 500 }).map((n) => String(n)),
  // in-range value but > 2 decimal places (3 or 4 dp)
  fc.integer({ min: 1, max: 3 }).chain((extra) => {
    const dp = 2 + extra;
    const scale = 10 ** dp;
    return fc.integer({ min: 1, max: 30 * scale }).map((u) => fromUnits(u, dp));
  }),
);

/** Invalid desired temp: out of [10,30], > 1 dp, or non-numeric. */
const invalidTempArb: fc.Arbitrary<string> = fc.oneof(
  nonNumericArb,
  // < 10.0
  fc.integer({ min: 0, max: 99 }).map((u) => fromUnits(u, 1)),
  fc.constantFrom('-5', '0', '9.9'),
  // > 30.0
  fc.integer({ min: 301, max: 9999 }).map((u) => fromUnits(u, 1)),
  fc.constantFrom('31', '100'),
  // in-range but > 1 dp (2 or 3 decimal places)
  fc.integer({ min: 2, max: 3 }).chain((dp) => {
    const scale = 10 ** dp;
    return fc.integer({ min: 10 * scale, max: 30 * scale }).map((u) => fromUnits(u, dp));
  }),
);

/** Invalid external walls: out of [0,4], any decimal places, or non-numeric. */
const invalidWallsArb: fc.Arbitrary<string> = fc.oneof(
  nonNumericArb,
  // out of range whole numbers
  fc.integer({ min: 5, max: 999 }).map((n) => String(n)),
  fc.integer({ min: -999, max: -1 }).map((n) => String(n)),
  // fractional (rejected because it has decimal places, even if value is whole)
  fc.constantFrom('2.0', '1.5', '3.9', '0.5', '4.0'),
);

/** A string guaranteed not to be a member of any enum option set. */
const invalidEnumArb: fc.Arbitrary<string> = fc.oneof(
  fc.constantFrom('', '   ', 'lounge', 'bedroom', 'GOOD', 'Single Glazed', 'None', 'Foo', 'Quad_Glazed'),
  fc.string({ maxLength: 8 }).filter((s) => !ALL_ENUM_VALUES.includes(s.trim())),
);

// ---------------------------------------------------------------------------
// Helpers for the single-field acceptance properties (8, 9, 10).
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
function assertSingleField(field: keyof RawInputs, candidate: Candidate): void {
  const raw: RawInputs = { ...BASE_VALID, [field]: candidate.value };
  const result = validateInputs(raw);

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

// ===========================================================================
// Property 8
// ===========================================================================

describe('Property 8: dimension validation', () => {
  // Feature: radiator-heat-calculator, Property 8: Dimension validation accepts exactly the values in range and precision
  it('accepts a dimension field iff it parses to a number in (0,30] with <= 2 dp', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'length' | 'width' | 'height'>('length', 'width', 'height'),
        candidateArb(validDimensionArb, invalidDimensionArb),
        (field, candidate) => {
          assertSingleField(field, candidate);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ===========================================================================
// Property 9
// ===========================================================================

describe('Property 9: external wall count validation', () => {
  // Feature: radiator-heat-calculator, Property 9: External wall count validation accepts exactly whole numbers 0..4
  it('accepts externalWalls iff it is a whole number in [0,4], else records an error and withholds a result', () => {
    fc.assert(
      fc.property(candidateArb(validWallsArb, invalidWallsArb), (candidate) => {
        assertSingleField('externalWalls', candidate);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ===========================================================================
// Property 10
// ===========================================================================

describe('Property 10: desired temperature validation', () => {
  // Feature: radiator-heat-calculator, Property 10: Desired temperature validation accepts exactly the values in range and precision
  it('accepts desiredTemp iff it parses to a number in [10.0,30.0] with <= 1 dp', () => {
    fc.assert(
      fc.property(candidateArb(validTempArb, invalidTempArb), (candidate) => {
        assertSingleField('desiredTemp', candidate);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ===========================================================================
// Properties 11 & 12 share a generator producing a RawInputs where an
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

const FIELD_ORDER: (keyof RawInputs)[] = [
  'length',
  'width',
  'height',
  'desiredTemp',
  'externalWalls',
  'roomType',
  'insulation',
  'windowType',
];

interface MixedCase {
  raw: RawInputs;
  invalidFields: (keyof RawInputs)[];
}

/** Generator: at least one field invalid; reports which fields are invalid. */
const mixedInvalidArb: fc.Arbitrary<MixedCase> = fc
  .integer({ min: 0, max: FIELD_ORDER.length - 1 })
  .chain((forcedIndex) => {
    const forced = (i: number): boolean => i === forcedIndex;
    return fc
      .record({
        length: fieldTag(validDimensionArb, invalidDimensionArb, forced(0)),
        width: fieldTag(validDimensionArb, invalidDimensionArb, forced(1)),
        height: fieldTag(validDimensionArb, invalidDimensionArb, forced(2)),
        desiredTemp: fieldTag(validTempArb, invalidTempArb, forced(3)),
        externalWalls: fieldTag(validWallsArb, invalidWallsArb, forced(4)),
        roomType: fieldTag(validRoomTypeArb, invalidEnumArb, forced(5)),
        insulation: fieldTag(validInsulationArb, invalidEnumArb, forced(6)),
        windowType: fieldTag(validWindowArb, invalidEnumArb, forced(7)),
      })
      .map((tagged) => {
        const raw = {} as RawInputs;
        const invalidFields: (keyof RawInputs)[] = [];
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
// Property 11
// ===========================================================================

describe('Property 11: all invalid fields reported simultaneously', () => {
  // Feature: radiator-heat-calculator, Property 11: All invalid fields are reported simultaneously
  it('reports an error entry for every invalid field in the subset', () => {
    fc.assert(
      fc.property(mixedInvalidArb, ({ raw, invalidFields }) => {
        const result = validateInputs(raw);
        expect(result.valid).toBe(false);
        for (const field of invalidFields) {
          expect(result.errors.some((e) => e.field === field)).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ===========================================================================
// Property 12
// ===========================================================================

describe('Property 12: any invalid input withholds the calculated result', () => {
  // Feature: radiator-heat-calculator, Property 12: Any invalid input withholds the calculated result
  it('returns valid === false with no inputs payload when any field is invalid', () => {
    fc.assert(
      fc.property(mixedInvalidArb, ({ raw }) => {
        const result = validateInputs(raw);
        expect(result.valid).toBe(false);
        expect(result.inputs).toBeUndefined();
        expect(result.errors.length).toBeGreaterThan(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ===========================================================================
// Example / boundary unit tests (complement the properties above).
// ===========================================================================

describe('validateInputs example cases', () => {
  it('accepts a fully valid payload and returns a parsed inputs payload', () => {
    const result = validateInputs(BASE_VALID);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.inputs).toEqual({
      length: 5,
      width: 4,
      height: 2.4,
      desiredTempC: 21,
      externalWalls: 2,
      roomType: 'Lounge',
      insulation: 'Average',
      windowType: 'Double_Glazed',
    });
  });

  it('accepts dimension boundaries 0.01 and 30 but rejects 0 and 30.01', () => {
    expect(validateInputs({ ...BASE_VALID, length: '0.01' }).valid).toBe(true);
    expect(validateInputs({ ...BASE_VALID, length: '30' }).valid).toBe(true);
    expect(validateInputs({ ...BASE_VALID, length: '0' }).valid).toBe(false);
    expect(validateInputs({ ...BASE_VALID, length: '30.01' }).valid).toBe(false);
  });

  it('accepts temperature boundaries 10.0 and 30.0 but rejects 9.9 and 30.1', () => {
    expect(validateInputs({ ...BASE_VALID, desiredTemp: '10.0' }).valid).toBe(true);
    expect(validateInputs({ ...BASE_VALID, desiredTemp: '30.0' }).valid).toBe(true);
    expect(validateInputs({ ...BASE_VALID, desiredTemp: '9.9' }).valid).toBe(false);
    expect(validateInputs({ ...BASE_VALID, desiredTemp: '30.1' }).valid).toBe(false);
  });

  it('rejects external wall counts outside 0..4 and any fractional value', () => {
    expect(validateInputs({ ...BASE_VALID, externalWalls: '0' }).valid).toBe(true);
    expect(validateInputs({ ...BASE_VALID, externalWalls: '4' }).valid).toBe(true);
    expect(validateInputs({ ...BASE_VALID, externalWalls: '5' }).valid).toBe(false);
    expect(validateInputs({ ...BASE_VALID, externalWalls: '2.0' }).valid).toBe(false);
  });

  it('reports every invalid field at once', () => {
    const result = validateInputs({
      ...BASE_VALID,
      length: '',
      width: '-1',
      desiredTemp: '99',
      roomType: 'Nope',
    });
    expect(result.valid).toBe(false);
    const fields = result.errors.map((e) => e.field).sort();
    expect(fields).toEqual(['desiredTemp', 'length', 'roomType', 'width']);
    expect(result.inputs).toBeUndefined();
  });
});
