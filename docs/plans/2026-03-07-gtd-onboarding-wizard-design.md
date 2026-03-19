# GTD Onboarding Wizard Design

## Goal

After registration, guide users through setting up SweptMind for GTD — creating context lists with locations and device contexts via a full-page stepper wizard.

## DB Change

Add `onboarding_completed boolean default false` to `users` table.

## Routing

- New page `/onboarding` (outside `(app)` layout, no sidebar)
- `(app)/layout.tsx` — if `onboardingCompleted === false`, redirect to `/onboarding`
- Post-registration redirect changed from `/planned` to `/onboarding`
- `/onboarding` page — if `onboardingCompleted === true`, redirect to `/planned`

## Stepper (5 steps)

### Step 1: Intro

- "Want to set up SweptMind for GTD?"
- Brief description of what wizard does
- Buttons: "Yes, set it up" (next) / "Skip" (set flag, go to `/planned`)

### Step 2: Choose Lists

- 8 lists with checkboxes (all pre-selected):
  - Doma / Home (location indicator)
  - V praci / At Work (location indicator)
  - U pocitace / At Computer (device indicator)
  - Telefonaty / Phone Calls (device indicator)
  - Pochuzky / Errands
  - Cekam na / Waiting For
  - Nekdy/Mozna / Someday/Maybe
  - Ostatni / Other
- Buttons: "Continue" / "Skip" (set flag, go to `/planned`)

### Step 3: Where do you live? (only if "Doma" selected)

- Location search (geocoding via existing `useGeocode` hook)
- Pre-selected: user's current geolocation
- Buttons: "Continue" / "Skip step"

### Step 4: Where do you work? (only if "V praci" selected)

- Same location search, no pre-selection
- Buttons: "Continue" / "Skip step"

### Step 5: Done

- Summary: "Created X lists"
- Button: "Start using SweptMind" (set flag, go to `/planned`)

## Automatic (no user input needed)

- "U pocitace" gets `deviceContext: "computer"`
- "Telefonaty" gets `deviceContext: "phone"`

## Backend

- GraphQL mutation `completeOnboarding(input: OnboardingInput!)`:
  1. Creates selected lists (bulk)
  2. Creates locations if provided, assigns to lists
  3. Sets device contexts
  4. Sets `onboardingCompleted = true`
- Single mutation = atomic

## i18n

All text under `onboarding` key in cs/en dictionaries.
