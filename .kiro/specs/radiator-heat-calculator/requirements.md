# Requirements Document

## Introduction

The Radiator Heat Calculator is a client-side Single Page Application (SPA) that helps homeowners and renovators determine the heat output required to adequately warm a room. Given a set of room characteristics (dimensions, room type, construction and insulation details, window characteristics, and desired indoor temperature), the application calculates the required heat output and presents the result in both watts and British Thermal Units per hour (BTU/hr). This enables the user to correctly size radiators during home renovations.

The application runs entirely in the browser with no backend, is written in TypeScript, and is deployable to GitHub Pages.

## Glossary

- **Calculator**: The application component that computes the required heat output from validated room inputs.
- **Heat_Output**: The thermal power required to heat a room to the desired temperature, expressed in watts (W) and BTU/hr.
- **Room_Volume**: The interior volume of the room, computed as length x width x height, expressed in cubic metres (m^3).
- **Delta_T**: The difference between the desired indoor temperature and the assumed outdoor design temperature, expressed in degrees Celsius (C).
- **Room_Type**: A classification of the room (for example: Lounge, Bedroom, Kitchen, Bathroom, Hallway) that influences the desired indoor temperature and heat factor.
- **Insulation_Level**: A classification of the room's thermal insulation quality (for example: Poor, Average, Good).
- **External_Wall_Count**: The number of walls in the room that are exposed to the outside.
- **Window_Type**: A classification of the room's windows (for example: Single_Glazed, Double_Glazed, Triple_Glazed).
- **Input_Form**: The user interface component that collects room characteristics from the user.
- **BTU_Conversion_Factor**: The constant used to convert watts to BTU/hr, equal to 3.412142.
- **SPA**: Single Page Application; a browser-based application that loads a single HTML page and updates content dynamically.
- **Validation**: The process of confirming that user-supplied input values are present, numeric where required, and within accepted ranges.

## Requirements

### Requirement 1: Collect Room Dimensions

**User Story:** As a homeowner planning a renovation, I want to enter the dimensions of a room, so that the calculator can determine the volume of space to be heated.

#### Acceptance Criteria

1. THE Input_Form SHALL provide separate input fields for room length, room width, and room height, each labelled with its unit of metres.
2. WHEN the user enters a value for length, width, or height, THE Calculator SHALL accept a positive decimal number that is greater than 0 and less than or equal to 30, expressed with a maximum of 2 decimal places.
3. IF the user submits a dimension value that is empty, non-numeric, less than or equal to 0, greater than 30, or specified with more than 2 decimal places, THEN THE Calculator SHALL display, within 1 second of submission, a validation message identifying each invalid field and the reason for rejection, and SHALL withhold a calculated result.
4. WHEN valid length, width, and height values are provided, THE Calculator SHALL compute Room_Volume as length multiplied by width multiplied by height, expressed in cubic metres and rounded to 2 decimal places.
5. WHEN two or more dimension fields are invalid at submission, THE Calculator SHALL display a distinct validation message for every invalid field simultaneously.

### Requirement 2: Collect Room Characteristics

**User Story:** As a homeowner, I want to specify the room type, insulation level, external wall count, and window type, so that the calculator can account for factors that affect heat loss.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a selection control for Room_Type with the options Lounge, Bedroom, Kitchen, Bathroom, and Hallway.
2. THE Input_Form SHALL provide a selection control for Insulation_Level with the options Poor, Average, and Good.
3. THE Input_Form SHALL provide a numeric control for External_Wall_Count accepting whole numbers from 0 to 4 inclusive.
4. THE Input_Form SHALL provide a selection control for Window_Type with the options Single_Glazed, Double_Glazed, and Triple_Glazed.
5. WHERE any selection control has not been changed by the user, THE Input_Form SHALL apply a documented default value, determined independently for each such unchanged control, that is a member of that control's defined set of options.
6. IF the user submits an External_Wall_Count value that is empty, non-numeric, not a whole number, less than 0, or greater than 4, THEN THE Calculator SHALL display a validation message identifying the invalid field and SHALL withhold a calculated result.

### Requirement 3: Specify Desired Temperature

**User Story:** As a homeowner, I want to set the desired indoor temperature, so that the calculation reflects how warm I want the room to be.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a field for the desired indoor temperature expressed in degrees Celsius, accepting numeric values with up to one decimal place.
2. WHEN the user selects a Room_Type and the desired indoor temperature field has not been manually edited by the user, THE Input_Form SHALL populate the desired indoor temperature field with a documented default value corresponding to that Room_Type.
3. IF the user selects a Room_Type after having manually entered a desired indoor temperature, THEN THE Input_Form SHALL retain the user-entered value and SHALL NOT overwrite it with the Room_Type default value.
4. WHEN the user enters a desired indoor temperature, THE Calculator SHALL accept numeric values from 10.0 to 30.0 degrees Celsius inclusive, with up to one decimal place of precision.
5. WHEN the user submits the form, IF the desired indoor temperature is empty, non-numeric, less than 10.0, or greater than 30.0, THEN THE Calculator SHALL display a validation message identifying the desired indoor temperature field as invalid and SHALL withhold a calculated result while retaining the user's entered value.
6. THE Calculator SHALL compute Delta_T as the desired indoor temperature minus a documented outdoor design temperature constant.

### Requirement 4: Calculate Required Heat Output

**User Story:** As a homeowner, I want the calculator to compute the required heat output, so that I can size radiators correctly.

#### Acceptance Criteria

1. WHEN all required inputs are valid, THE Calculator SHALL compute Heat_Output in watts as a documented function of Room_Volume, Delta_T, Insulation_Level, External_Wall_Count, Window_Type, and Room_Type, rounded to the nearest 1 watt and bounded within the range 0 to 100000 watts.
2. WHEN the watts value has been computed, THE Calculator SHALL compute the BTU/hr value by multiplying the watts value by the BTU_Conversion_Factor of 3.412142, rounded to the nearest 1 BTU/hr.
3. WHEN two sets of inputs are identical, THE Calculator SHALL produce identical Heat_Output values (deterministic calculation).
4. WHILE all required inputs remain valid AND Delta_T is greater than 0, THE Calculator SHALL produce a Heat_Output in watts that is greater than 0.
5. WHILE all required inputs remain valid AND Delta_T equals 0, THE Calculator SHALL produce a Heat_Output in watts equal to 0.
6. WHILE all required inputs remain valid, WHEN Room_Volume increases by any positive amount and all other inputs remain constant, THE Calculator SHALL produce a Heat_Output in watts that is greater than or equal to the previous Heat_Output (monotonic with volume).
7. IF any required input is missing or invalid, THEN THE Calculator SHALL NOT compute a Heat_Output, SHALL indicate the invalid input, and SHALL preserve the previously displayed result state.
8. WHEN all required inputs are valid, THE Calculator SHALL produce the Heat_Output within 1 second of the triggering input change.

### Requirement 5: Display Results

**User Story:** As a homeowner, I want to see the required heat output in both watts and BTU, so that I can compare against radiator specifications regardless of the units they use.

#### Acceptance Criteria

1. WHEN the Calculator produces a Heat_Output, THE SPA SHALL display the result in watts using mathematical rounding to the nearest whole watt, where a fractional part of 0.5 rounds up to the next integer.
2. WHEN the Calculator produces a Heat_Output, THE SPA SHALL display the result in BTU/hr using mathematical rounding to the nearest whole BTU/hr, where a fractional part of 0.5 rounds up to the next integer.
3. WHEN the Calculator produces a Heat_Output, THE SPA SHALL display the watts result and the BTU/hr result concurrently, each labelled with its unit of measurement (watts as "W" and BTU/hr as "BTU/hr").
4. WHEN the user changes any input and all required inputs are valid, THE SPA SHALL recompute and update both the displayed watts result and the displayed BTU/hr result to reflect the changed inputs, replacing any previously displayed values.
5. WHILE no valid Heat_Output has been produced since the SPA loaded, THE SPA SHALL withhold any numeric watts and BTU/hr result values and SHALL display a placeholder indication in place of each result value.
6. IF any required input becomes invalid after a Heat_Output has been displayed, THEN THE SPA SHALL remove the previously displayed watts and BTU/hr result values and SHALL replace each with a placeholder indication until valid inputs are provided.

### Requirement 6: Client-Side Single Page Application

**User Story:** As a user, I want the calculator to work entirely in my browser, so that I can use it without accounts, installation, or a server connection.

#### Acceptance Criteria

1. THE SPA SHALL perform all calculations within the browser without issuing any network request to a backend service and without requiring a user account or authentication.
2. THE SPA SHALL load and render its interface from a single HTML entry point.
3. THE SPA SHALL be implemented in TypeScript.
4. WHEN the user changes any value in the Input_Form, THE SPA SHALL update the interface in place without performing a full page reload or navigation.
5. IF a validation or calculation error occurs while the user interacts with the Input_Form, THEN THE SPA SHALL display an error indication in place without performing a full page reload or navigation, AND SHALL retain the user's previously entered input values.
6. WHERE the SPA cannot complete a Heat_Output calculation because the calculation logic fails to run or terminates with an error, THE SPA SHALL still load and render the Input_Form interface AND SHALL display an error indication that a result is unavailable.

### Requirement 7: Deployment to GitHub Pages

**User Story:** As the project owner, I want the application deployed to GitHub Pages, so that I can access the calculator from a public URL.

#### Acceptance Criteria

1. THE SPA SHALL produce a static build consisting only of HTML, CSS, and JavaScript assets that require no server-side runtime and are servable directly from GitHub Pages static hosting.
2. THE SPA SHALL reference all assets using relative paths configured for the repository's GitHub Pages project subpath, such that every asset loads without producing a 404 (not-found) response when hosted from that subpath.
3. THE project SHALL provide an automated deployment configuration that, without manual file uploads, publishes the static build to GitHub Pages.
4. WHEN changes are pushed to the repository's default branch, THE automated deployment configuration SHALL rebuild the static build and publish it to GitHub Pages.
5. WHEN the deployment configuration completes successfully, THE published SPA SHALL be reachable at the repository's GitHub Pages URL and return the calculator's main page within 5 seconds of an initial page request.
6. IF the build or publish step of the deployment configuration fails, THEN THE deployment configuration SHALL halt without publishing the failed build, preserve the previously published version as the live site, and surface a failure indication in the deployment run status.
