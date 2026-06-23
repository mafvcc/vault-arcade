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

Arcade Vault — online gaming platform to compete for points (see `README.md`, in Spanish).

Built with **Spec Driven Design** via the `/spec` and `/spec-impl` skills (from `Klerith/fernando-skills`, installed with `npx skills@latest add Klerith/fernando-skills`).

## Architecture

- App Router under `app/` (`layout.tsx`, `page.tsx`, `globals.css`). Currently the default starter app.
- `@/*` path alias → repo root (`tsconfig.json`).
- TypeScript `strict` mode.
- Tailwind v4 via `@tailwindcss/postcss` (`postcss.config.mjs`); styles in `app/globals.css`.
- `references/` — present but empty.
