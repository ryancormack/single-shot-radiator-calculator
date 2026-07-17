/**
 * In-memory application state store for the Air Conditioning (cooling)
 * Calculator.
 *
 * This mirrors the heating `store.ts`: a small, framework-free state container
 * with a subscribe/notify (pub/sub) mechanism. It holds:
 *   - the current raw (string) form inputs (`RawCoolingInputs`),
 *   - the last valid calculation result (`CoolingResult`) or `null` when none,
 *   - the current validation errors (`FieldError[]`), and
 *   - a `resultUnavailable` flag for the calculation-failure case
 *     (Requirement 8.6), distinguishing "no result yet / invalid input" from
 *     "the calculation itself failed to run".
 *
 * The store is deliberately pure of DOM concerns: it never touches `document`,
 * `window`, or any I/O. The UI layer subscribes to state changes and re-renders
 * in place (Requirements 7.5, 8.4).
 */

import type { FieldError } from '../core/types';
import type { CoolingResult, RawCoolingInputs } from '../core/coolingTypes';
import {
  DEFAULT_APPLIANCE_HEAT_GAIN,
  DEFAULT_DESIRED_INDOOR_TEMP_C,
  DEFAULT_OCCUPANT_COUNT,
  DEFAULT_OUTDOOR_SUMMER_TEMP_C,
  DEFAULT_SUN_EXPOSURE,
} from '../core/coolingConfig';
import {
  DEFAULT_EXTERNAL_WALLS,
  DEFAULT_INSULATION,
  DEFAULT_ROOM_TYPE,
  DEFAULT_WINDOW_TYPE,
} from '../core/config';

/**
 * The complete cooling-calculator state snapshot.
 *
 * `result` is the last successfully computed cooling capacity, or `null` when
 * no valid result should currently be shown (initial load, or inputs became
 * invalid). `errors` lists the current per-field validation failures.
 * `resultUnavailable` is set when the calculation logic itself fails to run
 * (as opposed to ordinary validation failure), so the UI can surface a distinct
 * "result unavailable" indication while still rendering the form.
 */
export interface CoolingAppState {
  /** Current raw form values, exactly as entered/selected by the user. */
  inputs: RawCoolingInputs;
  /** Last valid calculation result, or `null` when none should be displayed. */
  result: CoolingResult | null;
  /** Current validation errors; empty when all inputs are valid. */
  errors: FieldError[];
  /** True when the calculation failed to run (Requirement 8.6). */
  resultUnavailable: boolean;
}

/** A subscriber invoked with the latest state whenever it changes. */
export type CoolingListener = (state: CoolingAppState) => void;

/** Unsubscribe handle returned by {@link CoolingStore.subscribe}. */
export type Unsubscribe = () => void;

/** The public store contract exposed to the controller and UI layers. */
export interface CoolingStore {
  /** Returns the current state snapshot. */
  getState(): CoolingAppState;
  /** Merges a partial update into the state and notifies subscribers. */
  setState(partial: Partial<CoolingAppState>): void;
  /**
   * Registers a listener invoked on every state change. Returns a function that
   * removes the listener when called.
   */
  subscribe(listener: CoolingListener): Unsubscribe;
}

/**
 * Build the initial raw inputs, seeded from the documented defaults so the form
 * starts in a consistent, valid-by-default configuration. Dimension fields
 * start empty (the user must supply them); selection/numeric controls start at
 * their documented defaults.
 */
function createInitialInputs(): RawCoolingInputs {
  return {
    length: '',
    width: '',
    height: '',
    outdoorSummerTemp: String(DEFAULT_OUTDOOR_SUMMER_TEMP_C),
    desiredIndoorTemp: String(DEFAULT_DESIRED_INDOOR_TEMP_C),
    roomType: DEFAULT_ROOM_TYPE,
    insulation: DEFAULT_INSULATION,
    windowType: DEFAULT_WINDOW_TYPE,
    externalWalls: String(DEFAULT_EXTERNAL_WALLS),
    sunExposure: DEFAULT_SUN_EXPOSURE,
    occupantCount: String(DEFAULT_OCCUPANT_COUNT),
    applianceHeatGain: String(DEFAULT_APPLIANCE_HEAT_GAIN),
  };
}

/** Build the initial application state: defaults in, no result, no errors. */
function createInitialState(): CoolingAppState {
  return {
    inputs: createInitialInputs(),
    result: null,
    errors: [],
    resultUnavailable: false,
  };
}

/**
 * Create a new in-memory cooling store.
 *
 * @param initialState Optional overrides merged over the default initial state,
 *   useful for tests or for restoring a known state.
 */
export function createCoolingStore(
  initialState?: Partial<CoolingAppState>,
): CoolingStore {
  let state: CoolingAppState = { ...createInitialState(), ...initialState };
  const listeners = new Set<CoolingListener>();

  function getState(): CoolingAppState {
    return state;
  }

  function setState(partial: Partial<CoolingAppState>): void {
    state = { ...state, ...partial };
    // Notify a snapshot of listeners so unsubscribing during notification is safe.
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  function subscribe(listener: CoolingListener): Unsubscribe {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { getState, setState, subscribe };
}
