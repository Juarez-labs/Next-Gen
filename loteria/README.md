# Lotería Game Builder

A web app for designing custom Lotería decks — generate card art with AI, lay out
balanced 4×4 boards, validate, and export printable PDFs.

Tracked under the Loteria App initiative (BOAA-397). This package is the Next.js
front-end + API surface; backing data lives in Supabase.

## Tech

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui primitives
- **DB / Auth / Storage:** Supabase (migrations in `../supabase/migrations/`)
- **AI image gen:** Higgsfield AI (planned)
- **PDF export:** Puppeteer (planned)

## Getting started

```bash
# from this directory (loteria/)
cp .env.example .env.local        # then fill in Supabase + Higgsfield keys
npm install
npm run dev
```

The dev server runs at <http://localhost:3000>. The root `/` redirects to
`/loteria`.

### Routes (scaffolded, mostly stubs)

| Route | Purpose |
| --- | --- |
| `/loteria` | Project list + "Create new game" |
| `/loteria/[projectId]/deck` | Card concept + image management |
| `/loteria/[projectId]/boards` | Board generation + validation |
| `/loteria/[projectId]/export` | PDF / ZIP export pipeline |

### Supabase

Migrations live one level up, in `../supabase/migrations/`. With the Supabase CLI:

```bash
supabase start                # local dev DB
supabase db reset             # applies migrations from ../supabase/migrations/
```

Tables created by `0001_init.sql`:

- `projects` — top-level deck container
- `cards` — 54 cards per project
- `boards` — generated 4×4 layouts, locked on approval
- `validation_reports` — per-generation pass/fail + per-card frequencies
- `exports` — generated PDFs / ZIPs

Row-level security is enabled on every table; rows scope to `auth.uid()`.

## Roadmap

- **Phase 1 — MVP**: project wizard, deck + image generation, board generator, PDF export.
- **Phase 2 — Live play**: caller mode, winner verification, saved projects.
- **Phase 3 — Ultra**: photo-to-character via Higgsfield image-to-image.

See the build plan on the parent issue for full detail.
