/**
 * In-memory application state store for the Radiator Heat Calculator.
 *
 * This module is a small, framework-free state container with a subscribe/notify
 * (pub/sub) mechanism. It holds:
 *   - the current raw (string) form inputs (`RawInputs`),
 *   - the last valid calculation result (`HeatResult`) or `null` when none exists,
 *   - the current validation errors (`FieldError[]`), and
 *   - a `resultUnavailable` flag for the calculation-failure case (Requirement 6.6),
 *     distinguishing "no result yet / invalid input" from "the calculation itself
 *     failed to run".
 *
 * The store is deliberately pure of DOM concerns: it never touches `document`,
 * `window`, or any I/O. The UI layer subscribes to state changes and re-renders
 * in place (Requirements 5.4, 6.4); this module only manages state and fan-out.
 */

import type { FieldError, HeatResult, RawInputs } from '../core/types';
import {
  DEFAULT_EXTERNAL_WALLS,
  DEFAULT_INSULATION,
  DEFAULT_ROOM_TYPE,
  DEFAULT_WINDOW_TYPE,
  ROOM_TYPE_DEFAULT_TEMP_C,
} from '../core/config';

/**
 * The complete application state snapshot.
 *
 * `result` is the last successfully computed heat output, or `null` when no
 * valid result should currently be shown (initial load, or inputs became
 * invalid). `errors` lists the current per-field validation failures.
 * `resultUnavailable` is set when the calculation logic itself fails to run
 * (as opposed to ordinary validation failure), so the UI can surface a distinct
 * "result unavailable" indication while still rendering the form.
 */
export interface AppState {
  /** Current raw form values, exactly as entered/selected by the user. */
  inputs: RawInputs;
  /** Last valid calculation result, or `null` when none should be displayed. */
  result: HeatResult | null;
  /** Current validation errors; empty when all inputs are valid. */
  errors: FieldError[];
  /** True when the calculation failed to run (Requirement 6.6). */
  resultUnavailable: boolean;
}

/** A subscriber invoked with the latest state whenever it changes. */
export type Listener = (state: AppState) => void;

/** Unsubscribe handle returned by {@link Store.subscribe}. */
export type Unsubscribe = () => void;

/** The public store contract exposed to the controller and UI layers. */
export interface Store {
  /** Returns the current state snapshot. */
  getState(): AppState;
  /** Merges a partial update into the state and notifies subscribers. */
  setState(partial: Partial<AppState>): void;
  /**
   * Registers a listener invoked on every state change. Returns a function that
   * removes the listener when called.
   */
  subscribe(listener: Listener): Unsubscribe;
}

/**
 * Build the initial raw inputs, seeded from the documented defaults so the
 * form starts in a consistent, valid-by-default configuration. Dimension fields
 * start empty (the user must supply them); selection/numeric controls start at
 * their documented defaults, and the desired temperature starts at the default
 * room type's documented default temperature.
 */
function createInitialInputs(): RawInputs {
  return {
    length: '',
    width: '',
    height: '',
    desiredTemp: String(ROOM_TYPE_DEFAULT_TEMP_C[DEFAULT_ROOM_TYPE]),
    roomType: DEFAULT_ROOM_TYPE,
    insulation: DEFAULT_INSULATION,
    windowType: DEFAULT_WINDOW_TYPE,
    externalWalls: String(DEFAULT_EXTERNAL_WALLS),
  };
}

/** Build the initial application state: defaults in, no result, no errors. */
function createInitialState(): AppState {
  return {
    inputs: createInitialInputs(),
    result: null,
    errors: [],
    resultUnavailable: false,
  };
}

/**
 * Create a new in-memory store.
 *
 * @param initialState Optional overrides merged over the default initial state,
 *   useful for tests or for restoring a known state.
 */
export function createStore(initialState?: Partial<AppState>): Store {
  let state: AppState = { ...createInitialState(), ...initialState };
  const listeners = new Set<Listener>();

  function getState(): AppState {
    return state;
  }

  function setState(partial: Partial<AppState>): void {
    state = { ...state, ...partial };
    // Notify a snapshot of listeners so unsubscribing during notification is safe.
    for (const listener of [...listeners]) {
      listener(state);
    }
  }

  function subscribe(listener: Listener): Unsubscribe {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { getState, setState, subscribe };
}
