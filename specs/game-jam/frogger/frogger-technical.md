# FROGGER — Spec técnico

> **Estado:** Borrador · **Depende de:** SPEC 06 (asteroides jugable), SPEC 07 (tablas `games`/`scores`) · **Fecha:** 2026-06-25

---

## Modelo de datos

**Fila nueva en `public.games`:**

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values (
  'frogger',
  'FROGGER',
  'Cruza la carretera y el río para llevar tu rana a casa.',
  'El clásico arcade de Konami: guía tu rana por cinco carriles de tráfico y cinco de río. Esquiva los coches, salta sobre troncos y tortugas flotantes y llena los cinco refugios antes de que se acabe el tiempo. Cada ronda es más rápida; el score premia la velocidad y la precisión.',
  'ARCADE',
  'cover-frogger',
  'cyan',
  12000,
  '0',
  5
);
```

---

## Constantes del motor

```ts
// Canvas
const CANVAS_W = 800;
const CANVAS_H = 600;

// Grid
const COLS = 16;
const ROWS = 13;
const CELL_W = CANVAS_W / COLS; // 50 px
const CELL_H = CANVAS_H / ROWS; // ~46.15 px (600/13)

// Frog
const FROG_MARGIN = 4; // margen AABB en px (shrink de cada lado)
const FROG_START_COL = 7; // columna inicial (centro)
const FROG_START_ROW = 12; // fila base

// Timer
const FROG_TIMER_MS = 12_000; // 12 s por rana

// Lives
const INITIAL_LIVES = 3;

// Lanes — row index (0 = top)
const HOME_ROW = 0;
const RIVER_ROWS = [1, 2, 3, 4, 5]; // flotadores
const SAFE_ROW = 6; // isla central
const ROAD_ROWS = [7, 8, 9, 10, 11]; // tráfico
const BASE_ROW = 12; // salida

// Level speed factor: level 1 → 1.0, level 5 → 1.5, capped
const speedFactor = (level: number) => Math.min(1.0 + (level - 1) * 0.1, 1.5);

// Score
const SCORE_STEP = 10; // por celda nueva avanzada
const SCORE_HOME = 50; // por refugio llegado
const SCORE_ROUND = 200; // bonus por completar los 5 refugios
const SCORE_TIME_UNIT = 10; // por segundo restante al llegar a refugio
```

---

## Definición de carriles

```ts
type LaneKind = "road" | "river";
type LaneDir = 1 | -1; // 1 = izquierda→derecha, -1 = derecha→izquierda

type ObstacleTemplate = {
  kind: "car" | "log" | "turtle";
  w: number; // ancho en px
  h: number; // alto en px (normalmente CELL_H - 6)
  count: number; // cantidad en el carril
  color: string; // color de relleno neon
};

type LaneDef = {
  row: number;
  kind: LaneKind;
  dir: LaneDir;
  speed: number; // px/s a nivel 1
  obstacle: ObstacleTemplate;
};

const LANE_DEFS: LaneDef[] = [
  // --- TRÁFICO (filas 7–11) ---
  {
    row: 11,
    kind: "road",
    dir: 1,
    speed: 80,
    obstacle: { kind: "car", w: 70, h: 34, count: 4, color: "#ff00ff" },
  },
  {
    row: 10,
    kind: "road",
    dir: -1,
    speed: 120,
    obstacle: { kind: "car", w: 80, h: 34, count: 5, color: "#ff6600" },
  },
  {
    row: 9,
    kind: "road",
    dir: 1,
    speed: 90,
    obstacle: { kind: "car", w: 90, h: 34, count: 3, color: "#ffff00" },
  },
  {
    row: 8,
    kind: "road",
    dir: -1,
    speed: 140,
    obstacle: { kind: "car", w: 75, h: 34, count: 4, color: "#ff0066" },
  },
  {
    row: 7,
    kind: "road",
    dir: 1,
    speed: 100,
    obstacle: { kind: "car", w: 100, h: 34, count: 3, color: "#ff3300" },
  },
  // --- RÍO (filas 1–5) ---
  {
    row: 5,
    kind: "river",
    dir: 1,
    speed: 60,
    obstacle: { kind: "log", w: 80, h: 34, count: 4, color: "#8B4513" },
  },
  {
    row: 4,
    kind: "river",
    dir: -1,
    speed: 80,
    obstacle: { kind: "turtle", w: 90, h: 34, count: 3, color: "#006400" },
  },
  {
    row: 3,
    kind: "river",
    dir: 1,
    speed: 50,
    obstacle: { kind: "log", w: 130, h: 34, count: 2, color: "#A0522D" },
  },
  {
    row: 2,
    kind: "river",
    dir: -1,
    speed: 90,
    obstacle: { kind: "turtle", w: 80, h: 34, count: 4, color: "#228B22" },
  },
  {
    row: 1,
    kind: "river",
    dir: 1,
    speed: 70,
    obstacle: { kind: "log", w: 100, h: 34, count: 3, color: "#6B4226" },
  },
];
```

Los obstáculos de cada carril se distribuyen con separación uniforme al inicializar: `startX[i] = (CANVAS_W / count) * i` ajustado por dirección. El wrap horizontal se aplica en cada frame: si `x > CANVAS_W + w` entonces `x = -w`; si `x < -w` entonces `x = CANVAS_W`.

---

## Refugios (fila 0)

```ts
// 5 refugios en columnas 1,4,7,10,13 (ancho 2 celdas = 100 px)
// 6 separadores en columnas 0,3,6,9,12,15 (ancho 1 celda = 50 px)
// Total: 5×100 + 6×50 = 800 px = CANVAS_W exacto.

const HOME_COLS = [1, 4, 7, 10, 13]; // columna izquierda de cada refugio (2 cols de ancho)

// homeFilled[0..4]: true si el refugio ya fue ocupado en esta ronda
let homeFilled: boolean[] = [false, false, false, false, false];
```

Para detectar a qué refugio llega la rana cuando `frog.row === 0`:

- Calcular `centerX = frog.col * CELL_W + CELL_W / 2`.
- Buscar en `HOME_COLS` el refugio cuyo rango `[col * CELL_W, (col+2) * CELL_W]` contiene `centerX`.
- Si el refugio existe y no está lleno (`!homeFilled[i]`) → marcar, sumar score, volver a base.
- Si el refugio ya está lleno o la rana cayó en un separador → muerte.

---

## Lógica de anclaje al flotador (río)

En cada frame, **antes** de procesar input de rana:

```ts
function applyRiverDrift(
  frog: FrogState,
  obstacles: Obstacle[],
  dt: number,
): void {
  if (!RIVER_ROWS.includes(frog.row)) return;

  const frogCenterX = frog.x + CELL_W / 2;
  const frogCenterY = frog.y + CELL_H / 2;

  const platform = obstacles.find(
    (o) =>
      o.laneKind === "river" &&
      o.row === frog.row &&
      frogCenterX >= o.x &&
      frogCenterX <= o.x + o.w &&
      frogCenterY >= o.y &&
      frogCenterY <= o.y + o.h,
  );

  if (!platform) {
    killFrog(); // agua sin plataforma
    return;
  }

  frog.x += platform.vx * dt; // drift horizontal

  // Muerte por salida lateral arrastrada por el tronco
  if (frog.x < 0 || frog.x + CELL_W > CANVAS_W) {
    killFrog();
  }
}
```

El anclaje es por centro de la rana (no por borde), lo que permite al jugador estar parcialmente fuera del tronco sin morir — coherente con el juego original.

---

## Colisión con coches (tráfico)

```ts
function checkRoadCollision(frog: FrogState, obstacles: Obstacle[]): boolean {
  if (!ROAD_ROWS.includes(frog.row)) return false;

  const fx = frog.x + FROG_MARGIN;
  const fy = frog.y + FROG_MARGIN;
  const fw = CELL_W - FROG_MARGIN * 2;
  const fh = CELL_H - FROG_MARGIN * 2;

  return obstacles.some(
    (o) =>
      o.laneKind === "road" &&
      o.row === frog.row &&
      fx < o.x + o.w &&
      fx + fw > o.x &&
      fy < o.y + o.h &&
      fy + fh > o.y,
  );
}
```

---

## Contrato del motor (`lib/games/frogger.ts`)

```ts
export type FroggerCallbacks = {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onPlaying?: () => void;
};

export type FroggerGame = {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  restart(): void;
};

export function createFroggerGame(
  canvas: HTMLCanvasElement,
  callbacks?: FroggerCallbacks,
): FroggerGame;
```

**Invariantes del motor:**

- Todo el estado vive en el cierre de la fábrica: `frog`, `obstacles`, `homeFilled`, `score`, `lives`, `level`, `timerMs`, `gameState` (`'playing' | 'paused' | 'gameover'`), `rafId`, `gameOverEmitted`.
- `canvas.width = 800; canvas.height = 600` fijado al instanciar.
- Sin `new Image()` ni `new Audio()` (todo son primitivas canvas). SSR-safe: no se accede a `document`/`window` a nivel de módulo.
- Listeners de teclado (`keydown`) añadidos en `start()`, retirados en `stop()`. `preventDefault` sobre `ArrowUp/Down/Left/Right` y `Space`.
- `onGameOver` emitido **una sola vez** en la transición a `gameover` (bandera `gameOverEmitted`). `onPlaying` emitido al volver a `playing` (por `restart()`).
- `dt` capado a `Math.min(delta, 50) / 1000` para evitar saltos tras freeze o pausa.
- `stop()` cancela el `requestAnimationFrame` activo y retira todos los listeners. Entrar/salir repetido no acumula loops.

---

## Estado interno del motor

```ts
type GameState = "playing" | "paused" | "gameover";

type FrogState = {
  col: number; // columna actual (0–15)
  row: number; // fila actual (0–12)
  x: number; // posición x en px (= col * CELL_W, ajustado por drift)
  y: number; // posición y en px (= row * CELL_H)
  highestRow: number; // fila más alta alcanzada esta vida (para score de avance)
};

type Obstacle = {
  id: number;
  laneKind: LaneKind;
  row: number;
  x: number; // posición x en px (actualizada cada frame)
  y: number; // = row * CELL_H + (CELL_H - h) / 2  (centrado vertical)
  w: number;
  h: number;
  vx: number; // velocidad en px/s (positivo = →, negativo = ←), ya con factor de nivel
  color: string;
  kind: "car" | "log" | "turtle";
};
```

---

## Render del canvas

El motor dibuja en este orden cada frame:

1. **Fondo:** rectángulo negro `(0,0,800,600)`.
2. **Bandas de zona:**
   - Fila 0 (refugios): `#003300` (verde oscuro).
   - Filas 1–5 (río): `#000066` (azul oscuro).
   - Fila 6 (isla): `#1a1a1a` (gris carbón).
   - Filas 7–11 (carretera): alternando `#111111` / `#1a1a1a` por carril.
   - Fila 12 (base): `#1a1a1a`.
3. **Separadores de carril:** líneas horizontales `#333333` de 1 px entre filas.
4. **Refugios:** para cada refugio en fila 0:
   - Si vacío: rectángulo `#006600` con borde `#00ff00` y un arco interno.
   - Si lleno: rectángulo `#00ff00` con glow (`shadowColor: '#00ff00', shadowBlur: 12`).
   - Separadores: rectángulos `#1a1a1a`.
5. **Obstáculos:** cada `Obstacle` dibujado con `fillRect` + `strokeRect`:
   - `car`: `fillStyle = obstacle.color`, `shadowColor = obstacle.color`, `shadowBlur = 8`. Dos faros como rectángulos blancos en los extremos.
   - `log`: `fillStyle = obstacle.color`. Líneas de veta en marrón más oscuro.
   - `turtle`: `fillStyle = obstacle.color`. Rectángulo con borde `#00ff66`.
6. **Rana:** rectángulo `CELL_W - 8` × `CELL_H - 10` centrado en la celda, `fillStyle = '#00ff44'`, `shadowColor = '#00ff44'`, `shadowBlur = 10`. Dos puntos blancos de 4 px como ojos.
7. **Barra de timer:** en la parte inferior del canvas (debajo de la fila 12), barra horizontal que va de `#00ff44` a `#ff0000` según tiempo restante. Ancho `= (timerMs / FROG_TIMER_MS) * CANVAS_W`, alto 6 px.
8. **Overlay PAUSA:** si `gameState === 'paused'`, semi-transparente `rgba(0,0,0,0.6)` + texto "EN PAUSA" centrado en Press Start 2P.
9. **Overlay GAME OVER:** si `gameState === 'gameover'`, igual con "GAME OVER" + score final.

---

## Spec del Player (`app/jugar/[id]/FroggerPlayer.tsx`)

- `"use client"`, un `<canvas ref={canvasRef}>` con clases `av-player--canvas game-canvas`.
- `useEffect`: instancia `createFroggerGame(canvasRef.current!, { onScore, onLives, onLevel, onGameOver, onPlaying })`, llama `game.start()` + `canvas.focus()`; limpieza: `game.stop()`.
- Estado React: `score: number`, `lives: number`, `level: number`, `paused: boolean`, `over: boolean`, `saved: boolean`.
- Callbacks → estado React:
  - `onScore(s)` → `setScore(s)`
  - `onLives(l)` → `setLives(l)`
  - `onLevel(lv)` → `setLevel(lv)`
  - `onGameOver(fs)` → `setOver(true)` (abre modal con score final)
  - `onPlaying()` → `setOver(false); setPaused(false)` (cierra modal, reset visual)
- HUD React muestra: **PUNTUACIÓN** / **VIDAS** / **NIVEL** (igual que Arkanoid/Asteroides).
- Botones:
  - PAUSA → `game.pause(); setPaused(true)`
  - REANUDAR → `game.resume(); setPaused(false)`
  - FIN → `game.stop(); callbacks.onGameOver(score)` (fuerza game over con score actual)
  - SALIR → `router.push("/juego/frogger")`
  - JUGAR DE NUEVO → `game.restart()`
  - GUARDAR PUNTUACIÓN → `saveScore({ game: "frogger", score, name })` (deshabilita tras primer guardado vía `saved`)
- `tabIndex={0}` en el canvas para capturar foco. `onKeyDown` con `preventDefault` para flechas y espacio ya lo maneja el motor internamente.

---

## Plan de implementación

1. **Migración + seed (BD).** Escribir `supabase/migrations/<timestamp>_add_frogger.sql` con el INSERT de arriba. Aplicar con `apply_migration` y commitear.
   _Verificación:_ `select * from games where id='frogger'` devuelve la fila; `/juego` muestra la card con `cover-frogger`; "JUGAR AHORA" apunta a `/jugar/frogger` (aún cae al `MockPlayer`).

2. **Motor `lib/games/frogger.ts`.** Implementar la fábrica completa: inicialización de obstáculos, game loop con `requestAnimationFrame`, lógica de anclaje a flotadores, colisión AABB con coches, sistema de refugios, timer de rana, puntuación y progresión de nivel. Sin `new Image()` ni `new Audio()` (todo primitivas canvas).
   _Verificación:_ `npm run lint` sin errores; sin referencias a `document`/`window` a nivel de módulo; `grep -n "document\." lib/games/frogger.ts` no devuelve resultados a nivel de módulo (solo dentro de funciones si fuera necesario, pero no lo es).

3. **`FroggerPlayer.tsx`.** Componente `"use client"` que monta el canvas, cablea callbacks al estado React y renderiza HUD + modal.
   _Verificación:_ el juego es real en `/jugar/frogger`; HUD React (score/vidas/nivel) se actualiza en tiempo real; la barra de timer se ve en el canvas.

4. **Registry en `page.tsx`.** Agregar `"frogger": FroggerPlayer` al objeto `PLAYERS`.
   _Verificación:_ `/jugar/frogger` carga el juego real; los demás ids siguen con `MockPlayer` o sus propios players.

5. **Portada `cover-frogger`.** Clase CSS en `app/globals.css`:

   ```css
   .cover-frogger {
     background: linear-gradient(
       to bottom,
       #003300 8%,
       #000066 8% 46%,
       #1a1a1a 46% 54%,
       #111111 54% 92%,
       #1a1a1a 92%
     );
     position: relative;
   }
   .cover-frogger::after {
     content: "";
     position: absolute;
     left: 50%;
     top: 50%;
     transform: translate(-50%, -50%);
     width: 20px;
     height: 16px;
     background: #00ff44;
     box-shadow: 0 0 8px #00ff44;
   }
   ```

   _Verificación:_ card muestra portada propia con franjas de color; canvas escala 4:3 sin deformarse.

6. **Limpieza.** `npm run build` + `npm run lint` limpios; sin fugas de `rAF` ni listeners (verificar con DevTools al entrar/salir de `/jugar/frogger` varias veces).

---

## Criterios de aceptación

- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings.
- [ ] Existe la migración versionada; `select * from games where id='frogger'` devuelve la fila correcta con `position = 5`.
- [ ] `/juego` muestra la card con portada `cover-frogger`; filtrar por `ARCADE` la incluye; `/juego/frogger` carga; "JUGAR AHORA" lleva a `/jugar/frogger`.
- [ ] El juego es **real** en `/jugar/frogger`: la rana se mueve celda a celda con las flechas; los coches matan; los troncos transportan; llegar a un refugio libre lo llena y reaparece la rana en la base.
- [ ] Las flechas **no** hacen scroll de página; el canvas capta foco al montar.
- [ ] El HUD React muestra score / vidas / nivel y se actualiza en tiempo real.
- [ ] La barra de timer en canvas disminuye y al llegar a cero mata a la rana (resta vida).
- [ ] Completar los 5 refugios incrementa el nivel, limpia el estado de refugios y aumenta la velocidad de obstáculos.
- [ ] Al llegar a 0 vidas: overlay "GAME OVER" en canvas **y** modal React con score final.
- [ ] "GUARDAR PUNTUACIÓN" inserta en `scores` y se deshabilita tras el primer guardado.
- [ ] PAUSA/REANUDAR/FIN/SALIR/JUGAR DE NUEVO funcionan correctamente y el estado es coherente.
- [ ] Canvas escala 4:3 sin deformarse; jugable en viewport angosto.
- [ ] Los demás ids existentes siguen con su propio player o `MockPlayer`; id inexistente da 404.
- [ ] Entrar/salir repetido de `/jugar/frogger` no acumula loops `rAF` ni listeners (verificar en DevTools).

---

## Punto de partida recomendado

Empezar por el paso 1 (migración) para que la card aparezca en `/juego` de inmediato, luego el paso 2 (motor `lib/games/frogger.ts`) ya que concentra toda la lógica y es independiente del resto. Una vez el motor funciona en aislamiento, el paso 3 (Player) es conexión de callbacks al HUD React existente, de complejidad baja.
