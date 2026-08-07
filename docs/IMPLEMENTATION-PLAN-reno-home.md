# RENO home integration handoff

## Goal

Serve the designer-owned `RENO/Web-PlantEmoji` experience as the PlantMoji
home page without rewriting it in React or changing the existing backend.

## Integration contract

- `RENO/Web-PlantEmoji` is the immutable visual source of truth.
- `/` is rewritten to `/farm/index.html` by `next.config.ts`.
- Static assets referenced from the rewritten document must use `/farm/...`
  absolute URLs because the browser-visible URL remains `/`.
- `public/farm/style.css` and `public/farm/assets/logo.png` stay byte-identical
  to the designer's source assets.
- `public/farm/live.js` may update values inside existing designer elements,
  but must not add panels, overlays, or CSS that changes the composition.
- Existing Supabase schemas, RLS, Node-RED flow, game engines, and API routes
  remain unchanged.

## Shared tab design

- React-backed tabs are wrapped by `src/components/reno-app-shell.tsx` from
  the root layout. The shell mirrors RENO's sky, ambient animation, logo,
  glass sidebar, pixel typography, colors, spacing, and responsive top nav.
- `/plants` and `/settings` intentionally share the existing settings data
  screen while keeping distinct navigation destinations and active states.
- `/reports`, `/quests`, and `/collection` keep their existing server-side
  data and actions; only their surrounding shell and presentation theme are
  changed.
- Camera AI and Shop remain visibly disabled until real routes exist. Never
  connect placeholder navigation to an unrelated backend action.

## Live data bindings

The adapter updates plant name and mood, speech, bond level, XP, streak,
temperature, humidity, light, and the health proxy. It uses the existing
browser-safe public config endpoint, Supabase Realtime, a 15-second polling
fallback, and the existing 60-second game tick. WATER and FERTILIZE remain
visual-only because there is no user-command API.

## Verification

Confirm `/`, `/farm/style.css`, `/farm/assets/logo.png`, and `/farm/live.js`
all return 200. Compare `/` with the RENO source at desktop, tablet, and
mobile sizes. Then run `npm test`, `npm run lint`, and `npm run build`. The
RENO source folder and backend/API/schema files must remain untouched.
