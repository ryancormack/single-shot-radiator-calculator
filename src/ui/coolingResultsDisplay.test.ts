/**
 * Tests for the cooling Results Display component (`renderCoolingResults`).
 *
 * Includes design Property 15 (results rendering shows every value with its
 * unit label) implemented as a fast-check property, plus example/DOM tests for
 * the placeholder, in-place update, "exceeds a single standard unit" note, and
 * "result unavailable" behaviours.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { renderCoolingResults } from './coolingResultsDisplay';
import type { CoolingResult } from '../core/coolingTypes';

const PLACEHOLDER = '--';
const NUM_RUNS = 200;

/** The worked-example cooling result vector (Lounge 5x4x2.4, 35C->22C). */
const VALID_RESULT: CoolingResult = {
  volume: 48,
  deltaTCooling: 13,
  watts: 1024,
  kw: 1.024,
  btu: 3494,
  recommendation: { nominalKw: 2.0, exceedsLargest: false },
};

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
});

function slotText(key: 'watts' | 'kw' | 'btu' | 'unit'): string {
  return container.querySelector(`#cooling-result-${key}-value`)?.textContent ?? '';
}

// ---------------------------------------------------------------------------
// Property 15
// ---------------------------------------------------------------------------

describe('Property 15: results rendering shows every value with its unit label', () => {
  // Feature: air-conditioning-calculator, Property 15: Results rendering shows every value with its unit label
  it('renders watts (W), kW, BTU/hr and the recommended unit concurrently for any result', () => {
    const resultArb: fc.Arbitrary<CoolingResult> = fc
      .integer({ min: 0, max: 100000 })
      .chain((watts) =>
        fc.constantFrom(2.0, 2.5, 3.5, 5.0, 7.1, 8.0, 10.0).map((nominalKw) => ({
          volume: 48,
          deltaTCooling: 13,
          watts,
          kw: watts / 1000,
          btu: Math.round(watts * 3.412142),
          recommendation: { nominalKw, exceedsLargest: watts > 10000 },
        })),
      );

    fc.assert(
      fc.property(resultArb, (result) => {
        // Fresh container each run so we assert a clean render.
        const c = document.createElement('div');
        renderCoolingResults(c, result);

        // Every numeric value is present.
        expect(c.querySelector('#cooling-result-watts-value')?.textContent).toBe(
          String(result.watts),
        );
        expect(c.querySelector('#cooling-result-btu-value')?.textContent).toBe(
          String(result.btu),
        );
        expect(c.querySelector('#cooling-result-kw-value')?.textContent).toBe(
          String(Number(result.kw.toFixed(3))),
        );
        expect(c.querySelector('#cooling-result-unit-value')?.textContent).toBe(
          String(Number(result.recommendation.nominalKw.toFixed(3))),
        );

        // Every unit label is present concurrently.
        const units = Array.from(c.querySelectorAll('.result-unit')).map(
          (el) => el.textContent,
        );
        expect(units).toContain('W');
        expect(units).toContain('kW');
        expect(units).toContain('BTU/hr');
        expect(units.some((u) => u?.includes('kW'))).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ---------------------------------------------------------------------------
// Example / DOM tests
// ---------------------------------------------------------------------------

describe('renderCoolingResults — valid result (Requirement 7.4)', () => {
  it('renders all four values with their unit labels', () => {
    renderCoolingResults(container, VALID_RESULT);
    expect(slotText('watts')).toBe('1024');
    expect(slotText('kw')).toBe('1.024');
    expect(slotText('btu')).toBe('3494');
    expect(slotText('unit')).toBe('2');

    const text = container.textContent ?? '';
    expect(text).toContain('W');
    expect(text).toContain('kW');
    expect(text).toContain('BTU/hr');
  });
});

describe('renderCoolingResults — initial / null state (Requirements 7.6, 7.7)', () => {
  it('shows the placeholder in place of every value when result is null', () => {
    renderCoolingResults(container, null);
    expect(slotText('watts')).toBe(PLACEHOLDER);
    expect(slotText('kw')).toBe(PLACEHOLDER);
    expect(slotText('btu')).toBe(PLACEHOLDER);
    expect(slotText('unit')).toBe(PLACEHOLDER);
  });

  it('replaces previously displayed values with placeholders when inputs become invalid', () => {
    renderCoolingResults(container, VALID_RESULT);
    expect(slotText('watts')).toBe('1024');

    renderCoolingResults(container, null);
    expect(slotText('watts')).toBe(PLACEHOLDER);
    expect(slotText('kw')).toBe(PLACEHOLDER);
    expect(slotText('btu')).toBe(PLACEHOLDER);
    expect(slotText('unit')).toBe(PLACEHOLDER);
  });
});

describe('renderCoolingResults — in-place updates (Requirement 7.5)', () => {
  it('re-rendering updates every value in place using the same DOM nodes', () => {
    renderCoolingResults(container, VALID_RESULT);
    const wattsNode = container.querySelector('#cooling-result-watts-value');

    const updated: CoolingResult = {
      volume: 60,
      deltaTCooling: 13,
      watts: 2000,
      kw: 2.0,
      btu: 6824,
      recommendation: { nominalKw: 2.0, exceedsLargest: false },
    };
    renderCoolingResults(container, updated);

    expect(slotText('watts')).toBe('2000');
    expect(slotText('kw')).toBe('2');
    expect(slotText('btu')).toBe('6824');
    // Same node instance -> in-place update, not a rebuild.
    expect(container.querySelector('#cooling-result-watts-value')).toBe(wattsNode);
  });
});

describe('renderCoolingResults — exceeds a single standard unit (Requirement 6.3)', () => {
  it('shows a note when the recommendation exceeds the largest standard unit', () => {
    const bigResult: CoolingResult = {
      volume: 200,
      deltaTCooling: 20,
      watts: 15000,
      kw: 15,
      btu: 51182,
      recommendation: { nominalKw: 10.0, exceedsLargest: true },
    };
    renderCoolingResults(container, bigResult);
    const note = container.querySelector('#cooling-result-note') as HTMLElement | null;
    expect(note).not.toBeNull();
    expect(note?.hidden).toBe(false);
    expect((note?.textContent ?? '').toLowerCase()).toContain('exceeds a single standard unit');
  });

  it('hides the note for a result within a single standard unit', () => {
    renderCoolingResults(container, VALID_RESULT);
    const note = container.querySelector('#cooling-result-note') as HTMLElement | null;
    expect(note?.hidden).toBe(true);
  });
});

describe('renderCoolingResults — unavailable option (Requirement 8.6)', () => {
  it('surfaces a "result unavailable" message and falls back to placeholders', () => {
    renderCoolingResults(container, VALID_RESULT, { unavailable: true });
    expect(slotText('watts')).toBe(PLACEHOLDER);
    expect(slotText('kw')).toBe(PLACEHOLDER);
    expect(slotText('btu')).toBe(PLACEHOLDER);
    expect(slotText('unit')).toBe(PLACEHOLDER);

    const message = container.querySelector('#cooling-result-message') as HTMLElement | null;
    expect(message?.hidden).toBe(false);
    expect((message?.textContent ?? '').toLowerCase()).toContain('unavailable');
  });

  it('clears the unavailable message once a valid result is rendered again', () => {
    renderCoolingResults(container, VALID_RESULT, { unavailable: true });
    renderCoolingResults(container, VALID_RESULT);
    const message = container.querySelector('#cooling-result-message') as HTMLElement | null;
    expect(message?.hidden).toBe(true);
    expect(slotText('watts')).toBe('1024');
  });
});
