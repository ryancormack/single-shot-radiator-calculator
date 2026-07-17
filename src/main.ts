/**
 * Composition root for the Radiator Heat Calculator.
 *
 * This module is the single place that wires the application's layers together
 * and mounts the app into the DOM. It:
 *   - locates the two mount containers declared in `index.html`
 *     (`#form-root` and `#results-root`),
 *   - creates the in-memory `Store` (with documented defaults) and the
 *     `Controller` bound to it,
 *   - subscribes the UI to state changes so the Input_Form and Results Display
 *     re-render in place on every change (Requirements 5.4, 6.4),
 *   - routes the form's `onChange` into `controller.handleInputChange`, which
 *     runs the pure validate -> calculate -> render-via-state pipeline, and
 *   - performs an initial render so the form is visible immediately on load,
 *     before any calculation has run (Requirement 6.5).
 *
 * By design this module performs NO network requests and never navigates or
 * reloads the page (Requirements 6.1, 6.2, 6.4). All logic is client-side and
 * pure below the UI layer; the controller wraps the calculation in a try/catch
 * so a calculation failure degrades gracefully to a "result unavailable"
 * indication while keeping the form rendered (Requirement 6.6).
 */

import './style.css';

import { createStore } from './state/store';
import { createController } from './state/controller';
import { renderForm } from './ui/inputForm';
import { renderResults } from './ui/resultsDisplay';
import { createCoolingStore } from './state/coolingStore';
import { createCoolingController } from './state/coolingController';
import { renderCoolingForm } from './ui/coolingInputForm';
import { renderCoolingResults } from './ui/coolingResultsDisplay';

/**
 * Bootstrap the application: locate the mount points, wire the layers, and
 * perform the initial render. Kept as a function so the wiring is explicit and
 * the module has a single, testable entry point.
 */
function bootstrap(): void {
  const formRoot = document.querySelector<HTMLElement>('#form-root');
  const resultsRoot = document.querySelector<HTMLElement>('#results-root');
  const coolingFormRoot = document.querySelector<HTMLElement>('#cooling-form-root');
  const coolingResultsRoot = document.querySelector<HTMLElement>('#cooling-results-root');

  if (!formRoot || !resultsRoot) {
    throw new Error(
      'Mount containers not found: expected #form-root and #results-root in index.html.',
    );
  }
  if (!coolingFormRoot || !coolingResultsRoot) {
    throw new Error(
      'Mount containers not found: expected #cooling-form-root and #cooling-results-root in index.html.',
    );
  }

  // --- Heating (radiator) calculator ---------------------------------------
  // Create the application state store (seeded with documented defaults) and
  // the controller that drives the validate -> calculate -> state pipeline.
  const store = createStore();
  const controller = createController(store);

  // Render the current state into both UI components. This runs on the initial
  // load and again on every state change via the store subscription, so all
  // updates happen in place with no navigation or reload (Requirements 5.4, 6.4).
  const render = (state = store.getState()): void => {
    renderForm(formRoot, state, (raw) => controller.handleInputChange(raw));
    renderResults(resultsRoot, state.result, {
      unavailable: state.resultUnavailable,
    });
  };

  // Re-render whenever the state changes.
  store.subscribe(render);

  // --- Cooling (air conditioning) calculator -------------------------------
  // The cooling calculator has its own independent store and controller but
  // uses the identical validate -> calculate -> render-in-place pipeline.
  const coolingStore = createCoolingStore();
  const coolingController = createCoolingController(coolingStore);

  const renderCooling = (state = coolingStore.getState()): void => {
    renderCoolingForm(coolingFormRoot, state, (raw) =>
      coolingController.handleInputChange(raw),
    );
    renderCoolingResults(coolingResultsRoot, state.result, {
      unavailable: state.resultUnavailable,
    });
  };

  coolingStore.subscribe(renderCooling);

  // Initial render so both forms show immediately on load, before any valid
  // calculation has been produced. Each Results Display shows placeholders
  // until valid inputs yield a result (Requirements 7.6, 8.6, and heating 5.5/6.5).
  render();
  renderCooling();
}

bootstrap();

export {};
