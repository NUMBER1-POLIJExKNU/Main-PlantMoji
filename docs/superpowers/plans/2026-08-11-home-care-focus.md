# PlantMoji Home Care Focus Implementation Plan

**Goal:** A first-time Indonesian student can understand Jamkachu's condition, find one safe action, and see how the sensors verify the result within 30 seconds.

## Product rule

The home screen must answer three questions before it presents progression or bonus content:

1. What is happening to the plant?
2. What should I do now?
3. How will I know it worked?

The authoritative loop remains `sensor -> mood -> quest -> physical care -> sensor verification -> reward`. The UI does not invent sensor truth, complete quests, or award XP.

## Scope

### P0 · One care-focus surface

- Add one dominant home card that contains the current situation, a single contextual care action, and a three-step progress explanation.
- Drive the card from four honest states: `waiting`, `healthy`, `action`, and `verifying`.
- Keep the existing quest, sensor, care-button, and realtime anchors so the backend contract does not fork.

### P0 · Information hierarchy

- Order the home rail as care focus -> current mission -> garden conditions -> Jamkachu progression -> bonus quiz.
- Visually demote XP, streak, seeds, and quiz without removing them.
- Keep the sensor board available as evidence, not as the first decision surface.

### P0 · Indonesian-first copy

- Use short Bahasa Indonesia verbs and one-sentence explanations.
- Keep exact English parity.
- Explain that tapping the guidance button does not complete a mission; real sensors verify physical care.

### P1 · Desktop and accessibility

- Keep the desktop right rail within one screen, with the primary action at least 52px tall.
- Use text, icon, and shape together; color is never the only state signal.
- Announce focus-state changes politely and honor reduced-motion preferences.

## Acceptance criteria

- No existing realtime ID or route changes.
- Waiting, active-care, verifying, and healthy states render distinct localized guidance.
- On desktop, progression and quiz appear after the care loop.
- At desktop widths from 1024px upward, the right rail has no horizontal overflow and remains vertically scroll-safe on short classroom laptops.
- Relevant Vitest suites, lint, and production build pass.
