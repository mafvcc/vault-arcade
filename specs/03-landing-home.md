# SPEC 03 — Landing en `/`

> **Estado:** Implementado · **Depende de:** 01-mvp-visual, 02-biblioteca-en-juego · **Fecha:** 2026-06-24
> **Objetivo:** Reemplazar el redirect de `/` por una landing portada de `home.jsx`, dejando la Biblioteca en `/juego`.

---

## Alcance

**Dentro:**

- **`app/page.tsx`** pasa de `permanentRedirect("/juego")` a renderizar la landing (Home), portada de `references/.../home-about/home.jsx` como componente `"use client"` (usa `IntersectionObserver` para el efecto `reveal`).
- Secciones de la landing portadas tal cual: HERO (siluetas flotantes + CTAs), `// 01` ¿Por qué Arcade Vault? (feature-grid), `// 02` Juegos disponibles (mini-rail con `GAMES.slice(0,6)`), STATS, `// 03` Actividad en vivo (ticker + top jugadores), `// 04` Precios (price-card + FAQ) y CTA final.
- **`app/components/Nav.tsx`** — añadir enlace "Inicio" (→`/`), orden Inicio·Biblioteca·Salón de la Fama; logo apunta a `/`; estado activo: "Inicio" en `/`, "Biblioteca" sigue activa en `/juego` y `/jugar`. Desktop y panel móvil.
- **`app/globals.css`** — portar desde `references/.../home-about/styles.css` solo las clases del landing que faltan: `home-*`, `feature-grid`/`feature-card`/`ft-*`, `mini-rail`/`mini-card`/`mini-*`, `home-stats`/`stat-*`, `activity-*`/`ac-*`/`ticker`/`tick-*`/`top-*`/`tp-*`/`lb-link`, `pricing-*`/`price-card`/`pc-*`/`faq-*`, `home-final`/`final-*`. Sin tocar las clases ya existentes.
- CTAs y navegación de la landing mapeados con `next/link`/`useRouter`: "Explorar juegos"/"Ver todos"/"Insertar moneda" → `/juego`; "Crear cuenta"/"Empezar gratis" → `/auth`; mini-card → `/juego/[id]`; "Ver salón" → `/salon`.

**Fuera de alcance:**

- **Página "Acerca de" (`about.jsx`) y su enlace en la Nav** — diferido a otro spec.
- Conectar Actividad en vivo, top jugadores, stats y FAQ a datos reales — quedan **hardcodeados** tal como en `home.jsx`.
- Rediseñar la Biblioteca, el detalle, el reproductor, el salón o el auth (solo se actualiza la Nav compartida).
- Tocar `lib/data.ts` salvo lectura de `GAMES`.
- Tests automatizados (no hay runner).

---

## Modelo de datos

No aplica — no se introducen estructuras nuevas ni se modifica `lib/data.ts`. El mini-rail lee `GAMES` (`GAMES.slice(0,6)`); el resto (actividad, top jugadores, stats, features, precios, FAQ) son arrays literales inline dentro del componente, sin estado ni persistencia.

---

## Plan de implementación

1. **Portar CSS del landing a `app/globals.css`** — copiar desde `references/.../home-about/styles.css` solo las clases que faltan (las del bloque "Dentro" del alcance), al final de `globals.css`. Verificar que no haya colisión de nombres con las existentes antes de pegar. *Verificación:* `grep` confirma que `home-hero`, `feature-grid`, `mini-card`, `activity-grid`, `pricing-grid`, `home-final` existen una sola vez en `globals.css`.

2. **Crear el componente Home en `app/page.tsx`** — reemplazar el redirect por el componente `"use client"` portado de `home.jsx`, con sus subcomponentes `FloatingSilhouettes`, `MiniCard` y `FeatureIcon`, y el hook `useReveal` (`IntersectionObserver`). Importar `GAMES` desde `@/lib/data`. Sustituir todas las llamadas `navigate({...})` por navegación real (`Link`/`useRouter`): biblioteca→`/juego`, auth→`/auth`, detalle→`/juego/[id]`, salon→`/salon`. *Verificación:* `/` muestra las 6 secciones (hero, 01–04, CTA final) sin error de hidratación en consola.

3. **Cablear la navegación de los CTAs y mini-cards** — "Explorar juegos"/"Ver todos los juegos"/"Insertar moneda" → `/juego`; "Crear cuenta"/"Empezar gratis" → `/auth`; cada mini-card → `/juego/[id]` del juego; "Ver salón" → `/salon`. *Verificación:* cada botón/card llega a la ruta correcta.

4. **Actualizar `app/components/Nav.tsx`** — logo → `/`; añadir enlace "Inicio" (→`/`) como primero; orden Inicio·Biblioteca·Salón de la Fama en desktop y en el panel móvil; `isHome = pathname === "/"`; `isLibrary` se mantiene en `/juego`/`/jugar`. *Verificación:* "Inicio" navega a `/` y se marca activo solo en `/`; "Biblioteca" sigue activa en `/juego` y `/juego/[id]`.

5. **Limpieza** — `npm run build` y `npm run lint` sin errores; sin warnings de hidratación; confirmar que `/juego` (Biblioteca) sigue intacta y que ya no existe redirect desde `/`. *Verificación:* build/lint limpios y `/` ya no redirige.

Nota: antes de tocar `app/page.tsx` (Server→Client) consultar `node_modules/next/dist/docs/` por si hay cambios en Next 16 sobre Client Components en la raíz / metadata.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en `/`.
- [ ] Visitar `/` ya **no** redirige a `/juego`; muestra la landing.
- [ ] La landing renderiza las 6 secciones: HERO, `// 01` features (4 cards), `// 02` mini-rail con 6 juegos de `GAMES`, STATS, `// 03` actividad (ticker + top jugadores), `// 04` precios + FAQ, y CTA final.
- [ ] El efecto `reveal` (fade-in al hacer scroll) funciona en las secciones.
- [ ] "Explorar juegos", "Ver todos los juegos" y "Insertar moneda" navegan a `/juego`.
- [ ] "Crear cuenta" y "Empezar gratis" navegan a `/auth`.
- [ ] Cada mini-card navega a `/juego/[id]` del juego correcto.
- [ ] "Ver salón" navega a `/salon`.
- [ ] La Nav muestra Inicio·Biblioteca·Salón de la Fama (sin "Acerca de"); el logo lleva a `/`.
- [ ] "Inicio" se marca activo solo en `/`; "Biblioteca" sigue activa en `/juego` y `/juego/[id]`.
- [ ] El panel móvil refleja el mismo conjunto y orden de enlaces.
- [ ] `/juego` (Biblioteca) sigue funcionando igual que antes (sin regresión).

---

## Decisiones

- **Sí:** `/` deja de redirigir y pasa a ser la landing; la Biblioteca se queda en `/juego`. El landing es ahora la cara del sitio y la Biblioteca ya tiene su ruta propia (spec 02).
- **Sí:** `app/page.tsx` como Client Component (`"use client"`). El landing necesita `IntersectionObserver` (reveal) e interacción; no hay datos de servidor que justifiquen SSR especial.
- **No:** extraer el Home a `app/components/Home.tsx`. Vive solo en `/`; mantenerlo en `page.tsx` evita indirección innecesaria (se puede extraer si luego se reutiliza).
- **Sí:** mantener hardcodeados ticker, top jugadores, stats y FAQ tal como en el prototipo. Son decorado visual; conectarlos a datos reales abriría su propio alcance.
- **Sí:** sacar "Acerca de" (`about.jsx`) de este spec. Es una pantalla con formulario propio; merece su spec para no inflar este.
- **No:** añadir el enlace "Acerca de" a la Nav todavía. Apuntaría a una ruta inexistente; entra junto con su página.
- **Sí:** portar solo las clases CSS que faltan a `globals.css`, sin tocar las existentes. Evita divergencia visual y duplicación.
- **Sí:** reusar `GAMES` de `lib/data.ts` para el mini-rail. Única fuente de verdad de los juegos.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Colisión de nombres de clase al pegar el CSS del prototipo en `globals.css` | `grep` de cada clase antes de pegar; portar solo las ausentes (paso 1). |
| Desajuste de hidratación si algún array "aleatorio" se renderiza en servidor | Los arrays son literales fijos; el `IntersectionObserver` vive en `useEffect`. Sin `Math.random` en render. |
| `navigate({...})` del prototipo sin equivalente real deja botones muertos | Mapear cada CTA a su ruta en el paso 3; cubierto por criterios de aceptación. |
| Quitar el redirect rompe bookmarks a `/` que esperaban la Biblioteca | Aceptado: `/` es ahora la landing; la Biblioteca tiene enlace propio en la Nav y CTAs. |
