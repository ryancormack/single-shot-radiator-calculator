/**
 * Centralised, documented configuration constants for the cooling-capacity
 * formula.
 *
 * Only cooling-specific constants live here. The multiplier tables that the
 * cooling and heating calculators share (`INSULATION_MULTIPLIER`,
 * `WINDOW_MULTIPLIER`, `WALL_MULTIPLIER`, `ROOM_TYPE_MULTIPLIER`) and the
 * `BTU_CONVERSION_FACTOR` are NOT redefined here; they are imported from
 * `./config` where needed so there is a single source of truth (Requirement
 * 8.3). This module is pure (no DOM/I/O).
 */

import type { SunExposure } from './coolingTypes';

/** Base volumetric cooling coefficient, in W per m^3 per degree C. */
export const COOLING_BASE_COEFFICIENT = 1.0;

/** Sensible heat gain contributed by each occupant, in watts. */
export const HEAT_GAIN_PER_OCCUPANT = 100;

/**
 * Multiplier applied for each Sun_Exposure classification. A shaded room gains
 * less solar heat than an equivalent sunny one, so needs less cooling.
 */
export const SUN_EXPOSURE_MULTIPLIER: Record<SunExposure, number> = {
  Shaded: 0.9,
  Average: 1.0,
  Sunny: 1.2,
};

/**
 * Standard split-system nominal cooling sizes (kW), ordered smallest to largest
 * (Requirement 6.1). These mirror common real-world single-room air
 * conditioner capacities.
 */
export const NOMINAL_CAPACITIES_KW: readonly number[] = [
  2.0, 2.5, 3.5, 5.0, 7.1, 8.0, 10.0,
];

/** Documented defaults for unchanged cooling controls (Requirements 3.3, 3.4, 4.4-4.6). */
export const DEFAULT_OUTDOOR_SUMMER_TEMP_C = 35; // within 20.0..50.0
export const DEFAULT_DESIRED_INDOOR_TEMP_C = 22; // within 16.0..30.0
export const DEFAULT_SUN_EXPOSURE: SunExposure = 'Average';
export const DEFAULT_OCCUPANT_COUNT = 2; // within 0..20
export const DEFAULT_APPLIANCE_HEAT_GAIN = 0; // within 0..10000
