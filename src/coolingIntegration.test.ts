/**
 * Integration / example tests for the full Air Conditioning Calculator pipeline.
 *
 * Drives input changes end to end through the real, composed cooling layers
 * (store -> controller -> Input_Form + Results Display) running against a jsdom
 * DOM, exactly as the composition root (`src/main.ts`) wires them, but without
 * importing `main.ts` directly (it self-executes bootstrap on import).
 *
 * Validates: Requirements 7.5, 8.4, 8.5 (and exercises 7.7 for the invalid path).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createCoolingStore } from './state/coolingStore';
import { createCoolingController } from './state/coolingController';
import { renderCoolingForm } from './ui/coolingInputForm';
import { renderCoolingResults } from './ui/coolingResultsDisplay';

/** Recreate the composition root's wiring against a fresh jsdom container. */
function mountApp() {
  document.body.innerHTML =
    '<div id="cooling-form-root"></div><div id="cooling-results-root"></div>';
  const formRoot = document.querySelector<HTMLElement>('#cooling-form-root')!;
  const resultsRoot = document.querySelector<HTMLElement>('#cooling-results-root')!;

  const store = createCoolingStore();
  const controller = createCoolingController(store);

  const render = (state = store.getState()): void => {
    renderCoolingForm(formRoot, state, (raw) => controller.handleInputChange(raw));
    renderCoolingResults(resultsRoot, state.result, {
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
function resultText(root: HTMLElement, key: 'watts' | 'kw' | 'btu' | 'unit'): string {
  return root.querySelector(`#cooling-result-${key}-value`)?.textContent?.trim() ?? '';
}

/** Fill the whole form with the worked-example valid values (dimensions last). */
function fillValidInputs(formRoot: HTMLElement): void {
  setControl(formRoot, 'cooling-roomType', 'Lounge', 'change');
  setControl(formRoot, 'cooling-insulation', 'Average', 'change');
  setControl(formRoot, 'cooling-windowType', 'Double_Glazed', 'change');
  setControl(formRoot, 'cooling-sunExposure', 'Average', 'change');
  setControl(formRoot, 'cooling-externalWalls', '2', 'input');
  setControl(formRoot, 'cooling-occupantCount', '2', 'input');
  setControl(formRoot, 'cooling-applianceHeatGain', '0', 'input');
  setControl(formRoot, 'cooling-outdoorSummerTemp', '35', 'input');
  setControl(formRoot, 'cooling-desiredIndoorTemp', '22', 'input');
  setControl(formRoot, 'cooling-length', '5', 'input');
  setControl(formRoot, 'cooling-width', '4', 'input');
  setControl(formRoot, 'cooling-height', '2.4', 'input');
}

describe('Air Conditioning Calculator - full pipeline integration', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('initially shows placeholders for all results before any valid input', () => {
    const { resultsRoot } = mountApp();
    expect(resultText(resultsRoot, 'watts')).toBe('--');
    expect(resultText(resultsRoot, 'kw')).toBe('--');
    expect(resultText(resultsRoot, 'btu')).toBe('--');
    expect(resultText(resultsRoot, 'unit')).toBe('--');
  });

  it('drives valid inputs end to end and shows the computed capacity (Req 7.5, 8.4)', () => {
    const { formRoot, resultsRoot, store } = mountApp();

    fillValidInputs(formRoot);

    // Worked example: 5 x 4 x 2.4, Lounge/Average/Double_Glazed/2 walls, Average
    // sun, 2 occupants, 35C -> 22C => 1024 W.
    expect(resultText(resultsRoot, 'watts')).toBe('1024');
    expect(resultText(resultsRoot, 'kw')).toBe('1.024');
    expect(resultText(resultsRoot, 'btu')).toBe('3494');
    expect(resultText(resultsRoot, 'unit')).toBe('2');

    const state = store.getState();
    expect(state.result?.watts).toBe(1024);
    expect(state.errors).toEqual([]);
    expect(state.resultUnavailable).toBe(false);
  });

  it('recomputes and updates the displayed result in place when an input changes', () => {
    const { formRoot, resultsRoot } = mountApp();

    fillValidInputs(formRoot);
    expect(resultText(resultsRoot, 'watts')).toBe('1024');

    const wattsNode = resultsRoot.querySelector('#cooling-result-watts-value')!;

    // Increase occupancy from 2 to 5: internal gain +300 W => 1324 W.
    setControl(formRoot, 'cooling-occupantCount', '5', 'input');
    expect(resultText(resultsRoot, 'watts')).toBe('1324');

    // Same DOM node was mutated in place, not replaced.
    expect(resultsRoot.querySelector('#cooling-result-watts-value')).toBe(wattsNode);
  });

  it('restores placeholders and shows a field error on invalid input, retaining values (Req 7.7, 8.5)', () => {
    const { formRoot, resultsRoot, store } = mountApp();

    fillValidInputs(formRoot);
    expect(resultText(resultsRoot, 'watts')).toBe('1024');

    // Make the outdoor temperature invalid (out of range).
    setControl(formRoot, 'cooling-outdoorSummerTemp', '99', 'input');

    expect(resultText(resultsRoot, 'watts')).toBe('--');
    expect(resultText(resultsRoot, 'kw')).toBe('--');

    const err = formRoot.querySelector('#cooling-outdoorSummerTemp-error')?.textContent ?? '';
    expect(err.length).toBeGreaterThan(0);

    // Other entered values are retained.
    expect(formRoot.querySelector<HTMLInputElement>('#cooling-length')!.value).toBe('5');
    expect(formRoot.querySelector<HTMLInputElement>('#cooling-desiredIndoorTemp')!.value).toBe('22');

    const state = store.getState();
    expect(state.result).toBeNull();
    expect(state.resultUnavailable).toBe(false);
    expect(state.errors.some((e) => e.field === 'outdoorSummerTemp')).toBe(true);
  });

  it('re-validates back to a result after fixing the invalid input, all in place', () => {
    const { formRoot, resultsRoot } = mountApp();

    fillValidInputs(formRoot);
    setControl(formRoot, 'cooling-outdoorSummerTemp', '99', 'input');
    expect(resultText(resultsRoot, 'watts')).toBe('--');

    setControl(formRoot, 'cooling-outdoorSummerTemp', '35', 'input');
    expect(resultText(resultsRoot, 'watts')).toBe('1024');

    const err = formRoot.querySelector('#cooling-outdoorSummerTemp-error')?.textContent ?? '';
    expect(err).toBe('');
  });

  it('performs all updates in place with no navigation or full-page reload (Req 8.4)', () => {
    const hrefBefore = window.location.href;
    const { formRoot } = mountApp();

    const formRootRef = document.querySelector('#cooling-form-root');
    const resultsRootRef = document.querySelector('#cooling-results-root');

    fillValidInputs(formRoot);
    setControl(formRoot, 'cooling-width', '5', 'input');
    setControl(formRoot, 'cooling-length', '', 'input');
    setControl(formRoot, 'cooling-length', '5', 'input');

    expect(document.querySelector('#cooling-form-root')).toBe(formRootRef);
    expect(document.querySelector('#cooling-results-root')).toBe(resultsRootRef);
    expect(window.location.href).toBe(hrefBefore);
  });
});
