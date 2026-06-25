// ===== lib/games/tetris.ts — motor TS autónomo portado desde =====
// references/started-games/03-tetris/game.js
//
// Sin globales de módulo: todo el estado vive dentro de la instancia que
// devuelve `createTetrisGame`. El canvas es la fuente de verdad y empuja
// score/líneas/nivel/fin/reinicio hacia React vía callbacks. El HUD del
// original era DOM → aquí sube por callbacks; el canvas sólo conserva el
// overlay "GAME OVER"/"PAUSA". La pieza siguiente se dibuja en `nextCanvas`.

export type TetrisCallbacks = {
  onScore?: (score: number) => void;
  onLines?: (lines: number) => void; // líneas completadas (reemplaza onLives)
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onPlaying?: () => void; // motor vuelve a 'playing' (incluye restart interno)
};

export type TetrisGame = {
  start(): void; // arranca el loop (requestAnimationFrame)
  stop(): void; // cancela el loop y retira listeners de teclado
  pause(): void; // congela el update (sigue dibujando el último frame + overlay)
  resume(): void; // reanuda
  restart(): void; // reinicia estado y vuelve a 'playing'
};

type Piece = { type: number; shape: number[][]; x: number; y: number };
type GameState = "playing" | "gameover";

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  nextCanvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks = {},
): TetrisGame {
  const ctx = canvas.getContext("2d");
  const nextCtx = nextCanvas.getContext("2d");
  if (!ctx || !nextCtx)
    throw new Error("No se pudo obtener el contexto 2D del canvas");

  // ── Dimensiones ───────────────────────────────────────────────────────────
  const W = 800;
  const H = 600;
  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;
  // El tablero (300×600) se centra dentro del canvas 4:3; el escalado es CSS.
  const OFFSET_X = (W - COLS * BLOCK) / 2; // 250
  const OFFSET_Y = 0;
  canvas.width = W;
  canvas.height = H;
  // Canvas de la pieza siguiente: rejilla 4×4.
  const NB = 30;
  nextCanvas.width = 4 * NB;
  nextCanvas.height = 4 * NB;

  const GRID_LINE = "rgba(255, 255, 255, 0.06)";

  const COLORS: (string | null)[] = [
    null,
    "#4dd0e1", // I - cyan
    "#ffd54f", // O - yellow
    "#ba68c8", // T - purple
    "#81c784", // S - green
    "#e57373", // Z - red
    "#90caf9", // J - pale blue
    "#ffb74d", // L - orange
    "#9e9e9e", // N - tuerca (gris metálico)
  ];

  const PIECES: (number[][] | null)[] = [
    null,
    [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ], // I
    [
      [2, 2],
      [2, 2],
    ], // O
    [
      [0, 3, 0],
      [3, 3, 3],
      [0, 0, 0],
    ], // T
    [
      [0, 4, 4],
      [4, 4, 0],
      [0, 0, 0],
    ], // S
    [
      [5, 5, 0],
      [0, 5, 5],
      [0, 0, 0],
    ], // Z
    [
      [6, 0, 0],
      [6, 6, 6],
      [0, 0, 0],
    ], // J
    [
      [0, 0, 7],
      [7, 7, 7],
      [0, 0, 0],
    ], // L
    [
      [8, 8, 8],
      [8, 0, 8],
      [8, 8, 8],
    ], // N (tuerca)
  ];

  const LINE_SCORES = [0, 100, 300, 500, 800];

  // ── Estado (en la instancia, no global de módulo) ───────────────────────────
  let board: number[][];
  let current: Piece;
  let next: Piece;
  let score: number;
  let lines: number;
  let level: number;
  let dropInterval: number;
  let dropAccum: number;
  let state: GameState;

  // Estado previo para emitir callbacks sólo cuando cambia.
  let lastScore = NaN;
  let lastLines = NaN;
  let lastLevel = NaN;
  let lastState: GameState | null = null;

  function emitChanges() {
    if (score !== lastScore) {
      lastScore = score;
      callbacks.onScore?.(score);
    }
    if (lines !== lastLines) {
      lastLines = lines;
      callbacks.onLines?.(lines);
    }
    if (level !== lastLevel) {
      lastLevel = level;
      callbacks.onLevel?.(level);
    }
    if (state !== lastState) {
      const prev = lastState;
      lastState = state;
      if (state === "gameover") callbacks.onGameOver?.(score);
      // Sólo al volver de 'gameover' (restart()), no en el arranque inicial.
      if (state === "playing" && prev === "gameover") callbacks.onPlaying?.();
    }
  }

  // ── Lógica del tablero ──────────────────────────────────────────────────────
  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = PIECES[type]!.map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length,
      cols = shape[0].length;
    const result: number[][] = Array.from({ length: cols }, () =>
      new Array(rows).fill(0),
    );
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      state = "gameover";
    }
    drawNext();
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────────
  function drawBlock(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    originX: number,
    originY: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    const color = COLORS[colorIndex]!;
    const px = x * size + originX;
    const py = y * size + originY;
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, size - 2, size - 2);
    // highlight
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.fillRect(px + 1, py + 1, size - 2, 4);
    context.globalAlpha = 1;
  }

  function drawGrid() {
    ctx!.strokeStyle = GRID_LINE;
    ctx!.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx!.beginPath();
      ctx!.moveTo(OFFSET_X + c * BLOCK, OFFSET_Y);
      ctx!.lineTo(OFFSET_X + c * BLOCK, OFFSET_Y + ROWS * BLOCK);
      ctx!.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx!.beginPath();
      ctx!.moveTo(OFFSET_X, OFFSET_Y + r * BLOCK);
      ctx!.lineTo(OFFSET_X + COLS * BLOCK, OFFSET_Y + r * BLOCK);
      ctx!.stroke();
    }
  }

  function drawBoardFrame() {
    // Marco del tablero, para separarlo del fondo del CRT.
    ctx!.strokeStyle = "rgba(255,255,255,0.18)";
    ctx!.lineWidth = 2;
    ctx!.strokeRect(OFFSET_X, OFFSET_Y, COLS * BLOCK, ROWS * BLOCK);
  }

  function drawOverlay(title: string, sub: string) {
    ctx!.save();
    ctx!.fillStyle = "rgba(0,0,0,0.72)";
    ctx!.fillRect(OFFSET_X, OFFSET_Y, COLS * BLOCK, ROWS * BLOCK);
    const cx = OFFSET_X + (COLS * BLOCK) / 2;
    const cy = OFFSET_Y + (ROWS * BLOCK) / 2;
    ctx!.textAlign = "center";
    ctx!.fillStyle = "#fff";
    ctx!.font = "bold 34px monospace";
    ctx!.fillText(title, cx, cy - 10);
    if (sub) {
      ctx!.font = "14px monospace";
      ctx!.fillStyle = "rgba(255,255,255,0.7)";
      ctx!.fillText(sub, cx, cy + 24);
    }
    ctx!.restore();
  }

  function draw() {
    // Fondo del CRT
    ctx!.fillStyle = "#05060d";
    ctx!.fillRect(0, 0, W, H);
    // Fondo del tablero
    ctx!.fillStyle = "#000";
    ctx!.fillRect(OFFSET_X, OFFSET_Y, COLS * BLOCK, ROWS * BLOCK);

    drawGrid();

    // Pila fija
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx!, c, r, board[r][c], BLOCK, OFFSET_X, OFFSET_Y);

    if (state === "playing") {
      // Ghost
      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(
              ctx!,
              current.x + c,
              gy + r,
              current.shape[r][c],
              BLOCK,
              OFFSET_X,
              OFFSET_Y,
              0.2,
            );

      // Pieza actual
      for (let r = 0; r < current.shape.length; r++)
        for (let c = 0; c < current.shape[r].length; c++)
          if (current.shape[r][c])
            drawBlock(
              ctx!,
              current.x + c,
              current.y + r,
              current.shape[r][c],
              BLOCK,
              OFFSET_X,
              OFFSET_Y,
            );
    }

    drawBoardFrame();

    if (state === "gameover")
      drawOverlay("GAME OVER", `PUNTUACIÓN: ${score.toLocaleString("es-ES")}`);
    else if (paused) drawOverlay("PAUSA", "PULSA P O REANUDAR");
  }

  function drawNext() {
    nextCtx!.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(nextCtx!, offX + c, offY + r, shape[r][c], NB, 0, 0);
  }

  // ── Init / loop ─────────────────────────────────────────────────────────────
  function initGame() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropAccum = 0;
    state = "playing";
    next = randomPiece();
    spawn();
  }

  // ── Input ───────────────────────────────────────────────────────────────────
  const PREVENT = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.code === "KeyP") {
      togglePause();
      return;
    }
    if (paused || state === "gameover") return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  };

  function togglePause() {
    if (state === "gameover") return;
    paused = !paused;
    if (!paused) lastTime = null; // evita un salto de dt al reanudar
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let paused = false;
  let running = false;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50); // ms, capado
    lastTime = ts;

    if (!paused && state === "playing") {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) {
          current.y++;
        } else {
          lockPiece();
        }
      }
    }

    draw();
    emitChanges();
    rafId = requestAnimationFrame(loop);
  }

  // ── API pública ─────────────────────────────────────────────────────────────
  return {
    start() {
      if (running) return;
      running = true;
      paused = false;
      lastTime = null;
      initGame();
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
      if (state === "gameover") return;
      paused = true;
    },
    resume() {
      if (state === "gameover") return;
      paused = false;
      lastTime = null;
    },
    restart() {
      initGame();
      paused = false;
      lastTime = null;
      emitChanges();
    },
  };
}
