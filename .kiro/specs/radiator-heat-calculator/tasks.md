# Implementation Plan: Radiator Heat Calculator

## Overview

This plan builds the Radiator Heat Calculator SPA incrementally, following the design's layered
architecture. It prioritizes the high-value, pure calculation and validation core (which carries the
14 correctness properties) with test-driven development, then layers state, UI, composition, and
GitHub Pages deployment on top. Each task builds on the previous ones and ends by wiring everything
together, leaving no orphaned code.

Language/stack (per design): TypeScript + Vite, tested with Vitest and `fast-check`.

## Tasks

- [x] 1. Scaffold the Vite + TypeScript SPA project
  - Create `package.json` with scripts (`dev`, `build`, `preview`, `test`) and dev dependencies: `vite`, `typescript`, `vitest`, `fast-check`, `jsdom`.
  - Create `tsconfig.json` (strict mode, ES module target, DOM lib).
  - Create `vite.config.ts` with `base: '/single-shot-radiator-calculator/'` for the GitHub Pages project subpath, and Vitest config (`environment: 'jsdom'`, globals).
  - Create the single `index.html` entry point that loads `src/main.ts` as a module and provides mount containers for the form and results.
  - Create a placeholder `src/main.ts` so the project builds.
  - _Requirements: 6.2, 6.3, 7.1, 7.2_

- [x] 2. Define domain types and configuration constants
  - [x] 2.1 Create shared types and the config constants module
    - Create `src/core/types.ts` with `RoomType`, `InsulationLevel`, `WindowType`, `RawInputs`, `CalculatorInputs`, `HeatResult`, `FieldError`, `ValidationResult`.
    - Create `src/core/config.ts` with `OUTDOOR_DESIGN_TEMP_C`, `BASE_COEFFICIENT`, `BTU_CONVERSION_FACTOR`, `INSULATION_MULTIPLIER`, `WINDOW_MULTIPLIER`, `WALL_MULTIPLIER`, `ROOM_TYPE_MULTIPLIER`, `ROOM_TYPE_DEFAULT_TEMP_C`, and the documented defaults (`DEFAULT_ROOM_TYPE`, `DEFAULT_INSULATION`, `DEFAULT_WINDOW_TYPE`, `DEFAULT_EXTERNAL_WALLS`).
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 3.2, 4.1_

  - [x]* 2.2 Write unit test that all documented defaults are members of their option sets
    - Assert each default value (room type, insulation, window type, external walls, per-room-type temperatures) belongs to its defined option set/range.
    - _Requirements: 2.5_

- [x] 3. Implement the pure calculation core
  - [x] 3.1 Implement `computeRoomVolume` and `computeDeltaT`
    - Create `src/core/calculator.ts` with `computeRoomVolume(length, width, height)` returning the product rounded to 2 decimal places, and `computeDeltaT(desiredTempC)` returning `desiredTempC - OUTDOOR_DESIGN_TEMP_C`.
    - Add internal `roundHalfUp` and `clamp` helpers (no DOM, no I/O).
    - _Requirements: 1.4, 3.6_

  - [x]* 3.2 Write property test for room volume
    - **Property 1: Room volume is the rounded product of dimensions**
    - Tag: `// Feature: radiator-heat-calculator, Property 1: Room volume is the rounded product of dimensions`
    - Use `fast-check` with dimensions in `(0, 30]` at <= 2 dp; min 100 runs.
    - **Validates: Requirements 1.4**

  - [x]* 3.3 Write property test for Delta_T
    - **Property 2: Delta_T is desired temperature minus the outdoor design constant**
    - Tag: `// Feature: radiator-heat-calculator, Property 2: Delta_T is desired temperature minus the outdoor design constant`
    - Temperatures in `[10.0, 30.0]` at <= 1 dp; min 100 runs.
    - **Validates: Requirements 3.6**

  - [x] 3.4 Implement `computeWatts`, `wattsToBtu`, and `computeHeatOutput`
    - Add `computeWatts` applying the documented formula (volume x deltaT x BASE_COEFFICIENT x insulation x window x wall x room-type multipliers), rounded half-up and clamped to `[0, 100000]`.
    - Add `wattsToBtu(watts)` = `roundHalfUp(watts * BTU_CONVERSION_FACTOR)`.
    - Add `computeHeatOutput(inputs)` wrapper returning `{ volume, deltaT, watts, btu }`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2_

  - [x]* 3.5 Write property test for bounded, whole-watt output
    - **Property 3: Heat output is bounded and rounded to a whole watt**
    - Tag: `// Feature: radiator-heat-calculator, Property 3: Heat output is bounded and rounded to a whole watt`
    - **Validates: Requirements 4.1, 5.1**

  - [x]* 3.6 Write property test for BTU/hr conversion
    - **Property 4: BTU/hr is the proportional, half-up-rounded conversion of watts**
    - Tag: `// Feature: radiator-heat-calculator, Property 4: BTU/hr is the proportional, half-up-rounded conversion of watts`
    - **Validates: Requirements 4.2, 5.2**

  - [x]* 3.7 Write property test for determinism
    - **Property 5: Calculation is deterministic**
    - Tag: `// Feature: radiator-heat-calculator, Property 5: Calculation is deterministic`
    - **Validates: Requirements 4.3**

  - [x]* 3.8 Write property test for Delta_T sign behavior
    - **Property 6: Delta_T sign determines output sign**
    - Tag: `// Feature: radiator-heat-calculator, Property 6: Delta_T sign determines output sign`
    - Cover `deltaT === 0` -> `0` watts and `deltaT > 0` -> `> 0` watts.
    - **Validates: Requirements 4.4, 4.5**

  - [x]* 3.9 Write property test for monotonicity in volume
    - **Property 7: Heat output is monotonic non-decreasing in volume**
    - Tag: `// Feature: radiator-heat-calculator, Property 7: Heat output is monotonic non-decreasing in volume`
    - **Validates: Requirements 4.6**

  - [x]* 3.10 Write unit test for the worked-example vector
    - Lounge 5 x 4 x 2.4 m, Average / Double_Glazed / 2 walls, 21 C -> 1521 W, 5190 BTU/hr (guards against constant drift).
    - _Requirements: 4.1, 4.2_

- [x] 4. Checkpoint - calculation core
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement the validation layer
  - [x] 5.1 Implement `validateInputs`
    - Create `src/validation/validate.ts` with a pure `validateInputs(raw: RawInputs): ValidationResult`.
    - Validate each field independently and collect all errors: dimensions parse to a number in `(0, 30]` with <= 2 dp; External_Wall_Count is a whole number in `[0, 4]`; desired temperature parses to a number in `[10.0, 30.0]` with <= 1 dp; reject empty/non-numeric values.
    - On success, return `valid: true` with a parsed `CalculatorInputs` payload; on any failure, return `valid: false`, the full `FieldError[]`, and no `inputs` payload. Messages name the field and reason.
    - _Requirements: 1.2, 1.3, 1.5, 2.3, 2.6, 3.4, 3.5, 4.7_

  - [x]* 5.2 Write property test for dimension validation
    - **Property 8: Dimension validation accepts exactly the values in range and precision**
    - Tag: `// Feature: radiator-heat-calculator, Property 8: Dimension validation accepts exactly the values in range and precision`
    - **Validates: Requirements 1.2, 1.3**

  - [x]* 5.3 Write property test for external wall count validation
    - **Property 9: External wall count validation accepts exactly whole numbers 0..4**
    - Tag: `// Feature: radiator-heat-calculator, Property 9: External wall count validation accepts exactly whole numbers 0..4`
    - **Validates: Requirements 2.3, 2.6**

  - [x]* 5.4 Write property test for desired temperature validation
    - **Property 10: Desired temperature validation accepts exactly the values in range and precision**
    - Tag: `// Feature: radiator-heat-calculator, Property 10: Desired temperature validation accepts exactly the values in range and precision`
    - **Validates: Requirements 3.4, 3.5**

  - [x]* 5.5 Write property test that all invalid fields are reported simultaneously
    - **Property 11: All invalid fields are reported simultaneously**
    - Tag: `// Feature: radiator-heat-calculator, Property 11: All invalid fields are reported simultaneously`
    - **Validates: Requirements 1.5**

  - [x]* 5.6 Write property test that any invalid input withholds the result
    - **Property 12: Any invalid input withholds the calculated result**
    - Tag: `// Feature: radiator-heat-calculator, Property 12: Any invalid input withholds the calculated result`
    - **Validates: Requirements 1.3, 2.6, 3.5, 4.7**

- [x] 6. Checkpoint - validation layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement state store and controller
  - [x] 7.1 Implement the AppState store
    - Create `src/state/store.ts` holding raw inputs, last valid result (or `null`), and current errors, with `getState()`, `setState(partial)`, and `subscribe(listener)` (in-memory, notifies subscribers).
    - _Requirements: 5.4, 6.4_

  - [x] 7.2 Implement the controller pipeline
    - Create `src/state/controller.ts` with `handleInputChange(raw)` orchestrating validate -> calculate -> render-via-state.
    - On validation failure, write errors to state, clear result to placeholder, retain raw inputs; on success, compute and store the result.
    - Wrap `computeHeatOutput` in try/catch so a calculation failure keeps the form and surfaces a "result unavailable" state (no reload).
    - _Requirements: 4.7, 4.8, 5.6, 6.5, 6.6_

  - [x]* 7.3 Write unit test for graceful calculation-failure handling
    - Inject a throwing calculation and assert the controller preserves state and sets an "unavailable" indication rather than throwing.
    - _Requirements: 6.6_

- [x] 8. Implement UI components
  - [x] 8.1 Implement the Input_Form component
    - Create `src/ui/inputForm.ts` with `renderForm(container, state, onChange)` rendering numeric fields (length, width, height in metres; desired temperature in C) and selection/numeric controls (Room_Type, Insulation_Level, Window_Type, External_Wall_Count 0-4), applying documented defaults to unchanged controls.
    - Implement `applyRoomTypeDefaults(roomType, tempManuallyEdited)` returning the default temp only when the field has not been manually edited, and track the manual-edit flag so a later Room_Type change never overwrites a user value.
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3_

  - [x]* 8.2 Write property test for room-type default temperature
    - **Property 13: Room-type default temperature is applied when not manually edited**
    - Tag: `// Feature: radiator-heat-calculator, Property 13: Room-type default temperature is applied when not manually edited`
    - **Validates: Requirements 3.2**

  - [x]* 8.3 Write property test that a manually edited temperature is never overwritten
    - **Property 14: A manually edited temperature is never overwritten by a Room_Type change**
    - Tag: `// Feature: radiator-heat-calculator, Property 14: A manually edited temperature is never overwritten by a Room_Type change`
    - **Validates: Requirements 3.3**

  - [x] 8.4 Implement the Results Display component
    - Create `src/ui/resultsDisplay.ts` with `renderResults(container, result)` showing watts labelled `W` and BTU/hr labelled `BTU/hr` concurrently, and a placeholder (`--`) for each when `result` is `null` or inputs are invalid.
    - _Requirements: 5.3, 5.5, 5.6_

  - [x]* 8.5 Write example/DOM tests for the Results Display
    - Assert both values render concurrently with correct unit labels; initial/`null` state shows placeholders; transitioning to invalid restores placeholders.
    - _Requirements: 5.3, 5.4, 5.5, 5.6_

- [x] 9. Compose and wire the application
  - [x] 9.1 Implement the composition root
    - Replace the placeholder `src/main.ts` so it mounts the Input_Form and Results Display, instantiates the store and controller, subscribes the UI to state changes, and re-renders in place on every input change with no network calls or navigation.
    - _Requirements: 6.1, 6.2, 6.4, 6.6_

  - [x]* 9.2 Write integration/example tests for the full pipeline (jsdom)
    - Drive input changes end to end: valid inputs show computed values; changing an input recomputes in place; invalid input restores placeholders while retaining entered values, without navigation/reload.
    - _Requirements: 5.4, 6.4, 6.5_

- [x] 10. Checkpoint - full application wired
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Configure GitHub Pages deployment
  - [x] 11.1 Create the GitHub Actions deployment workflow
    - Create `.github/workflows/deploy.yml` triggered on push to the default branch with `pages: write` and `id-token: write` permissions.
    - Steps: checkout -> setup Node -> `npm ci` -> `vite build` -> `actions/upload-pages-artifact` (path `dist`) -> `actions/deploy-pages`, so a failed build halts before publishing and keeps the previous live site.
    - _Requirements: 7.3, 7.4, 7.5, 7.6_

  - [x]* 11.2 Write smoke/static checks
    - Assert a single `index.html` entry point exists, core modules contain no `fetch`/network calls, and Vite `base` matches the GitHub Pages project subpath so built asset URLs resolve without 404s.
    - _Requirements: 6.1, 6.2, 7.1, 7.2_

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references the specific requirement clauses (and property numbers, for PBT tasks) it implements for full traceability.
- All 14 correctness properties from the design are implemented as individual `fast-check` property tests (min 100 runs each) placed next to the code they validate to catch errors early.
- Checkpoints ensure incremental validation of the calculation core, validation layer, and fully wired app.
- The calculation and validation layers remain pure (no DOM/I/O), which is what makes them property-testable.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "5.1", "7.1", "11.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "5.2", "5.3", "5.4", "5.5", "5.6", "8.1"] },
    { "id": 4, "tasks": ["3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "7.2", "8.2", "8.3", "8.4"] },
    { "id": 5, "tasks": ["7.3", "8.5", "9.1"] },
    { "id": 6, "tasks": ["9.2", "11.2"] }
  ]
}
```
