/**
 * Shared domain types for the Air Conditioning (cooling) Calculator.
 *
 * These types are pure data contracts with no DOM or I/O dependencies so they
 * can be shared across the cooling calculation core, validation layer, state,
 * and UI. Inputs common to both calculators (room type, insulation, windows)
 * are imported from the existing `types.ts` rather than duplicated, so the two
 * calculators share a single source of truth (Requirement 8.3).
 *
 * Following the existing codebase convention, enumerations are modelled as
 * string union types (never TypeScript `enum`s).
 */

import type {
  RoomType,
  InsulationLevel,
  WindowType,
  FieldError,
} from './types';

// Re-export the shared domain types so cooling modules can import the full set
// of input types from a single place (`coolingTypes`) while `types.ts` remains
// the single source of truth for values common to both calculators (Req 8.3).
export type { RoomType, InsulationLevel, WindowType, FieldError } from './types';

/** Classification of the direct solar heat gain the room receives. */
export type SunExposure = 'Shaded' | 'Average' | 'Sunny';

/**
 * Raw cooling inputs as read directly from the form, before validation.
 * All values are strings because they originate from DOM input elements.
 */
export interface RawCoolingInputs {
  length: string;
  width: string;
  height: string;
  outdoorSummerTemp: string;
  desiredIndoorTemp: string;
  roomType: string;
  insulation: string;
  windowType: string;
  externalWalls: string;
  sunExposure: string;
  occupantCount: string;
  applianceHeatGain: string;
}

/**
 * Validated, parsed cooling inputs. Only produced when every field passes
 * validation. Numeric ranges/precision are enforced by the validation layer.
 */
export interface CoolingInputs {
  length: number; // 0 < v <= 30, <= 2 dp
  width: number; // 0 < v <= 30, <= 2 dp
  height: number; // 0 < v <= 30, <= 2 dp
  outdoorSummerTempC: number; // 20.0..50.0, <= 1 dp
  desiredIndoorTempC: number; // 16.0..30.0, <= 1 dp
  roomType: RoomType;
  insulation: InsulationLevel;
  windowType: WindowType;
  externalWalls: number; // integer 0..4
  sunExposure: SunExposure;
  occupantCount: number; // integer 0..20
  applianceHeatGain: number; // integer 0..10000 (W)
}

/** Recommended standard split-system internal unit size. */
export interface UnitRecommendation {
  /** Selected standard nominal cooling size, in kilowatts. */
  nominalKw: number;
  /** True when the computed capacity exceeds the largest nominal size. */
  exceedsLargest: boolean;
}

/** Result of a successful cooling-capacity calculation. */
export interface CoolingResult {
  volume: number; // m^3, 2 dp
  deltaTCooling: number; // C (may be <= 0)
  watts: number; // integer, 0..100000
  kw: number; // watts / 1000
  btu: number; // integer BTU/hr
  recommendation: UnitRecommendation;
}

/**
 * Result of validating raw cooling inputs. When `valid` is true, `inputs` is
 * present with the parsed `CoolingInputs`; otherwise `errors` lists every
 * failure and no `inputs` payload is produced.
 */
export interface CoolingValidationResult {
  valid: boolean;
  errors: FieldError[];
  // present only when valid === true
  inputs?: CoolingInputs;
}
