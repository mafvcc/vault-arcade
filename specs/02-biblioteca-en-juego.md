# SPEC 02 — Biblioteca en `/juego`

> **Estado:** Implementado · **Depende de:** 01-mvp-visual · **Fecha:** 2026-06-24
> **Objetivo:** Mover la pantalla de Biblioteca de `/` a `/juego`, dejando `/` como redirect permanente a `/juego`.

---

## Alcance

**Dentro:**

- Crear `app/juego/page.tsx` con el contenido actual de la Biblioteca (hero, buscador, chips de categoría, grid), `"use client"`, movido tal cual desde `app/page.tsx`.
- Convertir `app/page.tsx` en un Server Component que hace `redirect("/juego")` (permanente).
- Actualizar las 8 referencias a `/` para que apunten a `/juego`:
  - `app/components/Nav.tsx`: logo (`href="/"`), enlace "Biblioteca" desktop y móvil, y el cálculo de `isLibrary`.
  - `app/auth/page.tsx`: `router.push("/")` tras login y tras invitado (×2).
  - `app/salon/page.tsx`: `router.push("/")` del botón "volver".
  - `app/juego/[id]/page.tsx`: `href="/"` del botón "volver".
  - `app/jugar/[id]/page.tsx`: `router.push("/")` del botón "volver".

**Fuera de alcance:**

- Cambiar el diseño, los datos o la lógica de la Biblioteca (solo se mueve).
- Tocar `/juego/[id]` (detalle), `/jugar/[id]`, `/auth` o `/salon` salvo el enlace de "volver".
- Cualquier landing nueva en `/` (solo redirige).
- Tests automatizados (no hay runner).

---

## Modelo de datos

No aplica — no se introducen estructuras nuevas; solo se mueve marcado y se actualizan rutas.

---

## Plan de implementación

1. **Crear `app/juego/page.tsx`** — mover el contenido completo de `app/page.tsx` (componente `Home`, `"use client"`, hero + buscador + chips + grid + `GameCard`). El import de `GameCard` pasa de `"./components/GameCard"` a `"../components/GameCard"` (o `"@/app/components/GameCard"`). Verificación: `/juego` muestra hero, buscador, chips y grid de 8 juegos; filtrar/buscar funciona.

2. **Reemplazar `app/page.tsx` por un redirect** — Server Component (sin `"use client"`) que llama `redirect("/juego")`. Consultar `node_modules/next/dist/docs/` para la API correcta de `redirect` en Next 16. Verificación: visitar `/` redirige a `/juego`.

3. **Actualizar `app/components/Nav.tsx`** — logo y enlace "Biblioteca" (desktop + móvil) a `href="/juego"`; `isLibrary` basado en `pathname.startsWith("/juego") || pathname.startsWith("/jugar")`. Verificación: "Biblioteca" navega a `/juego` y se marca activo en `/juego` y `/juego/[id]`.

4. **Actualizar redirecciones "volver"** — `auth/page.tsx` (×2), `salon/page.tsx`, `juego/[id]/page.tsx`, `jugar/[id]/page.tsx`: cambiar `"/"` por `"/juego"`. Verificación: login/invitado, y los botones "volver" del salón, detalle y reproductor llegan a `/juego`.

5. **Limpieza** — `npm run build` y `npm run lint` sin errores; revisar que no quede ninguna referencia colgante a `/` salvo el propio redirect. Verificación: `grep` de `"/"` en enlaces/redirecciones solo aparece en `app/page.tsx`.

Nota: antes de escribir el redirect consultar la guía en `node_modules/next/dist/docs/` (Next 16 puede tener cambios en la API de routing/`redirect`).

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] Visitar `/` redirige a `/juego`.
- [ ] `/juego` muestra hero, buscador, chips y grid con los 8 juegos.
- [ ] Buscar por nombre y filtrar por categoría siguen funcionando en `/juego`; sin resultados aparece "NO HAY RESULTADOS".
- [ ] Una card o "JUGAR" navega a `/juego/[id]` del juego correcto (sin regresión).
- [ ] El logo y "Biblioteca" de la Nav navegan a `/juego`; el enlace se marca activo en `/juego` y en `/juego/[id]`.
- [ ] Tras login o entrar como invitado en `/auth`, la redirección lleva a `/juego`.
- [ ] Los botones "volver" de salón, detalle y reproductor llevan a `/juego`.
- [ ] No queda ninguna referencia a `/` en enlaces/redirecciones salvo el `redirect` de `app/page.tsx`.

---

## Decisiones

- **Sí:** `/` hace `redirect("/juego")`. Una sola fuente de verdad para la Biblioteca; los enlaces antiguos y bookmarks a `/` siguen funcionando.
- **No:** eliminar `app/page.tsx` y dejar `/` en 404. Rompería enlaces existentes y el patrón de raíz del App Router.
- **No:** una landing nueva en `/`. Abre alcance propio; si llega, irá en su spec.
- **Sí:** anidar `/juego` (índice, Biblioteca) con `/juego/[id]` (detalle). Idiomático en App Router; URLs coherentes bajo `/juego`.
- **Sí:** mover el marcado de la Biblioteca tal cual, sin rediseñar. El objetivo es solo el cambio de ruta.
- **Sí:** actualizar las 8 referencias a `/` (incluido el logo) para que apunten a `/juego`. Evita un salto extra por el redirect en la navegación interna.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| API de `redirect` distinta en Next 16 | Consultar `node_modules/next/dist/docs/` antes de escribir `app/page.tsx`; usar el `redirect` de `next/navigation` en Server Component. |
| `isLibrary` deja de marcarse activo al quitar `pathname === "/"` | Basarlo en `startsWith("/juego")`; como `/` redirige, nunca se renderiza la Nav en `/`. |
| Import de `GameCard` roto al mover `page.tsx` a `app/juego/` | Ajustar la ruta relativa del import en el paso 1 y verificar con `build`. |
