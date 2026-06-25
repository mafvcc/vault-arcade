// ===== lib/games/snake.ts — motor TS autónomo del juego Snake =====
// Juego externo (no portado de references/started-games). Usa los sprites de
// fruta de public/snake-assets/fruits.png; las coordenadas del atlas están
// transcritas abajo desde references/resources/source-assets/snake-assets/sprites.js
//
// Sin globales de módulo: todo el estado vive dentro de la instancia que
// devuelve `createSnakeGame`. El canvas es la fuente de verdad y empuja
// score/longitud/fin/reinicio hacia React vía callbacks.

export type SnakeCallbacks = {
  onScore?: (score: number) => void;
  onLength?: (length: number) => void; // longitud de la serpiente (reemplaza onLives/onLevel)
  onGameOver?: (finalScore: number) => void;
  onPlaying?: () => void; // motor vuelve a 'playing' (incluye reinicio interno)
};

export type SnakeGame = {
  start(): void; // arranca el loop (requestAnimationFrame) + carga fruits.png
  stop(): void; // cancela el loop y retira listeners de teclado
  pause(): void; // congela el update (sigue dibujando el último frame + overlay PAUSA)
  resume(): void; // reanuda
  restart(): void; // reinicia estado y vuelve a 'playing'
};

type Cell = { x: number; y: number };
type GameState = "playing" | "gameover";

// ── Atlas de frutas (coords portadas de sprites.js; recortes de fruits.png) ──
type Sprite = { x: number; y: number; w: number; h: number };
const FRUIT_ATLAS: Record<string, Sprite> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};
const FRUIT_KEYS = Object.keys(FRUIT_ATLAS);

export function createSnakeGame(
  canvas: HTMLCanvasElement,
  callbacks: SnakeCallbacks = {},
): SnakeGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  const W = 800;
  const H = 600;
  // Resolución interna fija: el escalado es solo CSS.
  canvas.width = W;
  canvas.height = H;

  const CELL = 25;
  const COLS = W / CELL; // 32
  const ROWS = H / CELL; // 24
  const STEP_MS = 110; // velocidad constante (sin niveles ni aceleración)

  // Colores fijos (sin leer document.body, SSR-safe).
  const COL_BG = "#0a140d";
  const COL_GRID = "rgba(57, 211, 83, 0.10)";
  const COL_HEAD = "#9bff66";
  const COL_BODY = "#39d353";
  const COL_FOOD_FALLBACK = "#ff5d5d";

  // ── Sprite sheet ──────────────────────────────────────────────────────────
  let fruitsImg: HTMLImageElement | null = null;
  let fruitsReady = false;

  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
  const pickFruit = () => FRUIT_KEYS[randInt(0, FRUIT_KEYS.length - 1)];

  // ── Input ───────────────────────────────────────────────────────────────
  const PREVENT = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ]);

  const DIRS: Record<string, Cell> = {
    ArrowUp: { x: 0, y: -1 },
    KeyW: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    KeyS: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    KeyA: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    KeyD: { x: 1, y: 0 },
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();

    if (e.code === "KeyP") {
      if (state === "playing") paused = !paused;
      return;
    }

    if (state === "gameover") {
      if (e.code === "Space") restartInternal();
      return;
    }

    const turn = DIRS[e.code];
    if (turn) {
      // Evita reversa 180°: se valida contra la dirección ya en curso (dir),
      // no contra nextDir, para que dos teclas en el mismo paso no inviertan.
      if (turn.x !== -dir.x || turn.y !== -dir.y) {
        nextDir = turn;
      }
    }
  };

  // ── Estado del juego (en la instancia, no global de módulo) ─────────────────
  let snake: Cell[];
  let dir: Cell;
  let nextDir: Cell;
  let food: { x: number; y: number; fruitKey: string };
  let score: number;
  let length: number;
  let state: GameState;
  let stepAcc = 0; // acumulador de tiempo (ms) entre pasos

  // Estado previo para emitir callbacks sólo cuando cambia.
  let lastScore = NaN;
  let lastLength = NaN;
  let lastState: GameState | null = null;

  function emitChanges() {
    if (score !== lastScore) {
      lastScore = score;
      callbacks.onScore?.(score);
    }
    if (length !== lastLength) {
      lastLength = length;
      callbacks.onLength?.(length);
    }
    if (state !== lastState) {
      const prev = lastState;
      lastState = state;
      if (state === "gameover") callbacks.onGameOver?.(score);
      if (state === "playing" && prev === "gameover") callbacks.onPlaying?.();
    }
  }

  function placeFood() {
    const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
    let x: number, y: number;
    do {
      x = randInt(0, COLS - 1);
      y = randInt(0, ROWS - 1);
    } while (occupied.has(`${x},${y}`));
    food = { x, y, fruitKey: pickFruit() };
  }

  function initGame() {
    const cy = Math.floor(ROWS / 2);
    const cx = Math.floor(COLS / 2);
    // Serpiente inicial de 3 segmentos, cabeza a la derecha.
    snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    length = snake.length;
    state = "playing";
    stepAcc = 0;
    placeFood();
  }

  function step() {
    dir = nextDir;
    const head = snake[0];
    const nx = head.x + dir.x;
    const ny = head.y + dir.y;

    // Muerte por pared (fuera de la grilla).
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      state = "gameover";
      return;
    }
    // Muerte por autocolisión. La cola se libera este paso salvo que comamos,
    // así que pisarla sólo es letal contra los segmentos que permanecen.
    const eating = nx === food.x && ny === food.y;
    const body = eating ? snake : snake.slice(0, -1);
    if (body.some((c) => c.x === nx && c.y === ny)) {
      state = "gameover";
      return;
    }

    snake.unshift({ x: nx, y: ny });
    if (eating) {
      score += 10;
      length = snake.length;
      placeFood();
    } else {
      snake.pop();
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dtMs: number) {
    if (state === "gameover") return;
    stepAcc += dtMs;
    // Avanza tantos pasos como quepan en el tiempo acumulado (dt ya viene capado).
    while (stepAcc >= STEP_MS && state === "playing") {
      stepAcc -= STEP_MS;
      step();
    }
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function drawGrid() {
    ctx!.strokeStyle = COL_GRID;
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    for (let x = 0; x <= COLS; x++) {
      ctx!.moveTo(x * CELL + 0.5, 0);
      ctx!.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx!.moveTo(0, y * CELL + 0.5);
      ctx!.lineTo(W, y * CELL + 0.5);
    }
    ctx!.stroke();
  }

  function drawFruit() {
    const sp = FRUIT_ATLAS[food.fruitKey];
    const dx = food.x * CELL;
    const dy = food.y * CELL;
    if (fruitsReady && fruitsImg && sp) {
      // Encaja el sprite dentro de la celda preservando su aspecto.
      const pad = 2;
      const inner = CELL - pad * 2;
      const scale = Math.min(inner / sp.w, inner / sp.h);
      const dw = sp.w * scale;
      const dh = sp.h * scale;
      ctx!.drawImage(
        fruitsImg,
        sp.x,
        sp.y,
        sp.w,
        sp.h,
        dx + (CELL - dw) / 2,
        dy + (CELL - dh) / 2,
        dw,
        dh,
      );
    } else {
      // Fallback mientras carga la imagen.
      ctx!.fillStyle = COL_FOOD_FALLBACK;
      ctx!.beginPath();
      ctx!.arc(dx + CELL / 2, dy + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  function drawSnake() {
    for (let i = snake.length - 1; i >= 0; i--) {
      const c = snake[i];
      ctx!.fillStyle = i === 0 ? COL_HEAD : COL_BODY;
      ctx!.fillRect(c.x * CELL + 1, c.y * CELL + 1, CELL - 2, CELL - 2);
    }
  }

  function drawOverlay(title: string, sub: string) {
    ctx!.fillStyle = "rgba(0,0,0,0.55)";
    ctx!.fillRect(0, 0, W, H);
    ctx!.textAlign = "center";
    ctx!.fillStyle = "#fff";
    ctx!.font = "bold 46px monospace";
    ctx!.fillText(title, W / 2, H / 2 - 18);
    ctx!.font = "18px monospace";
    ctx!.fillStyle = "rgba(255,255,255,0.65)";
    ctx!.fillText(sub, W / 2, H / 2 + 22);
  }

  function draw() {
    ctx!.fillStyle = COL_BG;
    ctx!.fillRect(0, 0, W, H);
    drawGrid();
    drawFruit();
    drawSnake();

    if (state === "gameover") {
      drawOverlay(
        "GAME OVER",
        `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`,
      );
    } else if (paused) {
      drawOverlay("PAUSA", "P PARA REANUDAR");
    }
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let paused = false;
  let running = false;

  function loop(ts: number) {
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    if (!paused) update(dtMs);
    draw();
    emitChanges();
    rafId = requestAnimationFrame(loop);
  }

  function restartInternal() {
    initGame();
    paused = false;
    lastTime = null;
    emitChanges();
  }

  // ── API pública ─────────────────────────────────────────────────────────────
  return {
    start() {
      if (running) return;
      running = true;
      paused = false;
      lastTime = null;
      initGame();
      // Carga del sprite sheet dentro de start() (SSR-safe).
      if (!fruitsImg) {
        fruitsImg = new Image();
        fruitsImg.onload = () => {
          fruitsReady = true;
        };
        fruitsImg.src = "/snake-assets/fruits.png";
      }
      window.addEventListener("keydown", onKeyDown);
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("keydown", onKeyDown);
      running = false;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastTime = null; // evita un salto grande de dt al reanudar
    },
    restart() {
      restartInternal();
    },
  };
}
