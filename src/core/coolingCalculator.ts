/**
 * Pure calculation core for the Air Conditioning (cooling) Calculator.
 *
 * This is the cooling counterpart to `calculator.ts`. Where the heating core
 * computes the heat that must be *added* to reach a warm indoor temperature
 * against a cold outdoor design temperature, this core computes the heat that
 * must be *removed* to reach a cooler indoor temperature against a hot outdoor
 * summer temperature, and maps that required capacity onto a standard
 * split-system ("external pump style") internal unit.
 *
 * Every function here is deterministic and side-effect free: no DOM, no
 * randomness, no time dependence (Requirement 8.2). This is what makes the
 * core exhaustively unit- and property-testable.
 */

import type {
  CoolingInputs,
  CoolingResult,
  InsulationLevel,
  RoomType,
  SunExposure,
  UnitRecommendation,
  WindowType,
} from './coolingTypes';
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

/** Lower bound for the clamped watts output. */
const WATTS_MIN = 0;
/** Upper bound for the clamped watts output. */
const WATTS_MAX = 100000;

/**
 * Round half-up to the nearest integer. JavaScript's `Math.round` rounds a
 * `.5` fractional part up toward positive infinity, matching the
 * "0.5 rounds up" requirement (Requirements 5.3, 7.1, 7.2).
 */
function roundHalfUp(x: number): number {
  return Math.round(x);
}

/** Clamp `x` to the inclusive range [lo, hi]. */
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Compute Cooling_Volume as length x width x height, expressed in cubic metres
 * and rounded to 2 decimal places (Requirement 1.4).
 */
export function computeCoolingVolume(
  length: number,
  width: number,
  height: number,
): number {
  const raw = length * width * height;
  return Math.round(raw * 100) / 100;
}

/**
 * Compute Delta_T_Cooling as the outdoor summer temperature minus the desired
 * indoor temperature (Requirement 3.7). May be zero or negative when the
 * outside is not hotter than the target.
 */
export function computeDeltaTCooling(
  outdoorSummerC: number,
  desiredIndoorC: number,
): number {
  return outdoorSummerC - desiredIndoorC;
}

/**
 * Compute Effective_Delta_T_Cooling as the greater of Delta_T_Cooling and 0, so
 * the envelope contribution to the cooling load is never negative
 * (Requirement 3.8).
 */
export function effectiveDeltaTCooling(deltaTCooling: number): number {
  return Math.max(deltaTCooling, 0);
}

/**
 * Compute Internal_Gain_Load in watts as the sum of occupant heat gain and
 * appliance heat gain (Requirement 5.2). Accepts already-validated inputs.
 */
export function computeInternalGainLoad(
  occupantCount: number,
  applianceHeatGain: number,
): number {
  return occupantCount * HEAT_GAIN_PER_OCCUPANT + applianceHeatGain;
}

/**
 * Compute Envelope_Load in watts: the heat entering through the room envelope
 * (Requirement 5.1). Uses the effective (floored) delta-T, the base cooling
 * coefficient, the shared insulation/window/wall/room-type multipliers, and the
 * cooling-specific Sun_Exposure multiplier. The delta-T is floored internally
 * so a non-positive delta-T contributes exactly 0.
 */
export function computeEnvelopeLoad(params: {
  volume: number; // m^3, > 0
  deltaTCooling: number; // C (may be <= 0; floored at 0 internally)
  insulation: InsulationLevel;
  windowType: WindowType;
  externalWalls: number; // 0..4
  roomType: RoomType;
  sunExposure: SunExposure;
}): number {
  const {
    volume,
    deltaTCooling,
    insulation,
    windowType,
    externalWalls,
    roomType,
    sunExposure,
  } = params;

  return (
    volume *
    effectiveDeltaTCooling(deltaTCooling) *
    COOLING_BASE_COEFFICIENT *
    INSULATION_MULTIPLIER[insulation] *
    WINDOW_MULTIPLIER[windowType] *
    WALL_MULTIPLIER[externalWalls] *
    ROOM_TYPE_MULTIPLIER[roomType] *
    SUN_EXPOSURE_MULTIPLIER[sunExposure]
  );
}

/**
 * Core function computing the required cooling capacity in watts.
 *
 * Cooling_Capacity = clamp(roundHalfUp(Envelope_Load + Internal_Gain_Load), 0, 100000)
 * (Requirement 5.3). Accepts `deltaTCooling` directly (rather than the raw
 * temperatures) so the Delta_T_Cooling <= 0 case is directly testable.
 */
export function computeCoolingWatts(params: {
  volume: number;
  deltaTCooling: number;
  insulation: InsulationLevel;
  windowType: WindowType;
  externalWalls: number;
  roomType: RoomType;
  sunExposure: SunExposure;
  occupantCount: number;
  applianceHeatGain: number;
}): number {
  const envelope = computeEnvelopeLoad(params);
  const internal = computeInternalGainLoad(
    params.occupantCount,
    params.applianceHeatGain,
  );
  return clamp(roundHalfUp(envelope + internal), WATTS_MIN, WATTS_MAX);
}

/**
 * Convert a (already rounded) watts value to BTU/hr, rounded half-up to the
 * nearest whole BTU/hr (Requirement 7.2).
 */
export function wattsToBtu(watts: number): number {
  return roundHalfUp(watts * BTU_CONVERSION_FACTOR);
}

/** Convert a watts value to kilowatts (derived display value, Requirement 7.3). */
export function wattsToKw(watts: number): number {
  return watts / 1000;
}

/**
 * Recommend a standard split-system internal unit size for a computed cooling
 * capacity (Requirement 6). Selects the smallest Nominal_Capacity whose
 * watt-equivalent is >= the capacity. When the capacity exceeds the largest
 * nominal value, returns the largest value with `exceedsLargest: true`
 * (Requirement 6.3).
 */
export function recommendUnit(capacityWatts: number): UnitRecommendation {
  const largest = NOMINAL_CAPACITIES_KW[NOMINAL_CAPACITIES_KW.length - 1];

  for (const nominalKw of NOMINAL_CAPACITIES_KW) {
    if (nominalKw * 1000 >= capacityWatts) {
      return { nominalKw, exceedsLargest: false };
    }
  }

  return { nominalKw: largest, exceedsLargest: true };
}

/**
 * Convenience wrapper used by the controller: computes volume, Delta_T_Cooling,
 * the cooling capacity (W/kW/BTU), and the recommended unit for a fully
 * validated set of inputs (Requirements 5.1-5.4, 6.2, 7.1-7.3).
 */
export function computeCoolingCapacity(inputs: CoolingInputs): CoolingResult {
  const volume = computeCoolingVolume(inputs.length, inputs.width, inputs.height);
  const deltaTCooling = computeDeltaTCooling(
    inputs.outdoorSummerTempC,
    inputs.desiredIndoorTempC,
  );
  const watts = computeCoolingWatts({
    volume,
    deltaTCooling,
    insulation: inputs.insulation,
    windowType: inputs.windowType,
    externalWalls: inputs.externalWalls,
    roomType: inputs.roomType,
    sunExposure: inputs.sunExposure,
    occupantCount: inputs.occupantCount,
    applianceHeatGain: inputs.applianceHeatGain,
  });
  const kw = wattsToKw(watts);
  const btu = wattsToBtu(watts);
  const recommendation = recommendUnit(watts);

  return { volume, deltaTCooling, watts, kw, btu, recommendation };
}
