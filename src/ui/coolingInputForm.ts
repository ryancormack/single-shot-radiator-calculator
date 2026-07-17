/**
 * Input_Form component for the Air Conditioning (cooling) Calculator.
 *
 * This DOM-facing module renders the cooling form controls (Requirements 1, 2,
 * 3, 4), seeds documented defaults onto unchanged controls (Requirements 2.5,
 * 3.3, 3.4, 4.4-4.6), emits the current raw inputs on every change
 * (Requirements 7.5, 8.4), and renders per-field validation messages next to
 * the offending control (Requirements 1.3, 1.5).
 *
 * Unlike the heating form, the cooling form has no Room_Type -> temperature
 * coupling: the outdoor and desired indoor temperatures are independent fields.
 *
 * All updates happen in place; nothing here triggers navigation or a page
 * reload (Requirement 8.4). A per-container instance cache (WeakMap) means
 * repeated `renderCoolingForm` calls update the existing DOM rather than
 * rebuilding it, preserving focus and caret position.
 */

import type {
  InsulationLevel,
  RawCoolingInputs,
  RoomType,
  SunExposure,
  WindowType,
} from '../core/coolingTypes';
import type { CoolingAppState } from '../state/coolingStore';
import {
  DEFAULT_APPLIANCE_HEAT_GAIN,
  DEFAULT_DESIRED_INDOOR_TEMP_C,
  DEFAULT_OCCUPANT_COUNT,
  DEFAULT_OUTDOOR_SUMMER_TEMP_C,
  DEFAULT_SUN_EXPOSURE,
} from '../core/coolingConfig';
import {
  DEFAULT_EXTERNAL_WALLS,
  DEFAULT_INSULATION,
  DEFAULT_ROOM_TYPE,
  DEFAULT_WINDOW_TYPE,
} from '../core/config';

/** Room_Type options, in display order (Requirement 2.1). */
const ROOM_TYPES: readonly RoomType[] = [
  'Lounge',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Hallway',
];

/** Insulation_Level options, in display order (Requirement 2.2). */
const INSULATION_LEVELS: readonly InsulationLevel[] = ['Poor', 'Average', 'Good'];

/** Window_Type options, in display order (Requirement 2.4). */
const WINDOW_TYPES: readonly WindowType[] = [
  'Single_Glazed',
  'Double_Glazed',
  'Triple_Glazed',
];

/** Sun_Exposure options, in display order (Requirement 4.1). */
const SUN_EXPOSURES: readonly SunExposure[] = ['Shaded', 'Average', 'Sunny'];

/** References to the built form controls and their error message elements. */
interface FormRefs {
  length: HTMLInputElement;
  width: HTMLInputElement;
  height: HTMLInputElement;
  outdoorSummerTemp: HTMLInputElement;
  desiredIndoorTemp: HTMLInputElement;
  roomType: HTMLSelectElement;
  insulation: HTMLSelectElement;
  windowType: HTMLSelectElement;
  externalWalls: HTMLInputElement;
  sunExposure: HTMLSelectElement;
  occupantCount: HTMLInputElement;
  applianceHeatGain: HTMLInputElement;
  errors: Record<keyof RawCoolingInputs, HTMLElement>;
}

/** Per-container form instance. */
interface FormInstance {
  refs: FormRefs;
}

/**
 * Tracks the built form per container so repeated `renderCoolingForm` calls
 * update the existing DOM in place instead of rebuilding it.
 */
const instances = new WeakMap<HTMLElement, FormInstance>();

/** Create a labelled numeric input field with an associated error element. */
function createNumberField(
  parent: HTMLElement,
  id: string,
  labelText: string,
  opts: { min?: number; max?: number; step?: string },
): { input: HTMLInputElement; error: HTMLElement } {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const label = document.createElement('label');
  label.setAttribute('for', id);
  label.textContent = labelText;

  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.name = id;
  input.inputMode = 'decimal';
  if (opts.min !== undefined) input.min = String(opts.min);
  if (opts.max !== undefined) input.max = String(opts.max);
  if (opts.step !== undefined) input.step = opts.step;

  const error = document.createElement('span');
  error.className = 'field-error';
  error.id = `${id}-error`;
  error.setAttribute('role', 'alert');

  wrapper.append(label, input, error);
  parent.append(wrapper);
  return { input, error };
}

/** Create a labelled select control (from an option set) with an error element. */
function createSelectField(
  parent: HTMLElement,
  id: string,
  labelText: string,
  options: readonly string[],
): { select: HTMLSelectElement; error: HTMLElement } {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const label = document.createElement('label');
  label.setAttribute('for', id);
  label.textContent = labelText;

  const select = document.createElement('select');
  select.id = id;
  select.name = id;
  for (const value of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    select.append(option);
  }

  const error = document.createElement('span');
  error.className = 'field-error';
  error.id = `${id}-error`;
  error.setAttribute('role', 'alert');

  wrapper.append(label, select, error);
  parent.append(wrapper);
  return { select, error };
}

/** Read the current raw (string) inputs from the live form controls. */
function readRawInputs(refs: FormRefs): RawCoolingInputs {
  return {
    length: refs.length.value,
    width: refs.width.value,
    height: refs.height.value,
    outdoorSummerTemp: refs.outdoorSummerTemp.value,
    desiredIndoorTemp: refs.desiredIndoorTemp.value,
    roomType: refs.roomType.value,
    insulation: refs.insulation.value,
    windowType: refs.windowType.value,
    externalWalls: refs.externalWalls.value,
    sunExposure: refs.sunExposure.value,
    occupantCount: refs.occupantCount.value,
    applianceHeatGain: refs.applianceHeatGain.value,
  };
}

/**
 * Build the form DOM once for a container, wire up input/change events, and
 * seed the controls with the documented defaults / current state values.
 */
function buildForm(
  container: HTMLElement,
  state: CoolingAppState,
  onChange: (raw: RawCoolingInputs) => void,
): FormInstance {
  container.replaceChildren();

  const form = document.createElement('form');
  form.className = 'input-form';
  form.noValidate = true;
  // Never navigate/reload on submit (Requirement 8.4).
  form.addEventListener('submit', (event) => event.preventDefault());

  const length = createNumberField(form, 'cooling-length', 'Length (metres)', {
    min: 0,
    max: 30,
    step: '0.01',
  });
  const width = createNumberField(form, 'cooling-width', 'Width (metres)', {
    min: 0,
    max: 30,
    step: '0.01',
  });
  const height = createNumberField(form, 'cooling-height', 'Height (metres)', {
    min: 0,
    max: 30,
    step: '0.01',
  });
  const outdoorSummerTemp = createNumberField(
    form,
    'cooling-outdoorSummerTemp',
    'Outdoor summer temperature (°C)',
    { min: 20, max: 50, step: '0.1' },
  );
  const desiredIndoorTemp = createNumberField(
    form,
    'cooling-desiredIndoorTemp',
    'Desired indoor temperature (°C)',
    { min: 16, max: 30, step: '0.1' },
  );
  const roomType = createSelectField(form, 'cooling-roomType', 'Room type', ROOM_TYPES);
  const insulation = createSelectField(
    form,
    'cooling-insulation',
    'Insulation level',
    INSULATION_LEVELS,
  );
  const windowType = createSelectField(
    form,
    'cooling-windowType',
    'Window type',
    WINDOW_TYPES,
  );
  const externalWalls = createNumberField(
    form,
    'cooling-externalWalls',
    'External wall count',
    { min: 0, max: 4, step: '1' },
  );
  const sunExposure = createSelectField(
    form,
    'cooling-sunExposure',
    'Sun exposure',
    SUN_EXPOSURES,
  );
  const occupantCount = createNumberField(
    form,
    'cooling-occupantCount',
    'Occupants',
    { min: 0, max: 20, step: '1' },
  );
  const applianceHeatGain = createNumberField(
    form,
    'cooling-applianceHeatGain',
    'Appliance heat gain (W)',
    { min: 0, max: 10000, step: '1' },
  );

  const refs: FormRefs = {
    length: length.input,
    width: width.input,
    height: height.input,
    outdoorSummerTemp: outdoorSummerTemp.input,
    desiredIndoorTemp: desiredIndoorTemp.input,
    roomType: roomType.select,
    insulation: insulation.select,
    windowType: windowType.select,
    externalWalls: externalWalls.input,
    sunExposure: sunExposure.select,
    occupantCount: occupantCount.input,
    applianceHeatGain: applianceHeatGain.input,
    errors: {
      length: length.error,
      width: width.error,
      height: height.error,
      outdoorSummerTemp: outdoorSummerTemp.error,
      desiredIndoorTemp: desiredIndoorTemp.error,
      roomType: roomType.error,
      insulation: insulation.error,
      windowType: windowType.error,
      externalWalls: externalWalls.error,
      sunExposure: sunExposure.error,
      occupantCount: occupantCount.error,
      applianceHeatGain: applianceHeatGain.error,
    },
  };

  const instance: FormInstance = { refs };

  // Seed defaults on unchanged controls (Requirements 2.5, 3.3, 3.4, 4.4-4.6)
  // and reflect any values already present in state.
  refs.roomType.value = state.inputs.roomType || DEFAULT_ROOM_TYPE;
  refs.insulation.value = state.inputs.insulation || DEFAULT_INSULATION;
  refs.windowType.value = state.inputs.windowType || DEFAULT_WINDOW_TYPE;
  refs.sunExposure.value = state.inputs.sunExposure || DEFAULT_SUN_EXPOSURE;
  refs.externalWalls.value =
    state.inputs.externalWalls || String(DEFAULT_EXTERNAL_WALLS);
  refs.occupantCount.value =
    state.inputs.occupantCount || String(DEFAULT_OCCUPANT_COUNT);
  refs.applianceHeatGain.value =
    state.inputs.applianceHeatGain || String(DEFAULT_APPLIANCE_HEAT_GAIN);
  refs.outdoorSummerTemp.value =
    state.inputs.outdoorSummerTemp || String(DEFAULT_OUTDOOR_SUMMER_TEMP_C);
  refs.desiredIndoorTemp.value =
    state.inputs.desiredIndoorTemp || String(DEFAULT_DESIRED_INDOOR_TEMP_C);
  refs.length.value = state.inputs.length;
  refs.width.value = state.inputs.width;
  refs.height.value = state.inputs.height;

  const emit = (): void => onChange(readRawInputs(refs));

  // Numeric fields emit on `input`; selection fields emit on `change`.
  for (const el of [
    refs.length,
    refs.width,
    refs.height,
    refs.outdoorSummerTemp,
    refs.desiredIndoorTemp,
    refs.externalWalls,
    refs.occupantCount,
    refs.applianceHeatGain,
  ]) {
    el.addEventListener('input', emit);
  }
  for (const el of [
    refs.roomType,
    refs.insulation,
    refs.windowType,
    refs.sunExposure,
  ]) {
    el.addEventListener('change', emit);
  }

  container.append(form);
  return instance;
}

/** Clear and re-render the per-field validation messages from state. */
function renderErrors(instance: FormInstance, state: CoolingAppState): void {
  const { errors } = instance.refs;
  const fields = Object.keys(errors) as (keyof RawCoolingInputs)[];

  // Reset all messages first so stale errors never linger.
  for (const field of fields) {
    errors[field].textContent = '';
  }

  for (const error of state.errors) {
    const target = errors[error.field as keyof RawCoolingInputs];
    if (target) {
      target.textContent = error.reason;
    }
  }
}

/**
 * Render (or update) the cooling Input_Form inside `container`.
 *
 * On the first call for a given container the form DOM is built and events are
 * wired to invoke `onChange` with the current {@link RawCoolingInputs}. On
 * subsequent calls the existing controls are updated in place from `state`
 * (values and per-field error messages) without rebuilding the DOM, so focus is
 * preserved.
 */
export function renderCoolingForm(
  container: HTMLElement,
  state: CoolingAppState,
  onChange: (raw: RawCoolingInputs) => void,
): void {
  let instance = instances.get(container);
  if (!instance) {
    instance = buildForm(container, state, onChange);
    instances.set(container, instance);
  }
  renderErrors(instance, state);
}
