# SPEC 08 — Tetris jugable en `/jugar/tetris`

> **Estado:** Aprobado · **Depende de:** SPEC 06 (asteroides jugable), SPEC 07 (tablas `games`/`scores`) · **Fecha:** 2026-06-25
> **Objetivo:** Añadir el juego nuevo "Tetris" al catálogo y hacerlo jugable de verdad en `/jugar/tetris`, portando `references/started-games/03-tetris/game.js` a un motor TS autónomo (modelo score/líneas/nivel, con pieza siguiente en un segundo canvas) que notifica su estado al HUD y al modal React, reutilizando las tablas `games`/`scores` y `saveScore` ya existentes.

---

## Alcance

**Dentro:**

- **Migración + seed (BD)** — `supabase/migrations/<timestamp>_add_tetris.sql` (siguiendo la convención de timestamp del repo, p.ej. `20260625120000_add_tetris.sql`), aplicada al remoto con `apply_migration` y versionada en git. **Inserta una sola fila** en `public.games` con el `id: "tetris"` (valores en §Modelo de datos). No toca `caida` ni ninguna otra fila; **no reordena** posiciones existentes (la fila entra en `position: 9`, al final del grid). No crea tablas ni políticas (ya existen por SPEC 07).
- **`lib/games/tetris.ts`** — motor TS autónomo portado desde `game.js`. Fábrica `createTetrisGame(canvas, nextCanvas, callbacks)` que devuelve un controlador con `start()`, `stop()`, `pause()`, `resume()`, `restart()`. Sin globales de módulo: todo el estado (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, acumuladores de caída) vive en el cierre de la fábrica. Recibe ambos canvas por parámetro (no `document.getElementById`). Registra sus listeners de teclado y los retira en `stop()`. Lógica del tablero en coordenadas de bloque (10×20, `BLOCK = 30`).
- **Port fiel de mecánicas**: las **8 piezas** del original — los 7 tetrominós (I, O, T, S, Z, J, L) **más la pieza "tuerca"** (la forma custom gris del original) —, **ghost piece** (proyección semitransparente, `alpha 0.2`), **wall kicks** `[0,−1,1,−2,2]`, **hard drop** (Espacio, +2/celda), **soft drop** (↓, +1/fila), rotación CW (↑ o X), `LINE_SCORES = [0,100,300,500,800] × nivel`, nivel = `floor(líneas/10)+1`, `dropInterval = max(100, 1000−(nivel−1)×90)`.
- **Segundo canvas "next"**: el motor recibe un `nextCanvas` aparte y dibuja en él la pieza siguiente (port del `drawNext` original). El Player expone un 2º `ref` para ese canvas dentro del HUD React.
- **Callbacks motor → React**: `onScore(score)`, `onLines(lines)`, `onLevel(level)`, `onGameOver(finalScore)`, `onPlaying()`. El canvas es la fuente de verdad y empuja el estado hacia arriba. **Se reemplaza `onLives` (modelo de Asteroides) por `onLines`** (líneas completadas), que es el contador propio de Tetris.
- **`app/jugar/[id]/TetrisPlayer.tsx`** (`"use client"`) — monta el canvas principal y el canvas "next" con sendos `ref`, instancia el motor en `useEffect` (con limpieza en el unmount), refleja **puntuación/líneas/nivel** en el HUD React, y enruta `onGameOver` al modal existente (guardado con `useAuth().saveScore`) y `onPlaying` para cerrarlo. Cablea PAUSA/FIN/SALIR/JUGAR DE NUEVO/GUARDAR PUNTUACIÓN al controlador. Hace `preventDefault` de flechas/espacio para que no scrollee la página. El canvas capta foco al montar.
- **`app/jugar/[id]/page.tsx`** — agrega **una línea** al registry `PLAYERS`: `"tetris": TetrisPlayer` (e importa el componente). Resto del dispatch intacto; ids no mapeados siguen cayendo a `MockPlayer`, `notFound()` para ids inexistentes.
- **`app/globals.css`** — clase nueva `cover-tetris` (portada de la card, solo CSS, coherente con las demás `cover-*`). Se **reutiliza** `.av-player--canvas`/`.game-canvas` (escalado 4:3) para el canvas principal; estilo mínimo para encajar el 2º canvas "next" en el HUD si hace falta.

**Fuera de alcance:**

- Tocar el slot mock `caida` ni ningún otro juego existente del catálogo (siguen con `MockPlayer`).
- **Toggle de tema claro/oscuro** y su `localStorage` (`tetris-theme`) del original: la app ya tiene su propio tema; se descarta. El motor **no** lee `--grid-line` de `document.body` (usa un color de rejilla fijo).
- Crear tablas/políticas/Provider o tocar `saveScore` y los leaderboards (`/salon`, `/juego/[id]`): ya existen por SPEC 07 y funcionan automáticamente para `game_id = "tetris"`.
- Hold piece, 7-bag randomizer, T-spins, lock delay, controles táctiles, sonido, dificultad configurable, marcador online avanzado o anti-fraude. Cada uno abre su propio spec.
- Rediseñar el HUD, el modal o el marco CRT (solo se cablean al motor real).
- Tests automatizados (no hay runner).

---

## Modelo de datos

**Fila nueva en `public.games`** (columnas 1:1 con el type `Game` + `position`/`created_at`), insertada por la migración:

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values (
  'tetris',
  'TETRIS',
  'Encaja las piezas que caen y completa líneas.',
  'El clásico de bloques que caen: rota y desliza tetrominós (y alguna tuerca traviesa) para completar líneas antes de que la pila toque el techo. Cada 10 líneas sube el nivel y las piezas caen más rápido. Usa el descenso fantasma para colocar con precisión.',
  'PUZZLE',
  'cover-tetris',
  'magenta',
  42800,
  '0',
  9
);
```

- `cat = PUZZLE`, `color = magenta`, `cover = cover-tetris`, `position = 9` (último del grid, sin reordenar el resto).
- Inserción **siempre vía migración versionada** (`apply_migration` + commit), nunca un INSERT suelto.
- Lectura: `app/layout.tsx` ya lee `games` (`order by position`) y lo propaga por `<GamesProvider>`/`useGames()`. **No** hay que tocar layout ni provider.

**Contrato del motor** (`lib/games/tetris.ts`), no persistido (vive en memoria mientras se juega) — adaptado al modelo de HUD score/**líneas**/nivel:

```ts
export type TetrisCallbacks = {
  onScore?: (score: number) => void;
  onLines?: (lines: number) => void; // líneas completadas (reemplaza onLives)
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onPlaying?: () => void; // motor vuelve a 'playing' (incluye restart interno)
};

export type TetrisGame = {
  start(): void; // arranca requestAnimationFrame
  stop(): void; // cancela el loop y retira listeners de teclado
  pause(): void; // congela el update (sigue dibujando el último frame + overlay PAUSA)
  resume(): void;
  restart(): void; // reinicia estado y vuelve a 'playing'
};

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks?: TetrisCallbacks,
): TetrisGame;
```

**Render del tablero dentro del canvas 4:3.** El canvas principal mantiene resolución interna **800×600** (para reutilizar `.av-player--canvas`). El tablero 10×20 con `BLOCK = 30` mide 300×600 y se dibuja **centrado** (offsetX = 250, offsetY = 0); las márgenes laterales quedan en el fondo del CRT. El canvas "next" usa su propia resolución pequeña (p.ej. 120×120) y vive en el HUD React. El escalado del canvas principal es **solo CSS**; la resolución interna no cambia.

**Puntuación final guardada:** reutiliza `saveScore` (SPEC 07) → `insert into scores (game_id, player_name, score)` con `game_id = "tetris"`. No se introduce estructura persistida nueva.

---

## Plan de implementación

1. **Migración + seed (BD).** Escribir `supabase/migrations/<timestamp>_add_tetris.sql` con el único `insert` de la fila `tetris` (§Modelo de datos). Aplicar al remoto con `apply_migration` y commitear. _Verificación:_ `select * from games where id = 'tetris'` devuelve la fila; `select count(*) from games` = 10; `/juego` muestra la card "TETRIS" (última del grid) y filtrar por `PUZZLE` la incluye; click abre `/juego/tetris` (detalle) sin error y "JUGAR AHORA" apunta a `/jugar/tetris`. (Aún cae al `MockPlayer` hasta el paso 4.)

2. **Motor `lib/games/tetris.ts`.** Portar `game.js` a una fábrica `createTetrisGame(canvas, nextCanvas, callbacks)`. Cambios respecto al original:
   - El estado deja de ser global de módulo: vive en el cierre/instancia.
   - `ctx`/`nextCtx` se derivan de los canvas recibidos (no `document.getElementById`); se fija `canvas.width = 800; canvas.height = 600`; el tablero se dibuja con `offsetX = 250` (centrado). `nextCanvas` conserva su tamaño pequeño.
   - Listeners `keydown` se añaden en `start()` y se quitan en `stop()`; `preventDefault` de `ArrowUp/Down/Left/Right` y `Space`. Tecla `P` = pausa.
   - `pause()`/`resume()` con bandera que salta el `update` (sigue redibujando + overlay "PAUSA"); `restart()` reinicia el estado (equivalente al `init()` original) y emite `onPlaying`.
   - **Se conservan** las 8 piezas (incluida la "tuerca"), ghost piece, wall kicks, hard/soft drop, scoring y curva de velocidad por nivel del original. Se conserva un **overlay dibujado en canvas** "GAME OVER" / "PAUSA" sobre el tablero (port del `#overlay` DOM original).
   - **HUD a React, no a DOM**: el `updateHUD` del original (que escribía `#score`/`#lines`/`#level`) se reemplaza por los callbacks `onScore`/`onLines`/`onLevel`, emitidos **solo en cambios**. `onGameOver` se emite **una sola vez** en la transición a `gameover` (bandera); `onPlaying` al volver a `playing` (por `restart()`).
   - **Sin dependencia de tema**: color de rejilla fijo (no `getComputedStyle(document.body)`); sin toggle de tema ni `localStorage`.
   - `dt` capado (~50ms) para evitar saltos tras un freeze/pausa.

   _Verificación:_ el módulo typechequea (`npm run lint`); sin referencias a `document`/`window`/`localStorage` en el ámbito de módulo (solo dentro de `start`/`stop`).

3. **`TetrisPlayer.tsx`.** Componente `"use client"` que:
   - Renderiza el mismo HUD React y marco CRT que `AsteroidsPlayer`, pero con etiquetas **Puntuación / Líneas / Nivel** (en vez de Vidas) y un `<canvas ref={canvasRef}>` (principal, clase `av-player--canvas`/`game-canvas`) más un `<canvas ref={nextCanvasRef}>` (preview "next") en el HUD.
   - En `useEffect`: instancia `createTetrisGame(canvasRef.current, nextCanvasRef.current, { onScore, onLines, onLevel, onGameOver, onPlaying })`, llama `start()` y `canvas.focus()`; en la limpieza llama `stop()` y limpia el ref.
   - Estado React: `score`, `lines`, `level`, `paused`, `over`, `saved`, alimentados por los callbacks.
   - `onGameOver` abre el modal con el score final; `onPlaying` lo cierra y resetea el estado React (cubre el `restart()`).
   - PAUSA → `pause()/resume()` (+ overlay "EN PAUSA"); FIN → fuerza game over con el score actual (abre modal); SALIR → `router.push("/juego/tetris")`; modal "JUGAR DE NUEVO" → `restart()`; "GUARDAR PUNTUACIÓN" → `saveScore({ game: "tetris", score, name })` (se deshabilita tras el primer guardado vía `saved`).

   _Verificación:_ en `/jugar/tetris` se juega de verdad (mover, rotar, soft/hard drop); la pieza "next" se ve en el 2º canvas; Puntuación/Líneas/Nivel del HUD React se actualizan en tiempo real; completar 10 líneas sube el nivel y acelera la caída; al toparse la pila aparecen el overlay "GAME OVER" en canvas y el modal React.

4. **Registry en `page.tsx`.** Importar `TetrisPlayer` y agregar `"tetris": TetrisPlayer` al record `PLAYERS`. _Verificación:_ `/jugar/tetris` carga el juego real; `/jugar/caida` (y demás) siguen con `MockPlayer`; un id inexistente da 404.

5. **Portada `cover-tetris`.** En `globals.css`, crear la clase `.cover-tetris` (gradientes/pseudo-elementos que evoquen una pila de bloques/tetrominós cayendo, en clave magenta del tema, sin binarios), coherente con las demás `cover-*`. Estilo mínimo para el 2º canvas "next" si el layout lo requiere. _Verificación:_ la card "TETRIS" en `/juego` muestra su portada propia; en viewport angosto el canvas principal se reduce sin deformarse (4:3) y sigue jugable.

6. **Limpieza.** `npm run build` y `npm run lint` sin errores ni warnings; sin fugas de `requestAnimationFrame` ni listeners (entrar/salir de `/jugar/tetris` varias veces no acumula loops ni duplica HUD). _Verificación:_ build/lint limpios; entrar/salir repetido no degrada rendimiento.

Nota: cada paso deja el sistema funcional. El paso 1 ya hace visible la card (con mock); el juego real entra en los pasos 3–4. El mock y los demás juegos quedan intactos.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings.
- [ ] Existe la migración `supabase/migrations/<timestamp>_add_tetris.sql` versionada y registrada en el remoto (`list_migrations` la muestra); `select * from games where id='tetris'` devuelve la fila con `cat=PUZZLE`, `color=magenta`, `cover=cover-tetris`, `position=9`; `caida` y el resto quedan **sin cambios**.
- [ ] `/juego` muestra la card "TETRIS" con la portada `cover-tetris`; buscar "tetris" y filtrar por `PUZZLE` la incluyen; `/juego/tetris` (detalle) carga y "JUGAR AHORA" lleva a `/jugar/tetris`.
- [ ] En `/jugar/tetris` el juego es **real**: ←/→ mueven, ↑/X rotan (con wall kicks), ↓ es soft drop, Espacio es hard drop; las líneas completas se eliminan; aparecen las 8 piezas (incluida la "tuerca"); el ghost piece se ve bajo la pieza actual.
- [ ] Las flechas y el Espacio **no** hacen scroll de la página mientras se juega; el canvas capta foco al montar.
- [ ] La pieza **siguiente** se dibuja en el 2º canvas ("next") del HUD y se actualiza al fijar cada pieza.
- [ ] El HUD React muestra **Puntuación / Líneas / Nivel** y se actualizan en tiempo real; completar 10 líneas sube el nivel y acelera la caída (`dropInterval` menor).
- [ ] Al toparse la pila (colisión al aparecer) salen **ambos**: el overlay "GAME OVER" en canvas **y** el modal React con el score final.
- [ ] "GUARDAR PUNTUACIÓN" inserta `{ game_id: "tetris", player_name, score }` en `scores` (vía `saveScore` de SPEC 07) y la marca aparece en la pestaña Tetris del `/salon` y en el leaderboard de `/juego/tetris`; "GUARDAR" se deshabilita tras el primer guardado.
- [ ] PAUSA (botón o tecla `P`) congela el juego y muestra "EN PAUSA"/overlay; REANUDAR lo continúa. FIN abre el modal con el score actual. SALIR navega a `/juego/tetris`. "JUGAR DE NUEVO"/`restart()` reinicia sin recargar y cierra el modal (vía `onPlaying`).
- [ ] El canvas principal escala manteniendo proporción 4:3 dentro del marco CRT; el tablero portrait se ve centrado; en viewport angosto se reduce sin deformarse y sigue jugable.
- [ ] `/jugar/caida` y los demás ids existentes siguen mostrando el `MockPlayer`; un id inexistente da 404.
- [ ] Salir de `/jugar/tetris` y volver a entrar varias veces no acumula loops `requestAnimationFrame` ni listeners (sin fuga ni degradación); el motor no usa `document`/`window`/`localStorage` a nivel de módulo.

---

## Decisiones

- **Sí:** Tetris es un **juego nuevo** con `id: "tetris"` (no se reutiliza el slot mock `caida`). Lo confirmaste; sigue el precedente de SPEC 06 (asteroides nuevo, rocas intacto) y evita pisar un slot existente y su historial.
- **Sí:** **port fiel** con las 8 piezas del original, **incluida la "tuerca"** custom. Lo confirmaste; conservar la mecánica del código de referencia en vez de recortarla a 7 tetrominós estándar.
- **Sí:** **segundo canvas "next"** en el HUD (motor recibe `nextCanvas` aparte). Lo confirmaste; port directo del `drawNext` original con su propio `ctx`, sin meter el preview dentro del canvas 800×600.
- **Sí:** modelo de HUD **score/líneas/nivel** con `onLines` en vez de `onLives`. Es el contador propio de Tetris (§8 de la arquitectura).
- **Sí:** **HUD a React** (no DOM). El `updateHUD` original escribía nodos DOM; aquí los datos suben por callbacks al HUD React, manteniendo el patrón canvas→React de SPEC 06. El canvas conserva solo el overlay "GAME OVER"/"PAUSA" sobre el tablero.
- **Sí:** canvas principal **800×600** con el tablero 300×600 **centrado** (offsetX 250), para **reutilizar** `.av-player--canvas` (4:3) sin CSS de escalado nuevo. Evita un escalado portrait a medida; la lógica sigue en coordenadas de bloque.
- **Sí:** `position = 9` (append al final del grid). La migración inserta **una sola fila** sin reordenar las 9 existentes; más simple y sin riesgo de desfase de posiciones.
- **No:** crear tablas/políticas/Provider ni tocar `saveScore`/leaderboards. Ya existen por SPEC 07 y funcionan para `game_id = "tetris"` sin cambios.
- **No:** portar el **toggle de tema** y su `localStorage` del original. La app tiene su propio tema; el motor usa color de rejilla fijo y no toca `localStorage`.
- **No:** cargar `game.js` vía `<script>`/iframe. Descartado: HUD React desconectado, globales sueltos y fugas difíciles de limpiar al desmontar (mismo motivo que SPEC 06).
- **No:** hold piece, 7-bag, T-spins, lock delay, controles táctiles, sonido, dificultad configurable o anti-fraude. Abren alcance propio; fuera de este spec.

---

## Riesgos

| Riesgo                                                                                                                       | Mitigación                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuga de `requestAnimationFrame` y listeners de teclado al desmontar/remontar (loops acumulados, doble HUD, degradación).     | `start()` guarda el id del `rAF` y los listeners; `stop()` los cancela/retira; el `useEffect` llama `stop()` en su limpieza. Criterio "entrar/salir varias veces" lo cubre.        |
| Globales de módulo del `game.js` original (`board`, `current`, `score`, `animId`, …) provocan estado compartido o error SSR. | El motor encapsula todo el estado en el cierre de la fábrica; nada a nivel de módulo. Verificación en paso 2: sin `document`/`window`/`localStorage` fuera de `start`/`stop`.      |
| El 2º canvas "next" es `null` al instanciar (orden de montaje de los refs) y el motor rompe.                                 | `TetrisPlayer` es `"use client"`; la instanciación ocurre en `useEffect` con ambos refs ya montados; guarda temprana si alguno es `null`.                                          |
| El tablero portrait (1:2) se deforma o desperdicia el canvas 4:3.                                                            | Resolución interna 800×600 fija; tablero 300×600 dibujado centrado (offsetX 250); escalado solo CSS vía `.av-player--canvas`; el resto del canvas queda en fondo del CRT.          |
| `onGameOver` se dispara en bucle cada frame mientras el estado es `gameover`.                                                | Emitirlo **una sola vez** en la transición a `gameover` (bandera), no por frame; el loop original ya hace `cancelAnimationFrame` en `endGame`.                                     |
| Dos caminos de fin/reinicio (overlay canvas vs modal React) se desincronizan.                                                | `onPlaying` cierra el modal y resetea el estado React en cada vuelta a `playing`; `onGameOver` una sola vez por transición; el reinicio interno por `restart()` emite `onPlaying`. |
| `getComputedStyle(document.body)` para la rejilla rompe en SSR o sin el tema cargado.                                        | El motor usa un color de rejilla **fijo** (constante), sin leer `--grid-line` de `document.body`.                                                                                  |
| Tecla `P` (pausa) y los botones de PAUSA del HUD desincronizan el estado de pausa.                                           | Un único estado de pausa en el motor; `P` y el botón llaman al mismo `pause()/resume()`; el HUD React espeja `paused` vía callback/estado del Player.                              |
| Doble guardado de puntuación o reinicio inconsistente entre motor y React.                                                   | "GUARDAR" se deshabilita tras el primer guardado (patrón `saved`); "JUGAR DE NUEVO" llama `restart()` y el reset de React ocurre vía `onPlaying`.                                  |
| FK `scores.game_id → games.id`: guardar antes de aplicar la migración falla.                                                 | El paso 1 (migración) va **antes** del juego jugable; el `id "tetris"` existe en `games` cuando el Player puede guardar.                                                           |
