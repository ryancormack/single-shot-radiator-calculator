/**
 * Pure validation layer for the Radiator Heat Calculator.
 *
 * `validateInputs` inspects the raw (string) form values, validates every field
 * independently, and collects *all* failures at once (Requirement 1.5). On
 * success it returns a fully parsed `CalculatorInputs` payload; on any failure
 * it returns `valid: false` with the complete `FieldError[]` and no `inputs`
 * payload, so no heat output can be produced (Requirements 1.3, 2.6, 3.5, 4.7).
 *
 * This module is pure: no DOM, no I/O, no side effects.
 */

import type {
  CalculatorInputs,
  FieldError,
  InsulationLevel,
  RawInputs,
  RoomType,
  ValidationResult,
  WindowType,
} from '../core/types';

/** Inclusive/exclusive bounds for room dimensions (metres): 0 < v <= 30. */
const DIMENSION_MIN_EXCLUSIVE = 0;
const DIMENSION_MAX = 30;
const DIMENSION_MAX_DP = 2;

/** Bounds for desired indoor temperature (Celsius): 10.0 <= v <= 30.0. */
const TEMP_MIN = 10.0;
const TEMP_MAX = 30.0;
const TEMP_MAX_DP = 1;

/** Bounds for External_Wall_Count: whole number 0..4 inclusive. */
const WALLS_MIN = 0;
const WALLS_MAX = 4;

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
 * Validate the desired indoor temperature: numeric, 10.0..30.0, <= 1 dp
 * (Requirements 3.4, 3.5).
 */
function validateDesiredTemp(raw: string, errors: FieldError[]): number | undefined {
  const field = 'desiredTemp';
  const parsed = parseStrictNumber(raw);
  const reason = `Desired temperature must be a number from ${TEMP_MIN.toFixed(1)} to ${TEMP_MAX.toFixed(1)} degrees Celsius, with at most ${TEMP_MAX_DP} decimal place.`;

  if (!parsed.ok) {
    errors.push({ field, reason });
    return undefined;
  }
  if (parsed.value < TEMP_MIN || parsed.value > TEMP_MAX || parsed.dp > TEMP_MAX_DP) {
    errors.push({ field, reason });
    return undefined;
  }
  return parsed.value;
}

/**
 * Validate External_Wall_Count: a whole number in [0, 4] (Requirements 2.3, 2.6).
 */
function validateExternalWalls(raw: string, errors: FieldError[]): number | undefined {
  const field = 'externalWalls';
  const parsed = parseStrictNumber(raw);
  const reason = `External wall count must be a whole number from ${WALLS_MIN} to ${WALLS_MAX}.`;

  if (!parsed.ok) {
    errors.push({ field, reason });
    return undefined;
  }
  if (
    parsed.dp > 0 ||
    !Number.isInteger(parsed.value) ||
    parsed.value < WALLS_MIN ||
    parsed.value > WALLS_MAX
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
 * Validate all raw form inputs. Every field is checked independently and all
 * failures are reported together. On success returns a parsed
 * `CalculatorInputs` payload; on any failure returns `valid: false` with no
 * payload.
 */
export function validateInputs(raw: RawInputs): ValidationResult {
  const errors: FieldError[] = [];

  const length = validateDimension('length', raw.length, errors);
  const width = validateDimension('width', raw.width, errors);
  const height = validateDimension('height', raw.height, errors);
  const desiredTempC = validateDesiredTemp(raw.desiredTemp, errors);
  const externalWalls = validateExternalWalls(raw.externalWalls, errors);
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

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Every field validated: the values below are guaranteed defined.
  const inputs: CalculatorInputs = {
    length: length as number,
    width: width as number,
    height: height as number,
    desiredTempC: desiredTempC as number,
    externalWalls: externalWalls as number,
    roomType: roomType as RoomType,
    insulation: insulation as InsulationLevel,
    windowType: windowType as WindowType,
  };

  return { valid: true, errors: [], inputs };
}
