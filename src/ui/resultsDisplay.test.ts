/**
 * Example / DOM tests for the Results Display component (`renderResults`).
 *
 * These tests exercise the component against a real jsdom-backed DOM element
 * and assert its observable behaviour rather than internal structure:
 *   - both the watts and BTU/hr values render concurrently with their unit
 *     labels (Requirement 5.3);
 *   - the initial / `null` state shows a placeholder for BOTH values
 *     (Requirement 5.5);
 *   - re-rendering a new valid result updates in place (Requirement 5.4);
 *   - transitioning from a valid result back to `null` restores placeholders
 *     for BOTH values (Requirement 5.6);
 *   - the `{ unavailable: true }` option surfaces a "result unavailable"
 *     message with placeholder values (Requirement 6.6 support).
 *
 * Task 8.5 is an example/DOM test task (not a property test), so it uses
 * concrete inputs and asserts against the rendered text content.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderResults } from './resultsDisplay';
import type { HeatResult } from '../core/types';

const PLACEHOLDER = '--';

/** The worked-example result vector from the design (Lounge 5x4x2.4, 21 C). */
const VALID_RESULT: HeatResult = { volume: 48, deltaT: 24, watts: 1521, btu: 5190 };

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
});

/** Read the current watts value slot text. */
function wattsText(): string {
  return container.querySelector('#result-watts-value')?.textContent ?? '';
}

/** Read the current BTU value slot text. */
function btuText(): string {
  return container.querySelector('#result-btu-value')?.textContent ?? '';
}

describe('renderResults - valid result (Requirement 5.3)', () => {
  it('renders both the watts and BTU/hr values concurrently', () => {
    renderResults(container, VALID_RESULT);

    // Both values are present at the same time.
    expect(wattsText()).toBe('1521');
    expect(btuText()).toBe('5190');
  });

  it('renders both unit labels "W" and "BTU/hr"', () => {
    renderResults(container, VALID_RESULT);

    const unitLabels = Array.from(
      container.querySelectorAll('.result-unit'),
    ).map((el) => el.textContent);

    expect(unitLabels).toContain('W');
    expect(unitLabels).toContain('BTU/hr');
  });

  it('shows the full rendered text containing both values and units together', () => {
    renderResults(container, VALID_RESULT);

    const text = container.textContent ?? '';
    expect(text).toContain('1521');
    expect(text).toContain('W');
    expect(text).toContain('5190');
    expect(text).toContain('BTU/hr');
  });
});

describe('renderResults - initial / null state (Requirement 5.5)', () => {
  it('shows the placeholder in place of BOTH values when result is null', () => {
    renderResults(container, null);

    expect(wattsText()).toBe(PLACEHOLDER);
    expect(btuText()).toBe(PLACEHOLDER);
  });

  it('does not render any numeric result value in the null state', () => {
    renderResults(container, null);

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\d/);
  });
});

describe('renderResults - in-place updates (Requirement 5.4)', () => {
  it('re-rendering a new valid result updates both values in place', () => {
    renderResults(container, VALID_RESULT);
    expect(wattsText()).toBe('1521');
    expect(btuText()).toBe('5190');

    const updated: HeatResult = { volume: 60, deltaT: 24, watts: 2000, btu: 6824 };
    renderResults(container, updated);

    expect(wattsText()).toBe('2000');
    expect(btuText()).toBe('6824');
  });

  it('reuses the same DOM nodes across re-renders (updates in place, no rebuild)', () => {
    renderResults(container, VALID_RESULT);
    const wattsNodeFirst = container.querySelector('#result-watts-value');
    const btuNodeFirst = container.querySelector('#result-btu-value');

    renderResults(container, { volume: 60, deltaT: 24, watts: 2000, btu: 6824 });
    const wattsNodeSecond = container.querySelector('#result-watts-value');
    const btuNodeSecond = container.querySelector('#result-btu-value');

    // Same element instances -> in-place update, not a rebuild.
    expect(wattsNodeSecond).toBe(wattsNodeFirst);
    expect(btuNodeSecond).toBe(btuNodeFirst);
  });
});

describe('renderResults - transition to invalid/null (Requirement 5.6)', () => {
  it('replaces both previously displayed values with placeholders when inputs become invalid', () => {
    // First a valid result is shown.
    renderResults(container, VALID_RESULT);
    expect(wattsText()).toBe('1521');
    expect(btuText()).toBe('5190');

    // Then inputs become invalid -> render null into the SAME container.
    renderResults(container, null);

    expect(wattsText()).toBe(PLACEHOLDER);
    expect(btuText()).toBe(PLACEHOLDER);
  });
});

describe('renderResults - unavailable option (Requirement 6.6 support)', () => {
  it('surfaces a "result unavailable" message and falls back to placeholders', () => {
    renderResults(container, VALID_RESULT, { unavailable: true });

    // Values fall back to the placeholder.
    expect(wattsText()).toBe(PLACEHOLDER);
    expect(btuText()).toBe(PLACEHOLDER);

    // A visible "unavailable" message is present.
    const message = container.querySelector('#result-message') as HTMLElement | null;
    expect(message).not.toBeNull();
    expect(message?.hidden).toBe(false);
    expect((message?.textContent ?? '').toLowerCase()).toContain('unavailable');
  });

  it('clears the unavailable message once a valid result is rendered again', () => {
    renderResults(container, VALID_RESULT, { unavailable: true });
    renderResults(container, VALID_RESULT);

    const message = container.querySelector('#result-message') as HTMLElement | null;
    expect(message?.hidden).toBe(true);
    expect(wattsText()).toBe('1521');
    expect(btuText()).toBe('5190');
  });
});
