/**
 * Results Display component for the Radiator Heat Calculator.
 *
 * Renders the computed heat output as two values shown concurrently: the power
 * in watts labelled `W`, and the equivalent heat in BTU/hr labelled `BTU/hr`
 * (Requirement 5.3). Both values are always visible together — the component
 * never shows one without the other.
 *
 * When there is no valid result to display — the initial load, or when the
 * current inputs are invalid — a placeholder (`--`) is shown in place of BOTH
 * the watts and BTU/hr values (Requirements 5.5, 5.6).
 *
 * Optionally, callers may signal that the calculation itself failed to run
 * (as opposed to ordinary "no result yet / invalid input") via the
 * `options.unavailable` flag, which surfaces a distinct "result unavailable"
 * message while still keeping the value slots rendered (Requirement 6.6).
 *
 * All updates happen in place: the DOM structure is built once per container
 * and subsequent calls only mutate the text content of the value slots, so no
 * navigation or page reload occurs (Requirements 5.4, 6.4).
 */

import type { HeatResult } from '../core/types';

/** Placeholder shown for each value when no valid result exists. */
const PLACEHOLDER = '--';

/** Optional rendering flags for the Results Display. */
export interface RenderResultsOptions {
  /**
   * When true, surface a "result unavailable" indication (used when the
   * calculation logic itself fails to run — Requirement 6.6). The watts and
   * BTU/hr slots fall back to the placeholder in this case.
   */
  unavailable?: boolean;
}

/** References to the mutable parts of the built results DOM. */
interface ResultsRefs {
  wattsValue: HTMLElement;
  btuValue: HTMLElement;
  message: HTMLElement;
}

/**
 * Tracks the built DOM per container so repeated `renderResults` calls update
 * the existing value slots in place instead of rebuilding the structure.
 */
const instances = new WeakMap<HTMLElement, ResultsRefs>();

/** Build a single labelled value slot (e.g. `<value> W`) and return its refs. */
function createValueSlot(
  parent: HTMLElement,
  key: string,
  unitLabel: string,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'result';

  const value = document.createElement('span');
  value.className = 'result-value';
  value.id = `result-${key}-value`;
  value.textContent = PLACEHOLDER;

  const unit = document.createElement('span');
  unit.className = 'result-unit';
  unit.textContent = unitLabel;

  wrapper.append(value, unit);
  parent.append(wrapper);
  return value;
}

/** Build the results DOM once for a container and return its mutable refs. */
function buildResults(container: HTMLElement): ResultsRefs {
  container.replaceChildren();

  const region = document.createElement('div');
  region.className = 'results-display';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');

  // Both value slots are created together and always rendered concurrently
  // (Requirement 5.3).
  const wattsValue = createValueSlot(region, 'watts', 'W');
  const btuValue = createValueSlot(region, 'btu', 'BTU/hr');

  const message = document.createElement('p');
  message.className = 'result-message';
  message.id = 'result-message';
  message.hidden = true;

  region.append(message);
  container.append(region);

  return { wattsValue, btuValue, message };
}

/**
 * Render (or update) the Results Display inside `container`.
 *
 * On the first call for a given container the DOM is built; subsequent calls
 * update the existing value slots in place.
 *
 * @param container The element to render the results into.
 * @param result The computed heat result, or `null` when no valid result
 *   should be shown (placeholders are displayed for both values).
 * @param options Optional flags. `options.unavailable` surfaces a
 *   "result unavailable" message (Requirement 6.6); it is backward compatible
 *   and defaults to the ordinary placeholder behaviour when omitted.
 */
export function renderResults(
  container: HTMLElement,
  result: HeatResult | null,
  options?: RenderResultsOptions,
): void {
  let refs = instances.get(container);
  if (!refs) {
    refs = buildResults(container);
    instances.set(container, refs);
  }

  const unavailable = options?.unavailable === true;

  if (result && !unavailable) {
    // Show both values concurrently with their unit labels (Requirement 5.3).
    // watts and btu are already integers on HeatResult.
    refs.wattsValue.textContent = String(result.watts);
    refs.btuValue.textContent = String(result.btu);
    refs.message.hidden = true;
    refs.message.textContent = '';
    return;
  }

  // No valid result (or calculation unavailable): placeholder for BOTH values
  // (Requirements 5.5, 5.6).
  refs.wattsValue.textContent = PLACEHOLDER;
  refs.btuValue.textContent = PLACEHOLDER;

  if (unavailable) {
    refs.message.textContent = 'Result unavailable';
    refs.message.hidden = false;
  } else {
    refs.message.textContent = '';
    refs.message.hidden = true;
  }
}
