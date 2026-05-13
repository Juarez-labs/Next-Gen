# Lotería App — Build Plan

> **For the Next Gen team:** This document describes the full roadmap for the Lotería custom game card builder app. Phase 1 (MVP) is already implemented — see the `loteria/` folder. Phase 2 and 3 are next.

**Paperclip issue:** BOAA-397
**Reference playbook:** `loteria_game_creation_playbook.md` (in Downloads — ask the board for a copy)

---

## Overview

A web app that lets users create fully custom **Lotería-style game card decks** — from theme selection and AI-generated card art through board generation and printable PDF export.

The **Ultra feature** (Phase 3) enables users to upload photos of friends/family, which are transformed into cartoon/animated characters via Higgsfield AI, then embedded as custom Lotería card characters.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR + API routes in one repo |
| Language | TypeScript | Type safety for card/board data models |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent UI |
| Database | Supabase (PostgreSQL) | Auth + storage + DB in one |
| File storage | Supabase Storage (S3-compatible) | Card images, exports, uploads |
| Image processing | Sharp + node-canvas | Card rendering, board layout, resizing |
| PDF export | Puppeteer (headless Chrome) | Faithful render of board layouts to PDF |
| AI image gen | Higgsfield AI | Card art generation + ultra photo-to-cartoon |
| Deployment | Vercel | Native Next.js; auto-deploys from GitHub |

---

## Phase 1 — MVP ✅ COMPLETE

### What's already built (in `loteria/`)

- **Supabase DB schema** — `supabase/migrations/`: projects, cards, boards, validation_reports, exports tables
- **Board generator** — `lib/loteria/board-generator.ts`: 4 modes (casual random, balanced, perfect balance via max-flow, corner-balanced)
- **Validation engine** — `lib/loteria/validator.ts`: full deck/board validation with structured reports
- **Higgsfield client** — `lib/loteria/higgsfield.ts`: text-to-image card art, image-to-image (Phase 3 ready), job polling
- **Card renderer** — `lib/loteria/card-renderer.ts`: node-canvas card layout (number, English name, art, Spanish name)
- **PDF exporter** — `lib/loteria/pdf-exporter.ts`: Puppeteer pipeline, batched board PDFs, caller deck, card index CSV, ZIP
- **API routes** — `/api/loteria/generate-card-image`, `/api/loteria/job-status/[jobId]`, `/api/loteria/export/*`
- **CardEditor UI** — `components/loteria/CardEditor.tsx`: per-card approve/regenerate/upload

### Routes
- `/loteria` — project dashboard (list + create)
- `/loteria/[projectId]/deck` — card management
- `/loteria/[projectId]/boards` — board generation
- `/loteria/[projectId]/export` — export options

---

## Phase 2 — Live Play Mode

**Remaining work for the team:**

### Live Caller Mode (`/loteria/[projectId]/caller`)
- Shuffle the 54-card deck on game start
- "Draw next card" button — show card full-screen with number and name
- Text-to-speech announcement of the card name
- Running call history panel
- Reset round

### Winner Verification
- Input: board number + selected win condition (line / corners / diagonal / full)
- Compare board cards against called-card history
- Output: Valid/Invalid with the winning pattern highlighted on a board preview

### Saved Projects (Supabase Auth)
- User sign-up / sign-in
- Projects scoped to `user_id`
- Project list on dashboard

### Board Style Presets
- Classic Grey (current default)
- Fiesta Color
- Vintage Parchment
- Minimal White
- Holiday / Christmas

### Additional features
- Custom board counts (10 / 25 / 54 / 100 / custom)
- Multi-language support for card names (Spanish toggle already in data model)

---

## Phase 3 — Ultra: Photo-to-Character 🌟

**The flagship differentiator — most exciting feature.**

### User Flow
1. User uploads a photo of a friend/family member
2. **Required consent gate:** "I confirm I have permission to use this person's likeness in a game" ✓
3. User selects transformation style: cartoon / animated / watercolor / pixel art / vintage comic
4. App calls Higgsfield AI image-to-image with the photo + style prompt
5. Higgsfield returns the styled character illustration
6. User previews, crops, approves
7. User enters the card name (e.g., "El Abuelo", "La Maestra", "El Campeón")
8. Card rendered with character art like any other card
9. **Ultra bonus:** `generate_video` animates the character for the digital caller mode — the card "comes to life" when called

### Files to build
- `components/loteria/PhotoUploader.tsx` — upload widget with consent checkbox, style selector, preview
- API route: `POST /api/loteria/photo-to-character` — calls `media_upload` + `media_confirm` + `generate_image` (img2img)
- Update `CardEditor.tsx` to handle `is_custom_photo` cards
- Optional: `generate_video` integration for animated caller display

### Higgsfield API mapping
| Feature | Higgsfield call |
|---|---|
| Standard card art (Phase 1) | `generate_image` (text-to-image) |
| Photo-to-cartoon character | `generate_image` with reference image |
| Animated character for caller mode | `generate_video` |
| User photo upload | `media_upload` + `media_confirm` |

### Privacy rules
- Consent checkbox is required — block the upload without it
- Photos are not stored beyond the project lifetime unless user explicitly opts in
- No biometric data or face recognition stored anywhere

---

## Data Models

```
projects
  id, name, theme, audience, tone, deck_size, board_size,
  board_count, status, style_preset, created_at, user_id

cards
  id, project_id, card_number, english_name, spanish_name,
  category, description, prompt, image_url, approved,
  version, is_custom_photo

boards
  id, project_id, board_number, label, card_ids[16],
  seed, created_at, locked_at

validation_reports
  id, project_id, board_count, passes, checks_json,
  card_frequencies_json, warnings, created_at

exports
  id, project_id, type, file_url, metadata_json, created_at
```

---

## MVP Acceptance Checklist

- [x] Scaffold Next.js app with routes
- [x] Supabase DB migrations
- [x] Board generator — all 4 modes
- [x] Validation engine — all checks from playbook
- [x] Higgsfield card art generation
- [x] Card renderer (text overlay, not via AI)
- [x] PDF export pipeline (batched boards + caller deck + ZIP)
- [ ] Project wizard UI (Phase 2)
- [ ] Live caller mode (Phase 2)
- [ ] Winner verification (Phase 2)
- [ ] Supabase Auth (Phase 2)
- [ ] Photo-to-character upload (Phase 3)
- [ ] Animated character caller mode (Phase 3)

---

## Key Engineering Rules (from the playbook)

1. **Never render text via AI image gen** — card names/numbers are always rendered in-app
2. **Validate every board set before export** — invalid card IDs (e.g., 55) must be impossible
3. **Persist approved layouts** — lock to DB with seed; never silently regenerate after approval
4. **Use a fixed board template** — creates professional-looking boards (see Appendix A in playbook)
5. **Export in small batches** — 5 boards per PDF to avoid download failures
6. **Photo consent is mandatory** — never skip the consent gate in Phase 3

---

## Getting Started (for contributors)

```bash
cd loteria
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, HIGGSFIELD_API_KEY
npm install
npm run dev
# App runs at http://localhost:3000/loteria
```

Run tests:
```bash
npm test
```
