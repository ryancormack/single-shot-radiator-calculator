/**
 * Shared domain types for the Radiator Heat Calculator.
 *
 * These types are pure data contracts with no DOM or I/O dependencies so they
 * can be shared across the calculation core, validation layer, state, and UI.
 */

/** Classification of the room that influences desired temperature and heat factor. */
export type RoomType = 'Lounge' | 'Bedroom' | 'Kitchen' | 'Bathroom' | 'Hallway';

/** Classification of the room's thermal insulation quality. */
export type InsulationLevel = 'Poor' | 'Average' | 'Good';

/** Classification of the room's windows. */
export type WindowType = 'Single_Glazed' | 'Double_Glazed' | 'Triple_Glazed';

/**
 * Raw inputs as read directly from the form, before validation.
 * All values are strings because they originate from DOM input elements.
 */
export interface RawInputs {
  length: string;
  width: string;
  height: string;
  desiredTemp: string;
  roomType: string;
  insulation: string;
  windowType: string;
  externalWalls: string;
}

/**
 * Validated, parsed calculator inputs. Only produced when every field passes
 * validation. Numeric ranges/precision are enforced by the validation layer.
 */
export interface CalculatorInputs {
  length: number; // 0 < v <= 30, <= 2 dp
  width: number; // 0 < v <= 30, <= 2 dp
  height: number; // 0 < v <= 30, <= 2 dp
  desiredTempC: number; // 10.0..30.0, <= 1 dp
  roomType: RoomType;
  insulation: InsulationLevel;
  windowType: WindowType;
  externalWalls: number; // integer 0..4
}

/** Result of a successful heat-output calculation. */
export interface HeatResult {
  volume: number; // m^3, 2 dp
  deltaT: number; // C
  watts: number; // integer, 0..100000
  btu: number; // integer
}

/** A single validation failure, naming the offending field and the reason. */
export interface FieldError {
  field: string;
  reason: string;
}

/**
 * Result of validating raw inputs. When `valid` is true, `inputs` is present
 * with the parsed `CalculatorInputs`; otherwise `errors` lists every failure.
 */
export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  // present only when valid === true
  inputs?: CalculatorInputs;
}
