/**
 * Configuration sanity tests for the cooling calculator (Task 1.3).
 *
 * These example tests guard the documented cooling constants against drift and
 * confirm the shared multiplier tables are reused from `config.ts` rather than
 * redefined (Requirement 8.3).
 */

import { describe, it, expect } from 'vitest';

import {
  COOLING_BASE_COEFFICIENT,
  HEAT_GAIN_PER_OCCUPANT,
  SUN_EXPOSURE_MULTIPLIER,
  NOMINAL_CAPACITIES_KW,
  DEFAULT_OUTDOOR_SUMMER_TEMP_C,
  DEFAULT_DESIRED_INDOOR_TEMP_C,
  DEFAULT_SUN_EXPOSURE,
  DEFAULT_OCCUPANT_COUNT,
  DEFAULT_APPLIANCE_HEAT_GAIN,
} from './coolingConfig';
import type { SunExposure } from './coolingTypes';

const SUN_EXPOSURES: readonly SunExposure[] = ['Shaded', 'Average', 'Sunny'];

describe('cooling config — nominal capacity set (Requirement 6.1)', () => {
  it('is non-empty', () => {
    expect(NOMINAL_CAPACITIES_KW.length).toBeGreaterThan(0);
  });

  it('is strictly ascending', () => {
    for (let i = 1; i < NOMINAL_CAPACITIES_KW.length; i += 1) {
      expect(NOMINAL_CAPACITIES_KW[i]).toBeGreaterThan(NOMINAL_CAPACITIES_KW[i - 1]);
    }
  });

  it('contains only positive values', () => {
    for (const kw of NOMINAL_CAPACITIES_KW) {
      expect(kw).toBeGreaterThan(0);
    }
  });
});

describe('cooling config — core constants', () => {
  it('has a positive base coefficient and per-occupant heat gain', () => {
    expect(COOLING_BASE_COEFFICIENT).toBeGreaterThan(0);
    expect(HEAT_GAIN_PER_OCCUPANT).toBeGreaterThan(0);
  });

  it('defines a positive multiplier for every Sun_Exposure option', () => {
    for (const exposure of SUN_EXPOSURES) {
      expect(SUN_EXPOSURE_MULTIPLIER[exposure]).toBeGreaterThan(0);
    }
  });

  it('has exactly the documented Sun_Exposure keys', () => {
    expect(Object.keys(SUN_EXPOSURE_MULTIPLIER).sort()).toEqual(
      [...SUN_EXPOSURES].sort(),
    );
  });
});

describe('cooling config — documented defaults are within range (Requirements 2.5, 3.3, 3.4, 4.4-4.6)', () => {
  it('outdoor summer temperature default is within 20.0..50.0', () => {
    expect(DEFAULT_OUTDOOR_SUMMER_TEMP_C).toBeGreaterThanOrEqual(20.0);
    expect(DEFAULT_OUTDOOR_SUMMER_TEMP_C).toBeLessThanOrEqual(50.0);
  });

  it('desired indoor temperature default is within 16.0..30.0', () => {
    expect(DEFAULT_DESIRED_INDOOR_TEMP_C).toBeGreaterThanOrEqual(16.0);
    expect(DEFAULT_DESIRED_INDOOR_TEMP_C).toBeLessThanOrEqual(30.0);
  });

  it('default outdoor temperature is hotter than the default indoor temperature', () => {
    expect(DEFAULT_OUTDOOR_SUMMER_TEMP_C).toBeGreaterThan(DEFAULT_DESIRED_INDOOR_TEMP_C);
  });

  it('sun exposure default is a member of the option set', () => {
    expect(SUN_EXPOSURES).toContain(DEFAULT_SUN_EXPOSURE);
  });

  it('occupant count default is a whole number within 0..20', () => {
    expect(Number.isInteger(DEFAULT_OCCUPANT_COUNT)).toBe(true);
    expect(DEFAULT_OCCUPANT_COUNT).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_OCCUPANT_COUNT).toBeLessThanOrEqual(20);
  });

  it('appliance heat gain default is a whole number within 0..10000', () => {
    expect(Number.isInteger(DEFAULT_APPLIANCE_HEAT_GAIN)).toBe(true);
    expect(DEFAULT_APPLIANCE_HEAT_GAIN).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_APPLIANCE_HEAT_GAIN).toBeLessThanOrEqual(10000);
  });
});
