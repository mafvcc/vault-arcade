# SPEC 09 — Arkanoid jugable en `/jugar/arkanoid`

> **Estado:** Implementado · **Depende de:** SPEC 06 (asteroides jugable), SPEC 07 (tablas `games`/`scores`) · **Fecha:** 2026-06-25
> **Objetivo:** Añadir el juego nuevo "Arkanoid" al catálogo y hacerlo jugable de verdad en `/jugar/arkanoid`, portando `references/started-games/04-arkanoid/` (`game.js` + `levels.js` + `assets/spritesheet.js`, con su spritesheet PNG y sus 2 sonidos) a un motor TS autónomo (modelo score/vidas/nivel, control por mouse + teclado, 5 niveles y estado `win`) que notifica su estado al HUD y al modal React, reutilizando las tablas `games`/`scores` y `saveScore` ya existentes.

---

## Alcance

**Dentro:**

- **Migración + seed (BD)** — `supabase/migrations/<timestamp>_add_arkanoid.sql` (siguiendo la convención de timestamp del repo, p.ej. `20260625130000_add_arkanoid.sql`), aplicada al remoto con `apply_migration` y versionada en git. **Inserta una sola fila** en `public.games` con el `id: "arkanoid"` (valores en §Modelo de datos). No toca ninguna otra fila; **no reordena** posiciones existentes (la fila entra en `position: 10`, al final del grid). No crea tablas ni políticas (ya existen por SPEC 07).
- **Assets binarios** — copiar a `public/games/arkanoid/`: `spritesheet-breakout.png`, `sounds/ball-bounce.mp3` y `sounds/break-sound.mp3` (desde `references/started-games/04-arkanoid/assets/`). Se referencian por **ruta absoluta pública** (`/games/arkanoid/spritesheet-breakout.png`, `/games/arkanoid/sounds/...`). Es el **primer spec del vault que incorpora binarios**; el resto de portadas son CSS y los demás motores usan primitivas.
- **`lib/games/arkanoid.ts`** — motor TS autónomo portado desde `game.js` + `levels.js` + `assets/spritesheet.js`. Fábrica `createArkanoidGame(canvas, callbacks)` que devuelve un controlador con `start()`, `stop()`, `pause()`, `resume()`, `restart()`. Sin globales de módulo: todo el estado (`paddle`, `ball`, `blocks`, `explosions`, `score`, `lives`, `currentLevel`, `gameState`, `isPaused`, `keys`, acumuladores) vive en el cierre de la fábrica. Recibe el `canvas` por parámetro (no `document.getElementById`); deriva el `ctx`, fija `canvas.width = 800; canvas.height = 600` (lógica en coordenadas internas; escalado solo CSS). La imagen del spritesheet (`new Image()`) y los `Audio` se **crean dentro de `start()`** (SSR-safe, nunca a nivel de módulo); el loop `requestAnimationFrame` arranca en el callback de carga del spritesheet (port de `loadSpritesheet`). Helpers de dibujo (`drawSprite`/`drawFrame`) y constantes (`SPRITES`/`EXPLOSION_FRAMES`/`EXPLOSION_DURATION`) portados de `spritesheet.js` al módulo.
- **Port fiel de mecánicas** (de `game.js`/`levels.js`): paleta controlada por **mouse** (`mousemove`, posición X escalada) **y** flechas ←/→ (`PADDLE_SPEED = 400`); rebotes AABB contra paredes (izq/der/arriba), paleta y bloques; rejilla de hasta **6×10 bloques** por color (sprites `block_<color>`); explosiones de **4 frames** (`EXPLOSION_FRAMES`/`EXPLOSION_DURATION`); `score += 10` por bloque roto; **3 vidas**; **5 niveles** de `levels.js` con `speed` creciente (1.00 → 1.46) aplicada a la velocidad base de la bola (`BASE_BALL_VX = 200`, `BASE_BALL_VY = -300`); avance automático de nivel al limpiar todos los bloques; sonidos `bounce` (pared/paleta) y `break` (bloque) vía `cloneNode().play()`. Pausa con tecla `P`/`Escape`.
- **Estado `win`** — al romper todos los bloques estando en el nivel 5, `gameState` pasa a `'win'`. El motor emite `onGameOver(finalScore, won = true)`; el Player abre el modal con título **"¡COMPLETASTE EL JUEGO!"** (vs "FIN DEL JUEGO" para `gameover`), permitiendo igualmente **guardar la puntuación** y **JUGAR DE NUEVO**. El overlay "¡Completaste el juego!" dibujado en canvas del original se conserva sobre el tablero.
- **Selector de nivel en pausa** — se **conserva** el `drawPauseOverlay` del original: estando en pausa, el canvas dibuja el overlay "PAUSA" con botones **1–5** y la lógica de **click sobre el canvas** (hitboxes en coordenadas internas, computadas con el escalado `canvas.width / rect.width`) que llama a `loadLevel(n)` y reanuda. Es una afordancia de salto de nivel del original (decisión explícita de conservarla).
- **Callbacks motor → React**: `onScore(score)`, `onLives(lives)`, `onLevel(level)`, `onGameOver(finalScore, won?)`, `onPlaying()`. Modelo de HUD **score/vidas/nivel** (igual que Asteroides), con un **flag `won` opcional en `onGameOver`** para que el Player distinga victoria de derrota. El canvas es la fuente de verdad y empuja el estado hacia arriba; los callbacks se emiten **solo en cambios** y `onGameOver` **una sola vez** en la transición a `gameover`/`win` (bandera). `onPlaying` al volver a `playing` (por `restart()`).
- **`app/jugar/[id]/ArkanoidPlayer.tsx`** (`"use client"`) — clona el patrón de `AsteroidsPlayer.tsx`: `canvasRef`, `gameRef`, estado React `score`/`lives`/`level`/`paused`/`over`/`saved` más `won`. En `useEffect` instancia `createArkanoidGame(canvasRef.current, { onScore, onLives, onLevel, onGameOver, onPlaying })`, llama `start()` y `canvas.focus()`; en la limpieza llama `stop()` y limpia el ref. Mismo HUD React (Jugador / Puntuación / Vidas / Nivel) y marco CRT que Asteroides, con `<canvas ref={canvasRef}>` (clase `av-player--canvas`/`game-canvas`). Cablea PAUSA/REANUDAR → `pause()`/`resume()` (+ overlay "EN PAUSA"); FIN → fuerza game over con el score actual; SALIR → `router.push("/juego/arkanoid")`; "JUGAR DE NUEVO" → `restart()`; "GUARDAR PUNTUACIÓN" → `saveScore({ game: "arkanoid", score, name })` (se deshabilita tras el primer guardado vía `saved`). El modal muestra el título según `won`. `preventDefault` de flechas/espacio lo hace el motor; el canvas capta foco al montar.
- **`app/jugar/[id]/page.tsx`** — agrega **una línea** al registry `PLAYERS`: `arkanoid: ArkanoidPlayer` (e importa el componente). Resto del dispatch intacto; ids no mapeados siguen cayendo a `MockPlayer`, `notFound()` para ids inexistentes.
- **`app/globals.css`** — clase nueva `.cover-arkanoid` (portada de la card, solo CSS, gradientes/pseudo-elementos que evoquen una pared de ladrillos con paleta + pelota, en clave **magenta** del tema), coherente con las demás `cover-*`. Se **reutiliza** `.av-player--canvas`/`.game-canvas` (escalado 4:3); no hace falta CSS de canvas nuevo.

**Fuera de alcance:**

- Crear tablas/políticas/Provider o tocar `saveScore` y los leaderboards (`/salon`, `/juego/[id]`): ya existen por SPEC 07 y funcionan automáticamente para `game_id = "arkanoid"`.
- Tocar cualquier otro juego o slot del catálogo (siguen con `MockPlayer`).
- Cargar `game.js` vía `<script>`/iframe (mismo motivo que SPEC 06: HUD React desconectado, globales sueltos, fugas al desmontar).
- Power-ups, multibola, ladrillos resistentes/multi-hit, más de 5 niveles, controles táctiles, dificultad configurable, marcador online avanzado o anti-fraude. Cada uno abre su propio spec.
- Rediseñar el HUD, el modal o el marco CRT (solo se cablean al motor real).
- Tests automatizados (no hay runner).

---

## Modelo de datos

**Fila nueva en `public.games`** (columnas 1:1 con el type `Game` + `position`/`created_at`), insertada por la migración:

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values (
  'arkanoid',
  'ARKANOID',
  'Rompe todos los ladrillos rebotando la pelota con tu paleta.',
  'El clásico breakout: mueve la paleta con el mouse o las flechas y rebota la pelota para destruir la pared de ladrillos. Cinco niveles con velocidad creciente y diseños cada vez más traicioneros; pierdes una de tus 3 vidas cada vez que la pelota cae. Limpia el último nivel para completar el juego.',
  'ARCADE',
  'cover-arkanoid',
  'magenta',
  18900,
  '0',
  10
);
```

- `cat = ARCADE`, `color = magenta`, `cover = cover-arkanoid`, `position = 10` (último del grid, sin reordenar el resto).
- Inserción **siempre vía migración versionada** (`apply_migration` + commit), nunca un INSERT suelto.
- Lectura: `app/layout.tsx` ya lee `games` (`order by position`) y lo propaga por `<GamesProvider>`/`useGames()`. **No** hay que tocar layout ni provider.

**Contrato del motor** (`lib/games/arkanoid.ts`), no persistido (vive en memoria mientras se juega) — modelo de HUD score/vidas/nivel, con `won` en `onGameOver`:

```ts
export type ArkanoidCallbacks = {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number, won?: boolean) => void; // won=true al limpiar el nivel 5
  onPlaying?: () => void; // motor vuelve a 'playing' (incluye restart interno)
};

export type ArkanoidGame = {
  start(): void; // carga el spritesheet/audio y arranca requestAnimationFrame
  stop(): void; // cancela el loop y retira listeners de teclado/mouse; detiene audio
  pause(): void; // congela el update (sigue dibujando el último frame + overlay PAUSA con selector 1–5)
  resume(): void;
  restart(): void; // reinicia estado (nivel 1, 3 vidas, score 0) y vuelve a 'playing'
};

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks?: ArkanoidCallbacks,
): ArkanoidGame;
```

**Render dentro del canvas 4:3.** El canvas mantiene resolución interna **800×600** (la misma del original) y reutiliza `.av-player--canvas`/`.game-canvas`. El escalado es **solo CSS**; el cálculo de la posición del mouse y de las hitboxes del selector de nivel usa el factor `canvas.width / rect.width` (como el original).

**Puntuación final guardada:** reutiliza `saveScore` (SPEC 07) → `insert into scores (game_id, player_name, score)` con `game_id = "arkanoid"`. No se introduce estructura persistida nueva.

---

## Plan de implementación

1. **Migración + seed (BD).** Escribir `supabase/migrations/<timestamp>_add_arkanoid.sql` con el único `insert` de la fila `arkanoid` (§Modelo de datos). Aplicar al remoto con `apply_migration` y commitear. _Verificación:_ `select * from games where id = 'arkanoid'` devuelve la fila; `select count(*) from games` = 11; `/juego` muestra la card "ARKANOID" (última del grid) y filtrar por `ARCADE` la incluye; click abre `/juego/arkanoid` (detalle) sin error y "JUGAR AHORA" apunta a `/jugar/arkanoid`. (Aún cae al `MockPlayer` hasta el paso 5.)

2. **Assets a `public/`.** Copiar `references/started-games/04-arkanoid/assets/spritesheet-breakout.png` y `assets/sounds/ball-bounce.mp3` / `break-sound.mp3` a `public/games/arkanoid/` (PNG en la raíz, mp3 bajo `sounds/`). Commitear los binarios. _Verificación:_ con `npm run dev`, `GET /games/arkanoid/spritesheet-breakout.png` y los dos mp3 responden 200.

3. **Motor `lib/games/arkanoid.ts`.** Portar `game.js` + `levels.js` + `spritesheet.js` a una fábrica `createArkanoidGame(canvas, callbacks)`. Cambios respecto al original:
   - El estado deja de ser global de módulo: vive en el cierre/instancia. Las constantes (`LEVELS`, `SPRITES`, `EXPLOSION_FRAMES`, etc.) pueden ser constantes de módulo (datos puros, SSR-safe).
   - `ctx` se deriva del canvas recibido (no `document.getElementById`); se fija `canvas.width = 800; canvas.height = 600`.
   - `new Image()` (spritesheet) y los `Audio` se crean **dentro de `start()`**, nunca a nivel de módulo; las rutas apuntan a `/games/arkanoid/...`. El loop arranca en el callback de carga del spritesheet (port de `loadSpritesheet`).
   - Listeners `keydown`/`keyup` (flechas + `P`/`Escape`) y `mousemove`/`click` se añaden en `start()` y se quitan en `stop()`; `preventDefault` de `ArrowLeft/Right/Up/Down` y `Space`. El `click` en pausa resuelve el selector de nivel 1–5.
   - `pause()`/`resume()` con bandera `isPaused` que salta el `update` (sigue redibujando + overlay "PAUSA" con botones 1–5); `restart()` reinicia el estado (nivel 1, 3 vidas, score 0, `loadLevel(1)`) y emite `onPlaying`. `stop()` además detiene cualquier audio en curso.
   - **Se conservan** las mecánicas del original: control mouse+flechas, rebotes, los **5 niveles** con su curva de velocidad, las explosiones de bloques, los sonidos, el avance automático de nivel y el **estado `win`** al limpiar el nivel 5.
   - **HUD a React, no a canvas-only**: el motor sigue dibujando el marcador en canvas como en el original, pero además emite `onScore`/`onLives`/`onLevel` **solo en cambios**. `onGameOver(finalScore, won)` se emite **una sola vez** en la transición a `gameover` (`won=false`) o `win` (`won=true`); `onPlaying` al volver a `playing` (por `restart()`).
   - `dt` capado (~50ms) para evitar saltos tras un freeze/pausa.
     _Verificación:_ el módulo typechequea (`npm run lint`); sin referencias a `document`/`window`/`new Image`/`new Audio` en el ámbito de módulo (solo dentro de `start`/`stop`).

4. **`ArkanoidPlayer.tsx`.** Componente `"use client"` que:
   - Renderiza el mismo HUD React y marco CRT que `AsteroidsPlayer`, con etiquetas **Puntuación / Vidas / Nivel** y un `<canvas ref={canvasRef}>` (clase `av-player--canvas`/`game-canvas`).
   - En `useEffect`: instancia `createArkanoidGame(canvasRef.current, { onScore, onLives, onLevel, onGameOver, onPlaying })`, llama `start()` y `canvas.focus()`; en la limpieza llama `stop()` y limpia el ref.
   - Estado React: `score`, `lives`, `level`, `paused`, `over`, `saved`, `won`, alimentados por los callbacks.
   - `onGameOver(final, won)` abre el modal con el score final y guarda `won` para el título ("¡COMPLETASTE EL JUEGO!" si `won`, "FIN DEL JUEGO" si no); `onPlaying` lo cierra y resetea el estado React (cubre el `restart()`).
   - PAUSA → `pause()/resume()` (+ overlay "EN PAUSA"); FIN → fuerza game over con el score actual (abre modal); SALIR → `router.push("/juego/arkanoid")`; modal "JUGAR DE NUEVO" → `restart()`; "GUARDAR PUNTUACIÓN" → `saveScore({ game: "arkanoid", score, name })` (se deshabilita tras el primer guardado vía `saved`).
     _Verificación:_ en `/jugar/arkanoid` se juega de verdad (mover con mouse y flechas, romper bloques con sonido, perder vidas, avanzar de nivel); Puntuación/Vidas/Nivel del HUD React se actualizan en tiempo real; la pausa muestra el selector de nivel 1–5 y saltar de nivel funciona; al perder todas las vidas aparecen el overlay "GAME OVER" en canvas y el modal "FIN DEL JUEGO"; al limpiar el nivel 5 aparece el modal "¡COMPLETASTE EL JUEGO!".

5. **Registry en `page.tsx`.** Importar `ArkanoidPlayer` y agregar `arkanoid: ArkanoidPlayer` al record `PLAYERS`. _Verificación:_ `/jugar/arkanoid` carga el juego real; los demás ids siguen con `MockPlayer`; un id inexistente da 404.

6. **Portada `cover-arkanoid`.** En `globals.css`, crear la clase `.cover-arkanoid` (gradientes/pseudo-elementos que evoquen una pared de ladrillos con paleta + pelota, en clave magenta del tema, sin binarios), coherente con las demás `cover-*`. _Verificación:_ la card "ARKANOID" en `/juego` muestra su portada propia; en viewport angosto el canvas se reduce sin deformarse (4:3) y sigue jugable.

7. **Limpieza.** `npm run build` y `npm run lint` sin errores ni warnings; sin fugas de `requestAnimationFrame`, listeners ni `Audio` (entrar/salir de `/jugar/arkanoid` varias veces no acumula loops, listeners ni nodos de audio sonando). _Verificación:_ build/lint limpios; entrar/salir repetido no degrada rendimiento ni deja audio colgado.

Nota: cada paso deja el sistema funcional. El paso 1 ya hace visible la card (con mock); el juego real entra en los pasos 3–5. Los demás juegos quedan intactos.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings.
- [ ] Existe la migración `supabase/migrations/<timestamp>_add_arkanoid.sql` versionada y registrada en el remoto (`list_migrations` la muestra); `select * from games where id='arkanoid'` devuelve la fila con `cat=ARCADE`, `color=magenta`, `cover=cover-arkanoid`, `position=10`; el resto de filas quedan **sin cambios** (`count(*)`=11).
- [ ] Los assets `public/games/arkanoid/spritesheet-breakout.png`, `.../sounds/ball-bounce.mp3` y `.../sounds/break-sound.mp3` existen y se sirven (200).
- [ ] `/juego` muestra la card "ARKANOID" con la portada `cover-arkanoid`; buscar "arkanoid" y filtrar por `ARCADE` la incluyen; `/juego/arkanoid` (detalle) carga y "JUGAR AHORA" lleva a `/jugar/arkanoid`.
- [ ] En `/jugar/arkanoid` el juego es **real**: la paleta sigue el **mouse** y también responde a ←/→; la pelota rebota en paredes/paleta/bloques; romper un bloque suma 10, lo borra con animación de explosión y suena `break`; rebotar suena `bounce`.
- [ ] Las flechas y el Espacio **no** hacen scroll de la página mientras se juega; el canvas capta foco al montar.
- [ ] El HUD React muestra **Puntuación / Vidas / Nivel** y se actualizan en tiempo real; hay **3 vidas**; perder la pelota resta una vida y a 0 vidas es game over.
- [ ] Los **5 niveles** de `levels.js` se cargan con su diseño y velocidad creciente; limpiar todos los bloques avanza de nivel automáticamente.
- [ ] Al perder todas las vidas salen **ambos**: el overlay "GAME OVER" en canvas **y** el modal React "FIN DEL JUEGO" con el score final.
- [ ] Al limpiar el **nivel 5**, el motor emite `onGameOver(final, won=true)` y el modal React muestra **"¡COMPLETASTE EL JUEGO!"** con el score final, permitiendo guardar.
- [ ] La **pausa** (botón o tecla `P`/`Escape`) congela el juego y muestra el overlay "PAUSA" con el **selector de nivel 1–5**; hacer click en un número salta a ese nivel y reanuda; REANUDAR continúa.
- [ ] "GUARDAR PUNTUACIÓN" inserta `{ game_id: "arkanoid", player_name, score }` en `scores` (vía `saveScore` de SPEC 07) y la marca aparece en la pestaña Arkanoid del `/salon` y en el leaderboard de `/juego/arkanoid`; "GUARDAR" se deshabilita tras el primer guardado.
- [ ] FIN abre el modal con el score actual. SALIR navega a `/juego/arkanoid`. "JUGAR DE NUEVO"/`restart()` reinicia (nivel 1, 3 vidas, score 0) sin recargar y cierra el modal (vía `onPlaying`).
- [ ] El canvas escala manteniendo proporción 4:3 dentro del marco CRT; en viewport angosto se reduce sin deformarse y sigue jugable; el selector de nivel en pausa acierta las hitboxes pese al escalado.
- [ ] Los demás ids existentes siguen mostrando el `MockPlayer`; un id inexistente da 404.
- [ ] Salir de `/jugar/arkanoid` y volver a entrar varias veces no acumula loops `requestAnimationFrame`, listeners ni nodos de `Audio` sonando; el motor no usa `document`/`window`/`new Image`/`new Audio` a nivel de módulo.

---

## Decisiones

- **Sí:** Arkanoid es un **juego nuevo** con `id: "arkanoid"`, `position: 10` (append al final del grid). La migración inserta **una sola fila** sin reordenar las 10 existentes; sigue el precedente de SPEC 06/08.
- **Sí:** **port fiel con assets binarios** — copiar el spritesheet PNG y los 2 mp3 a `public/games/arkanoid/` y portar `spritesheet.js`/sonido tal cual (elección del usuario). Es el primer spec que mete binarios; a diferencia de Asteroides/Tetris (primitivas + CSS), aquí se conserva el look y el audio originales.
- **Sí:** **estado `win` → modal**. Al limpiar el nivel 5 se abre el modal React con "¡COMPLETASTE EL JUEGO!" y opción de guardar score, no solo el overlay en canvas. Para distinguirlo de la derrota, `onGameOver` lleva un segundo argumento `won?: boolean` — extensión mínima del contrato canónico (Asteroides solo pasa `finalScore`).
- **Sí:** **conservar el selector de nivel 1–5** en el overlay de pausa (port del `drawPauseOverlay` + click en canvas). Es una afordancia de salto de nivel del original; el usuario pidió mantenerla pese a que rompe la progresión.
- **Sí:** modelo de HUD **score/vidas/nivel** con `onLives` (igual que Asteroides, §8 de la arquitectura): Arkanoid comparte el contador de vidas, no necesita variar el contrato salvo el flag `won`.
- **Sí:** **control por mouse + teclado**. Es el primer juego del vault con mouse; los listeners `mousemove`/`click` se añaden/retiran en `start`/`stop` junto a los de teclado, y la conversión de coordenadas usa el factor de escala del canvas (como el original).
- **Sí:** canvas **800×600** reutilizando `.av-player--canvas`/`.game-canvas` (4:3) sin CSS de escalado nuevo; coincide con la resolución del original.
- **No:** crear tablas/políticas/Provider ni tocar `saveScore`/leaderboards. Ya existen por SPEC 07 y funcionan para `game_id = "arkanoid"`.
- **No:** cargar `game.js` vía `<script>`/iframe. Descartado por el mismo motivo que SPEC 06: HUD React desconectado, globales sueltos y fugas difíciles de limpiar al desmontar.
- **No:** power-ups, multibola, ladrillos resistentes, más niveles, táctil, dificultad configurable o anti-fraude. Abren alcance propio; fuera de este spec.
- **Color magenta** para `cover-arkanoid` y el botón JUGAR (elección del usuario), pese a coincidir con Tetris.

---

## Riesgos

| Riesgo                                                                                                                                                   | Mitigación                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuga de `requestAnimationFrame`, listeners de teclado/**mouse** y nodos de `Audio` al desmontar/remontar (loops acumulados, audio colgado, degradación). | `start()` guarda el id del `rAF` y referencias a los listeners; `stop()` los cancela/retira y detiene el audio en curso; el `useEffect` llama `stop()` en su limpieza. Criterio "entrar/salir varias veces" lo cubre. |
| Globales de módulo del `game.js` original (`paddle`, `ball`, `blocks`, `score`, `lives`, `gameState`, …) provocan estado compartido o error SSR.         | El motor encapsula todo el estado mutable en el cierre de la fábrica; solo constantes de datos quedan a nivel de módulo. Verificación en paso 3: sin `document`/`window` fuera de `start`/`stop`.                     |
| `new Image()` / `new Audio()` a nivel de módulo rompen en SSR (no existen en el servidor).                                                               | Crearlos **dentro de `start()`**; arrancar el loop en el callback de carga del spritesheet (`loadSpritesheet`).                                                                                                       |
| Dibujar antes de que el spritesheet termine de cargar (sprites en blanco o error).                                                                       | El loop arranca **solo tras** el `onload` del spritesheet (port de `loadSpritesheet(cb)`); guarda temprana si el canvas/ctx es `null`.                                                                                |
| Autoplay de audio bloqueado por el navegador hasta el primer gesto del usuario.                                                                          | El juego requiere interacción (mouse/teclado) para empezar a jugar; los sonidos se disparan tras ese gesto. Se ignoran promesas rechazadas de `play()`.                                                               |
| Acumulación de nodos `Audio` por `cloneNode().play()` en ráfagas (muchos rebotes/roturas).                                                               | Los clones son efímeros y se recogen al terminar; opcionalmente reutilizar un pool pequeño. `stop()` no deja referencias vivas. (Aceptable: comportamiento del original.)                                             |
| `onGameOver` se dispara en bucle cada frame mientras el estado es `gameover`/`win`.                                                                      | Emitirlo **una sola vez** en la transición (bandera), no por frame.                                                                                                                                                   |
| Dos caminos de fin/reinicio (overlay canvas vs modal React) se desincronizan; o `win` vs `gameover` muestran el título equivocado.                       | `onPlaying` cierra el modal y resetea el estado React en cada vuelta a `playing`; `onGameOver(final, won)` una sola vez por transición y el Player elige el título por `won`.                                         |
| Tecla `P`/`Escape` (pausa) y el botón PAUSA del HUD desincronizan el estado de pausa.                                                                    | Un único estado `isPaused` en el motor; tecla y botón llaman al mismo `pause()/resume()`; el HUD React espeja `paused` vía estado del Player.                                                                         |
| Las hitboxes del selector de nivel 1–5 fallan por el escalado CSS del canvas.                                                                            | Convertir las coordenadas del click con el factor `canvas.width / rect.width` (como el original), no con coordenadas de pantalla crudas.                                                                              |
| FK `scores.game_id → games.id`: guardar antes de aplicar la migración falla.                                                                             | El paso 1 (migración) va **antes** del juego jugable; el `id "arkanoid"` existe en `games` cuando el Player puede guardar.                                                                                            |
| Binarios en el repo (peso del spritesheet/sonidos, licencia).                                                                                            | Assets pequeños (PNG ~30 KB, mp3 cortos) y provienen del propio paquete de referencia del curso; se versionan en `public/games/arkanoid/`. Único spec con binarios, acotado a este juego.                             |
