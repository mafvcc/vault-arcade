# SPEC 01 — MVP visual de Arcade Vault

> **Estado:** Implementado · **Depende de:** — · **Fecha:** 2026-06-23
> **Objetivo:** Portar las 7 pantallas del prototipo de `references/resources/templates/` a Next.js 16 (App Router) como interfaz puramente visual, sin lógica de juego ni backend.

---

## Alcance

**Dentro:**

- Las 5 rutas del App Router: `/` (Biblioteca), `/juego/[id]` (Detalle), `/jugar/[id]` (Reproductor), `/auth` (Acceso), `/salon` (Salón de la Fama).
- Componentes compartidos: `Nav` (barra superior + panel móvil), `GameCard`, y el pie de página, montados en `app/layout.tsx`.
- Datos mock tipados en `lib/data.ts` (`GAMES`, `CATS`, `seededScores`) portados de `data.jsx`.
- Sesión mock con `localStorage` (`av_user`) vía contexto cliente: iniciar sesión / invitado / cerrar sesión. Solo guarda un nombre.
- Guardado de puntuación falsa en `localStorage` (`av_scores`) desde el modal de Fin del Juego.
- Reproductor con simulación **visual** animada (ticker de puntos, vidas, nivel, pausa, modal Game Over). No es un juego.
- Fidelidad visual con el prototipo reutilizando las clases CSS ya presentes en `app/globals.css`.
- Navegación con `next/link` y `useRouter` (reemplaza el routing por hash del prototipo).

**Fuera de alcance (para futuros specs):**

- Cualquier juego real o motor de juego.
- Backend, API, base de datos o autenticación real (OAuth Google/GitHub son botones decorativos).
- Puntuaciones reales/persistentes en servidor; el Salón usa datos generados con semilla.
- Búsqueda/filtrado del lado servidor, paginación, i18n.
- Tests automatizados (no hay runner configurado).
- Responsive más allá de lo que ya trae el CSS del prototipo.

---

## Modelo de datos

No se introducen estructuras nuevas; se portan las del prototipo (`data.jsx`) a `lib/data.ts` con tipos TypeScript.

```ts
// lib/data.ts
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Game = {
  id: string;        // slug, p.ej. "bloque-buster"
  title: string;
  short: string;     // descripción corta (card)
  long: string;      // descripción larga (detalle)
  cat: string;       // "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"
  cover: string;     // clase CSS de portada, p.ej. "cover-bricks"
  color: GameColor;  // color del botón JUGAR
  best: number;      // mejor puntuación
  plays: string;     // partidas, p.ej. "12.4K"
};

export type ScoreRow = { rank: number; name: string; score: number; date: string };

export const GAMES: Game[];          // los 8 juegos del prototipo
export const CATS: string[];         // ["TODOS","ARCADE","PUZZLE","SHOOTER","VERSUS"]
export function seededScores(seed: number, count?: number): ScoreRow[];
```

Estado en cliente (no persiste estructura nueva, solo formas en runtime):

```ts
// Contexto de sesión (AuthProvider, "use client")
type User = { name: string } | null;

// localStorage
"av_user"   // JSON: { name } | null
"av_scores" // JSON: { game, score, name, at }[]
```

Convenciones:

- `seededScores` es determinista (PRNG con semilla) — mismas filas para la misma semilla, sin `Math.random` en render de servidor.
- El ticker de puntos del Reproductor sí usa `Math.random` pero solo dentro de un `useEffect` cliente.

---

## Plan de implementación

1. **`lib/data.ts`** — portar `GAMES`, `CATS` y `seededScores` desde `data.jsx` con los tipos `Game`/`ScoreRow`. Quitar las asignaciones a `window`. Verificación: `import` desde una página y log de `GAMES.length === 8`.

2. **`app/components/AuthProvider.tsx`** (`"use client"`) — contexto de sesión: lee/escribe `av_user` en `localStorage`, expone `{ user, login, signOut, saveScore }`. Verificación: provider montado en layout sin error de hidratación.

3. **`app/layout.tsx`** — añadir los divs de fondo `.av-bg` y `.av-noise`, envolver con `AuthProvider`, montar `<Nav/>`, `<main className="av-main">` y el `<footer>` del prototipo (`app.jsx`). Cambiar `lang="es"`. Verificación: marco visible en todas las rutas.

4. **`app/components/Nav.tsx`** (`"use client"`) — portar `nav.jsx`: logo, links (Biblioteca / Salón) con estado activo vía `usePathname`, contador de créditos, botón de sesión (usa contexto), hamburguesa + panel móvil. Navegación con `next/link`. Verificación: links cambian de ruta y marcan activo.

5. **`app/page.tsx` (Biblioteca)** — portar `biblioteca.jsx`: hero, buscador, chips de categoría (`"use client"` para filtro), grid. Extraer `app/components/GameCard.tsx` (`"use client"`, con el efecto tilt). Cada card enlaza a `/juego/[id]`. Verificación: buscar/filtrar funciona; cards visibles.

6. **`app/juego/[id]/page.tsx` (Detalle)** — portar `detalle.jsx`: portada, tags, stats, acciones, leaderboard con `seededScores`. `params` es `Promise` en Next 16 (`await params`). Botón "Jugar ahora" → `/jugar/[id]`. Si el id no existe → `notFound()`. Verificación: cada juego abre su detalle.

7. **`app/jugar/[id]/page.tsx` (Reproductor)** — portar `reproductor.jsx` (`"use client"`): HUD, arena CRT, ticker animado, pausa, modal Fin del Juego con guardado vía contexto. Verificación: el puntaje sube, pausa/fin funcionan, "Guardar" muestra el toast.

8. **`app/auth/page.tsx` (Acceso)** — portar `auth.jsx` (`"use client"`): tabs sesión/registro, formulario, "jugar como invitado", botones sociales decorativos. Al enviar → `login()` + `router.push("/")`. Verificación: entrar deja sesión activa en la Nav.

9. **`app/salon/page.tsx` (Salón de la Fama)** — portar `salon.jsx` (`"use client"` por las tabs): tabs por juego, podio, tabla, fila "tu mejor marca" si hay sesión. Verificación: cambiar de tab recalcula filas.

10. **Limpieza** — borrar assets del starter no usados (`next.svg`, `vercel.svg` si los hubiera) y referencias. Verificación: `npm run build` y `npm run lint` sin errores.

Nota: antes de escribir cualquier código de routing/params/fuentes consultar la guía en `node_modules/next/dist/docs/` (Next 16 tiene cambios; p.ej. `params` asíncrono).

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores.
- [ ] La consola del navegador no muestra errores ni warnings de hidratación en ninguna ruta.
- [ ] `/` muestra hero, buscador, chips y un grid con los 8 juegos.
- [ ] Escribir en el buscador filtra las cards por título; elegir una categoría filtra por `cat`; sin resultados aparece "NO HAY RESULTADOS".
- [ ] Hacer clic en una card o en "JUGAR" navega a `/juego/[id]` del juego correcto.
- [ ] `/juego/[id]` muestra portada, tags, stats y leaderboard; un id inexistente devuelve 404 (`notFound()`).
- [ ] "Jugar ahora" en el detalle navega a `/jugar/[id]`.
- [ ] En `/jugar/[id]` la puntuación sube sola; "PAUSA" la detiene y "REANUDAR" la continúa.
- [ ] "FIN" abre el modal de Fin del Juego; "Guardar puntuación" muestra el toast y escribe en `av_scores`.
- [ ] `/auth` permite iniciar sesión o entrar como invitado y redirige a `/`; tras iniciar sesión la Nav muestra el nombre del usuario.
- [ ] Cerrar sesión desde la Nav borra `av_user` y vuelve a mostrar "Iniciar Sesión".
- [ ] Recargar la página mantiene la sesión (persiste `av_user` en `localStorage`).
- [ ] `/salon` muestra tabs por juego, podio (01/02/03) y tabla; cambiar de tab recalcula las filas.
- [ ] Con sesión activa, `/salon` muestra la fila "TU MEJOR MARCA" con el nombre del usuario.
- [ ] La Nav marca como activo el enlace correcto según la ruta y el panel móvil abre/cierra.
- [ ] El marco (fondo `.av-bg`/`.av-noise`, Nav y footer) es visible en las 5 rutas.

---

## Decisiones

- **Sí:** rutas del App Router por archivo (`/`, `/juego/[id]`, `/jugar/[id]`, `/auth`, `/salon`). Idiomático en Next 16, URLs reales y compartibles, permite Server Components.
- **No:** replicar el routing por hash del prototipo. Funciona, pero desperdicia el App Router y el SSR.
- **Sí:** reutilizar las clases CSS ya portadas en `app/globals.css`. El trabajo visual ya está hecho; el spec solo porta el marcado.
- **No:** reescribir estilos con utilidades Tailwind. Duplicaría trabajo y arriesgaría divergencia visual con el prototipo.
- **Sí:** sesión mock con `localStorage` vía contexto cliente (`AuthProvider`). Mantiene la persistencia del prototipo sin backend.
- **No:** autenticación real / OAuth. Fuera de alcance; los botones sociales quedan decorativos.
- **Sí:** mantener la simulación animada del Reproductor (ticker, pausa, modal). Es decorado visual, no un juego.
- **No:** un juego real en el Reproductor. Explícitamente fuera de alcance.
- **Sí:** `seededScores` determinista para el Salón y los leaderboards. Evita desajustes de hidratación servidor/cliente.
- **Sí:** marcar como `"use client"` solo los componentes con interacción (Nav, GameCard, filtros, Reproductor, Auth, Salón); el resto como Server Components.
- **No:** tests automatizados. No hay runner configurado; la verificación es manual + `build`/`lint`.

---

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Desajuste de hidratación al leer `localStorage` (servidor no lo tiene) | Leer `av_user` dentro de `useEffect` en `AuthProvider`; estado inicial `null` y rehidratar en cliente. |
| `Math.random` del ticker rompiendo la hidratación | El ticker vive solo en `useEffect` del Reproductor (`"use client"`), nunca en render de servidor. |
| `params` asíncrono en Next 16 rompe `/juego/[id]` y `/jugar/[id]` | Consultar `node_modules/next/dist/docs/` y usar `const { id } = await params`. |
| Clase CSS de portada ausente para algún juego | Verificar que cada `game.cover` tenga su `.cover-*` en `globals.css` durante el paso 5/6. |

---

## Lo que **no** entra en este spec

- Juegos reales o motor de juego.
- Backend, API, base de datos o autenticación real (OAuth solo decorativo).
- Puntuaciones reales/persistentes en servidor.
- Tests automatizados.

Cada uno, si llega, irá en su propio spec.
