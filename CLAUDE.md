# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical: Next.js version

This is **Next.js 16.2.9** with React 19 and Tailwind CSS v4 — newer than training data and with breaking changes. Before writing any Next.js code (routing, data fetching, config, params, caching), read the relevant guide under `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`, `index.md`). Heed deprecation notices.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm start` — serve production build
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)

No test runner is configured.

## Project

Arcade Vault — online arcade platform to compete for points (see `README.md`, in Spanish). UI/comments in Spanish; neon-pixel theme.

Built with **Spec Driven Design** via the `/spec` and `/spec-impl` skills (from `Klerith/fernando-skills`, installed with `npx skills@latest add Klerith/fernando-skills`). Each feature is a numbered spec in `specs/` shipped via its own PR.

## Stack additions

- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) — catalog + scores persistence, session.
- **Resend** (`resend`) — contact form email.
- Fonts via `next/font/google`: Press Start 2P (pixel), JetBrains Mono, Courier Prime.

## Architecture

- App Router under `app/`. `layout.tsx` is async: server-loads the `games` catalog from Supabase and wraps the tree in `<AuthProvider>` + `<GamesProvider>`.
- `@/*` path alias → repo root. TypeScript `strict`. Tailwind v4 via `@tailwindcss/postcss`; styles in `app/globals.css`.

### Routes

- `/` landing/home · `/juego` game library (filter by `CATS`) · `/juego/[id]` detail + leaderboard (server-rendered) · `/jugar/[id]` playable game · `/salon` hall of fame (per-game top scores) · `/auth` login · `/about` about + contact form.
- `app/api/contact/route.ts` — POST handler, sends mail via Resend (`RESEND_API_KEY`).

### Data & state

- Catalog lives in Supabase table `games`; read server-side in `layout.tsx` and propagated via `<GamesProvider>` → `useGames()`. Never import a static games array — use the hook. `lib/data.ts` holds only the `Game` type and static `CATS`.
- Scores in table `scores` (FK → `games.id`). Written via `useAuth().saveScore(...)`, read for leaderboards.
- Session: `<AuthProvider>` (`useAuth()`) — a localStorage-backed store over `useSyncExternalStore` (`av_user` key). Lightweight, not real Supabase auth yet.

### Supabase clients (`lib/supabase/`)

- `client.ts` — browser client (Client Components). `server.ts` — async server client (cookies). `middleware.ts` `updateSession()` — refreshes session per request, invoked from root `proxy.ts` (Next 16 renamed `middleware` → `proxy`; no route protection yet). `database.types.ts` — generated DB types.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Migrations in `supabase/migrations/`.

### Games

- Each game is a self-contained TS engine in `lib/games/` (`asteroids`, `tetris`, `arkanoid`, `snake`). No module globals — state lives in the instance from `create<Game>Game()`; canvas is the source of truth and pushes score/lives/etc. to React via callbacks. SSR-safe (Image/Audio created in `start()`).
- React wrappers in `app/jugar/[id]/` (`AsteroidsPlayer`, etc.). `page.tsx` holds a `PLAYERS` registry (id → player); unmapped ids fall back to `MockPlayer`. Adding a real game = one registry entry + an engine + a DB row.
- Assets in `public/games/`, `public/snake-assets/`. Source material ported in `references/started-games/` and `references/resources/`.
