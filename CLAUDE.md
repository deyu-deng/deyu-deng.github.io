# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal website and portfolio for "Turtlelet". A React SPA frontend with a Cloudflare Workers backend. The site showcases notes, music, 3D modeling, honors, and projects. It supports bilingual content (English/Chinese), dark/light themes, admin CRUD, and a guest request system for file downloads.

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, react-router-dom, react-markdown + remark-gfm, Zustand, lucide-react
- **Backend**: Cloudflare Worker (TypeScript), D1 (SQLite), R2 (object storage)
- **Deployment**: Frontend via Cloudflare Pages (auto-deploy from GitHub), Worker via `wrangler deploy`
- **Styling**: Pure CSS with CSS variables (`data-theme="light|dark"`), no Tailwind or CSS-in-JS library. Uses Google Fonts (Nunito, Noto Serif SC, ZCOOL XiaoWei, Space Mono).

## Common Commands

```bash
# Dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint

# Deploy backend worker
wrangler deploy

# Apply D1 schema
wrangler d1 execute turtlelet-db --file=worker/schema.sql
```

## Project Structure

```
src/
  App.tsx              # BrowserRouter + Routes
  main.tsx             # React root, imports globals.css
  pages/               # Route-level pages (HomePage, NotesPage, MusicPage, etc.)
  components/
    layout/            # Navbar, Footer
    sections/          # HomePage section components
    admin/             # LoginModal, CardEditor, GuestModal
    ui/                # ViewToggle, FileUpload, Tooltip, AnimBg
  lib/api.ts           # All API clients + helpers (tl, dl, buildCategoryTree, etc.)
  store/index.ts       # Zustand store (lang, theme, token, guestToken)
  types/index.ts       # Shared TypeScript interfaces
  styles/globals.css   # CSS variables, themes, animations, layout
worker/
  index.ts             # Cloudflare Worker: auth, CRUD, upload, file serving
  schema.sql           # D1 database schema
```

## Architecture

### Frontend

- **Routing**: `BrowserRouter` with static routes (`/`, `/notes`, `/music`, `/projects`, `/modeling`, `/honors`, `/guests`, `/view/:id`).
- **State**: `useAppStore` (Zustand) persists `lang`, `theme`, `token`, `guestToken` to `localStorage`. Theme is applied to `document.documentElement` via `data-theme` attribute.
- **API**: All HTTP requests go through `src/lib/api.ts`. `API_BASE` is read from `VITE_API_BASE` env var (empty string for same-origin). `makeApi<T>(slug)` generates list/get/create/update/remove methods for each resource.
- **i18n**: Bilingual content is stored as paired fields (`title_en`/`title_zh`, `desc_en`/`desc_zh`). Use `tl(obj, lang)` and `dl(obj, lang)` from `lib/api.ts` to select the right field. Default language is Chinese (`zh`).
- **Styling**: All styles are in `globals.css` using CSS custom properties that switch between light (green) and dark (purple) themes. Inline `style` props are used for dynamic/layout values in components.

### Backend (Worker)

- **Auth**: Two-tier system:
  - **Admin**: JWT (HS256) signed with `JWT_SECRET`. Returned on `/api/auth/login`. Required for all write operations.
  - **Guest**: UUID token stored in `guest_requests` table. Passed via `X-Guest-Token` header. Required for file downloads (read-only access).
- **CRUD**: Generic handlers loop over `SLUG` mapping (`/api/{slug}` → table name). `dbList`, `dbCreate`, `dbUpdate` handle query building and timestamp management. Some routes (`note-files` list, `note-categories` create) have explicit handlers for safer logging.
- **Upload**: Two-step process: `POST /api/upload/request` returns an R2 key, then `PUT /api/upload` with `X-File-Key` header uploads the binary body directly to R2.
- **File Serving**: `GET /api/file/{key}` streams from R2 with `Cache-Control: private, max-age=1800`.
- **Email**: Uses Resend API to notify admin on new guest applications.

### Data Model (D1)

| Table | Purpose |
|-------|---------|
| `timeline` | Homepage journey timeline |
| `note_categories` | Hierarchical note categories (max 3 levels via `parent_id`) |
| `notes` | Note metadata (files stored separately) |
| `note_files` | Multiple files per note |
| `resource_links` | External links on notes page |
| `songs` | Music entries with audio/cover R2 keys |
| `scores` | Sheet music scores |
| `models` | 3D modeling portfolio (links to GrabCAD/external URL) |
| `honors` | Awards/honors |
| `projects` | Software projects (`tab` = 'mine' or 'recommend') |
| `guest_requests` | Visitor download permission applications |

### Important Patterns

- **File association**: Notes no longer store file keys directly. The `note_files` table links to `notes.id`. When displaying a note, fetch its files via `note_id` filter.
- **Category tree**: `buildCategoryTree(cats)` in `lib/api.ts` converts flat `note_categories` rows into a nested tree for rendering.
- **Guest flow**: Visitor applies on `/guests` → admin approves in admin panel → visitor's token is stored in Zustand → file downloads include `X-Guest-Token` header.
- **Manual chunks**: Vite config splits `vendor` (react, router) and `markdown` (react-markdown, remark-gfm) into separate chunks.

## Environment Variables

### Frontend (`.env` / build time)
- `VITE_API_BASE` — API origin (empty for same-origin, or full URL for local dev against remote worker)

### Worker (Cloudflare Dashboard / wrangler secrets)
- `JWT_SECRET`, `ADMIN_PASSWORD`, `ALLOWED_ORIGIN`
- `RESEND_API_KEY`, `ADMIN_EMAIL`, `NOTIFY_FROM`

## Deployment Notes

- See `DEPLOY.md` for full deploy steps including D1 migrations.
- The worker CORS headers use `ALLOWED_ORIGIN` (not `*`) in production.
- R2 bucket name: `turtlelet-files`. D1 database name: `turtlelet-db`.
