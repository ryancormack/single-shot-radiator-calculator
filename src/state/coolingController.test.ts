/**
 * Unit tests for the cooling controller pipeline (`createCoolingController`).
 *
 * Covers the three pipeline branches:
 *   - valid inputs -> a numeric result is stored and `resultUnavailable` is false;
 *   - invalid inputs -> field errors are populated, no result, raw inputs
 *     retained, and no calculation runs (Requirements 4.7, 5.8, 8.5);
 *   - a calculation failure for otherwise-valid inputs is handled gracefully:
 *     the controller does NOT throw, retains inputs, clears the result, and sets
 *     `resultUnavailable = true` (Requirement 8.6).
 *
 * The calculation core is mocked so `computeCoolingCapacity` is a spy that, by
 * default, delegates to the real implementation. The failure test overrides a
 * single call to throw.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCoolingController } from './coolingController';
import { createCoolingStore } from './coolingStore';
import { computeCoolingCapacity } from '../core/coolingCalculator';
import type { RawCoolingInputs } from '../core/coolingTypes';

vi.mock('../core/coolingCalculator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/coolingCalculator')>();
  return {
    ...actual,
    computeCoolingCapacity: vi.fn(actual.computeCoolingCapacity),
  };
});

/** A fully valid set of raw inputs (the design's worked-example vector). */
const VALID_RAW: RawCoolingInputs = {
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

beforeEach(() => {
  vi.mocked(computeCoolingCapacity).mockClear();
});

describe('createCoolingController.handleInputChange', () => {
  it('stores a numeric result and clears the unavailable flag for valid inputs', () => {
    const store = createCoolingStore();
    const controller = createCoolingController(store);

    controller.handleInputChange(VALID_RAW);

    const state = store.getState();
    expect(state.result).not.toBeNull();
    expect(typeof state.result?.watts).toBe('number');
    expect(typeof state.result?.btu).toBe('number');
    // Worked-example vector: 1024 W, 1.024 kW, 3494 BTU/hr, recommend 2.0 kW.
    expect(state.result?.watts).toBe(1024);
    expect(state.result?.kw).toBe(1.024);
    expect(state.result?.btu).toBe(3494);
    expect(state.result?.recommendation).toEqual({ nominalKw: 2.0, exceedsLargest: false });
    expect(state.errors).toEqual([]);
    expect(state.resultUnavailable).toBe(false);
    expect(state.inputs).toEqual(VALID_RAW);
  });

  it('populates errors, withholds the result, and retains inputs for invalid inputs', () => {
    const store = createCoolingStore();
    const controller = createCoolingController(store);

    const invalidRaw: RawCoolingInputs = { ...VALID_RAW, length: 'not-a-number' };
    controller.handleInputChange(invalidRaw);

    const state = store.getState();
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.errors.some((e) => e.field === 'length')).toBe(true);
    expect(state.result).toBeNull();
    // A validation failure is NOT a calculation failure.
    expect(state.resultUnavailable).toBe(false);
    // Entered values are always retained (Requirement 8.5).
    expect(state.inputs).toEqual(invalidRaw);
    // No calculation should run when validation fails (Requirement 5.8).
    expect(vi.mocked(computeCoolingCapacity)).not.toHaveBeenCalled();
  });

  it('clears a previous result and shows placeholders when inputs become invalid (Req 7.7)', () => {
    const store = createCoolingStore();
    const controller = createCoolingController(store);

    // First a valid result.
    controller.handleInputChange(VALID_RAW);
    expect(store.getState().result).not.toBeNull();

    // Then an input becomes invalid.
    controller.handleInputChange({ ...VALID_RAW, outdoorSummerTemp: '999' });
    const state = store.getState();
    expect(state.result).toBeNull();
    expect(state.errors.some((e) => e.field === 'outdoorSummerTemp')).toBe(true);
  });

  it('degrades gracefully when the calculation throws for valid inputs (Requirement 8.6)', () => {
    vi.mocked(computeCoolingCapacity).mockImplementationOnce(() => {
      throw new Error('calculation failed to run');
    });

    const store = createCoolingStore();
    const controller = createCoolingController(store);

    expect(() => controller.handleInputChange(VALID_RAW)).not.toThrow();

    const state = store.getState();
    expect(state.inputs).toEqual(VALID_RAW);
    expect(state.result).toBeNull();
    expect(state.resultUnavailable).toBe(true);
    expect(state.errors).toEqual([]);
  });
});
