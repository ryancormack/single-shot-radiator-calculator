/**
 * Pure validation layer for the Air Conditioning (cooling) Calculator.
 *
 * `validateCoolingInputs` inspects the raw (string) form values, validates
 * every field independently, and collects *all* failures at once
 * (Requirement 1.5). On success it returns a fully parsed `CoolingInputs`
 * payload; on any failure it returns `valid: false` with the complete
 * `FieldError[]` and no `inputs` payload, so no cooling capacity can be produced
 * (Requirements 1.3, 2.6, 3.5, 3.6, 4.7, 4.8, 5.8).
 *
 * The strict-decimal matcher, decimal-place counting, and per-field discipline
 * mirror the heating `validate.ts`. The room-dimension and shared enum bounds
 * are identical to the heating calculator (Requirement 8.3).
 *
 * This module is pure: no DOM, no I/O, no side effects.
 */

import type { FieldError } from '../core/types';
import type {
  CoolingInputs,
  CoolingValidationResult,
  InsulationLevel,
  RoomType,
  SunExposure,
  WindowType,
} from '../core/coolingTypes';

/** Inclusive/exclusive bounds for room dimensions (metres): 0 < v <= 30. */
const DIMENSION_MIN_EXCLUSIVE = 0;
const DIMENSION_MAX = 30;
const DIMENSION_MAX_DP = 2;

/** Bounds for the outdoor summer temperature (Celsius): 20.0 <= v <= 50.0. */
const OUTDOOR_TEMP_MIN = 20.0;
const OUTDOOR_TEMP_MAX = 50.0;
const OUTDOOR_TEMP_MAX_DP = 1;

/** Bounds for the desired indoor temperature (Celsius): 16.0 <= v <= 30.0. */
const INDOOR_TEMP_MIN = 16.0;
const INDOOR_TEMP_MAX = 30.0;
const INDOOR_TEMP_MAX_DP = 1;

/** Bounds for External_Wall_Count: whole number 0..4 inclusive. */
const WALLS_MIN = 0;
const WALLS_MAX = 4;

/** Bounds for Occupant_Count: whole number 0..20 inclusive. */
const OCCUPANTS_MIN = 0;
const OCCUPANTS_MAX = 20;

/** Bounds for Appliance_Heat_Gain (watts): whole number 0..10000 inclusive. */
const APPLIANCE_MIN = 0;
const APPLIANCE_MAX = 10000;

/** Allowed enum option sets, mirrored from the domain types. */
const ROOM_TYPES: readonly RoomType[] = [
  'Lounge',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Hallway',
];
const INSULATION_LEVELS: readonly InsulationLevel[] = ['Poor', 'Average', 'Good'];
const WINDOW_TYPES: readonly WindowType[] = [
  'Single_Glazed',
  'Double_Glazed',
  'Triple_Glazed',
];
const SUN_EXPOSURES: readonly SunExposure[] = ['Shaded', 'Average', 'Sunny'];

/**
 * Strict decimal-number matcher. Accepts an optional sign, and either a whole
 * number, a number with a fractional part, or a bare fractional part (".5").
 * Deliberately rejects the loose forms `Number()` would otherwise accept
 * (empty string, whitespace, hex, exponent notation, "Infinity", "NaN").
 */
const DECIMAL_RE = /^[+-]?(\d+(\.\d+)?|\.\d+)$/;

/** Count the number of digits after the decimal point in a numeric string. */
function decimalPlaces(numeric: string): number {
  const dot = numeric.indexOf('.');
  return dot === -1 ? 0 : numeric.length - dot - 1;
}

interface ParsedNumber {
  ok: boolean;
  value: number;
  /** Number of decimal places present in the input, when `ok`. */
  dp: number;
}

/**
 * Parse a raw string into a finite number using the strict matcher above.
 * Returns `ok: false` for empty, whitespace-only, or non-numeric input.
 */
function parseStrictNumber(raw: string): ParsedNumber {
  const trimmed = raw.trim();
  if (trimmed === '' || !DECIMAL_RE.test(trimmed)) {
    return { ok: false, value: NaN, dp: 0 };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, value: NaN, dp: 0 };
  }
  return { ok: true, value, dp: decimalPlaces(trimmed) };
}

/**
 * Validate one room dimension (length/width/height). Pushes a `FieldError` and
 * returns `undefined` on failure; returns the parsed number on success.
 */
function validateDimension(
  field: string,
  raw: string,
  errors: FieldError[],
): number | undefined {
  const parsed = parseStrictNumber(raw);
  const reason = `${field} must be a number greater than 0 and no more than ${DIMENSION_MAX}, with at most ${DIMENSION_MAX_DP} decimal places.`;

  if (!parsed.ok) {
    errors.push({ field, reason });
    return undefined;
  }
  if (
    parsed.value <= DIMENSION_MIN_EXCLUSIVE ||
    parsed.value > DIMENSION_MAX ||
    parsed.dp > DIMENSION_MAX_DP
  ) {
    errors.push({ field, reason });
    return undefined;
  }
  return parsed.value;
}

/**
 * Validate a temperature field against inclusive [min, max] bounds and a
 * maximum number of decimal places (Requirements 3.5, 3.6).
 */
function validateTemp(
  field: string,
  raw: string,
  min: number,
  max: number,
  maxDp: number,
  errors: FieldError[],
): number | undefined {
  const parsed = parseStrictNumber(raw);
  const dpLabel = maxDp === 1 ? '1 decimal place' : `${maxDp} decimal places`;
  const reason = `${field} must be a number from ${min.toFixed(1)} to ${max.toFixed(1)} degrees Celsius, with at most ${dpLabel}.`;

  if (!parsed.ok) {
    errors.push({ field, reason });
    return undefined;
  }
  if (parsed.value < min || parsed.value > max || parsed.dp > maxDp) {
    errors.push({ field, reason });
    return undefined;
  }
  return parsed.value;
}

/**
 * Validate a whole-number field against inclusive [min, max] bounds
 * (used for External_Wall_Count, Occupant_Count, and Appliance_Heat_Gain).
 */
function validateWholeNumber(
  field: string,
  raw: string,
  min: number,
  max: number,
  reason: string,
  errors: FieldError[],
): number | undefined {
  const parsed = parseStrictNumber(raw);

  if (!parsed.ok) {
    errors.push({ field, reason });
    return undefined;
  }
  if (
    parsed.dp > 0 ||
    !Number.isInteger(parsed.value) ||
    parsed.value < min ||
    parsed.value > max
  ) {
    errors.push({ field, reason });
    return undefined;
  }
  return parsed.value;
}

/**
 * Validate that a raw string is a member of an allowed enum option set.
 */
function validateEnum<T extends string>(
  field: string,
  raw: string,
  options: readonly T[],
  errors: FieldError[],
): T | undefined {
  const trimmed = raw.trim();
  if ((options as readonly string[]).includes(trimmed)) {
    return trimmed as T;
  }
  errors.push({
    field,
    reason: `${field} must be one of: ${options.join(', ')}.`,
  });
  return undefined;
}

/**
 * Validate all raw cooling form inputs. Every field is checked independently
 * and all failures are reported together. On success returns a parsed
 * `CoolingInputs` payload; on any failure returns `valid: false` with no
 * payload.
 */
export function validateCoolingInputs(raw: {
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
}): CoolingValidationResult {
  const errors: FieldError[] = [];

  const length = validateDimension('length', raw.length, errors);
  const width = validateDimension('width', raw.width, errors);
  const height = validateDimension('height', raw.height, errors);
  const outdoorSummerTempC = validateTemp(
    'outdoorSummerTemp',
    raw.outdoorSummerTemp,
    OUTDOOR_TEMP_MIN,
    OUTDOOR_TEMP_MAX,
    OUTDOOR_TEMP_MAX_DP,
    errors,
  );
  const desiredIndoorTempC = validateTemp(
    'desiredIndoorTemp',
    raw.desiredIndoorTemp,
    INDOOR_TEMP_MIN,
    INDOOR_TEMP_MAX,
    INDOOR_TEMP_MAX_DP,
    errors,
  );
  const externalWalls = validateWholeNumber(
    'externalWalls',
    raw.externalWalls,
    WALLS_MIN,
    WALLS_MAX,
    `External wall count must be a whole number from ${WALLS_MIN} to ${WALLS_MAX}.`,
    errors,
  );
  const occupantCount = validateWholeNumber(
    'occupantCount',
    raw.occupantCount,
    OCCUPANTS_MIN,
    OCCUPANTS_MAX,
    `Occupant count must be a whole number from ${OCCUPANTS_MIN} to ${OCCUPANTS_MAX}.`,
    errors,
  );
  const applianceHeatGain = validateWholeNumber(
    'applianceHeatGain',
    raw.applianceHeatGain,
    APPLIANCE_MIN,
    APPLIANCE_MAX,
    `Appliance heat gain must be a whole number of watts from ${APPLIANCE_MIN} to ${APPLIANCE_MAX}.`,
    errors,
  );
  const roomType = validateEnum<RoomType>('roomType', raw.roomType, ROOM_TYPES, errors);
  const insulation = validateEnum<InsulationLevel>(
    'insulation',
    raw.insulation,
    INSULATION_LEVELS,
    errors,
  );
  const windowType = validateEnum<WindowType>(
    'windowType',
    raw.windowType,
    WINDOW_TYPES,
    errors,
  );
  const sunExposure = validateEnum<SunExposure>(
    'sunExposure',
    raw.sunExposure,
    SUN_EXPOSURES,
    errors,
  );

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Every field validated: the values below are guaranteed defined.
  const inputs: CoolingInputs = {
    length: length as number,
    width: width as number,
    height: height as number,
    outdoorSummerTempC: outdoorSummerTempC as number,
    desiredIndoorTempC: desiredIndoorTempC as number,
    externalWalls: externalWalls as number,
    occupantCount: occupantCount as number,
    applianceHeatGain: applianceHeatGain as number,
    roomType: roomType as RoomType,
    insulation: insulation as InsulationLevel,
    windowType: windowType as WindowType,
    sunExposure: sunExposure as SunExposure,
  };

  return { valid: true, errors: [], inputs };
}
