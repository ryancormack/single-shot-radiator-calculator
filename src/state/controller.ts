/**
 * Controller pipeline for the Radiator Heat Calculator.
 *
 * The controller orchestrates the reactive validate -> calculate -> render-via-state
 * pipeline that runs on every input change. It is the single place that connects
 * the pure validation layer (`validateInputs`) and the pure calculation core
 * (`computeHeatOutput`) to the in-memory `Store`. It contains no DOM code itself:
 * it only reads raw inputs and writes derived state, so the UI can re-render in
 * place by subscribing to the store (Requirements 5.4, 6.4).
 *
 * Behaviour (per the design's Error Handling table):
 *   - The latest raw inputs are ALWAYS persisted to state so entered values are
 *     retained regardless of validity (Requirements 5.6, 6.5).
 *   - On validation failure: the full `FieldError[]` is written to state, the
 *     result is cleared to `null` (placeholder), and `resultUnavailable` is
 *     cleared. No calculation runs (Requirements 4.7, 4.8, 5.6, 6.5).
 *   - On validation success: `computeHeatOutput` is called inside a try/catch.
 *       - Success: the result is stored, errors are cleared, and
 *         `resultUnavailable` is cleared.
 *       - Thrown error: the inputs/form are kept, the result is cleared to
 *         `null`, and `resultUnavailable` is set to `true`. The error is NOT
 *         rethrown, so the app degrades gracefully (Requirement 6.6).
 */

import type { RawInputs } from '../core/types';
import { computeHeatOutput } from '../core/calculator';
import { validateInputs } from '../validation/validate';
import type { Store } from './store';

/** The public controller contract exposed to the composition root and UI. */
export interface Controller {
  /**
   * Handle a change to the raw form inputs: persist the inputs, validate them,
   * and either compute-and-store the result or record validation errors. Never
   * throws — calculation failures are captured as a `resultUnavailable` state.
   */
  handleInputChange(raw: RawInputs): void;
}

/**
 * Create a controller bound to the given store.
 *
 * @param store The application state store the controller reads from and writes to.
 * @returns A {@link Controller} whose `handleInputChange` drives the pipeline.
 */
export function createController(store: Store): Controller {
  function handleInputChange(raw: RawInputs): void {
    const result = validateInputs(raw);

    if (!result.valid || !result.inputs) {
      // Invalid input: retain entered values, surface every field error, and
      // clear any previously displayed result to a placeholder. No calculation
      // runs (Requirements 4.7, 4.8, 5.6, 6.5).
      store.setState({
        inputs: raw,
        errors: result.errors,
        result: null,
        resultUnavailable: false,
      });
      return;
    }

    // Valid input: attempt the calculation, degrading gracefully if it throws.
    try {
      const heat = computeHeatOutput(result.inputs);
      store.setState({
        inputs: raw,
        errors: [],
        result: heat,
        resultUnavailable: false,
      });
    } catch {
      // The calculation logic failed to run. Keep the form/inputs, clear the
      // result, and flag it as unavailable so the UI can show a distinct
      // "result unavailable" indication in place. Do NOT rethrow (Requirement 6.6).
      store.setState({
        inputs: raw,
        errors: [],
        result: null,
        resultUnavailable: true,
      });
    }
  }

  return { handleInputChange };
}
