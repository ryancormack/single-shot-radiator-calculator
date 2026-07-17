/**
 * Controller pipeline for the Air Conditioning (cooling) Calculator.
 *
 * The controller orchestrates the reactive validate -> calculate -> render-via-state
 * pipeline that runs on every input change. It is the single place that connects
 * the pure validation layer (`validateCoolingInputs`) and the pure calculation
 * core (`computeCoolingCapacity`) to the in-memory `CoolingStore`. It contains no
 * DOM code itself: it only reads raw inputs and writes derived state, so the UI
 * can re-render in place by subscribing to the store (Requirements 7.5, 8.4).
 *
 * Behaviour (per the design's Error Handling table):
 *   - The latest raw inputs are ALWAYS persisted to state so entered values are
 *     retained regardless of validity (Requirements 3.5, 3.6, 8.5).
 *   - On validation failure: the full `FieldError[]` is written to state, the
 *     result is cleared to `null` (placeholder), and `resultUnavailable` is
 *     cleared. No calculation runs (Requirements 4.7, 4.8, 5.8, 7.7).
 *   - On validation success: `computeCoolingCapacity` is called inside a
 *     try/catch.
 *       - Success: the result is stored, errors are cleared, and
 *         `resultUnavailable` is cleared.
 *       - Thrown error: the inputs/form are kept, the result is cleared to
 *         `null`, and `resultUnavailable` is set to `true`. The error is NOT
 *         rethrown, so the app degrades gracefully (Requirement 8.6).
 */

import type { RawCoolingInputs } from '../core/coolingTypes';
import { computeCoolingCapacity } from '../core/coolingCalculator';
import { validateCoolingInputs } from '../validation/coolingValidate';
import type { CoolingStore } from './coolingStore';

/** The public controller contract exposed to the composition root and UI. */
export interface CoolingController {
  /**
   * Handle a change to the raw form inputs: persist the inputs, validate them,
   * and either compute-and-store the result or record validation errors. Never
   * throws — calculation failures are captured as a `resultUnavailable` state.
   */
  handleInputChange(raw: RawCoolingInputs): void;
}

/**
 * Create a cooling controller bound to the given store.
 *
 * @param store The state store the controller reads from and writes to.
 * @returns A {@link CoolingController} whose `handleInputChange` drives the pipeline.
 */
export function createCoolingController(store: CoolingStore): CoolingController {
  function handleInputChange(raw: RawCoolingInputs): void {
    const result = validateCoolingInputs(raw);

    if (!result.valid || !result.inputs) {
      // Invalid input: retain entered values, surface every field error, and
      // clear any previously displayed result to a placeholder. No calculation
      // runs (Requirements 4.7, 4.8, 5.8, 7.7).
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
      const cooling = computeCoolingCapacity(result.inputs);
      store.setState({
        inputs: raw,
        errors: [],
        result: cooling,
        resultUnavailable: false,
      });
    } catch {
      // The calculation logic failed to run. Keep the form/inputs, clear the
      // result, and flag it as unavailable so the UI can show a distinct
      // "result unavailable" indication in place. Do NOT rethrow (Requirement 8.6).
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
