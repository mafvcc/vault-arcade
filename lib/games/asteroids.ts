// ===== lib/games/asteroids.ts — motor TS autónomo portado desde =====
// references/started-games/02-asteroids/game.js
//
// Sin globales de módulo: todo el estado vive dentro de la instancia que
// devuelve `createAsteroidsGame`. El canvas es la fuente de verdad y empuja
// score/vidas/nivel/fin/reinicio hacia React vía callbacks.

import type { SkinId } from "@/lib/data";

export type AsteroidsCallbacks = {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onPlaying?: () => void; // motor vuelve a 'playing' (incluye reinicio con ESPACIO)
};

export type AsteroidsGame = {
  start(): void; // arranca el loop (requestAnimationFrame)
  stop(): void; // cancela el loop y retira listeners de teclado
  pause(): void; // congela el update (sigue dibujando el último frame)
  resume(): void; // reanuda
  restart(): void; // reinicia score/vidas/nivel y vuelve a 'playing'
  setSkin(skin: SkinId): void; // cambia la paleta en caliente, sin resetear
};

type Point = { x: number; y: number };
type GameState = "playing" | "dead" | "gameover";

// ── Paletas por skin ─────────────────────────────────────────────────────────
// Todas con fondo oscuro (el arcade es dark-only). Los campos `*Rgb` guardan
// "r,g,b" para componer rgba() con alpha dinámico (partículas / propulsor).
type AsteroidsPalette = {
  bg: string; // fondo del canvas
  stroke: string; // contorno de nave y asteroides
  bullet: string; // balas
  hud: string; // texto del HUD y overlay
  hudDim: string; // subtítulo del overlay (atenuado)
  powerup: string; // caja y texto del power-up 3x
  particleRgb: string; // "r,g,b" de las partículas de explosión
  flameRgb: string; // "r,g,b" de la llama del propulsor
};

const SKINS: Record<SkinId, AsteroidsPalette> = {
  // Clásico: vector blanco sobre negro, power-up cian y propulsor naranja
  // (los colores originales del motor, solo formalizados).
  clasico: {
    bg: "#000000",
    stroke: "#ffffff",
    bullet: "#ffffff",
    hud: "#ffffff",
    hudDim: "rgba(255,255,255,0.65)",
    powerup: "#00ffff",
    particleRgb: "255,255,255",
    flameRgb: "255,130,0",
  },
  // Neon: cyberpunk-arcade. Cian eléctrico sobre negro puro, acentos magenta/lima.
  neon: {
    bg: "#000000",
    stroke: "#00ffff",
    bullet: "#ffff00",
    hud: "#00ffff",
    hudDim: "rgba(0,255,255,0.65)",
    powerup: "#ff00ff",
    particleRgb: "0,255,65",
    flameRgb: "255,102,0",
  },
  // Retro: CRT 8-bit. Ámbar (opción B) sobre azul noche; contrasta con el
  // blanco/cian del clásico para que los 3 skins sean bien distintos.
  retro: {
    bg: "#0d0d1a",
    stroke: "#f5a623",
    bullet: "#39ff14",
    hud: "#f5a623",
    hudDim: "rgba(245,166,35,0.65)",
    powerup: "#0099ff",
    particleRgb: "245,166,35",
    flameRgb: "233,69,96",
  },
};

export function createAsteroidsGame(
  canvas: HTMLCanvasElement,
  callbacks: AsteroidsCallbacks = {},
  { skin = "clasico" }: { skin?: SkinId } = {},
): AsteroidsGame {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  let p = SKINS[skin]; // p de palette (mutable: setSkin la reemplaza en caliente)

  const W = 800;
  const H = 600;
  // Resolución interna fija: el escalado es solo CSS.
  canvas.width = W;
  canvas.height = H;

  // ── Input ───────────────────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};
  const PREVENT = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    keys[e.code] = false;
  };

  function pressed(code: string): boolean {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  // ── Utils ───────────────────────────────────────────────────────────────
  const wrap = (v: number, max: number) => ((v % max) + max) % max;
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (min: number, max: number) => min + Math.random() * (max - min);
  const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

  // ── Constants ─────────────────────────────────────────────────────────────
  const POWERUP_DROP_CHANCE = 0.15;
  const POWERUP_DURATION = 5;
  const POWERUP_TTL = 12;
  const TRIPLE_SPREAD = 0.18;

  // ── Bullet ────────────────────────────────────────────────────────────────
  class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl = 1.1;
    radius = 2;
    dead = false;

    constructor(x: number, y: number, angle: number) {
      this.x = x;
      this.y = y;
      const SPEED = 520;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      ctx!.fillStyle = p.bullet;
      ctx!.beginPath();
      ctx!.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  // ── Asteroid ──────────────────────────────────────────────────────────────
  const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
  const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
  const POINTS = [0, 100, 50, 20]; // puntos por tamaño

  class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    dead = false;
    vx: number;
    vy: number;
    rotSpeed: number;
    rot: number;
    verts: [number, number][] = [];

    constructor(x: number, y: number, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];

      const angle = rand(0, Math.PI * 2);
      const speed = SPEEDS[size] + rand(-15, 15);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.rotSpeed = rand(-1.2, 1.2);
      this.rot = rand(0, Math.PI * 2);

      // Polígono irregular
      const n = randInt(8, 13);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }

    split(): Asteroid[] {
      if (this.size <= 1) return [];
      return [
        new Asteroid(this.x, this.y, this.size - 1),
        new Asteroid(this.x, this.y, this.size - 1),
      ];
    }

    draw() {
      ctx!.save();
      ctx!.translate(this.x, this.y);
      ctx!.rotate(this.rot);
      ctx!.strokeStyle = p.stroke;
      ctx!.lineWidth = 1.5;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      ctx!.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++)
        ctx!.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx!.closePath();
      ctx!.stroke();
      ctx!.restore();
    }
  }

  // ── PowerUp ─────────────────────────────────────────────────────────────────
  class PowerUp {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius = 12;
    ttl = POWERUP_TTL;
    dead = false;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(20, 40);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
      const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
      ctx!.save();
      ctx!.translate(this.x, this.y);
      ctx!.rotate(Math.PI / 4);
      ctx!.strokeStyle = p.powerup;
      ctx!.lineWidth = 2;
      const r = this.radius * pulse;
      ctx!.strokeRect(-r, -r, r * 2, r * 2);
      ctx!.restore();
      ctx!.fillStyle = p.powerup;
      ctx!.font = "bold 12px monospace";
      ctx!.textAlign = "center";
      ctx!.textBaseline = "middle";
      ctx!.fillText("3x", this.x, this.y);
    }
  }

  // ── Ship ──────────────────────────────────────────────────────────────────
  class Ship {
    x = W / 2;
    y = H / 2;
    angle = -Math.PI / 2;
    vx = 0;
    vy = 0;
    radius = 12;
    thrusting = false;
    invincible = 3;
    shootCooldown = 0;
    dead = false;
    tripleShot = 0;

    constructor() {
      this.reset();
    }

    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.radius = 12;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.dead = false;
    }

    update(dt: number) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.tripleShot > 0) this.tripleShot -= dt;

      const ROT = 3.5; // rad/s
      const THRUST = 260; // px/s²
      const DRAG = 0.987;

      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;

      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }

      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }

    tryShoot(): Bullet[] {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const ox = this.x + Math.cos(this.angle) * NOSE;
      const oy = this.y + Math.sin(this.angle) * NOSE;
      if (this.tripleShot > 0) {
        return [
          new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
          new Bullet(ox, oy, this.angle),
          new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
        ];
      }
      return [new Bullet(ox, oy, this.angle)];
    }

    draw() {
      if (this.dead) return;
      // Parpadeo durante invencibilidad de reaparición
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
        return;

      ctx!.save();
      ctx!.translate(this.x, this.y);
      ctx!.rotate(this.angle);
      ctx!.strokeStyle = p.stroke;
      ctx!.lineWidth = 1.5;
      ctx!.lineJoin = "round";

      // Silueta clásica: triángulo con muesca trasera
      ctx!.beginPath();
      ctx!.moveTo(20, 0); // nariz
      ctx!.lineTo(-12, -9); // ala izquierda
      ctx!.lineTo(-7, 0); // muesca trasera
      ctx!.lineTo(-12, 9); // ala derecha
      ctx!.closePath();
      ctx!.stroke();

      // Llama del propulsor
      if (this.thrusting && Math.random() > 0.35) {
        ctx!.beginPath();
        ctx!.moveTo(-8, -4);
        ctx!.lineTo(-8 - rand(6, 14), 0);
        ctx!.lineTo(-8, 4);
        ctx!.strokeStyle = `rgba(${p.flameRgb}, 0.85)`;
        ctx!.stroke();
      }

      ctx!.restore();
    }
  }

  // ── Partículas (explosión) ────────────────────────────────────────────────
  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    dead = false;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = rand(0.4, 1.1);
      this.ttl = this.life;
    }

    update(dt: number) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      const alpha = this.ttl / this.life;
      ctx!.strokeStyle = `rgba(${p.particleRgb},${alpha.toFixed(2)})`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      ctx!.moveTo(this.x, this.y);
      ctx!.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
      ctx!.stroke();
    }
  }

  // ── Estado del juego (en la instancia, no global de módulo) ─────────────────
  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let powerUps: PowerUp[];
  let score: number;
  let lives: number;
  let level: number;
  let state: GameState;
  let deadTimer = 0;
  let powerUpSpawned: boolean;
  let killsSinceSpawn: number;

  // Estado previo para emitir callbacks sólo cuando cambia.
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
    if (level !== lastLevel) {
      lastLevel = level;
      callbacks.onLevel?.(level);
    }
    if (state !== lastState) {
      const prev = lastState;
      lastState = state;
      if (state === "gameover") callbacks.onGameOver?.(score);
      // Sólo al volver de 'gameover' (reinicio con ESPACIO o restart()),
      // no en la reaparición tras perder una vida ('dead' → 'playing').
      if (state === "playing" && prev === "gameover") callbacks.onPlaying?.();
    }
  }

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    spawnAsteroids(4);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      if (pressed("Space")) initGame();
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    // Disparar
    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  function drawLifeIcon(x: number, y: number) {
    ctx!.save();
    ctx!.translate(x, y);
    ctx!.rotate(-Math.PI / 2);
    ctx!.strokeStyle = p.stroke;
    ctx!.lineWidth = 1.2;
    ctx!.lineJoin = "round";
    ctx!.beginPath();
    ctx!.moveTo(9, 0);
    ctx!.lineTo(-6, -5);
    ctx!.lineTo(-3, 0);
    ctx!.lineTo(-6, 5);
    ctx!.closePath();
    ctx!.stroke();
    ctx!.restore();
  }

  function drawHUD() {
    ctx!.fillStyle = p.hud;
    ctx!.font = "15px monospace";

    ctx!.textAlign = "left";
    ctx!.fillText(`SCORE  ${score}`, 14, 26);

    ctx!.textAlign = "center";
    ctx!.fillText(`NIVEL ${level}`, W / 2, 26);

    for (let i = 0; i < lives; i++) drawLifeIcon(W - 16 - i * 22, 18);

    if (ship.tripleShot > 0) {
      ctx!.textAlign = "left";
      ctx!.fillStyle = p.powerup;
      ctx!.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 46);
    }
  }

  function drawOverlay(title: string, sub: string) {
    ctx!.textAlign = "center";
    ctx!.fillStyle = p.hud;
    ctx!.font = "bold 46px monospace";
    ctx!.fillText(title, W / 2, H / 2 - 18);
    ctx!.font = "18px monospace";
    ctx!.fillStyle = p.hudDim;
    ctx!.fillText(sub, W / 2, H / 2 + 22);
  }

  function draw() {
    ctx!.fillStyle = p.bg;
    ctx!.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    powerUps.forEach((p) => p.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();

    drawHUD();

    if (state === "gameover")
      drawOverlay(
        "GAME OVER",
        `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`,
      );
  }

  // ── Loop principal ──────────────────────────────────────────────────────────
  let rafId: number | null = null;
  let lastTime: number | null = null;
  let paused = false;
  let running = false;

  function loop(ts: number) {
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) update(dt);
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
      window.addEventListener("keyup", onKeyUp);
      rafId = requestAnimationFrame(loop);
    },
    stop() {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
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
      initGame();
      paused = false;
      lastTime = null;
      emitChanges();
    },
    setSkin(next) {
      p = SKINS[next];
      // El loop repinta cada frame con la nueva paleta; si está en pausa,
      // forzamos un repintado único para reflejar el cambio al instante.
      if (paused || !running) draw();
    },
  };
}
