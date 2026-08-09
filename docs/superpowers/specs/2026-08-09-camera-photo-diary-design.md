# Camera AI — growth photo diary design spec (2026-08-09)

## Goal

Make the disabled "Camera AI" nav button real: students photograph the REAL
plant, the photo lands in the growth diary, and Jamkachu reacts with an
AI-voiced observation comment. AI stays language-only (project invariant):
it never judges, scores, or rewards — Gemini writes flavor text, and a
deterministic template speaks when Gemini is unavailable.

User decisions (2026-08-09): growth photo diary + AI comment (no AI
health-diagnosis rewards); photos in Supabase Storage.

## Flow

1. `/camera` (new React route, pixel-farm styled; sidebar Camera button
   enabled in both navs). Capture via `<input type="file"
   accept="image/*" capture="environment">` — works on school-managed
   Androids with no permissions ceremony; getUserMedia live preview is a
   roadmap upgrade, not MVP.
2. Client compresses on-canvas (max edge 1280px, JPEG q0.8) before upload —
   school networks are slow and Storage is metered.
3. Upload to Supabase Storage bucket `plant-photos`, path
   `plant-01/<wib-date>-<ts>.jpg`, via a server action using the existing
   server client (browser never holds write credentials).
4. Server action calls the comment layer: Gemini Vision (existing optional
   `GEMINI_API_KEY`, server-only) with a Jamkachu-voice prompt in the active
   locale → one warm 1-2 sentence observation ("new leaf on the left!").
   On missing key / failure / timeout (4s cap): deterministic template built
   from the latest sensor snapshot (same fallback contract as
   `/api/mood-message`). The comment is NEVER parsed for game decisions.
5. A `growth_records` row is created (the diary's existing table) with new
   columns `photo_url` + `ai_comment` — the photo diary IS the growth diary,
   one timeline, no second feed. Diary page renders photo thumbnails inline
   with records; farm-home memories may quote the comment later (roadmap).
6. Deterministic reward tie-in (allowed because it is not AI-judged): the
   FIRST photo of each WIB day grants +1 Seed via
   `award_seeds(plant_id, 1, 'photo:<wib-date>')` — idempotent by key, so
   spamming photos earns nothing more.

## Privacy & safety (kids, school devices, possible KBS filming)

- UI copy (en/id) instructs: photograph the PLANT only ("식물만 찍어요" /
  "Foto tanamannya saja, ya!").
- Bucket is public-read for MVP (single shared classroom plant, no personal
  albums); path never contains student names. Roadmap: authenticated reads
  if per-student accounts ever exist.
- Gemini prompt instructs: comment on the plant only; never describe people;
  if a person is visible, respond with the generic template line instead.
- 5MB pre-compression cap client-side; server action re-validates MIME +
  size (never trust the client).

## Data (milestone19-photo-diary.sql)

Storage bucket `plant-photos` (public read, authenticated write via service
role) + `growth_records.photo_url text` / `ai_comment text` columns.
Additive, re-runnable. Missing migration/bucket → `/camera` shows the
operator-note "coming soon" state (quiz.js migration-note pattern); diary
renders records without thumbnails. Depends on milestone18 only for the +1
Seed grant — without it the photo still saves, the grant is skipped
gracefully.

## Error handling

- Upload failure (offline) → photo stays on-page with a retry button; no
  record row until upload succeeds (no dangling URLs).
- Gemini failure → template comment, marked internally (`ai_comment` still
  stored; source flag not shown to kids).
- Storage bucket missing → surfaced operator note, camera input disabled.

## Testing

- Unit: comment-layer fallback selection (no key / error / timeout →
  template; template output localized), reward-key formatting
  (`photo:<wib-date>` uses WIB not device timezone), server-action
  validation rejects >5MB and non-image MIME.
- Full suite + build green.

## Out of scope (roadmap)

getUserMedia live viewfinder; time-lapse strip from accumulated photos;
AI comment quoting in farm-home memories; per-student albums.

## User actions after merge

Run `supabase/milestone19-photo-diary.sql`; verify `GEMINI_API_KEY` in
Vercel if AI comments are wanted (works without it via templates); redeploy.
