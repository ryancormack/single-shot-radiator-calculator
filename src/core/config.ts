/**
 * Centralised, documented configuration constants for the heat-output formula.
 *
 * All formula constants live here so the calculation is fully reproducible and
 * so accidental drift is caught by unit tests. This module is pure (no DOM/I/O).
 */

import type { InsulationLevel, RoomType, WindowType } from './types';

/** Outdoor design temperature (common UK sizing value), in degrees Celsius. */
export const OUTDOOR_DESIGN_TEMP_C = -3;

/** Base volumetric heat-loss coefficient, in W per m^3 per degree C. */
export const BASE_COEFFICIENT = 1.0;

/** Watts -> BTU/hr conversion factor (1 W = 3.412142 BTU/hr). */
export const BTU_CONVERSION_FACTOR = 3.412142;

/** Multiplier applied for each insulation level. */
export const INSULATION_MULTIPLIER: Record<InsulationLevel, number> = {
  Poor: 1.3,
  Average: 1.0,
  Good: 0.8,
};

/** Multiplier applied for each window (glazing) type. */
export const WINDOW_MULTIPLIER: Record<WindowType, number> = {
  Single_Glazed: 1.2,
  Double_Glazed: 1.0,
  Triple_Glazed: 0.9,
};

/** Multiplier indexed by External_Wall_Count (0..4). */
export const WALL_MULTIPLIER: readonly number[] = [1.0, 1.1, 1.2, 1.3, 1.4];

/** Multiplier applied for each room type. */
export const ROOM_TYPE_MULTIPLIER: Record<RoomType, number> = {
  Lounge: 1.1,
  Bedroom: 1.0,
  Kitchen: 0.9,
  Bathroom: 1.2,
  Hallway: 1.0,
};

/** Documented per-Room_Type default desired indoor temperatures (C). */
export const ROOM_TYPE_DEFAULT_TEMP_C: Record<RoomType, number> = {
  Lounge: 21,
  Bedroom: 18,
  Kitchen: 20,
  Bathroom: 22,
  Hallway: 18,
};

/** Documented defaults for unchanged selection controls (Requirement 2.5). */
export const DEFAULT_ROOM_TYPE: RoomType = 'Lounge';
export const DEFAULT_INSULATION: InsulationLevel = 'Average';
export const DEFAULT_WINDOW_TYPE: WindowType = 'Double_Glazed';
export const DEFAULT_EXTERNAL_WALLS = 1;
