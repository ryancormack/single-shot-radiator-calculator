# Requirements Document

## Introduction

The Air Conditioning Calculator is a client-side feature that extends the existing radiator (heating) calculator to compute the *cooling* capacity required to cool a room during hot weather. It is the counterpart to the existing heat-output calculation: instead of the heat that must be *added* to reach a warm indoor temperature against a cold outdoor design temperature, it computes the heat that must be *removed* to reach a cooler indoor temperature against a hot outdoor summer temperature.

The feature assumes a standard split-system ("external pump style") air conditioner, consisting of an outdoor compressor/condenser unit and an indoor (internal) unit that delivers the cooling into the room. Given a set of room characteristics (dimensions, room type, insulation, external walls, window/glazing type), the summer outdoor and desired indoor temperatures, and cooling-specific internal heat gains (sun exposure, occupancy, and heat-generating appliances), the feature calculates the required cooling capacity of the internal unit and presents it in watts (W), kilowatts (kW), and British Thermal Units per hour (BTU/hr), along with a recommended standard nominal unit size.

The feature reuses the room-geometry and room-characteristic inputs, the pure/deterministic calculation-core approach, the strict validation discipline, and the in-place SPA rendering of the existing Radiator Heat Calculator. It runs entirely in the browser with no backend, is written in TypeScript, and is deployable to GitHub Pages through the existing deployment pipeline.

## Glossary

- **Cooling_Calculator**: The application component that computes the required cooling capacity from validated room and cooling inputs.
- **Cooling_Capacity**: The thermal power the Internal_Unit must remove from a room to reach the desired indoor temperature under the given conditions, expressed in watts (W), kilowatts (kW), and BTU/hr.
- **Cooling_Volume**: The interior volume of the room, computed as length x width x height, expressed in cubic metres (m^3).
- **Delta_T_Cooling**: The difference between the outdoor summer temperature and the desired indoor temperature, expressed in degrees Celsius (C), computed as Outdoor_Summer_Temperature minus Desired_Indoor_Temperature.
- **Effective_Delta_T_Cooling**: Delta_T_Cooling bounded to a minimum of 0, so the room-envelope contribution to Cooling_Capacity is never negative.
- **Outdoor_Summer_Temperature**: The assumed hot outdoor air temperature used for cooling sizing, expressed in degrees Celsius (C).
- **Desired_Indoor_Temperature**: The target (cooler) indoor air temperature the occupant wants to achieve, expressed in degrees Celsius (C).
- **Split_System**: An air conditioner comprising an outdoor compressor/condenser unit and one indoor unit connected by refrigerant lines; the "standard external pump style" unit assumed by this feature.
- **Internal_Unit**: The indoor component of the Split_System whose required Cooling_Capacity this feature calculates.
- **Room_Type**: A classification of the room (for example: Lounge, Bedroom, Kitchen, Bathroom, Hallway) that influences the cooling factor.
- **Insulation_Level**: A classification of the room's thermal insulation quality (for example: Poor, Average, Good).
- **External_Wall_Count**: The number of walls in the room that are exposed to the outside.
- **Window_Type**: A classification of the room's windows (for example: Single_Glazed, Double_Glazed, Triple_Glazed).
- **Sun_Exposure**: A classification of how much direct solar heat gain the room receives (for example: Shaded, Average, Sunny).
- **Occupant_Count**: The number of people typically present in the room, contributing internal heat gain.
- **Heat_Gain_Per_Occupant**: A documented constant for the sensible heat gain contributed by each occupant, expressed in watts (W).
- **Appliance_Heat_Gain**: The additional internal heat load from heat-generating appliances in the room, expressed in watts (W).
- **Envelope_Load**: The portion of Cooling_Capacity attributable to heat transfer through the room envelope, derived from Cooling_Volume, Effective_Delta_T_Cooling, and the room-characteristic and Sun_Exposure multipliers.
- **Internal_Gain_Load**: The portion of Cooling_Capacity attributable to internal heat sources, derived from Occupant_Count (via Heat_Gain_Per_Occupant) and Appliance_Heat_Gain.
- **Nominal_Capacity**: A standard published cooling capacity for a Split_System unit (for example, from a documented set of common sizes in kW), used to recommend a real-world unit.
- **Input_Form**: The user interface component that collects room and cooling characteristics from the user.
- **BTU_Conversion_Factor**: The constant used to convert watts to BTU/hr, equal to 3.412142.
- **SPA**: Single Page Application; a browser-based application that loads a single HTML page and updates content dynamically.
- **Validation**: The process of confirming that user-supplied input values are present, numeric where required, and within accepted ranges.

## Requirements

### Requirement 1: Collect Room Dimensions

**User Story:** As a homeowner planning to cool a room, I want to enter the dimensions of the room, so that the Cooling_Calculator can determine the volume of space to be cooled.

#### Acceptance Criteria

1. THE Input_Form SHALL provide separate input fields for room length, room width, and room height, each labelled with its unit of metres.
2. WHEN the user enters a value for length, width, or height, THE Cooling_Calculator SHALL accept a positive decimal number that is greater than 0 and less than or equal to 30, expressed with a maximum of 2 decimal places.
3. IF the user submits a dimension value that is empty, non-numeric, less than or equal to 0, greater than 30, or specified with more than 2 decimal places, THEN THE Cooling_Calculator SHALL display, within 1 second of submission, a validation message identifying each invalid field and the reason for rejection, and SHALL withhold a calculated result.
4. WHEN valid length, width, and height values are provided, THE Cooling_Calculator SHALL compute Cooling_Volume as length multiplied by width multiplied by height, expressed in cubic metres and rounded to 2 decimal places.
5. WHEN two or more dimension fields are invalid at submission, THE Cooling_Calculator SHALL display a distinct validation message for every invalid field simultaneously.

### Requirement 2: Collect Room Characteristics

**User Story:** As a homeowner, I want to specify the room type, insulation level, external wall count, and window type, so that the Cooling_Calculator can account for factors that affect heat gain through the room envelope.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a selection control for Room_Type with the options Lounge, Bedroom, Kitchen, Bathroom, and Hallway.
2. THE Input_Form SHALL provide a selection control for Insulation_Level with the options Poor, Average, and Good.
3. THE Input_Form SHALL provide a numeric control for External_Wall_Count accepting whole numbers from 0 to 4 inclusive.
4. THE Input_Form SHALL provide a selection control for Window_Type with the options Single_Glazed, Double_Glazed, and Triple_Glazed.
5. WHERE any selection control has not been changed by the user, THE Input_Form SHALL apply a documented default value, determined independently for each such unchanged control, that is a member of that control's defined set of options.
6. IF the user submits an External_Wall_Count value that is empty, non-numeric, not a whole number, less than 0, or greater than 4, THEN THE Cooling_Calculator SHALL display a validation message identifying the invalid field and SHALL withhold a calculated result.

### Requirement 3: Specify Outdoor and Desired Indoor Temperatures

**User Story:** As a homeowner, I want to set the hot outdoor summer temperature and my desired cooler indoor temperature, so that the calculation reflects how much the room needs to be cooled.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a field for the Outdoor_Summer_Temperature expressed in degrees Celsius, accepting numeric values from 20.0 to 50.0 degrees Celsius inclusive, with up to one decimal place of precision.
2. THE Input_Form SHALL provide a field for the Desired_Indoor_Temperature expressed in degrees Celsius, accepting numeric values from 16.0 to 30.0 degrees Celsius inclusive, with up to one decimal place of precision.
3. WHERE the Outdoor_Summer_Temperature field has not been changed by the user, THE Input_Form SHALL apply a documented default Outdoor_Summer_Temperature value within the range 20.0 to 50.0 degrees Celsius inclusive.
4. WHERE the Desired_Indoor_Temperature field has not been changed by the user, THE Input_Form SHALL apply a documented default Desired_Indoor_Temperature value within the range 16.0 to 30.0 degrees Celsius inclusive.
5. IF the user submits an Outdoor_Summer_Temperature that is empty, non-numeric, less than 20.0, greater than 50.0, or specified with more than one decimal place, THEN THE Cooling_Calculator SHALL display a validation message identifying the Outdoor_Summer_Temperature field as invalid, SHALL withhold a calculated result, and SHALL retain the user's entered value.
6. IF the user submits a Desired_Indoor_Temperature that is empty, non-numeric, less than 16.0, greater than 30.0, or specified with more than one decimal place, THEN THE Cooling_Calculator SHALL display a validation message identifying the Desired_Indoor_Temperature field as invalid, SHALL withhold a calculated result, and SHALL retain the user's entered value.
7. THE Cooling_Calculator SHALL compute Delta_T_Cooling as the Outdoor_Summer_Temperature minus the Desired_Indoor_Temperature.
8. THE Cooling_Calculator SHALL compute Effective_Delta_T_Cooling as the greater of Delta_T_Cooling and 0.

### Requirement 4: Specify Cooling-Specific Heat Gain Factors

**User Story:** As a homeowner, I want to specify sun exposure, occupancy, and appliance heat load, so that the cooling calculation reflects the internal and solar heat gains that a heating calculation ignores.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a selection control for Sun_Exposure with the options Shaded, Average, and Sunny.
2. THE Input_Form SHALL provide a numeric control for Occupant_Count accepting whole numbers from 0 to 20 inclusive.
3. THE Input_Form SHALL provide a numeric control for Appliance_Heat_Gain expressed in watts, accepting whole numbers from 0 to 10000 inclusive.
4. WHERE the Sun_Exposure control has not been changed by the user, THE Input_Form SHALL apply a documented default value that is a member of the Sun_Exposure option set.
5. WHERE the Occupant_Count control has not been changed by the user, THE Input_Form SHALL apply a documented default whole-number value within the range 0 to 20 inclusive.
6. WHERE the Appliance_Heat_Gain control has not been changed by the user, THE Input_Form SHALL apply a documented default whole-number value within the range 0 to 10000 inclusive.
7. IF the user submits an Occupant_Count that is empty, non-numeric, not a whole number, less than 0, or greater than 20, THEN THE Cooling_Calculator SHALL display a validation message identifying the Occupant_Count field as invalid and SHALL withhold a calculated result.
8. IF the user submits an Appliance_Heat_Gain that is empty, non-numeric, not a whole number, less than 0, or greater than 10000, THEN THE Cooling_Calculator SHALL display a validation message identifying the Appliance_Heat_Gain field as invalid and SHALL withhold a calculated result.

### Requirement 5: Calculate Required Cooling Capacity

**User Story:** As a homeowner, I want the Cooling_Calculator to compute the required cooling capacity, so that I can size the internal unit of a split-system air conditioner correctly.

#### Acceptance Criteria

1. WHEN all required inputs are valid, THE Cooling_Calculator SHALL compute Envelope_Load in watts as a documented function of Cooling_Volume, Effective_Delta_T_Cooling, Insulation_Level, External_Wall_Count, Window_Type, Room_Type, and Sun_Exposure.
2. WHEN all required inputs are valid, THE Cooling_Calculator SHALL compute Internal_Gain_Load in watts as the sum of Occupant_Count multiplied by Heat_Gain_Per_Occupant and Appliance_Heat_Gain.
3. WHEN all required inputs are valid, THE Cooling_Calculator SHALL compute Cooling_Capacity in watts as the sum of Envelope_Load and Internal_Gain_Load, rounded to the nearest 1 watt where a fractional part of 0.5 rounds up, and bounded within the range 0 to 100000 watts.
4. WHEN two sets of inputs are identical, THE Cooling_Calculator SHALL produce identical Cooling_Capacity values (deterministic calculation).
5. WHILE all required inputs remain valid AND Delta_T_Cooling is less than or equal to 0 AND Occupant_Count equals 0 AND Appliance_Heat_Gain equals 0, THE Cooling_Calculator SHALL produce a Cooling_Capacity in watts equal to 0.
6. WHILE all required inputs remain valid, WHEN Cooling_Volume increases by any positive amount and all other inputs remain constant, THE Cooling_Calculator SHALL produce a Cooling_Capacity in watts that is greater than or equal to the previous Cooling_Capacity (monotonic with volume).
7. WHILE all required inputs remain valid, WHEN Occupant_Count or Appliance_Heat_Gain increases and all other inputs remain constant, THE Cooling_Calculator SHALL produce a Cooling_Capacity in watts that is greater than or equal to the previous Cooling_Capacity (monotonic with internal gains).
8. IF any required input is missing or invalid, THEN THE Cooling_Calculator SHALL NOT compute a Cooling_Capacity, SHALL indicate the invalid input, and SHALL preserve the previously displayed result state.
9. WHEN all required inputs are valid, THE Cooling_Calculator SHALL produce the Cooling_Capacity within 1 second of the triggering input change.

### Requirement 6: Recommend a Standard Internal Unit Size

**User Story:** As a homeowner, I want a recommended standard split-system unit size, so that I can shop for a real air conditioner that meets the calculated capacity.

#### Acceptance Criteria

1. THE Cooling_Calculator SHALL maintain a documented set of standard Nominal_Capacity values, each expressed in kilowatts, ordered from smallest to largest.
2. WHEN the Cooling_Calculator produces a Cooling_Capacity, THE Cooling_Calculator SHALL select as the recommended Internal_Unit size the smallest Nominal_Capacity value that is greater than or equal to the computed Cooling_Capacity.
3. IF the computed Cooling_Capacity exceeds the largest Nominal_Capacity value in the documented set, THEN THE Cooling_Calculator SHALL select the largest Nominal_Capacity value and SHALL indicate that the required capacity exceeds a single standard unit.
4. WHEN two sets of inputs are identical, THE Cooling_Calculator SHALL recommend an identical Nominal_Capacity (deterministic recommendation).

### Requirement 7: Display Results

**User Story:** As a homeowner, I want to see the required cooling capacity in watts, kilowatts, and BTU/hr together with a recommended unit size, so that I can compare against air conditioner specifications regardless of the units the manufacturer uses.

#### Acceptance Criteria

1. WHEN the Cooling_Calculator produces a Cooling_Capacity, THE SPA SHALL display the capacity in watts using mathematical rounding to the nearest whole watt, where a fractional part of 0.5 rounds up to the next integer.
2. WHEN the Cooling_Calculator produces a Cooling_Capacity, THE SPA SHALL display the capacity in BTU/hr computed by multiplying the watts value by the BTU_Conversion_Factor of 3.412142, using mathematical rounding to the nearest whole BTU/hr where a fractional part of 0.5 rounds up to the next integer.
3. WHEN the Cooling_Calculator produces a Cooling_Capacity, THE SPA SHALL display the capacity in kilowatts derived from the watts value.
4. WHEN the Cooling_Calculator produces a Cooling_Capacity, THE SPA SHALL display the watts value, the kilowatts value, the BTU/hr value, and the recommended Nominal_Capacity concurrently, each labelled with its unit of measurement (watts as "W", kilowatts as "kW", and BTU/hr as "BTU/hr").
5. WHEN the user changes any input and all required inputs are valid, THE SPA SHALL recompute and update every displayed cooling result value to reflect the changed inputs, replacing any previously displayed values.
6. WHILE no valid Cooling_Capacity has been produced since the SPA loaded, THE SPA SHALL withhold every numeric cooling result value and SHALL display a placeholder indication in place of each result value.
7. IF any required input becomes invalid after a Cooling_Capacity has been displayed, THEN THE SPA SHALL remove every previously displayed cooling result value and SHALL replace each with a placeholder indication until valid inputs are provided.

### Requirement 8: Consistency With the Existing Calculator and Client-Side SPA

**User Story:** As a user of the existing radiator calculator, I want the air conditioning calculator to behave consistently and run in my browser, so that I can size heating and cooling without accounts, installation, or a server connection.

#### Acceptance Criteria

1. THE Cooling_Calculator SHALL perform all calculations within the browser without issuing any network request to a backend service and without requiring a user account or authentication.
2. THE Cooling_Calculator SHALL be implemented in TypeScript as a pure, deterministic calculation core that is free of DOM access, network access, randomness, and time dependence.
3. THE Cooling_Calculator SHALL reuse the existing room-dimension and room-characteristic input definitions, ranges, and documented multiplier values shared with the Radiator Heat Calculator for any input the two calculators have in common.
4. WHEN the user changes any value in the Input_Form, THE SPA SHALL update the interface in place without performing a full page reload or navigation.
5. IF a validation or calculation error occurs while the user interacts with the Input_Form, THEN THE SPA SHALL display an error indication in place without performing a full page reload or navigation, AND SHALL retain the user's previously entered input values.
6. WHERE the SPA cannot complete a Cooling_Capacity calculation because the calculation logic fails to run or terminates with an error, THE SPA SHALL still load and render the Input_Form interface AND SHALL display an error indication that a result is unavailable.

### Requirement 9: Deployment to GitHub Pages

**User Story:** As the project owner, I want the air conditioning calculator deployed alongside the existing calculator on GitHub Pages, so that I can access it from a public URL.

#### Acceptance Criteria

1. THE SPA SHALL produce a static build that includes the air conditioning calculator and consists only of HTML, CSS, and JavaScript assets that require no server-side runtime and are servable directly from GitHub Pages static hosting.
2. THE SPA SHALL reference all assets using relative paths configured for the repository's GitHub Pages project subpath, such that every asset loads without producing a 404 (not-found) response when hosted from that subpath.
3. WHEN changes are pushed to the repository's default branch, THE existing automated deployment configuration SHALL rebuild the static build including the air conditioning calculator and publish it to GitHub Pages without manual file uploads.
4. IF the build or publish step of the deployment configuration fails, THEN THE deployment configuration SHALL halt without publishing the failed build, preserve the previously published version as the live site, and surface a failure indication in the deployment run status.
