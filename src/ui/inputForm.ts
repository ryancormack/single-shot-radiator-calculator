/**
 * Input_Form component for the Radiator Heat Calculator.
 *
 * This is the only-ish DOM-facing module for input collection. It renders the
 * form controls (Requirements 1, 2, 3), applies documented defaults to
 * unchanged selection controls (Requirements 2.5, 3.2), emits the current raw
 * inputs on every change (Requirements 5.4, 6.4), and renders per-field
 * validation messages next to the offending control (Requirements 1.3, 1.5).
 *
 * It also implements the Room_Type -> desired-temperature default behaviour:
 * selecting a Room_Type populates the desired temperature with that type's
 * documented default *only* while the user has not manually edited the field
 * (Requirement 3.2); once the user edits the temperature, a later Room_Type
 * change never overwrites it (Requirement 3.3). A per-form "manually edited"
 * flag tracks this.
 *
 * All updates happen in place; nothing here triggers navigation or a page
 * reload (Requirement 6.4).
 */

import type {
  InsulationLevel,
  RawInputs,
  RoomType,
  WindowType,
} from '../core/types';
import type { AppState } from '../state/store';
import {
  DEFAULT_EXTERNAL_WALLS,
  DEFAULT_INSULATION,
  DEFAULT_ROOM_TYPE,
  DEFAULT_WINDOW_TYPE,
  ROOM_TYPE_DEFAULT_TEMP_C,
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

/**
 * Resolve the desired-temperature default to apply when a Room_Type is selected.
 *
 * Returns `{ desiredTemp }` with the documented default temperature for the
 * given Room_Type when the desired-temperature field has NOT been manually
 * edited by the user (Requirement 3.2). When the field HAS been manually edited
 * it returns `{}` (no override), so a later Room_Type change never overwrites a
 * user-entered temperature (Requirement 3.3).
 */
export function applyRoomTypeDefaults(
  roomType: RoomType,
  tempManuallyEdited: boolean,
): { desiredTemp?: number } {
  if (tempManuallyEdited) {
    return {};
  }
  return { desiredTemp: ROOM_TYPE_DEFAULT_TEMP_C[roomType] };
}

/** References to the built form controls and their error message elements. */
interface FormRefs {
  length: HTMLInputElement;
  width: HTMLInputElement;
  height: HTMLInputElement;
  desiredTemp: HTMLInputElement;
  roomType: HTMLSelectElement;
  insulation: HTMLSelectElement;
  windowType: HTMLSelectElement;
  externalWalls: HTMLInputElement;
  errors: Record<keyof RawInputs, HTMLElement>;
}

/** Per-container form instance: DOM refs plus the manual-edit flag. */
interface FormInstance {
  refs: FormRefs;
  /** True once the user has manually edited the desired-temperature field. */
  tempManuallyEdited: boolean;
}

/**
 * Tracks the built form per container so repeated `renderForm` calls (triggered
 * by state changes) update the existing DOM in place instead of rebuilding it,
 * preserving focus, caret position, and the manual-edit flag.
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
function readRawInputs(refs: FormRefs): RawInputs {
  return {
    length: refs.length.value,
    width: refs.width.value,
    height: refs.height.value,
    desiredTemp: refs.desiredTemp.value,
    roomType: refs.roomType.value,
    insulation: refs.insulation.value,
    windowType: refs.windowType.value,
    externalWalls: refs.externalWalls.value,
  };
}

/**
 * Build the form DOM once for a container, wire up input/change events, and
 * seed the controls with the documented defaults / current state values.
 */
function buildForm(
  container: HTMLElement,
  state: AppState,
  onChange: (raw: RawInputs) => void,
): FormInstance {
  container.replaceChildren();

  const form = document.createElement('form');
  form.className = 'input-form';
  form.noValidate = true;
  // Never navigate/reload on submit (Requirement 6.4).
  form.addEventListener('submit', (event) => event.preventDefault());

  const length = createNumberField(form, 'length', 'Length (metres)', {
    min: 0,
    max: 30,
    step: '0.01',
  });
  const width = createNumberField(form, 'width', 'Width (metres)', {
    min: 0,
    max: 30,
    step: '0.01',
  });
  const height = createNumberField(form, 'height', 'Height (metres)', {
    min: 0,
    max: 30,
    step: '0.01',
  });
  const desiredTemp = createNumberField(
    form,
    'desiredTemp',
    'Desired indoor temperature (°C)',
    { min: 10, max: 30, step: '0.1' },
  );
  const roomType = createSelectField(form, 'roomType', 'Room type', ROOM_TYPES);
  const insulation = createSelectField(
    form,
    'insulation',
    'Insulation level',
    INSULATION_LEVELS,
  );
  const windowType = createSelectField(
    form,
    'windowType',
    'Window type',
    WINDOW_TYPES,
  );
  const externalWalls = createNumberField(
    form,
    'externalWalls',
    'External wall count',
    { min: 0, max: 4, step: '1' },
  );

  const refs: FormRefs = {
    length: length.input,
    width: width.input,
    height: height.input,
    desiredTemp: desiredTemp.input,
    roomType: roomType.select,
    insulation: insulation.select,
    windowType: windowType.select,
    externalWalls: externalWalls.input,
    errors: {
      length: length.error,
      width: width.error,
      height: height.error,
      desiredTemp: desiredTemp.error,
      roomType: roomType.error,
      insulation: insulation.error,
      windowType: windowType.error,
      externalWalls: externalWalls.error,
    },
  };

  const instance: FormInstance = { refs, tempManuallyEdited: false };

  // Seed defaults on unchanged selection/numeric controls (Requirements 2.5, 3.2)
  // and reflect any values already present in state.
  refs.roomType.value = state.inputs.roomType || DEFAULT_ROOM_TYPE;
  refs.insulation.value = state.inputs.insulation || DEFAULT_INSULATION;
  refs.windowType.value = state.inputs.windowType || DEFAULT_WINDOW_TYPE;
  refs.externalWalls.value =
    state.inputs.externalWalls || String(DEFAULT_EXTERNAL_WALLS);
  refs.length.value = state.inputs.length;
  refs.width.value = state.inputs.width;
  refs.height.value = state.inputs.height;
  refs.desiredTemp.value =
    state.inputs.desiredTemp ||
    String(ROOM_TYPE_DEFAULT_TEMP_C[refs.roomType.value as RoomType]);

  // Plain numeric/selection fields simply re-emit the current raw inputs.
  const emit = (): void => onChange(readRawInputs(refs));

  for (const el of [refs.length, refs.width, refs.height, refs.externalWalls]) {
    el.addEventListener('input', emit);
  }
  for (const el of [refs.insulation, refs.windowType]) {
    el.addEventListener('change', emit);
  }

  // Manually editing the temperature latches the manual-edit flag so subsequent
  // Room_Type changes never overwrite it (Requirement 3.3).
  refs.desiredTemp.addEventListener('input', () => {
    instance.tempManuallyEdited = true;
    emit();
  });

  // Selecting a Room_Type applies the documented default temperature only while
  // the field has not been manually edited (Requirement 3.2).
  refs.roomType.addEventListener('change', () => {
    const roomTypeValue = refs.roomType.value as RoomType;
    const applied = applyRoomTypeDefaults(
      roomTypeValue,
      instance.tempManuallyEdited,
    );
    if (applied.desiredTemp !== undefined) {
      refs.desiredTemp.value = String(applied.desiredTemp);
    }
    emit();
  });

  container.append(form);
  return instance;
}

/** Clear and re-render the per-field validation messages from state. */
function renderErrors(instance: FormInstance, state: AppState): void {
  const { errors } = instance.refs;
  const fields = Object.keys(errors) as (keyof RawInputs)[];

  // Reset all messages first so stale errors never linger.
  for (const field of fields) {
    errors[field].textContent = '';
  }

  for (const error of state.errors) {
    const target = errors[error.field as keyof RawInputs];
    if (target) {
      target.textContent = error.reason;
    }
  }
}

/**
 * Render (or update) the Input_Form inside `container`.
 *
 * On the first call for a given container the form DOM is built and events are
 * wired to invoke `onChange` with the current {@link RawInputs}. On subsequent
 * calls the existing controls are updated in place from `state` (values and
 * per-field error messages) without rebuilding the DOM, so focus and the
 * manual-edit flag are preserved.
 */
export function renderForm(
  container: HTMLElement,
  state: AppState,
  onChange: (raw: RawInputs) => void,
): void {
  let instance = instances.get(container);
  if (!instance) {
    instance = buildForm(container, state, onChange);
    instances.set(container, instance);
  }
  renderErrors(instance, state);
}
