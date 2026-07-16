/**
 * Integration / example tests for the full Radiator Heat Calculator pipeline.
 *
 * Task 9.2 — drives input changes end to end through the real, composed layers
 * (store -> controller -> Input_Form + Results Display) running against a jsdom
 * DOM, exactly as the composition root (`src/main.ts`) wires them, but without
 * importing `main.ts` directly (it self-executes bootstrap on import).
 *
 * Validates: Requirements 5.4, 6.4, 6.5 (and exercises 5.6 for the invalid path).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createStore } from './state/store';
import { createController } from './state/controller';
import { renderForm } from './ui/inputForm';
import { renderResults } from './ui/resultsDisplay';

/**
 * Recreate the composition root's wiring against a fresh jsdom container so we
 * can drive the pipeline deterministically. Mirrors `bootstrap()` in main.ts:
 * subscribe -> renderForm + renderResults, with the form's onChange routed into
 * the controller.
 */
function mountApp() {
  document.body.innerHTML =
    '<div id="form-root"></div><div id="results-root"></div>';
  const formRoot = document.querySelector<HTMLElement>('#form-root')!;
  const resultsRoot = document.querySelector<HTMLElement>('#results-root')!;

  const store = createStore();
  const controller = createController(store);

  const render = (state = store.getState()): void => {
    renderForm(formRoot, state, (raw) => controller.handleInputChange(raw));
    renderResults(resultsRoot, state.result, {
      unavailable: state.resultUnavailable,
    });
  };

  store.subscribe(render);
  render();

  return { formRoot, resultsRoot, store, controller };
}

/** Set a control's value and dispatch a bubbling DOM event to drive the pipeline. */
function setControl(
  root: HTMLElement,
  id: string,
  value: string,
  eventType: 'input' | 'change' = 'input',
): void {
  const el = root.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
  if (!el) throw new Error(`Control #${id} not found`);
  el.value = value;
  el.dispatchEvent(new Event(eventType, { bubbles: true }));
}

/** Read the current text shown in a results value slot. */
function resultText(root: HTMLElement, key: 'watts' | 'btu'): string {
  return (
    root.querySelector(`#result-${key}-value`)?.textContent?.trim() ?? ''
  );
}

/**
 * Fill the whole form with the worked-example valid values. Selection/numeric
 * controls are set first, and the dimension fields last, so the final emit sees
 * a fully valid input set and produces a result.
 */
function fillValidInputs(formRoot: HTMLElement): void {
  setControl(formRoot, 'roomType', 'Lounge', 'change');
  setControl(formRoot, 'insulation', 'Average', 'change');
  setControl(formRoot, 'windowType', 'Double_Glazed', 'change');
  setControl(formRoot, 'externalWalls', '2', 'input');
  setControl(formRoot, 'desiredTemp', '21', 'input');
  setControl(formRoot, 'length', '5', 'input');
  setControl(formRoot, 'width', '4', 'input');
  setControl(formRoot, 'height', '2.4', 'input');
}

describe('Radiator Heat Calculator - full pipeline integration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initially shows placeholders for both results before any valid input', () => {
    const { resultsRoot } = mountApp();
    expect(resultText(resultsRoot, 'watts')).toBe('--');
    expect(resultText(resultsRoot, 'btu')).toBe('--');
  });

  it('drives valid inputs end to end and shows the computed watts and BTU/hr (Req 5.4, 6.4)', () => {
    const { formRoot, resultsRoot, store } = mountApp();

    fillValidInputs(formRoot);

    // Worked example: 5 x 4 x 2.4, Lounge/Average/Double_Glazed/2 walls, 21C.
    expect(resultText(resultsRoot, 'watts')).toBe('1521');
    expect(resultText(resultsRoot, 'btu')).toBe('5190');

    // Both value slots are labelled with their units and shown concurrently.
    const wattsUnit = resultsRoot.querySelector('#result-watts-value')
      ?.nextElementSibling?.textContent;
    const btuUnit = resultsRoot.querySelector('#result-btu-value')
      ?.nextElementSibling?.textContent;
    expect(wattsUnit).toBe('W');
    expect(btuUnit).toBe('BTU/hr');

    // State reflects a valid result with no errors.
    const state = store.getState();
    expect(state.result).toEqual({ volume: 48, deltaT: 24, watts: 1521, btu: 5190 });
    expect(state.errors).toEqual([]);
    expect(state.resultUnavailable).toBe(false);
  });

  it('recomputes and updates the displayed result in place when an input changes (Req 5.4, 6.4)', () => {
    const { formRoot, resultsRoot } = mountApp();

    fillValidInputs(formRoot);
    expect(resultText(resultsRoot, 'watts')).toBe('1521');

    // Capture the exact value-slot nodes to prove the update happens in place
    // (same nodes mutated, no rebuild / navigation).
    const wattsNode = resultsRoot.querySelector('#result-watts-value')!;
    const btuNode = resultsRoot.querySelector('#result-btu-value')!;

    // Change one input to another valid value: height 2.4 -> 3.0 (volume 60).
    setControl(formRoot, 'height', '3', 'input');

    // 60 * 24 * 1.2 (walls) * 1.1 (Lounge) = 1900.8 -> 1901 W; 1901 * 3.412142 -> 6486.
    expect(resultText(resultsRoot, 'watts')).toBe('1901');
    expect(resultText(resultsRoot, 'btu')).toBe('6486');

    // Same DOM nodes were mutated in place, not replaced.
    expect(resultsRoot.querySelector('#result-watts-value')).toBe(wattsNode);
    expect(resultsRoot.querySelector('#result-btu-value')).toBe(btuNode);
  });

  it('restores placeholders and shows a field error on invalid input, retaining entered values (Req 5.6, 6.5)', () => {
    const { formRoot, resultsRoot, store } = mountApp();

    fillValidInputs(formRoot);
    expect(resultText(resultsRoot, 'watts')).toBe('1521');

    // Make length invalid (empty). The other entered values must be retained.
    setControl(formRoot, 'length', '', 'input');

    // Both result values fall back to placeholders (Req 5.6).
    expect(resultText(resultsRoot, 'watts')).toBe('--');
    expect(resultText(resultsRoot, 'btu')).toBe('--');

    // A field error is shown for the offending field.
    const lengthError = formRoot.querySelector('#length-error')?.textContent ?? '';
    expect(lengthError.length).toBeGreaterThan(0);

    // The user's other entered values are retained in the form controls (Req 6.5).
    expect(formRoot.querySelector<HTMLInputElement>('#width')!.value).toBe('4');
    expect(formRoot.querySelector<HTMLInputElement>('#height')!.value).toBe('2.4');
    expect(formRoot.querySelector<HTMLInputElement>('#desiredTemp')!.value).toBe('21');
    expect(formRoot.querySelector<HTMLSelectElement>('#roomType')!.value).toBe('Lounge');
    expect(formRoot.querySelector<HTMLInputElement>('#externalWalls')!.value).toBe('2');

    // State retains the raw inputs and clears the result (no calculation failure).
    const state = store.getState();
    expect(state.inputs.width).toBe('4');
    expect(state.inputs.height).toBe('2.4');
    expect(state.result).toBeNull();
    expect(state.resultUnavailable).toBe(false);
    expect(state.errors.some((e) => e.field === 'length')).toBe(true);
  });

  it('re-validates back to a result after fixing the invalid input, all in place', () => {
    const { formRoot, resultsRoot } = mountApp();

    fillValidInputs(formRoot);
    setControl(formRoot, 'length', '', 'input');
    expect(resultText(resultsRoot, 'watts')).toBe('--');

    // Fix the input again -> the result reappears in the same slots.
    setControl(formRoot, 'length', '5', 'input');
    expect(resultText(resultsRoot, 'watts')).toBe('1521');
    expect(resultText(resultsRoot, 'btu')).toBe('5190');

    // The field error is cleared once the input is valid again.
    const lengthError = formRoot.querySelector('#length-error')?.textContent ?? '';
    expect(lengthError).toBe('');
  });

  it('performs all updates in place with no navigation or full-page reload (Req 6.4)', () => {
    const hrefBefore = window.location.href;
    const { formRoot, resultsRoot } = mountApp();

    // The container nodes must persist across the whole interaction sequence.
    const formRootRef = document.querySelector('#form-root');
    const resultsRootRef = document.querySelector('#results-root');

    fillValidInputs(formRoot);
    setControl(formRoot, 'width', '5', 'input');
    setControl(formRoot, 'length', '', 'input');
    setControl(formRoot, 'length', '5', 'input');

    // Same container nodes are still attached (no rebuild / navigation).
    expect(document.querySelector('#form-root')).toBe(formRootRef);
    expect(document.querySelector('#results-root')).toBe(resultsRootRef);
    expect(resultsRootRef?.contains(resultsRoot.querySelector('#result-watts-value'))).toBe(true);

    // The document location is unchanged (no navigation / reload occurred).
    expect(window.location.href).toBe(hrefBefore);
  });
});
