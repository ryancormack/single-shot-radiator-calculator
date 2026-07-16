/**
 * Pure calculation core for the Radiator Heat Calculator.
 *
 * Implements Requirement 4 (and the rounding clauses of Requirement 5).
 * Every function here is deterministic and side-effect free: no DOM, no
 * randomness, no time dependence. This is what makes the core exhaustively
 * unit- and property-testable.
 */

import type {
  CalculatorInputs,
  HeatResult,
  InsulationLevel,
  RoomType,
  WindowType,
} from './types';
import {
  BASE_COEFFICIENT,
  BTU_CONVERSION_FACTOR,
  INSULATION_MULTIPLIER,
  OUTDOOR_DESIGN_TEMP_C,
  ROOM_TYPE_MULTIPLIER,
  WALL_MULTIPLIER,
  WINDOW_MULTIPLIER,
} from './config';

/** Lower bound for the clamped watts output. */
const WATTS_MIN = 0;
/** Upper bound for the clamped watts output. */
const WATTS_MAX = 100000;

/**
 * Round half-up to the nearest integer. JavaScript's `Math.round` rounds a
 * `.5` fractional part up toward positive infinity, which matches the
 * "0.5 rounds up" requirement (Requirements 5.1, 5.2).
 */
function roundHalfUp(x: number): number {
  return Math.round(x);
}

/** Clamp `x` to the inclusive range [lo, hi]. */
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/**
 * Compute Room_Volume as length x width x height, expressed in cubic metres
 * and rounded to 2 decimal places (Requirement 1.4).
 */
export function computeRoomVolume(length: number, width: number, height: number): number {
  const raw = length * width * height;
  return Math.round(raw * 100) / 100;
}

/**
 * Compute Delta_T as the desired indoor temperature minus the documented
 * outdoor design temperature constant (Requirement 3.6).
 */
export function computeDeltaT(desiredTempC: number): number {
  return desiredTempC - OUTDOOR_DESIGN_TEMP_C;
}

/**
 * Core physics function computing the required heat output in watts.
 *
 * Accepts `deltaT` directly (rather than a desired temperature) so the
 * Delta_T === 0 case is directly testable. The result is rounded half-up and
 * clamped to [0, 100000] (Requirements 4.1, 4.4, 4.5, 4.6, 5.1).
 */
export function computeWatts(params: {
  volume: number; // m^3, > 0
  deltaT: number; // C, >= 0
  insulation: InsulationLevel;
  windowType: WindowType;
  externalWalls: number; // 0..4
  roomType: RoomType;
}): number {
  const { volume, deltaT, insulation, windowType, externalWalls, roomType } = params;

  const rawWatts =
    volume *
    deltaT *
    BASE_COEFFICIENT *
    INSULATION_MULTIPLIER[insulation] *
    WINDOW_MULTIPLIER[windowType] *
    WALL_MULTIPLIER[externalWalls] *
    ROOM_TYPE_MULTIPLIER[roomType];

  return clamp(roundHalfUp(rawWatts), WATTS_MIN, WATTS_MAX);
}

/**
 * Convert a (already rounded) watts value to BTU/hr, rounded half-up to the
 * nearest whole BTU/hr (Requirements 4.2, 5.2).
 */
export function wattsToBtu(watts: number): number {
  return roundHalfUp(watts * BTU_CONVERSION_FACTOR);
}

/**
 * Convenience wrapper used by the controller: computes volume, Delta_T, watts,
 * and BTU/hr for a fully validated set of inputs (Requirements 4.1-4.3).
 */
export function computeHeatOutput(inputs: CalculatorInputs): HeatResult {
  const volume = computeRoomVolume(inputs.length, inputs.width, inputs.height);
  const deltaT = computeDeltaT(inputs.desiredTempC);
  const watts = computeWatts({
    volume,
    deltaT,
    insulation: inputs.insulation,
    windowType: inputs.windowType,
    externalWalls: inputs.externalWalls,
    roomType: inputs.roomType,
  });
  const btu = wattsToBtu(watts);

  return { volume, deltaT, watts, btu };
}
