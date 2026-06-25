// ===== lib/games/arkanoid.ts — motor TS autónomo portado desde =====
// references/started-games/04-arkanoid/{game.js, levels.js, assets/spritesheet.js}
//
// Sin globales de módulo: todo el estado mutable vive dentro de la instancia que
// devuelve `createArkanoidGame`. El canvas es la fuente de verdad y empuja
// score/vidas/nivel/pausa/fin/reinicio hacia React vía callbacks. El spritesheet
// (Image) y los sonidos (Audio) se crean dentro de `start()` (SSR-safe).

export type ArkanoidCallbacks = {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onPause?: (paused: boolean) => void; // espeja el estado de pausa (tecla P o botón)
  onGameOver?: (finalScore: number, won?: boolean) => void; // won=true al limpiar el nivel 5
  onPlaying?: () => void; // motor vuelve a 'playing' (incluye restart interno)
};

export type ArkanoidGame = {
  start(): void; // carga spritesheet/audio y arranca requestAnimationFrame
  stop(): void; // cancela el loop y retira listeners de teclado/mouse; detiene audio
  pause(): void; // congela el update (sigue dibujando el último frame + overlay PAUSA)
  resume(): void;
  restart(): void; // reinicia estado (nivel 1, 3 vidas, score 0) y vuelve a 'playing'
};

type GameState = "playing" | "gameover" | "win";
type Color =
  | "red"
  | "yellow"
  | "cyan"
  | "magenta"
  | "hotpink"
  | "green"
  | "gray";

type Block = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: Color;
  alive: boolean;
};
type Explosion = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: Color;
  elapsed: number;
};
type Frame = { sx: number; sy: number; sw: number; sh: number };

// ── Spritesheet (datos puros, portados de assets/spritesheet.js) ──────────────
const EXPLOSION_DURATION = 150;

const EXPLOSION_FRAMES: Record<Color, Frame[]> = {
  red: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
  cyan: [
    { sx: 256, sy: 192, sw: 32, sh: 16 },
    { sx: 288, sy: 192, sw: 32, sh: 16 },
    { sx: 320, sy: 192, sw: 32, sh: 16 },
    { sx: 352, sy: 192, sw: 32, sh: 16 },
  ],
  green: [
    { sx: 256, sy: 208, sw: 32, sh: 16 },
    { sx: 288, sy: 208, sw: 32, sh: 16 },
    { sx: 320, sy: 208, sw: 32, sh: 16 },
    { sx: 352, sy: 208, sw: 32, sh: 16 },
  ],
  magenta: [
    { sx: 256, sy: 224, sw: 32, sh: 16 },
    { sx: 288, sy: 224, sw: 32, sh: 16 },
    { sx: 320, sy: 224, sw: 32, sh: 16 },
    { sx: 352, sy: 224, sw: 32, sh: 16 },
  ],
  yellow: [
    { sx: 256, sy: 240, sw: 32, sh: 16 },
    { sx: 288, sy: 240, sw: 32, sh: 16 },
    { sx: 320, sy: 240, sw: 32, sh: 16 },
    { sx: 352, sy: 240, sw: 32, sh: 16 },
  ],
  hotpink: [
    { sx: 256, sy: 256, sw: 32, sh: 16 },
    { sx: 288, sy: 256, sw: 32, sh: 16 },
    { sx: 320, sy: 256, sw: 32, sh: 16 },
    { sx: 352, sy: 256, sw: 32, sh: 16 },
  ],
  gray: [
    { sx: 256, sy: 176, sw: 32, sh: 16 },
    { sx: 288, sy: 176, sw: 32, sh: 16 },
    { sx: 320, sy: 176, sw: 32, sh: 16 },
    { sx: 352, sy: 176, sw: 32, sh: 16 },
  ],
};

const PADDLE_SPRITE: Frame = { sx: 32, sy: 112, sw: 162, sh: 14 };
const BALL_SPRITE: Frame = { sx: 32, sy: 32, sw: 16, sh: 16 };
const BLOCK_SPRITES: Record<Color, Frame> = {
  gray: { sx: 32, sy: 288, sw: 32, sh: 16 },
  red: { sx: 32, sy: 176, sw: 32, sh: 16 },
  yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
  cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
  magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
  hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
  green: { sx: 32, sy: 208, sw: 32, sh: 16 },
};

// ── Niveles (datos puros, portados de levels.js) ──────────────────────────────
type LevelDef = {
  speed: number;
  blocks: { col: number; row: number; color: Color }[];
};

const LEVELS: LevelDef[] = (() => {
  const rowColors1: Color[] = [
    "red",
    "yellow",
    "cyan",
    "magenta",
    "hotpink",
    "green",
  ];
  const rowColors2: Color[] = [
    "gray",
    "cyan",
    "hotpink",
    "yellow",
    "magenta",
    "green",
  ];
  const rowColors4: Color[] = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "hotpink",
    "red",
  ];

  const l1: LevelDef["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelDef["blocks"] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelDef["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelDef["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelDef["blocks"] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
})();

export function createArkanoidGame(
  canvas: HTMLCanvasElement,
  callbacks: ArkanoidCallbacks = {},
): ArkanoidGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  const W = 800;
  const H = 600;
  // Resolución interna fija: el escalado es solo CSS.
  canvas.width = W;
  canvas.height = H;

  // ── Constantes (portadas de game.js) ────────────────────────────────────────
  const PADDLE_SPEED = 400;
  const BLOCK_COLS = 10;
  const BLOCK_W = 64;
  const BLOCK_H = 24;
  const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
  const BLOCKS_ORIGIN_Y = 80;
  const BASE_BALL_VX = 200;
  const BASE_BALL_VY = -300;

  // Selector de nivel del overlay de pausa.
  const PAUSE_BTN_W = 60;
  const PAUSE_BTN_H = 40;
  const PAUSE_BTN_GAP = 12;
  const PAUSE_BTN_Y = 340;
  const PAUSE_BTN_ROW_X = (W - (5 * PAUSE_BTN_W + 4 * PAUSE_BTN_GAP)) / 2;

  // ── Estado (en la instancia, no global de módulo) ────────────────────────────
  const paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball = { x: 0, y: 0, w: 16, h: 16, vx: BASE_BALL_VX, vy: BASE_BALL_VY };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let currentLevel = 1;
  let gameState: GameState = "playing";
  let isPaused = false;

  const keys: Record<string, boolean> = {};

  // Spritesheet y sonidos: se crean en start() (SSR-safe).
  let ssImg: HTMLImageElement | null = null;
  let ssLoaded = false;
  let bounceSound: HTMLAudioElement | null = null;
  let breakSound: HTMLAudioElement | null = null;

  function playSound(snd: HTMLAudioElement | null) {
    if (!snd) return;
    const node = snd.cloneNode() as HTMLAudioElement;
    node.play().catch(() => {}); // ignora rechazos de autoplay
  }

  function drawSprite(
    frame: Frame,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    if (!ssLoaded || !ssImg) return;
    ctx!.drawImage(ssImg, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
  }

  // ── Init / niveles (portado de game.js) ──────────────────────────────────────
  function initPaddle() {
    paddle.x = (W - paddle.w) / 2;
  }

  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * level.speed;
    ball.vy = BASE_BALL_VY * level.speed;
  }

  function initGame() {
    score = 0;
    lives = 3;
    gameState = "playing";
    isPaused = false;
    initPaddle();
    loadLevel(1);
  }

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  const PREVENT = new Set([
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
    "ArrowDown",
    "Space",
  ]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") keys[e.key] = true;
    if (
      (e.key === "p" || e.key === "P" || e.key === "Escape") &&
      gameState === "playing"
    ) {
      setPaused(!isPaused);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") keys[e.key] = false;
  };

  const onMouseMove = (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    paddle.x = Math.max(0, Math.min(W - paddle.w, mouseX - paddle.w / 2));
  };

  const onClick = (e: MouseEvent) => {
    if (!isPaused) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      if (
        mx >= bx &&
        mx <= bx + PAUSE_BTN_W &&
        my >= PAUSE_BTN_Y &&
        my <= PAUSE_BTN_Y + PAUSE_BTN_H
      ) {
        loadLevel(i + 1);
        setPaused(false);
        return;
      }
    }
  };

  function setPaused(value: boolean) {
    if (isPaused === value) return;
    isPaused = value;
    if (value) lastTime = null; // evita salto de dt al reanudar
    callbacks.onPause?.(isPaused);
  }

  // ── Callbacks (sólo en cambios) ───────────────────────────────────────────
  let lastScore = NaN;
  let lastLives = NaN;
  let lastLevel = NaN;
  let lastState: GameState | null = null;

  function emitChanges() {
    if (score !== lastScore) {
      lastScore = score;
      callbacks.onScore?.(score);
    }
    if (lives !== lastLives) {
      lastLives = lives;
      callbacks.onLives?.(lives);
    }
    if (currentLevel !== lastLevel) {
      lastLevel = currentLevel;
      callbacks.onLevel?.(currentLevel);
    }
    if (gameState !== lastState) {
      const prev = lastState;
      lastState = gameState;
      if (gameState === "gameover") callbacks.onGameOver?.(score, false);
      if (gameState === "win") callbacks.onGameOver?.(score, true);
      if (gameState === "playing" && (prev === "gameover" || prev === "win"))
        callbacks.onPlaying?.();
    }
  }

  // ── Update (portado de game.js) ───────────────────────────────────────────
  function update(dt: number) {
    if (gameState !== "playing") return;

    // Paleta (teclado; el mouse la mueve vía onMouseMove)
    if (keys["ArrowLeft"]) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys["ArrowRight"])
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Movimiento de la bola
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebotes en paredes (izq, der, arriba)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(bounceSound);
    }

    // Rebote en la paleta
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playSound(bounceSound);
    }

    // Colisiones con bloques (uno por frame)
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        playSound(breakSound);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < 5) loadLevel(currentLevel + 1);
          else gameState = "win";
        }
        break;
      }
    }

    // Explosiones
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Bola perdida
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameState = "gameover";
      } else {
        initBall();
      }
    }
  }

  // ── Draw (portado de game.js) ─────────────────────────────────────────────
  function drawOverlay(message: string) {
    ctx!.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx!.fillRect(0, 0, W, H);
    ctx!.fillStyle = "#fff";
    ctx!.font = "bold 64px monospace";
    ctx!.textAlign = "center";
    ctx!.textBaseline = "middle";
    ctx!.fillText(message, W / 2, H / 2);
  }

  function drawPauseOverlay() {
    ctx!.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx!.fillRect(0, 0, W, H);

    ctx!.fillStyle = "#fff";
    ctx!.font = "bold 56px monospace";
    ctx!.textAlign = "center";
    ctx!.textBaseline = "middle";
    ctx!.fillText("PAUSA", W / 2, 260);

    ctx!.font = "bold 16px monospace";
    ctx!.fillText("Saltar al nivel:", W / 2, 310);

    for (let i = 0; i < 5; i++) {
      const bx = PAUSE_BTN_ROW_X + i * (PAUSE_BTN_W + PAUSE_BTN_GAP);
      const isActive = i + 1 === currentLevel;
      ctx!.fillStyle = isActive ? "#f0c040" : "#444";
      ctx!.strokeStyle = "#fff";
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.roundRect(bx, PAUSE_BTN_Y, PAUSE_BTN_W, PAUSE_BTN_H, 6);
      ctx!.fill();
      ctx!.stroke();
      ctx!.fillStyle = isActive ? "#000" : "#fff";
      ctx!.font = "bold 20px monospace";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText(
        String(i + 1),
        bx + PAUSE_BTN_W / 2,
        PAUSE_BTN_Y + PAUSE_BTN_H / 2,
      );
    }
  }

  function draw() {
    ctx!.fillStyle = "#000";
    ctx!.fillRect(0, 0, W, H);

    for (const block of blocks) {
      if (block.alive)
        drawSprite(
          BLOCK_SPRITES[block.color],
          block.x,
          block.y,
          block.w,
          block.h,
        );
    }

    for (const exp of explosions) {
      const frameIndex = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4),
        3,
      );
      drawSprite(
        EXPLOSION_FRAMES[exp.color][frameIndex],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    drawSprite(PADDLE_SPRITE, paddle.x, paddle.y, paddle.w, paddle.h);
    drawSprite(BALL_SPRITE, ball.x, ball.y, ball.w, ball.h);

    if (gameState === "playing") {
      ctx!.fillStyle = "#fff";
      ctx!.font = "bold 18px monospace";
      ctx!.textAlign = "left";
      ctx!.textBaseline = "top";
      ctx!.fillText("Score: " + score, 10, 10);
      ctx!.textAlign = "center";
      ctx!.fillText("Nivel: " + currentLevel, W / 2, 10);
      const ballSize = 16;
      const ballSpacing = 4;
      for (let i = 0; i < lives; i++) {
        const bx = W - 10 - (lives - i) * (ballSize + ballSpacing);
        drawSprite(BALL_SPRITE, bx, 10, ballSize, ballSize);
      }
    }

    if (gameState === "gameover") drawOverlay("GAME OVER");
    if (gameState === "win") drawOverlay("¡Completaste el juego!");
    if (isPaused) drawPauseOverlay();
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let running = false;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!isPaused) update(dt);
    draw();
    emitChanges();
    rafId = requestAnimationFrame(loop);
  }

  function loadAssets(onReady: () => void) {
    bounceSound = new Audio("/games/arkanoid/sounds/ball-bounce.mp3");
    breakSound = new Audio("/games/arkanoid/sounds/break-sound.mp3");

    const img = new Image();
    img.onload = () => {
      ssImg = img;
      ssLoaded = true;
      onReady();
    };
    img.onerror = () => {
      // Si falla la carga, igual arrancamos (sprites no se dibujan pero el juego corre).
      onReady();
    };
    img.src = "/games/arkanoid/spritesheet-breakout.png";
  }

  // ── API pública ─────────────────────────────────────────────────────────────
  return {
    start() {
      if (running) return;
      running = true;
      isPaused = false;
      lastTime = null;
      initGame();
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("click", onClick);
      loadAssets(() => {
        if (!running) return; // pudo desmontarse durante la carga
        rafId = requestAnimationFrame(loop);
      });
    },
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
      if (bounceSound) bounceSound.pause();
      if (breakSound) breakSound.pause();
      running = false;
    },
    pause() {
      setPaused(true);
    },
    resume() {
      setPaused(false);
    },
    restart() {
      initGame();
      lastTime = null;
      emitChanges();
    },
  };
}
