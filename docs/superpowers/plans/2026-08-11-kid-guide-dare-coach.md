# Kid-Friendly Guide: "Dare Coach + One Sticker Book" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 10-year-old who has never seen PlantMoji discovers and masters every feature in their first week with no adult present — each feature taught the moment it is met, by doing (a "dare"), with a replayable picture sticker book as the single help home.

**Architecture:** Synthesis of a 3-design judge panel (workflow wf_5a9abb2e-576): contextual coach skeleton (per-surface first-visit spotlights, one seen-state, one hub) + learn-by-doing dare/sticker dopamine layer + character split (Jamkachu dares on the farm; Grandpa Tani is the "I still don't get it" door). Two coach hosts share one contract: farm `pmCoach()` generalized from the existing tour engine, React `coach-mark.tsx` extracted from app-guide.

**Tech Stack:** vanilla farm layer (live.js/strings.js), React shell, one shared seen-store (`pm_seen_v3` JSON blob) and one card source (`public/farm/help-book.json`, en+id).

## Global Constraints

- Copy reads at an 8-year-old level; "senses" never "sensors" in kid copy; every string en+id (parity-tested).
- Dares/coaches grant FX + cosmetic Book stickers ONLY — never XP/seeds/quests; quest truth ("my real senses check your work — buttons alone can't finish a mission") is restated at hatch, /quests coach, and quiz coach.
- Never a wall of text: dim + spotlight + emoji + ONE sentence; the final card of every coach is an ACTION dare, never a read-only close.
- Invitations, not locks: pacing is context-driven (max 2 undone dares/day), never calendar-gated; everything replayable forever from the `?` Book.
- Existing surfaces are consolidated, not multiplied: guide modal → Book; how-to-play-map → Book index page; both old seen-flags migrate into `pm_seen_v3`.
- Concurrency discipline: re-read files before editing, own files exclusively per task, full QA gate (vitest+lint+build) before each commit, hunk-filtered staging if a shared file is dirty, verify committed-HEAD self-consistency after staging.

---

### Task 1 (S, P1): Dead-affordance fixes
**Files:** public/farm/index.html (#current-quest ~L624), public/farm/style.css, public/farm/live.js
- [ ] `#current-quest` panel becomes a real link to /quests (whole-card tap target ≥44px)
- [ ] Env tiles read as pressable: pressed-button styling + a one-time wiggle until first tap (seen-gated)
- [ ] Update index.html-pinning tests

### Task 2 (S, P1): Unified seen-store
**Files:** public/farm/seen.js (new), src/lib/seen.ts (new), public/farm/live.js (~L504-514), src/components/app-guide.tsx, tests/farm-onboarding-tour.test.ts, tests/app-guide.test.ts
- [ ] One JSON blob `pm_seen_v3`; API: seen(id), markSeen(id), reset()
- [ ] First read migrates pm_hatched, pm_tour_seen_v1, plantmoji_guide_seen_v1/v2
- [ ] Both hosts read/write only this store; replay = clear one flag
- [ ] Re-pin flag-name tests to the store + migration

### Task 3 (M, P1): Coach engine, two hosts
**Files:** public/farm/live.js (generalize runFirstDayTour ~L5497 → pmCoach(id, cards)), src/components/coach-mark.tsx (new, extracted from app-guide.tsx)
- [ ] Shared contract: dim + spotlight + emoji + 1 sentence; final card = action dare; completing fires FX queue + markSeen; zero reward writes
- [ ] app-guide.tsx becomes a consumer of coach-mark.tsx (behavior identical)
- [ ] Contract test pinning the action-dare final card + no XP writes

### Task 4 (M, P1): Help Book (sticker book hub)
**Files:** public/farm/index.html (guide dialog ~L726-733), public/farm/live.js (renderer), src/components/help-hub.tsx (new), public/farm/help-book.json (new, en+id), src/app/settings/page.tsx (drop HowToPlayMap), src/components/how-to-play-map.tsx (delete), replay-guide-button.tsx (repurpose as per-sticker "Show me")
- [ ] One card source renders both hosts; done dares = colored stickers, todo = silhouette + hint emoji
- [ ] Every sticker: "Show me" deep-links and replays its coach
- [ ] Book index page = the old SENSE→GROW 6-icon map
- [ ] Update settings/ui-shell/how-to-play test pins

### Task 5 (S, P1): Hatch → Book handoff
**Files:** public/farm/strings.js (hatch/tour groups en+id), public/farm/live.js
- [ ] Tour gains a final card: Grandpa waves — "Lost? Tap me, or fill my sticker book here →" pointing at the `?` FAB
- [ ] Parity + tour tests updated

### Task 6 (M, P2): Day-1 farm dares
**Files:** public/farm/discover.js (new, trigger table only), public/farm/live.js, public/farm/strings.js
- [ ] Six dares: tap Jamkachu · care button · one env tile · quiz chip · quest link · ask Grandpa one question
- [ ] Context triggers (tab, mood, pending actions), max 2 undone dares/day; rendering stays in pmCoach

### Task 7 (M, P2): Per-surface first-visit coaches
**Files:** src pages/components per surface + quiz.js; help-book.json entries
- [ ] /quests 2 cards incl. the honesty card; quiz pre-Q1 card; /collection + sub-tab micro-cards; /camera wave + ✨ toggle; /diary ruler ritual; wardrobe bond explanation; streak-day-2 popover; /monitoring "grown-up numbers" banner; first-seed coach fires on farm home
- [ ] No coach for Cheat Mode / admin surfaces

### Task 8 (S, P2): What-Now ambient pull
**Files:** src/components/what-now.tsx
- [ ] "One new dare is waiting! 📖" state, shown only when no care/quest action pending

### Task 9 (M, P3): Secret gestures as collectibles
**Files:** public/farm/live.js, src/components/collection-tabs.tsx, help-book.json
- [ ] One whispered hint/day from day 2 (double-tap hop, long-press, slow-drag lullaby, 3 ticklish spots, flame tap, seeds tap); discovery stamps a sticker + a dex-style reveal; zero reward writes

### Task 10 (S, P3): Grandpa contextual prompts
**Files:** src/components/farmer-chat-dialog.tsx
- [ ] Canned questions rotate per page ("What's a badge?" on /collection)

### Task 11 (S, P3): Finale
- [ ] All stickers → one-time confetti + golden book cover + cosmetic title "Penjelajah Jamkachu"; no XP/seeds

### Task 12 (M, P3): Copy pass + tests
- [ ] All new strings en+id, parity test extension, pm_seen_v3 migration test, honesty-card presence test

## Self-Review Notes
- All 12 items map 1:1 to the judged blueprint; verified anchors (live.js L504/5306/5497, index.html L624/L726) checked against HEAD by the audit agents.
- No placeholders; each task names exact files and the deliverable behavior.
- Interfaces: pmCoach(id, cards) + seen.js/seen.ts store + help-book.json schema are the three cross-task contracts — defined in Tasks 2-4, consumed by 5-11.
