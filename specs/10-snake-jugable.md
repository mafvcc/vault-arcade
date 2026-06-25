# SPEC 10 — Snake jugable en `/jugar/snake`

> **Estado:** Implementado · **Depende de:** SPEC 06 (asteroides jugable), SPEC 07 (tablas `games`/`scores`) · **Fecha:** 2026-06-25
> **Objetivo:** Añadir el juego nuevo "Snake" al catálogo y hacerlo jugable de verdad en `/jugar/snake` con un motor TS autónomo (grilla, modelo score/longitud, una vida, muerte por pared o autocolisión, frutas aleatorias del atlas `fruits.png`) que notifica su estado al HUD y al modal React, reutilizando las tablas `games`/`scores` y `saveScore` ya existentes.

---

## Alcance

**Dentro:**

- **Asset** — copiar `references/resources/source-assets/snake-assets/fruits.png` a `public/snake-assets/fruits.png` para servirlo en runtime (el motor lo carga vía `new Image()`). `sprites.js` **no** se copia: sus coordenadas se transcriben a una constante en el motor TS.
- **Migración + seed (BD)** — `supabase/migrations/<timestamp>_add_snake.sql` (convención timestamp del repo, p.ej. `20260625130000_add_snake.sql`), aplicada al remoto con `apply_migration` y versionada en git. **Inserta una sola fila** en `public.games` con `id: "snake"` (valores en §Modelo de datos). No reordena posiciones existentes (entra en `position: 11`). No crea tablas ni políticas (ya existen por SPEC 07).
- **`lib/games/snake.ts`** — motor TS autónomo. Fábrica `createSnakeGame(canvas, callbacks)` que devuelve `{ start, stop, pause, resume, restart }`. Sin globales de módulo: todo el estado (`snake` array de celdas, `dir`/`nextDir`, `food` `{cell, fruitKey}`, `score`, `length`, `paused`, `gameOver`, acumulador de tiempo) vive en el cierre. `ctx` y dimensiones se derivan del canvas (`canvas.width=800; canvas.height=600`). Listeners de teclado en `start()`, retirados en `stop()`. Carga de `fruits.png` con `new Image()` **dentro de `start()`** (SSR-safe), con fallback de rectángulo si aún no cargó.
- **Mecánica Snake clásica:** grilla **32×24 celdas** sobre 800×600 (`CELL = 25` → 800/25=32 columnas × 600/25=24 filas). Movimiento por pasos a intervalo fijo (`STEP_MS`, p.ej. 110 ms — **velocidad constante**). Controles: **flechas y WASD** para girar; **no** se permite invertir 180° directamente (se valida contra la dirección actual). Comer fruta: +10 al score, crece 1 segmento, reaparece fruta en celda libre aleatoria con **sprite de fruta aleatorio** de las 22. **Muerte:** cabeza contra pared (fuera de la grilla) **o** contra su propio cuerpo → game over. **Sin niveles ni aceleración** (decisión del usuario).
- **Render:** fondo del tablero + cuadrícula tenue (color fijo, sin leer `document.body`); serpiente como rectángulos (cabeza algo distinta del cuerpo, en clave verde del tema); fruta dibujada con `ctx.drawImage` recortando del atlas (centrada y escalada dentro de la celda, respetando su aspecto). Overlay "GAME OVER"/"PAUSA" dibujado en canvas (como Asteroides/Tetris). HUD numérico vive en React (no en canvas).
- **Callbacks motor → React:** `onScore(score)`, `onLength(length)`, `onGameOver(finalScore)`, `onPlaying()`. **Se reemplaza el modelo vidas/nivel** por **score/longitud**: no hay `onLives` ni `onLevel`; se añade `onLength`. Emitidos **solo en cambios**; `onGameOver` **una sola vez** en la transición a `gameover`; `onPlaying` al volver a `playing` (incluye `restart()`).
- **`app/jugar/[id]/SnakePlayer.tsx`** (`"use client"`) — monta `<canvas ref>` (clase `av-player--canvas`/`game-canvas`), instancia el motor en `useEffect` con limpieza en el unmount, refleja **Puntuación / Longitud** en el HUD React, enruta `onGameOver` al modal existente (guardado con `useAuth().saveScore`) y `onPlaying` para cerrarlo. Cablea PAUSA/FIN/SALIR/JUGAR DE NUEVO/GUARDAR PUNTUACIÓN al controlador. `preventDefault` de flechas/espacio. El canvas capta foco al montar.
- **`app/jugar/[id]/page.tsx`** — agrega **una línea** al registry `PLAYERS`: `"snake": SnakePlayer` (e importa el componente). Resto del dispatch intacto; ids no mapeados siguen cayendo a `MockPlayer`; `notFound()` para inexistentes.
- **`app/globals.css`** — clase nueva `.cover-snake` (portada de la card, **solo CSS**, en clave verde del tema, coherente con las demás `cover-*`). Se **reutiliza** `.av-player--canvas`/`.game-canvas` (escalado 4:3); no se crea CSS de canvas nuevo.

**Fuera de alcance:**

- Niveles, aceleración progresiva, frutas con distinto valor, power-ups, obstáculos, paredes de nivel (la velocidad es fija y todas las frutas valen +10, por decisión del usuario). Cada uno abre su propio spec.
- Wrap-around toroidal (se eligió muerte clásica por pared).
- Sprites de cuerpo de serpiente (no existen en los assets; se dibuja con rectángulos).
- Cargar `sprites.js` como global `window.SPRITE_ATLAS` (sus coords se portan a una constante TS).
- Sonido, controles táctiles, dificultad configurable, multijugador, anti-fraude.
- Crear tablas/políticas/Provider o tocar `saveScore`/leaderboards (ya existen por SPEC 07; funcionan para `game_id = "snake"`).
- Tocar otros juegos del catálogo o el slot mock; rediseñar HUD/modal/marco CRT.
- Tests automatizados (no hay runner).

---

## Modelo de datos

**Fila nueva en `public.games`** (columnas 1:1 con el type `Game` + `position`/`created_at`), insertada por la migración:

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values (
  'snake',
  'SNAKE',
  'Crece comiendo fruta sin morderte la cola.',
  'El clásico de la serpiente: guíala por la grilla para comer fruta y crecer. Cada bocado suma puntos y un segmento más, pero también más cola que esquivar. Chocar contra una pared o contra ti misma termina la partida. ¿Hasta qué largo llegás?',
  'ARCADE',
  'cover-snake',
  'green',
  9600,
  '0',
  11
);
```

- `cat = ARCADE`, `color = green`, `cover = cover-snake`, `position = 11` (append al final del grid, sin reordenar asteroides/tetris/arkanoid ni los slots mock).
- Inserción **siempre vía migración versionada** (`apply_migration` + commit), nunca un INSERT suelto.
- Lectura: `app/layout.tsx` ya lee `games` (`order by position`) y lo propaga por `<GamesProvider>`/`useGames()`. **No** hay que tocar layout ni provider.

**Grilla y render dentro del canvas 4:3.** Resolución interna fija **800×600** (para reutilizar `.av-player--canvas`). Se usa **`CELL = 25` → 32 columnas × 24 filas** (800/25=32, 600/25=24), grilla rectangular que cubre todo el canvas. Toda la lógica vive en coordenadas de celda; el escalado a pantalla es **solo CSS**.

**Atlas de frutas (portado de `sprites.js` a constante TS):** mapa `{ key: {x,y,w,h} }` con las 22 frutas (banana, orange, grape, …) recortadas de `fruits.png`. Al comer, se elige una `key` al azar para la próxima fruta. El motor dibuja `ctx.drawImage(img, sx,sy,sw,sh, dx,dy,dw,dh)` ajustando la fruta centrada dentro de la celda (preservando aspecto, ya que los recortes son ~110–170px de ancho × 160 de alto).

**Contrato del motor** (`lib/games/snake.ts`), no persistido (vive en memoria mientras se juega) — adaptado al modelo de HUD score/**longitud**:

```ts
export type SnakeCallbacks = {
  onScore?: (score: number) => void;
  onLength?: (length: number) => void; // longitud de la serpiente (reemplaza onLives/onLevel)
  onGameOver?: (finalScore: number) => void;
  onPlaying?: () => void; // motor vuelve a 'playing' (incluye restart interno)
};

export type SnakeGame = {
  start(): void; // arranca requestAnimationFrame + carga fruits.png
  stop(): void; // cancela el loop y retira listeners de teclado
  pause(): void; // congela el update (sigue dibujando el último frame + overlay PAUSA)
  resume(): void;
  restart(): void; // reinicia estado y vuelve a 'playing'
};

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks?: SnakeCallbacks,
): SnakeGame;
```

**Puntuación final guardada:** reutiliza `saveScore` (SPEC 07) → `insert into scores (game_id, player_name, score)` con `game_id = "snake"`. No se introduce estructura persistida nueva.

---

## Plan de implementación

1. **Asset.** Copiar `references/resources/source-assets/snake-assets/fruits.png` → `public/snake-assets/fruits.png`. _Verificación:_ `GET /snake-assets/fruits.png` responde 200 en `npm run dev`.

2. **Migración + seed (BD).** Escribir `supabase/migrations/<timestamp>_add_snake.sql` con el único `insert` de la fila `snake` (§Modelo de datos). Aplicar al remoto con `apply_migration` y commitear. _Verificación:_ `select * from games where id='snake'` devuelve la fila; `select count(*) from games` aumenta en 1; `/juego` muestra la card "SNAKE" (última del grid) y filtrar por `ARCADE` la incluye; click abre `/juego/snake` (detalle) sin error y "JUGAR AHORA" apunta a `/jugar/snake`. (Aún cae al `MockPlayer` hasta el paso 5.)

3. **Motor `lib/games/snake.ts`.** Fábrica `createSnakeGame(canvas, callbacks)`:
   - Estado en el cierre (no global): `snake` (array de `{x,y}` en celdas), `dir`/`nextDir`, `food` (`{x,y,fruitKey}`), `score`, `length`, `paused`, `gameOver`, acumulador de tiempo.
   - `ctx` del canvas recibido; `canvas.width=800; canvas.height=600`; grilla `CELL=25` (32×24).
   - **Carga de `fruits.png`** con `new Image()` dentro de `start()` (SSR-safe); `FRUIT_ATLAS` como constante TS (coords portadas de `sprites.js`). Fallback: rectángulo de color si la imagen aún no cargó.
   - Bucle: `requestAnimationFrame`; avanza un paso de la serpiente cada `STEP_MS` (velocidad constante, `dt` capado ~50ms); aplica `nextDir` evitando reversa 180°.
   - Comer fruta → +10 score, crece 1, reubica fruta en celda libre aleatoria con `fruitKey` aleatoria; emite `onScore`/`onLength` **solo en cambios**.
   - Muerte: cabeza fuera de grilla **o** sobre el cuerpo → `gameOver`, `cancelAnimationFrame` del update, overlay "GAME OVER" en canvas, `onGameOver(score)` **una sola vez**.
   - Listeners `keydown` (flechas + WASD para girar; `P` pausa) en `start()`, retirados en `stop()`; `preventDefault` de `ArrowUp/Down/Left/Right` y `Space`.
   - `pause()`/`resume()` con bandera que salta el `update` (sigue redibujando + overlay "PAUSA"); `restart()` reinicia el estado y emite `onPlaying`.
   - Render: cuadrícula tenue (color fijo), serpiente (cabeza distinta del cuerpo, verde del tema), fruta vía atlas.

   _Verificación:_ el módulo typechequea (`npm run lint`); sin referencias a `document`/`window`/`localStorage` en el ámbito de módulo (solo dentro de `start`/`stop`).

4. **`SnakePlayer.tsx`.** Componente `"use client"` que:
   - Renderiza el mismo HUD React y marco CRT que `AsteroidsPlayer`, con etiquetas **Puntuación / Longitud** (sin Vidas ni Nivel) y un `<canvas ref={canvasRef}>` (clase `av-player--canvas`/`game-canvas`).
   - En `useEffect`: instancia `createSnakeGame(canvasRef.current, { onScore, onLength, onGameOver, onPlaying })`, llama `start()` y `canvas.focus()`; en la limpieza llama `stop()` y limpia el ref.
   - Estado React: `score`, `length`, `paused`, `over`, `saved`, alimentados por los callbacks.
   - `onGameOver` abre el modal con el score final; `onPlaying` lo cierra y resetea el estado React (cubre el `restart()`).
   - PAUSA → `pause()/resume()` (+ overlay "EN PAUSA"); FIN → fuerza game over con el score actual (abre modal); SALIR → `router.push("/juego/snake")`; modal "JUGAR DE NUEVO" → `restart()`; "GUARDAR PUNTUACIÓN" → `saveScore({ game: "snake", score, name })` (se deshabilita tras el primer guardado vía `saved`).

   _Verificación:_ en `/jugar/snake` se juega de verdad (girar con flechas/WASD, crecer al comer, frutas variadas); Puntuación/Longitud del HUD React se actualizan en tiempo real; chocar pared o cola dispara overlay "GAME OVER" en canvas + modal React.

5. **Registry en `page.tsx`.** Importar `SnakePlayer` y agregar `"snake": SnakePlayer` al record `PLAYERS`. _Verificación:_ `/jugar/snake` carga el juego real; los demás ids siguen con `MockPlayer`; un id inexistente da 404.

6. **Portada `cover-snake`.** En `globals.css`, crear la clase `.cover-snake` (gradientes/pseudo-elementos que evoquen una serpiente/cuadrícula y fruta, en clave verde del tema, sin binarios), coherente con las demás `cover-*`. _Verificación:_ la card "SNAKE" en `/juego` muestra su portada propia; en viewport angosto el canvas se reduce sin deformarse (4:3) y sigue jugable.

7. **Limpieza.** `npm run build` y `npm run lint` sin errores ni warnings; sin fugas de `requestAnimationFrame` ni listeners (entrar/salir de `/jugar/snake` varias veces no acumula loops ni duplica HUD). _Verificación:_ build/lint limpios; entrar/salir repetido no degrada rendimiento.

Nota: cada paso deja el sistema funcional. El paso 2 ya hace visible la card (con mock); el juego real entra en los pasos 4–5. El mock y los demás juegos quedan intactos.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings.
- [ ] `public/snake-assets/fruits.png` existe y se sirve (200).
- [ ] Existe la migración `supabase/migrations/<timestamp>_add_snake.sql` versionada y registrada en el remoto (`list_migrations` la muestra); `select * from games where id='snake'` devuelve la fila con `cat=ARCADE`, `color=green`, `cover=cover-snake`, `position=11`; los demás juegos quedan **sin cambios**.
- [ ] `/juego` muestra la card "SNAKE" con la portada `cover-snake`; buscar "snake" y filtrar por `ARCADE` la incluyen; `/juego/snake` (detalle) carga y "JUGAR AHORA" lleva a `/jugar/snake`.
- [ ] En `/jugar/snake` el juego es **real**: flechas y WASD giran (sin reversa 180°), la serpiente avanza a velocidad constante, come fruta (+10, crece 1), las frutas se ven con sprites variados del atlas.
- [ ] Las flechas y el Espacio **no** hacen scroll de la página mientras se juega; el canvas capta foco al montar.
- [ ] El HUD React muestra **Puntuación / Longitud** y se actualizan en tiempo real.
- [ ] Chocar contra una pared **o** contra el propio cuerpo dispara **ambos**: el overlay "GAME OVER" en canvas **y** el modal React con el score final (una sola vez).
- [ ] "GUARDAR PUNTUACIÓN" inserta `{ game_id: "snake", player_name, score }` en `scores` (vía `saveScore` de SPEC 07) y la marca aparece en la pestaña Snake del `/salon` y en el leaderboard de `/juego/snake`; "GUARDAR" se deshabilita tras el primer guardado.
- [ ] PAUSA (botón o tecla `P`) congela el juego y muestra "EN PAUSA"/overlay; REANUDAR lo continúa. FIN abre el modal con el score actual. SALIR navega a `/juego/snake`. "JUGAR DE NUEVO"/`restart()` reinicia sin recargar y cierra el modal (vía `onPlaying`).
- [ ] El canvas escala manteniendo proporción 4:3 dentro del marco CRT; en viewport angosto se reduce sin deformarse y sigue jugable.
- [ ] `/jugar/caida` y los demás ids existentes siguen mostrando el `MockPlayer`; un id inexistente da 404.
- [ ] Salir de `/jugar/snake` y volver a entrar varias veces no acumula loops `requestAnimationFrame` ni listeners (sin fuga ni degradación); el motor no usa `document`/`window`/`localStorage` a nivel de módulo.

---

## Decisiones

- **Sí:** Snake es un **juego nuevo** con `id: "snake"`, `position: 11` (append, sin reordenar). Sigue el precedente de SPEC 06/08.
- **Sí:** modelo de HUD **score/longitud** con `onLength` (no `onLives`/`onLevel`). Lo eligió el usuario: una sola vida, velocidad fija, sin niveles.
- **Sí:** **muerte clásica** por pared o autocolisión (no wrap-around). Elección del usuario.
- **Sí:** **frutas aleatorias** del atlas (22 sprites), todas **+10**. Aprovecha `fruits.png` sin complicar el scoring. Elección del usuario.
- **Sí:** copiar **solo `fruits.png`** a `public/snake-assets/` y **portar las coords** de `sprites.js` a una constante TS (no cargar `window.SPRITE_ATLAS`). Mantiene el motor autónomo y SSR-safe.
- **Sí:** serpiente dibujada con **rectángulos** (no hay sprites de cuerpo en los assets).
- **Sí:** canvas **800×600**, grilla `CELL=25` (32×24), para **reutilizar** `.av-player--canvas` (4:3) sin CSS de escalado nuevo.
- **No:** crear tablas/políticas/Provider ni tocar `saveScore`/leaderboards. Ya existen por SPEC 07 y funcionan para `game_id = "snake"` sin cambios.
- **No:** niveles/aceleración, frutas con distinto valor, wrap-around, sonido, táctil, dificultad configurable, multijugador o anti-fraude. Cada uno abre su propio spec.
- **No:** cargar el juego vía `<script>`/iframe (HUD React desconectado, globales sueltos y fugas difíciles de limpiar al desmontar; mismo motivo que SPEC 06).

---

## Riesgos

| Riesgo                                                                                           | Mitigación                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Fuga de `requestAnimationFrame` y listeners al desmontar/remontar (loops acumulados, doble HUD). | `start()` guarda el id del `rAF` y los listeners; `stop()` los cancela/retira; el `useEffect` llama `stop()` en su limpieza. Criterio "entrar/salir varias veces". |
| Estado global de módulo → estado compartido o error SSR.                                         | Todo el estado vive en el cierre de la fábrica; nada a nivel de módulo. Verificación en paso 3.                                                                    |
| `fruits.png` no cargado al primer frame → fruta no se dibuja o excepción.                        | `new Image()` con `onload`; hasta entonces, fallback de rectángulo; nunca `drawImage` con imagen incompleta.                                                       |
| Reversa 180° instantánea (la serpiente se muerde al girar en U).                                 | `nextDir` se valida contra `dir` actual; un giro opuesto directo se ignora.                                                                                        |
| `onGameOver` disparado en bucle cada frame mientras `gameover`.                                  | Emitirlo **una sola vez** en la transición (bandera); el loop hace `cancelAnimationFrame` al morir.                                                                |
| Desincronía overlay canvas vs modal React (fin/reinicio).                                        | `onPlaying` cierra el modal y resetea el estado React en cada vuelta a `playing`; `onGameOver` una sola vez; `restart()` emite `onPlaying`.                        |
| Tecla `P` y botón PAUSA desincronizan el estado de pausa.                                        | Un único estado de pausa en el motor; `P` y el botón llaman al mismo `pause()/resume()`; el HUD espeja `paused` vía callback/estado del Player.                    |
| Aspecto de los sprites de fruta (portrait) deformado al meterlos en celda cuadrada.              | Escalar preservando aspecto y centrar dentro de la celda; no estirar al tamaño de celda.                                                                           |
| Color de rejilla leído de `document.body` rompe en SSR o sin el tema cargado.                    | Color de rejilla **fijo** (constante); sin `getComputedStyle(document.body)`.                                                                                      |
| FK `scores.game_id → games.id`: guardar antes de aplicar la migración falla.                     | El paso 2 (migración) va **antes** del juego jugable; el `id "snake"` existe en `games` cuando el Player puede guardar.                                            |
