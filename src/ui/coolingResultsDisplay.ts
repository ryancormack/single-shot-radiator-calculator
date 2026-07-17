/**
 * Results Display component for the Air Conditioning (cooling) Calculator.
 *
 * Renders the computed cooling capacity as four values shown concurrently
 * (Requirement 7.4):
 *   - the capacity in watts, labelled `W`,
 *   - the capacity in kilowatts, labelled `kW`,
 *   - the equivalent capacity in BTU/hr, labelled `BTU/hr`, and
 *   - the recommended standard split-system unit size, labelled `kW (unit)`.
 *
 * When there is no valid result to display — the initial load, or when the
 * current inputs are invalid — a placeholder (`--`) is shown in place of every
 * value (Requirements 7.6, 7.7).
 *
 * When the computed capacity exceeds the largest standard unit, an
 * "exceeds a single standard unit" note is shown alongside the recommendation
 * (Requirement 6.3).
 *
 * Callers may signal that the calculation itself failed to run via the
 * `options.unavailable` flag, surfacing a distinct "result unavailable" message
 * while keeping the value slots rendered (Requirement 8.6).
 *
 * All updates happen in place: the DOM structure is built once per container
 * and subsequent calls only mutate the text content of the value slots
 * (Requirements 7.5, 8.4).
 */

import type { CoolingResult } from '../core/coolingTypes';

/** Placeholder shown for each value when no valid result exists. */
const PLACEHOLDER = '--';

/** Optional rendering flags for the cooling Results Display. */
export interface RenderCoolingResultsOptions {
  /**
   * When true, surface a "result unavailable" indication (used when the
   * calculation logic itself fails to run — Requirement 8.6). All value slots
   * fall back to the placeholder in this case.
   */
  unavailable?: boolean;
}

/** References to the mutable parts of the built results DOM. */
interface ResultsRefs {
  wattsValue: HTMLElement;
  kwValue: HTMLElement;
  btuValue: HTMLElement;
  unitValue: HTMLElement;
  note: HTMLElement;
  message: HTMLElement;
}

/**
 * Tracks the built DOM per container so repeated `renderCoolingResults` calls
 * update the existing value slots in place instead of rebuilding the structure.
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
  value.id = `cooling-result-${key}-value`;
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
  region.className = 'results-display cooling-results';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');

  // All value slots are created together and always rendered concurrently
  // (Requirement 7.4).
  const wattsValue = createValueSlot(region, 'watts', 'W');
  const kwValue = createValueSlot(region, 'kw', 'kW');
  const btuValue = createValueSlot(region, 'btu', 'BTU/hr');
  const unitValue = createValueSlot(region, 'unit', 'kW (recommended unit)');

  const note = document.createElement('p');
  note.className = 'result-note';
  note.id = 'cooling-result-note';
  note.hidden = true;

  const message = document.createElement('p');
  message.className = 'result-message';
  message.id = 'cooling-result-message';
  message.hidden = true;

  region.append(note, message);
  container.append(region);

  return { wattsValue, kwValue, btuValue, unitValue, note, message };
}

/** Format the kilowatts value to at most 3 decimals, trimming trailing zeros. */
function formatKw(kw: number): string {
  return String(Number(kw.toFixed(3)));
}

/**
 * Render (or update) the cooling Results Display inside `container`.
 *
 * On the first call for a given container the DOM is built; subsequent calls
 * update the existing value slots in place.
 *
 * @param container The element to render the results into.
 * @param result The computed cooling result, or `null` when no valid result
 *   should be shown (placeholders are displayed for every value).
 * @param options Optional flags. `options.unavailable` surfaces a
 *   "result unavailable" message (Requirement 8.6).
 */
export function renderCoolingResults(
  container: HTMLElement,
  result: CoolingResult | null,
  options?: RenderCoolingResultsOptions,
): void {
  let refs = instances.get(container);
  if (!refs) {
    refs = buildResults(container);
    instances.set(container, refs);
  }

  const unavailable = options?.unavailable === true;

  if (result && !unavailable) {
    // Show all values concurrently with their unit labels (Requirement 7.4).
    refs.wattsValue.textContent = String(result.watts);
    refs.kwValue.textContent = formatKw(result.kw);
    refs.btuValue.textContent = String(result.btu);
    refs.unitValue.textContent = formatKw(result.recommendation.nominalKw);

    if (result.recommendation.exceedsLargest) {
      // Requirement 6.3: capacity exceeds a single standard unit.
      refs.note.textContent =
        'Required capacity exceeds a single standard unit — you may need multiple units or a larger system.';
      refs.note.hidden = false;
    } else {
      refs.note.textContent = '';
      refs.note.hidden = true;
    }

    refs.message.hidden = true;
    refs.message.textContent = '';
    return;
  }

  // No valid result (or calculation unavailable): placeholder for every value
  // (Requirements 7.6, 7.7).
  refs.wattsValue.textContent = PLACEHOLDER;
  refs.kwValue.textContent = PLACEHOLDER;
  refs.btuValue.textContent = PLACEHOLDER;
  refs.unitValue.textContent = PLACEHOLDER;
  refs.note.textContent = '';
  refs.note.hidden = true;

  if (unavailable) {
    refs.message.textContent = 'Result unavailable';
    refs.message.hidden = false;
  } else {
    refs.message.textContent = '';
    refs.message.hidden = true;
  }
}
