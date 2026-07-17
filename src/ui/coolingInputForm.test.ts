/**
 * Example / DOM tests for the cooling Input_Form component (`renderCoolingForm`).
 *
 * Verifies every control is rendered with its labels/options/range attributes
 * (Requirements 1.1, 2.1-2.4, 3.1, 3.2, 4.1-4.3), defaults are seeded onto
 * unchanged controls (Requirements 2.5, 3.3, 3.4, 4.4-4.6), and change events
 * emit the current raw inputs without a page reload (Requirement 8.4).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderCoolingForm } from './coolingInputForm';
import { createCoolingStore } from '../state/coolingStore';
import type { RawCoolingInputs } from '../core/coolingTypes';

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
});

function renderWithSpy(): { emitted: RawCoolingInputs[]; container: HTMLElement } {
  const state = createCoolingStore().getState();
  const emitted: RawCoolingInputs[] = [];
  renderCoolingForm(container, state, (raw) => emitted.push(raw));
  return { emitted, container };
}

describe('renderCoolingForm — control presence (Requirements 1.1, 2.1-2.4, 3.1, 3.2, 4.1-4.3)', () => {
  it('renders all twelve controls', () => {
    renderWithSpy();
    const ids = [
      'cooling-length',
      'cooling-width',
      'cooling-height',
      'cooling-outdoorSummerTemp',
      'cooling-desiredIndoorTemp',
      'cooling-roomType',
      'cooling-insulation',
      'cooling-windowType',
      'cooling-externalWalls',
      'cooling-sunExposure',
      'cooling-occupantCount',
      'cooling-applianceHeatGain',
    ];
    for (const id of ids) {
      expect(container.querySelector(`#${id}`)).not.toBeNull();
    }
  });

  it('renders the sun exposure select with its three options', () => {
    renderWithSpy();
    const select = container.querySelector<HTMLSelectElement>('#cooling-sunExposure')!;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['Shaded', 'Average', 'Sunny']);
  });

  it('renders room type, insulation and window type selects with their options', () => {
    renderWithSpy();
    const roomType = container.querySelector<HTMLSelectElement>('#cooling-roomType')!;
    const insulation = container.querySelector<HTMLSelectElement>('#cooling-insulation')!;
    const windowType = container.querySelector<HTMLSelectElement>('#cooling-windowType')!;
    expect(Array.from(roomType.options).map((o) => o.value)).toEqual([
      'Lounge',
      'Bedroom',
      'Kitchen',
      'Bathroom',
      'Hallway',
    ]);
    expect(Array.from(insulation.options).map((o) => o.value)).toEqual([
      'Poor',
      'Average',
      'Good',
    ]);
    expect(Array.from(windowType.options).map((o) => o.value)).toEqual([
      'Single_Glazed',
      'Double_Glazed',
      'Triple_Glazed',
    ]);
  });

  it('sets numeric range attributes on the temperature and count fields', () => {
    renderWithSpy();
    const outdoor = container.querySelector<HTMLInputElement>('#cooling-outdoorSummerTemp')!;
    const indoor = container.querySelector<HTMLInputElement>('#cooling-desiredIndoorTemp')!;
    const occupants = container.querySelector<HTMLInputElement>('#cooling-occupantCount')!;
    const appliance = container.querySelector<HTMLInputElement>('#cooling-applianceHeatGain')!;
    expect(outdoor.min).toBe('20');
    expect(outdoor.max).toBe('50');
    expect(indoor.min).toBe('16');
    expect(indoor.max).toBe('30');
    expect(occupants.min).toBe('0');
    expect(occupants.max).toBe('20');
    expect(appliance.min).toBe('0');
    expect(appliance.max).toBe('10000');
  });

  it('labels the appliance field with its watt unit', () => {
    renderWithSpy();
    const label = container.querySelector('label[for="cooling-applianceHeatGain"]');
    expect(label?.textContent).toContain('W');
  });
});

describe('renderCoolingForm — documented defaults (Requirements 2.5, 3.3, 3.4, 4.4-4.6)', () => {
  it('seeds the documented default values on unchanged controls', () => {
    renderWithSpy();
    expect(container.querySelector<HTMLSelectElement>('#cooling-roomType')!.value).toBe('Lounge');
    expect(container.querySelector<HTMLSelectElement>('#cooling-insulation')!.value).toBe('Average');
    expect(container.querySelector<HTMLSelectElement>('#cooling-windowType')!.value).toBe('Double_Glazed');
    expect(container.querySelector<HTMLSelectElement>('#cooling-sunExposure')!.value).toBe('Average');
    expect(container.querySelector<HTMLInputElement>('#cooling-outdoorSummerTemp')!.value).toBe('35');
    expect(container.querySelector<HTMLInputElement>('#cooling-desiredIndoorTemp')!.value).toBe('22');
    expect(container.querySelector<HTMLInputElement>('#cooling-externalWalls')!.value).toBe('1');
    expect(container.querySelector<HTMLInputElement>('#cooling-occupantCount')!.value).toBe('2');
    expect(container.querySelector<HTMLInputElement>('#cooling-applianceHeatGain')!.value).toBe('0');
  });
});

describe('renderCoolingForm — change emission (Requirement 8.4)', () => {
  it('emits the current raw inputs when a numeric field changes', () => {
    const { emitted, container: c } = renderWithSpy();
    const length = c.querySelector<HTMLInputElement>('#cooling-length')!;
    length.value = '5';
    length.dispatchEvent(new Event('input', { bubbles: true }));
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[emitted.length - 1].length).toBe('5');
  });

  it('emits the current raw inputs when a select changes', () => {
    const { emitted, container: c } = renderWithSpy();
    const sun = c.querySelector<HTMLSelectElement>('#cooling-sunExposure')!;
    sun.value = 'Sunny';
    sun.dispatchEvent(new Event('change', { bubbles: true }));
    expect(emitted[emitted.length - 1].sunExposure).toBe('Sunny');
  });

  it('renders a per-field validation message from state next to the offending control', () => {
    const state = createCoolingStore({
      errors: [{ field: 'occupantCount', reason: 'Occupant count must be a whole number from 0 to 20.' }],
    }).getState();
    renderCoolingForm(container, state, () => {});
    const err = container.querySelector('#cooling-occupantCount-error');
    expect(err?.textContent).toContain('whole number');
  });
});
