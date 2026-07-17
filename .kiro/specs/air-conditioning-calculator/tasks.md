# Implementation Plan: Air Conditioning Calculator

## Overview

This plan converts the Air Conditioning Calculator design into a series of incremental, test-driven coding steps that slot into the existing codebase without disturbing the heating calculator. It follows the established layering — pure calculation core in `src/core/`, pure validation in `src/validation/`, in-memory state/controller in `src/state/`, DOM-facing components in `src/ui/`, and composition in `src/main.ts` — and reuses the shared multiplier tables and `BTU_CONVERSION_FACTOR` from `src/core/config.ts`.

Work proceeds bottom-up: domain types and configuration first, then the pure calculation core (with its property tests), then validation, state, UI, and finally wiring everything into `main.ts`/`index.html` so there is no orphaned code. Each of the 15 correctness properties from the design is implemented as its own fast-check property test (minimum 100 iterations, tagged `// Feature: air-conditioning-calculator, Property {number}: ...`), complemented by example, UI, integration, and smoke tests as described in the design's Testing Strategy.

Implementation language: **TypeScript** (as specified throughout the design document).

## Tasks

- [ ] 1. Establish cooling domain types and configuration
  - [ ] 1.1 Create cooling domain types module (`src/core/coolingTypes.ts`)
    - Define the `SunExposure` string union (`'Shaded' | 'Average' | 'Sunny'`) following the existing union-type-plus-lookup convention (no TS `enum`s)
    - Define `RawCoolingInputs`, `CoolingInputs`, `UnitRecommendation`, `CoolingResult`, and `CoolingValidationResult` interfaces exactly as specified in the design's Data Models section
    - Import and reuse `RoomType`, `InsulationLevel`, `WindowType`, and `FieldError` from `src/core/types.ts` (no duplication)
    - Keep the module pure data with no DOM/I/O dependencies
    - _Requirements: 8.2, 8.3_

  - [ ] 1.2 Create cooling configuration constants module (`src/core/coolingConfig.ts`)
    - Define `COOLING_BASE_COEFFICIENT`, `HEAT_GAIN_PER_OCCUPANT`, and `SUN_EXPOSURE_MULTIPLIER` (`Record<SunExposure, number>`)
    - Define `NOMINAL_CAPACITIES_KW` as an ascending `readonly number[]`
    - Define documented defaults `DEFAULT_OUTDOOR_SUMMER_TEMP_C`, `DEFAULT_DESIRED_INDOOR_TEMP_C`, `DEFAULT_SUN_EXPOSURE`, `DEFAULT_OCCUPANT_COUNT`, `DEFAULT_APPLIANCE_HEAT_GAIN`
    - Do NOT redefine shared multipliers; they will be imported from `src/core/config.ts` where needed
    - _Requirements: 6.1, 8.3, 3.3, 3.4, 4.4, 4.5, 4.6_

  - [ ]* 1.3 Write configuration sanity unit tests (`src/core/coolingConfig.test.ts`)
    - Assert `NOMINAL_CAPACITIES_KW` is non-empty and strictly ascending
    - Assert each cooling default is a member of / within its documented option set or range (sun exposure in the union; occupant `0..20`; appliance `0..10000`; outdoor `20.0..50.0`; indoor `16.0..30.0`)
    - Assert shared multiplier tables are imported from `config.ts` (single source of truth)
    - _Requirements: 6.1, 8.3, 2.5, 3.3, 3.4, 4.4, 4.5, 4.6_

- [ ] 2. Implement the pure cooling calculation core
  - [ ] 2.1 Implement geometry and temperature helpers (`src/core/coolingCalculator.ts`)
    - Implement `computeCoolingVolume(length, width, height)` returning `length * width * height` rounded to 2 dp
    - Implement `computeDeltaTCooling(outdoorSummerC, desiredIndoorC)` returning `outdoor - indoor`
    - Implement `effectiveDeltaTCooling(deltaTCooling)` returning `max(deltaTCooling, 0)`
    - Reuse `round2dp`/half-up helper style from `calculator.ts`; keep all functions pure and deterministic
    - _Requirements: 1.4, 3.7, 3.8, 8.2_

  - [ ] 2.2 Implement load functions (`src/core/coolingCalculator.ts`)
    - Implement `computeInternalGainLoad(occupantCount, applianceHeatGain)` = `occupantCount * HEAT_GAIN_PER_OCCUPANT + applianceHeatGain`
    - Implement `computeEnvelopeLoad(params)` as the documented product of `Cooling_Volume`, `Effective_Delta_T_Cooling`, `COOLING_BASE_COEFFICIENT`, the shared `INSULATION_MULTIPLIER`/`WINDOW_MULTIPLIER`/`WALL_MULTIPLIER`/`ROOM_TYPE_MULTIPLIER`, and `SUN_EXPOSURE_MULTIPLIER`
    - Implement `computeCoolingWatts(params)` = `clamp(roundHalfUp(Envelope_Load + Internal_Gain_Load), 0, 100000)`
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 2.3 Implement conversions, recommendation, and full pipeline (`src/core/coolingCalculator.ts`)
    - Implement `wattsToBtu(watts)` = `roundHalfUp(watts * BTU_CONVERSION_FACTOR)` (imported from `config.ts`) and `wattsToKw(watts)` = `watts / 1000`
    - Implement `recommendUnit(capacityWatts)` selecting the smallest `NOMINAL_CAPACITIES_KW` whose watt-equivalent is `>=` capacity, setting `exceedsLargest: true` and returning the largest nominal when capacity exceeds it
    - Implement `computeCoolingCapacity(inputs)` composing volume, delta-T, watts/kW/BTU, and the unit recommendation into a `CoolingResult`
    - _Requirements: 5.3, 5.4, 6.2, 6.3, 7.1, 7.2, 7.3_

  - [ ]* 2.4 Write property test for cooling volume (`src/core/coolingCalculator.test.ts`)
    - **Property 1: Cooling volume is the rounded product of dimensions**
    - **Validates: Requirements 1.4**
    - Use `dimensionArb` (integers `1..3000` mapped to `/100`); assert `computeCoolingVolume` equals `round2dp(l*w*h)`; min 100 runs

  - [ ]* 2.5 Write property test for Delta_T_Cooling (`src/core/coolingCalculator.test.ts`)
    - **Property 2: Delta_T_Cooling is outdoor minus indoor temperature**
    - **Validates: Requirements 3.7**

  - [ ]* 2.6 Write property test for effective Delta_T (`src/core/coolingCalculator.test.ts`)
    - **Property 3: Effective_Delta_T_Cooling is never negative**
    - **Validates: Requirements 3.8**

  - [ ]* 2.7 Write property test for internal gain load (`src/core/coolingCalculator.test.ts`)
    - **Property 4: Internal_Gain_Load is the documented sum of gains**
    - **Validates: Requirements 5.2**

  - [ ]* 2.8 Write property test for capacity formula and bounds (`src/core/coolingCalculator.test.ts`)
    - **Property 5: Cooling capacity is bounded, whole-watt, and equals the documented formula**
    - **Validates: Requirements 5.1, 5.3**
    - Assert result is an integer in `[0, 100000]` matching the recomputed documented formula

  - [ ]* 2.9 Write property test for determinism (`src/core/coolingCalculator.test.ts`)
    - **Property 6: Cooling calculation is deterministic**
    - **Validates: Requirements 5.4, 6.4, 8.2**

  - [ ]* 2.10 Write property test for zero-demand inputs (`src/core/coolingCalculator.test.ts`)
    - **Property 7: Zero-demand inputs yield zero capacity**
    - **Validates: Requirements 5.5**
    - Generate inputs with `Delta_T_Cooling <= 0`, `Occupant_Count == 0`, `Appliance_Heat_Gain == 0`; assert watts `== 0`

  - [ ]* 2.11 Write property test for monotonicity in volume (`src/core/coolingCalculator.test.ts`)
    - **Property 8: Capacity is monotonic non-decreasing in volume**
    - **Validates: Requirements 5.6**

  - [ ]* 2.12 Write property test for monotonicity in internal gains (`src/core/coolingCalculator.test.ts`)
    - **Property 9: Capacity is monotonic non-decreasing in internal gains**
    - **Validates: Requirements 5.7**

  - [ ]* 2.13 Write property test for unit recommendation (`src/core/coolingCalculator.test.ts`)
    - **Property 10: Unit recommendation selects the smallest sufficient standard size**
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 2.14 Write property test for watt conversions (`src/core/coolingCalculator.test.ts`)
    - **Property 11: Watt-to-unit conversions are proportional and correctly rounded**
    - **Validates: Requirements 7.2, 7.3**

  - [ ]* 2.15 Write worked-example and zero-demand example tests (`src/core/coolingCalculator.test.ts`)
    - Add one fully specified room vector with known volume, envelope load, internal gain, watts, kW, BTU/hr, and recommended unit (guards against constant drift)
    - Add an explicit zero-demand example (outdoor ≤ indoor, zero occupants, zero appliances → 0 W)
    - _Requirements: 5.5_

- [ ] 3. Checkpoint - calculation core complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement the cooling validation layer
  - [ ] 4.1 Implement `validateCoolingInputs` (`src/validation/coolingValidate.ts`)
    - Reuse the strict-decimal matcher, decimal-place counting, and collect-all-errors discipline from `validate.ts`
    - Validate dimensions (`0 < v <= 30`, `<= 2 dp`), room characteristics (enum membership; `External_Wall_Count` integer `0..4`), temperatures (`Outdoor_Summer_Temperature` `20.0..50.0` `<= 1 dp`; `Desired_Indoor_Temperature` `16.0..30.0` `<= 1 dp`), and cooling gains (`Sun_Exposure` enum; `Occupant_Count` integer `0..20`; `Appliance_Heat_Gain` integer `0..10000`)
    - Return `{ valid: false, errors }` with no `inputs` on any failure; `{ valid: true, errors: [], inputs }` on success
    - _Requirements: 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.4, 2.6, 3.1, 3.2, 3.5, 3.6, 4.1, 4.2, 4.3, 4.7, 4.8, 5.8_

  - [ ]* 4.2 Write property test for valid input acceptance (`src/validation/coolingValidate.test.ts`)
    - **Property 12: Valid inputs are accepted and parsed**
    - **Validates: Requirements 1.2, 3.1, 3.2, 4.2, 4.3**

  - [ ]* 4.3 Write property test for invalid input rejection (`src/validation/coolingValidate.test.ts`)
    - **Property 13: Out-of-range or malformed inputs are rejected with the offending field flagged**
    - **Validates: Requirements 1.3, 2.6, 3.5, 3.6, 4.7, 4.8, 5.8**

  - [ ]* 4.4 Write property test for simultaneous multi-field errors (`src/validation/coolingValidate.test.ts`)
    - **Property 14: All invalid fields are reported simultaneously**
    - **Validates: Requirements 1.5**

- [ ] 5. Implement cooling state store and controller
  - [ ] 5.1 Implement the cooling store (`src/state/coolingStore.ts`)
    - Hold `RawCoolingInputs` seeded with documented defaults, last valid `CoolingResult | null`, current `FieldError[]`, and a `resultUnavailable` flag
    - Mirror the heating store's `getState`/`setState`/`subscribe`/`notify` API
    - _Requirements: 7.6, 8.6_

  - [ ] 5.2 Implement the cooling controller (`src/state/coolingController.ts`)
    - Implement `handleInputChange(raw)`: always persist latest raw inputs; on validation failure write all `FieldError`s and clear result to `null`; on success call `computeCoolingCapacity` inside `try/catch`, storing the result and clearing errors, or setting `resultUnavailable = true` (without rethrowing) on a thrown error
    - _Requirements: 3.5, 3.6, 5.8, 7.5, 7.7, 8.4, 8.5, 8.6_

  - [ ]* 5.3 Write controller/store unit tests (`src/state/coolingController.test.ts`)
    - Drive valid→invalid transitions asserting placeholder clearing, entered-value retention, and in-place updates; force a calculation throw and assert `resultUnavailable` is set without rethrow
    - _Requirements: 5.8, 7.5, 7.7, 8.4, 8.5, 8.6_

- [ ] 6. Checkpoint - core, validation, and state complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement the cooling UI components
  - [ ] 7.1 Implement the cooling input form (`src/ui/coolingInputForm.ts`)
    - Render all controls with unit labels (dimensions in metres; temperatures in C; appliance gain in W) and the documented option sets/ranges
    - Seed documented defaults on unchanged controls; emit `RawCoolingInputs` on every change with no page reload; render per-field validation messages beside the offending control
    - Re-render in place via a `WeakMap` instance cache to preserve focus, as the heating form does
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 8.4, 8.5_

  - [ ]* 7.2 Write input form UI tests (`src/ui/coolingInputForm.test.ts`)
    - Render the form (jsdom) and assert every control exists with its labels/options/range attributes; assert defaults are seeded and change events emit raw inputs without reload
    - _Requirements: 1.1, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2, 4.3, 8.4_

  - [ ] 7.3 Implement the cooling results display (`src/ui/coolingResultsDisplay.ts`)
    - Show watts (`W`), kilowatts (`kW`), BTU/hr (`BTU/hr`), and recommended `Nominal_Capacity` concurrently, each unit-labelled
    - Show `--` placeholders for every value when there is no valid result (initial load or invalid input); show an "exceeds a single standard unit" note when `exceedsLargest`; show a distinct "result unavailable" message on calculation failure
    - _Requirements: 6.3, 7.1, 7.2, 7.3, 7.4, 7.6, 7.7, 8.6_

  - [ ]* 7.4 Write property test for results rendering (`src/ui/coolingResultsDisplay.test.ts`)
    - **Property 15: Results rendering shows every value with its unit label**
    - **Validates: Requirements 7.4**

  - [ ]* 7.5 Write results display example/placeholder UI tests (`src/ui/coolingResultsDisplay.test.ts`)
    - Assert `--` placeholders for null result (initial and post-invalid), the "exceeds a single standard unit" note, and the "result unavailable" indication
    - _Requirements: 6.3, 7.6, 7.7, 8.6_

- [ ] 8. Wire the cooling calculator into the application
  - [ ] 8.1 Extend composition root and markup (`src/main.ts`, `index.html`)
    - Add cooling mount containers to `index.html` and wire the cooling store, controller, input form, and results display in `main.ts`, subscribing the UI to state changes and performing an initial render (form visible, placeholders shown) with no network access or page reload; guard for missing mount containers
    - _Requirements: 8.1, 8.4, 8.6_

  - [ ]* 8.2 Write integration, purity, and build smoke tests (`src/coolingIntegration.test.ts`, `src/coolingSmoke.test.ts`)
    - Integration: drive the wired controller/store/UI through a valid calculation and a forced failure end-to-end
    - Purity/no-network smoke: assert the core and validation modules perform no DOM or network access
    - Build smoke: assert the Vite production build succeeds and references assets via the configured GitHub Pages base path so they resolve without 404s
    - _Requirements: 8.1, 8.2, 9.1, 9.2_

- [ ] 9. Final checkpoint - full feature integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each of the 15 correctness properties from the design is implemented as its own dedicated fast-check property test (minimum 100 iterations, tagged `// Feature: air-conditioning-calculator, Property {number}: ...`), placed close to the implementation it validates.
- Property tests validate universal correctness; example, UI, integration, and smoke tests cover fixed configuration, DOM interaction, error-recovery transitions, and deployment concerns.
- The heating modules (`calculator.ts`, `validate.ts`, `controller.ts`, `store.ts`, and heating UI) are left untouched; cooling logic lives in parallel modules that import shared multipliers and `BTU_CONVERSION_FACTOR` from `src/core/config.ts`.
- Deployment (Requirements 9.3, 9.4) is handled by the existing GitHub Actions workflow and verified via CI status rather than code tasks.
- Each task references specific requirement clauses for traceability, and later tasks build on and wire together earlier ones so no code is left orphaned.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "2.1", "4.1", "5.1", "7.1", "7.3"] },
    { "id": 3, "tasks": ["2.2", "2.4", "4.2", "7.2", "7.4"] },
    { "id": 4, "tasks": ["2.3", "2.5", "4.3", "7.5"] },
    { "id": 5, "tasks": ["2.6", "4.4", "5.2"] },
    { "id": 6, "tasks": ["2.7", "5.3"] },
    { "id": 7, "tasks": ["2.8", "8.1"] },
    { "id": 8, "tasks": ["2.9", "8.2"] },
    { "id": 9, "tasks": ["2.10"] },
    { "id": 10, "tasks": ["2.11"] },
    { "id": 11, "tasks": ["2.12"] },
    { "id": 12, "tasks": ["2.13"] },
    { "id": 13, "tasks": ["2.14"] },
    { "id": 14, "tasks": ["2.15"] }
  ]
}
```
