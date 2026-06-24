# SPEC 06 — Asteroids jugable en `/jugar/asteroides`

> **Estado:** Implementado · **Depende de:** 02-biblioteca-en-juego · **Fecha:** 2026-06-24
> **Objetivo:** Añadir el juego nuevo "Asteroides" al catálogo y hacerlo jugable de verdad en `/jugar/asteroides`, portando `references/started-games/02-asteroids/game.js` a un motor TS autónomo que notifica su estado al HUD y al modal React, dejando los demás juegos con el reproductor mock vía un registry.

---

## Alcance

**Dentro:**

- **`lib/data.ts`** — añadir una entrada **nueva** al **principio** del array `GAMES`:
  - `id: "asteroides"`, `title: "ASTEROIDES"`, `cat: "SHOOTER"`, `color: "cyan"`, `cover: "cover-asteroids"`
  - `short`: "Destruye la lluvia de asteroides en el vacío."
  - `long`: "Pilota una nave en un campo de asteroides toroidal. Dispara para partir las rocas en fragmentos cada vez más pequeños y recoge el power-up de triple disparo. El espacio no perdona."
  - `best: 39750`, `plays: "0"`
  - **No se toca** el slot `rocas` ni ningún otro existente.
- **`lib/games/asteroids.ts`** — motor TS autónomo portado desde `game.js`. Fábrica `createAsteroidsGame(canvas, callbacks)` que devuelve un controlador con `start()`, `stop()`, `pause()`, `resume()`, `restart()`. Sin globales de módulo: todo el estado vive dentro de la instancia. Recibe el `canvas` por parámetro (no `document.getElementById`). Registra sus listeners de teclado y los retira en `stop()`. Lógica en coordenadas internas 800×600. **Conserva su HUD dibujado en canvas** (SCORE / NIVEL / iconos de vidas / indicador "3x") **y el overlay "GAME OVER — ESPACIO PARA REINICIAR"** con su reinicio por ESPACIO; en paralelo emite los callbacks.
- **Callbacks motor → React**: `onScore(score)`, `onLives(lives)`, `onLevel(level)`, `onGameOver(score)`, `onPlaying()`. El canvas es la fuente de verdad y empuja el estado hacia arriba.
- **Power-ups**: se portan tal cual (cubo "3x" → triple disparo 5s).
- **`app/jugar/[id]/AsteroidsPlayer.tsx`** (`"use client"`) — monta el canvas con un `ref`, instancia el motor en `useEffect` (con limpieza en el unmount), refleja score/vidas/nivel en el HUD React, y enruta `onGameOver` al modal existente (guardado con `useAuth().saveScore`) y `onPlaying` para cerrarlo. Cablea PAUSA/FIN/SALIR/JUGAR DE NUEVO al controlador. Hace `preventDefault` de flechas/espacio para que no scrollee la página.
- **`app/jugar/[id]/MockPlayer.tsx`** (`"use client"`) — el reproductor falso actual, extraído tal cual desde `page.tsx` (sin cambios de comportamiento; conserva la arena CSS decorativa).
- **`app/jugar/[id]/page.tsx`** — despacha por `id` vía un registry: `asteroides` → `AsteroidsPlayer`, el resto → `MockPlayer`. Mantiene `notFound()` para ids inexistentes.
- **`app/globals.css`** — clase nueva `cover-asteroids` (portada de la card) y estilo del canvas para que **escale manteniendo proporción** dentro del marco CRT (`max-width: 100%`, `aspect-ratio` 4:3).

**Fuera de alcance:**

- Tocar el slot `rocas` ni ningún otro juego existente del catálogo.
- Conectar las puntuaciones a Supabase o al Salón de la Fama: `saveScore` sigue escribiendo en localStorage (como hoy).
- Adaptar cualquiera de los otros juegos: siguen con `MockPlayer` hasta su propio spec.
- Rediseñar el HUD, el modal o el marco CRT (solo se cablean al motor real).
- Sonido, marcador online, dificultad configurable, controles táctiles dedicados (sigue siendo teclado).
- Tests automatizados (no hay runner).

---

## Modelo de datos

Una entrada nueva en el array `GAMES` de `lib/data.ts` (tipo `Game` ya existente, sin cambios de tipo):

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "Destruye la lluvia de asteroides en el vacío.",
  long: "Pilota una nave en un campo de asteroides toroidal. Dispara para partir las rocas en fragmentos cada vez más pequeños y recoge el power-up de triple disparo. El espacio no perdona.",
  cat: "SHOOTER",
  cover: "cover-asteroids",
  color: "cyan",
  best: 39750,
  plays: "0",
}
```

El motor (`lib/games/asteroids.ts`) define su propio contrato, **no persistido** (vive solo en memoria mientras se juega):

```ts
type AsteroidsCallbacks = {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onPlaying?: () => void; // motor vuelve a 'playing' (incluye reinicio con ESPACIO)
};

type AsteroidsGame = {
  start(): void; // arranca el loop (requestAnimationFrame)
  stop(): void; // cancela el loop y retira listeners de teclado
  pause(): void; // congela el update (sigue dibujando el último frame)
  resume(): void; // reanuda
  restart(): void; // reinicia score/vidas/nivel y vuelve a 'playing'
};

function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks?: AsteroidsCallbacks,
): AsteroidsGame;
```

La puntuación final guardada reutiliza el `ScoreEntry` existente de `AuthProvider` (`{ game: "asteroides", score, name }`) vía `saveScore` → localStorage `av_scores`. No se introduce ninguna estructura persistida nueva.

---

## Plan de implementación

1. **Catálogo y portada.** Añadir la entrada `asteroides` al **principio** del array `GAMES` en `lib/data.ts`. Crear la clase `.cover-asteroids` en `app/globals.css` (estilo de portada propio, coherente con las demás `cover-*`). _Verificación:_ `/juego` muestra la card "ASTEROIDES" como primera del grid; click en la card abre `/juego/asteroides` (detalle) sin error; el botón "JUGAR AHORA" apunta a `/jugar/asteroides`.

2. **Motor `lib/games/asteroids.ts`.** Portar `game.js` a un módulo TS autónomo: convertir las clases (`Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`) y la lógica de loop/update/draw a una fábrica `createAsteroidsGame(canvas, callbacks)`. Cambios respecto al original:
   - El estado deja de ser global de módulo: vive en cierre/instancia.
   - El `ctx` y dimensiones se derivan del `canvas` recibido (no `document.getElementById`); se fija `canvas.width = 800; canvas.height = 600` internamente.
   - Listeners `keydown`/`keyup` se añaden en `start()` y se quitan en `stop()`; `preventDefault` para `ArrowUp/Down/Left/Right` y `Space`.
   - `pause()`/`resume()` con una bandera que salta el `update` (sigue redibujando); `restart()` llama a `initGame()`.
   - **Se mantienen** el `drawHUD` del canvas, el overlay "GAME OVER — ESPACIO PARA REINICIAR" y el reinicio interno con ESPACIO (conviven con el HUD/modal React).
   - Emitir callbacks: `onScore` cuando cambia `score`, `onLives` cuando cambia `lives`, `onLevel` en `nextLevel`, `onGameOver` **una sola vez** al entrar en estado `gameover`, y `onPlaying` al volver a `playing` (tras `initGame()` por ESPACIO o por `restart()`).
   - `dt` sigue capado a 50ms.

   _Verificación:_ el módulo typechequea (`npm run lint`); sin referencias a `document`/`window` en el ámbito de módulo (solo dentro de `start`/`stop`).

3. **Extraer `MockPlayer.tsx`.** Mover el JSX/estado actual de `app/jugar/[id]/page.tsx` a `app/jugar/[id]/MockPlayer.tsx` (`"use client"`), recibiendo el `game` por prop (o el `id` y resolviéndolo). Sin cambios de comportamiento. _Verificación:_ jugar cualquier juego que no sea `asteroides` (p.ej. `/jugar/rocas`) se ve y comporta igual que antes (ticker falso, PAUSA/FIN/SALIR, modal de guardado).

4. **`AsteroidsPlayer.tsx`.** Componente `"use client"` que:
   - Renderiza el mismo HUD React (Jugador/Puntuación/Vidas/Nivel) y el marco CRT, pero con un `<canvas ref>` dentro de la pantalla en lugar de la arena decorativa.
   - En `useEffect`: instancia `createAsteroidsGame(canvasRef.current, { onScore, onLives, onLevel, onGameOver, onPlaying })`, llama `start()`, y en la limpieza llama `stop()`.
   - Estado React: `score`, `lives`, `level`, `over` alimentados por los callbacks.
   - `onGameOver` abre el modal; `onPlaying` lo cierra y resetea el estado React (cubre el reinicio con ESPACIO dentro del canvas).
   - PAUSA → `pause()/resume()` (+ overlay "EN PAUSA" existente); FIN → fuerza gameover (abre modal con el score actual); SALIR → `router.push("/juego/asteroides")`; modal "JUGAR DE NUEVO" → `restart()`; "GUARDAR PUNTUACIÓN" → `saveScore({ game: "asteroides", score, name })`.
   - Foco: el canvas/contenedor capta el teclado al montar.

   _Verificación:_ en `/jugar/asteroides` se juega de verdad (rotar, propulsar, disparar); score/vidas/nivel del HUD se actualizan en tiempo real; al perder las 3 vidas aparecen el overlay del canvas y el modal React.

5. **Dispatch en `page.tsx`.** Reescribir `app/jugar/[id]/page.tsx` para resolver el `game` por `id` (mantener `notFound()` si no existe) y despachar vía registry: `asteroides` → `<AsteroidsPlayer>`, resto → `<MockPlayer>`. _Verificación:_ `/jugar/asteroides` carga el juego real; `/jugar/rocas` (y demás) cargan el mock; un id inexistente da 404.

6. **Canvas responsive.** En `globals.css`, estilar el canvas para escalar manteniendo proporción dentro del marco CRT (`max-width: 100%`, `height: auto`, `aspect-ratio: 4 / 3`, `image-rendering` si aplica). _Verificación:_ en viewport angosto el canvas se reduce sin deformarse y sigue jugable; en desktop ocupa la pantalla CRT.

7. **Limpieza.** `npm run build` y `npm run lint` sin errores ni warnings; sin fugas de `requestAnimationFrame` ni listeners (navegar a `/jugar/asteroides` y salir varias veces no acumula loops). _Verificación:_ build/lint limpios; salir y volver a entrar al juego no degrada rendimiento ni duplica el HUD.

Nota: cada paso deja el sistema funcional. El componente real (pasos 4–5) es el único que cambia runtime de `/jugar/asteroides`; el mock y los demás juegos quedan intactos.

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings.
- [ ] `lib/data.ts` tiene la entrada `asteroides` como **primera** del array `GAMES`; el slot `rocas` y los demás quedan **sin cambios**.
- [ ] `/juego` muestra la card "ASTEROIDES" (primera del grid), con la portada `cover-asteroids`; buscar "asteroides" y filtrar por `SHOOTER` la incluyen.
- [ ] `/juego/asteroides` (detalle) carga sin error y "JUGAR AHORA" lleva a `/jugar/asteroides`.
- [ ] En `/jugar/asteroides` el juego es **real**: las flechas rotan/propulsan y el espacio dispara; los asteroides grandes se parten en medianos y pequeños; el power-up "3x" da triple disparo temporal.
- [ ] Las flechas y el espacio **no** hacen scroll de la página mientras se juega.
- [ ] El HUD del canvas (SCORE/NIVEL/vidas/"3x") **se mantiene visible** junto al HUD React (Puntuación/Vidas/Nivel); ambos muestran el mismo dato.
- [ ] Al perder las 3 vidas aparecen **ambos**: el overlay "GAME OVER — ESPACIO PARA REINICIAR" en canvas **y** el modal React de fin de juego con el score final.
- [ ] "GUARDAR PUNTUACIÓN" persiste `{ game: "asteroides", score, name }` en `localStorage` (`av_scores`) vía `saveScore`.
- [ ] Reiniciar con **ESPACIO** (canvas) reinicia el juego **y cierra el modal React** (vía `onPlaying`), sin recargar; "JUGAR DE NUEVO" del modal hace lo mismo.
- [ ] PAUSA congela el juego (no avanza) y muestra "EN PAUSA"; REANUDAR lo continúa. FIN abre el modal con el score actual. SALIR navega a `/juego/asteroides`.
- [ ] El canvas escala manteniendo proporción 4:3 dentro del marco CRT; en viewport angosto se reduce sin deformarse y sigue jugable.
- [ ] `/jugar/rocas` y los demás ids existentes siguen mostrando el `MockPlayer` con su comportamiento previo; un id inexistente da 404.
- [ ] Salir de `/jugar/asteroides` y volver a entrar varias veces no acumula loops `requestAnimationFrame` ni listeners (sin fuga ni degradación).

---

## Decisiones

- **Sí:** Asteroides es un **juego nuevo** con `id: "asteroides"`, separado de `rocas`. Lo aclaraste explícitamente; `rocas` queda intacto. Evita pisar un slot existente del catálogo y su historial.
- **Sí:** portar `game.js` a un **módulo TS autónomo** con fábrica `createAsteroidsGame(canvas, callbacks)`. SSR-safe (sin `document`/`window` en módulo), ciclo de vida limpio con `start`/`stop`, y estado puenteado al HUD por callbacks.
- **No:** cargar `game.js` casi tal cual vía `<script>`/iframe. Descartado: dejaría el HUD React desconectado, globales sueltos y fugas difíciles de limpiar al desmontar.
- **Sí:** el **canvas es la fuente de verdad** y notifica a React por callbacks (`onScore`/`onLives`/`onLevel`/`onGameOver`/`onPlaying`). Lo pediste así; React solo refleja y enruta, sin duplicar lógica de juego.
- **Sí:** mantener el **HUD del canvas y el HUD React a la vez** (los dos visibles, mismo dato), y **conservar el overlay "GAME OVER" + reinicio con ESPACIO** del canvas además del modal React. Lo pediste así.
- **Sí:** callback `onPlaying` para que React **cierre el modal** cuando el reinicio ocurre dentro del canvas (ESPACIO), evitando dos estados de fin de juego desincronizados.
- **Sí:** **mantener los power-ups** (triple disparo). Ya están en el código original; quitarlos sería trabajo extra para perder una mecánica.
- **Sí:** **registry id→componente** en `page.tsx`; `asteroides` → real, resto → `MockPlayer`. Permite incorporar juegos reales de a uno sin reescribir el reproductor falso ni romper los demás.
- **Sí:** extraer el reproductor falso a `MockPlayer.tsx` **sin cambios de comportamiento**. Aísla lo real de lo mock y evita regresiones en los juegos restantes.
- **Sí:** **escalar el canvas** manteniendo proporción 4:3; la lógica sigue en coordenadas 800×600. Juega en móvil sin reescribir física ni colisiones.
- **No:** persistir scores en **Supabase/Salón** en este spec. Se mantiene `saveScore` → localStorage; migrar el scoring es trabajo de un spec futuro.
- **No:** **controles táctiles** dedicados, sonido, dificultad configurable o marcador online. Abren alcance propio; fuera de este spec.
- **No:** **crear `favicon.svg`** ni assets del juego de referencia. La portada es CSS (`cover-asteroids`); no se copian binarios.

---

## Riesgos

| Riesgo                                                                                                                                 | Mitigación                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fuga de `requestAnimationFrame` y listeners de teclado al desmontar/remontar el componente (loops acumulados, doble HUD, degradación). | `start()` guarda el id del `rAF` y los listeners; `stop()` los cancela/retira. El `useEffect` llama `stop()` en su limpieza. Criterio de aceptación de "entrar/salir varias veces" lo cubre. |
| Globales de módulo del `game.js` original (`ship`, `score`, `state`, …) provocan estado compartido entre montajes o errores en SSR.    | El motor encapsula todo el estado en la instancia/cierre; nada a nivel de módulo. Verificación en paso 2: sin `document`/`window` fuera de `start`/`stop`.                                   |
| El canvas se renderiza en servidor o el `ref` es `null` al instanciar el motor.                                                        | `AsteroidsPlayer` es `"use client"`; la instanciación ocurre en `useEffect` (solo cliente) con el `ref` ya montado.                                                                          |
| Flechas/espacio scrollean la página o roban foco a otros elementos.                                                                    | `preventDefault` en el handler de teclado para flechas y `Space`; el contenedor capta foco al montar.                                                                                        |
| `onGameOver` se dispara en bucle cada frame mientras el estado es `gameover`.                                                          | Emitirlo **una sola vez** en la transición a `gameover` (guardado con bandera), no en cada frame.                                                                                            |
| Dos caminos de fin/reinicio (canvas ESPACIO vs modal) se desincronizan: modal abierto sobre un juego ya reiniciado.                    | `onPlaying` cierra el modal y resetea el estado React en cada vuelta a `playing`; `onGameOver` se emite una sola vez por transición.                                                         |
| Doble guardado de puntuación o reinicio inconsistente entre motor y React.                                                             | "GUARDAR" deshabilita tras el primer guardado (patrón `saved` del mock); "JUGAR DE NUEVO" llama `restart()` y resetea el estado React en el mismo handler.                                   |
| Escalado del canvas borrosea o desincroniza coordenadas de input (el juego usa 800×600 fijos).                                         | El canvas mantiene resolución interna 800×600 (`width/height`); el escalado es solo CSS (`max-width`/`aspect-ratio`); el input no depende de coordenadas de puntero.                         |
| El registry queda desincronizado si se añaden juegos reales luego y `page.tsx` no los contempla.                                       | Default explícito a `MockPlayer` para cualquier id no mapeado; añadir un juego real es una sola entrada en el registry.                                                                      |
