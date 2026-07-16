/**
 * Unit tests for the controller pipeline (`createController`).
 *
 * Focus of Task 7.3: graceful handling of a calculation failure (Requirement 6.6).
 * When the calculation logic throws for otherwise-valid inputs, the controller
 * must NOT throw; it must retain the raw inputs, clear the result to `null`, and
 * flag `resultUnavailable = true` so the UI can render a distinct
 * "result unavailable" indication in place.
 *
 * We also cover the two ordinary pipeline branches for confidence:
 *   - valid inputs -> a numeric result is stored and `resultUnavailable` is false;
 *   - invalid inputs -> field errors are populated, no result, and the raw inputs
 *     are retained (Requirements 4.7, 5.6, 6.5).
 *
 * The calculation core is mocked so that `computeHeatOutput` is a spy that, by
 * default, delegates to the real implementation (so the "valid" test exercises
 * real math). The failure test overrides that single call to throw.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createController } from './controller';
import { createStore } from './store';
import { computeHeatOutput } from '../core/calculator';
import type { RawInputs } from '../core/types';

// Mock the calculator module, but default each export to the real behaviour so
// the positive test runs the genuine calculation. Only the failure test swaps
// in a throwing implementation (for a single call).
vi.mock('../core/calculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/calculator')>();
  return {
    ...actual,
    computeHeatOutput: vi.fn(actual.computeHeatOutput),
  };
});

/** A fully valid set of raw inputs (the design's worked-example vector). */
const VALID_RAW: RawInputs = {
  length: '5',
  width: '4',
  height: '2.4',
  desiredTemp: '21',
  roomType: 'Lounge',
  insulation: 'Average',
  windowType: 'Double_Glazed',
  externalWalls: '2',
};

beforeEach(() => {
  // Clear call history and any per-test overrides between tests so the spy
  // reverts to delegating to the real implementation.
  vi.mocked(computeHeatOutput).mockClear();
});

describe('createController.handleInputChange', () => {
  it('stores a numeric result and clears the unavailable flag for valid inputs', () => {
    const store = createStore();
    const controller = createController(store);

    controller.handleInputChange(VALID_RAW);

    const state = store.getState();
    expect(state.result).not.toBeNull();
    expect(typeof state.result?.watts).toBe('number');
    expect(typeof state.result?.btu).toBe('number');
    // Worked-example vector: Lounge 5 x 4 x 2.4 m, Average / Double_Glazed / 2
    // walls, 21 C -> 1521 W, 5190 BTU/hr.
    expect(state.result?.watts).toBe(1521);
    expect(state.result?.btu).toBe(5190);
    expect(state.errors).toEqual([]);
    expect(state.resultUnavailable).toBe(false);
    expect(state.inputs).toEqual(VALID_RAW);
  });

  it('populates errors, withholds the result, and retains inputs for invalid inputs', () => {
    const store = createStore();
    const controller = createController(store);

    const invalidRaw: RawInputs = { ...VALID_RAW, length: 'not-a-number' };
    controller.handleInputChange(invalidRaw);

    const state = store.getState();
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.errors.some((e) => e.field === 'length')).toBe(true);
    expect(state.result).toBeNull();
    // A validation failure is NOT a calculation failure.
    expect(state.resultUnavailable).toBe(false);
    // Entered values are always retained (Requirement 6.5).
    expect(state.inputs).toEqual(invalidRaw);
    // No calculation should run when validation fails (Requirement 4.7).
    expect(vi.mocked(computeHeatOutput)).not.toHaveBeenCalled();
  });

  it('degrades gracefully when the calculation throws for valid inputs (Requirement 6.6)', () => {
    vi.mocked(computeHeatOutput).mockImplementationOnce(() => {
      throw new Error('calculation failed to run');
    });

    const store = createStore();
    const controller = createController(store);

    // The controller must not rethrow the calculation error.
    expect(() => controller.handleInputChange(VALID_RAW)).not.toThrow();

    const state = store.getState();
    // Raw inputs are preserved so the form keeps the user's values.
    expect(state.inputs).toEqual(VALID_RAW);
    // The result is cleared and flagged as unavailable (not just "no result").
    expect(state.result).toBeNull();
    expect(state.resultUnavailable).toBe(true);
    // No spurious validation errors were introduced by the failure.
    expect(state.errors).toEqual([]);
  });
});
