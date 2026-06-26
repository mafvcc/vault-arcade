'use client';

import { useEffect, useRef } from 'react';

interface FroggerGameProps {
  paused: boolean;
  skinKey?: string;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
const CANVAS_W = COLS * CELL; // 640 — se escala con CSS al contenedor
const CANVAS_H = ROWS * CELL; // 560

// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const HOP_MS = 120; // duración de la animación de salto
const BASE_TIME = 15; // segundos de ronda en nivel 1
const GOALS_COUNT = 5; // bocas destino
const GOAL_WIDTH = 2; // columnas por boca

// ── Skin system ───────────────────────────────────────────────────────────────

type Skin = {
  name: string;
  boardBg: string | null;
  // Zone backgrounds
  zoneGoals: string;
  zoneRiver: string;
  zoneSafe: string;
  zoneRoad: string;
  zoneStart: string;
  // Road lane dividers
  laneDivider: string;
  // Goal border color
  goalBorder: string;
  // Log colors
  logFill: string;
  logVein: string;
  // Turtle (visible)
  turtleBody: string;
  turtleShell: string;
  turtleSubmerged: string;
  // Car palette
  carPalette: string[];
  // Truck body / cab
  truckBody: string;
  truckCab: string;
  // Frog body / legs
  frogBody: string;
  frogLegs: string;
  // HUD bar colors
  barHigh: string;
  barMid: string;
  barLow: string;
  // Neon-only glow (null = no glow)
  glowColor: string | null;
  drawCar: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    color: string,
    glowColor: string | null,
  ) => void;
  drawTruck: (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    body: string,
    cab: string,
    glowColor: string | null,
  ) => void;
};

function classicDrawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
  _glow: string | null,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 8, w - 6, CELL - 16, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(x + w - 14, y + 12, 6, CELL - 24);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x + 10, y + CELL - 8, 4, 0, Math.PI * 2);
  ctx.arc(x + w - 10, y + CELL - 8, 4, 0, Math.PI * 2);
  ctx.fill();
}

function classicDrawTruck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  body: string,
  cab: string,
  _glow: string | null,
) {
  ctx.fillStyle = body;
  ctx.fillRect(x + 3, y + 7, w - 6 - 14, CELL - 14);
  ctx.fillStyle = cab;
  ctx.fillRect(x + w - 17, y + 9, 14, CELL - 18);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(x + w - 14, y + 12, 8, 8);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x + 12, y + CELL - 7, 4, 0, Math.PI * 2);
  ctx.arc(x + w - 12, y + CELL - 7, 4, 0, Math.PI * 2);
  ctx.fill();
}

function retroDrawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
  _glow: string | null,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x + 3, y + 8, w - 6, CELL - 16);
  // CRT highlight strip
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 3, y + 8, w - 6, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + w - 14, y + 12, 6, CELL - 24);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x + 10, y + CELL - 8, 4, 0, Math.PI * 2);
  ctx.arc(x + w - 10, y + CELL - 8, 4, 0, Math.PI * 2);
  ctx.fill();
}

function retroDrawTruck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  body: string,
  cab: string,
  _glow: string | null,
) {
  ctx.fillStyle = body;
  ctx.fillRect(x + 3, y + 7, w - 6 - 14, CELL - 14);
  // highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 3, y + 7, w - 6 - 14, 4);
  ctx.fillStyle = cab;
  ctx.fillRect(x + w - 17, y + 9, 14, CELL - 18);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + w - 14, y + 12, 8, 8);
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x + 12, y + CELL - 7, 4, 0, Math.PI * 2);
  ctx.arc(x + w - 12, y + CELL - 7, 4, 0, Math.PI * 2);
  ctx.fill();
}

function neonDrawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  color: string,
  glowColor: string | null,
) {
  if (glowColor) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = glowColor;
  }
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  ctx.fillStyle = `rgba(${r},${g},${b},0.4)`;
  ctx.fillRect(x + 3, y + 8, w - 6, CELL - 16);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 4, y + 9, w - 8, CELL - 18);
  ctx.shadowBlur = 0;
  // Wheels as bright squares
  ctx.fillStyle = color;
  ctx.fillRect(x + 6, y + CELL - 11, 7, 5);
  ctx.fillRect(x + w - 13, y + CELL - 11, 7, 5);
}

function neonDrawTruck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  body: string,
  cab: string,
  glowColor: string | null,
) {
  if (glowColor) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = glowColor;
  }
  const rb = parseInt(body.slice(1, 3), 16);
  const gb = parseInt(body.slice(3, 5), 16);
  const bb = parseInt(body.slice(5, 7), 16);
  ctx.fillStyle = `rgba(${rb},${gb},${bb},0.35)`;
  ctx.fillRect(x + 3, y + 7, w - 6 - 14, CELL - 14);
  ctx.strokeStyle = body;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 4, y + 8, w - 6 - 16, CELL - 16);
  ctx.fillStyle = `rgba(${parseInt(cab.slice(1, 3), 16)},${parseInt(cab.slice(3, 5), 16)},${parseInt(cab.slice(5, 7), 16)},0.5)`;
  ctx.fillRect(x + w - 17, y + 9, 14, CELL - 18);
  ctx.strokeStyle = cab;
  ctx.strokeRect(x + w - 16, y + 10, 12, CELL - 20);
  ctx.shadowBlur = 0;
  ctx.fillStyle = body;
  ctx.fillRect(x + 8, y + CELL - 11, 7, 5);
  ctx.fillRect(x + w - 15, y + CELL - 11, 7, 5);
}

const SKINS: Record<string, Skin> = {
  classic: {
    name: 'Classic',
    boardBg: null,
    zoneGoals: '#1f7a2e',
    zoneRiver: '#0d2b66',
    zoneSafe: '#0a3d24',
    zoneRoad: '#111111',
    zoneStart: '#0a3d24',
    laneDivider: 'rgba(255,255,255,0.15)',
    goalBorder: '#e0b020',
    logFill: '#7a4a1e',
    logVein: 'rgba(0,0,0,0.25)',
    turtleBody: '#2faa55',
    turtleShell: 'rgba(0,0,0,0.2)',
    turtleSubmerged: 'rgba(120,220,160,0.4)',
    carPalette: ['#ff3b3b', '#ffd23b', '#3b9bff'],
    truckBody: '#9aa0a6',
    truckCab: '#5a6066',
    frogBody: '#46e02a',
    frogLegs: '#37b81f',
    barHigh: '#46e02a',
    barMid: '#e0d020',
    barLow: '#e03b3b',
    glowColor: null,
    drawCar: classicDrawCar,
    drawTruck: classicDrawTruck,
  },
  retro: {
    name: 'Retro',
    boardBg: null,
    zoneGoals: '#2a5c1a',
    zoneRiver: '#0e1f4a',
    zoneSafe: '#1a3a18',
    zoneRoad: '#1a1a1a',
    zoneStart: '#1a3a18',
    laneDivider: 'rgba(255,255,255,0.10)',
    goalBorder: '#c89010',
    logFill: '#6b3e18',
    logVein: 'rgba(0,0,0,0.30)',
    turtleBody: '#24904a',
    turtleShell: 'rgba(0,0,0,0.25)',
    turtleSubmerged: 'rgba(100,200,140,0.35)',
    carPalette: ['#e03030', '#d4c030', '#2e80d8'],
    truckBody: '#808890',
    truckCab: '#484e58',
    frogBody: '#38c022',
    frogLegs: '#2a9018',
    barHigh: '#38c022',
    barMid: '#c8b818',
    barLow: '#c83030',
    glowColor: null,
    drawCar: retroDrawCar,
    drawTruck: retroDrawTruck,
  },
  neon: {
    name: 'Neon',
    boardBg: '#000000',
    zoneGoals: '#001a05',
    zoneRiver: '#000d22',
    zoneSafe: '#001208',
    zoneRoad: '#0a0a0a',
    zoneStart: '#001208',
    laneDivider: 'rgba(0,255,200,0.12)',
    goalBorder: '#ffee00',
    logFill: '#8b4a00',
    logVein: 'rgba(255,200,0,0.15)',
    turtleBody: '#00ff88',
    turtleShell: 'rgba(0,0,0,0.4)',
    turtleSubmerged: 'rgba(0,255,136,0.2)',
    carPalette: ['#ff0040', '#ffee00', '#00aaff'],
    truckBody: '#00aaff',
    truckCab: '#0066cc',
    frogBody: '#00ff44',
    frogLegs: '#00cc33',
    barHigh: '#00ff44',
    barMid: '#ffee00',
    barLow: '#ff0040',
    glowColor: '#00ff88',
    drawCar: neonDrawCar,
    drawTruck: neonDrawTruck,
  },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Direction = 'up' | 'down' | 'left' | 'right';

interface Entity {
  col: number;
  width: number;
  type: 'car' | 'truck' | 'log' | 'turtle';
  submerged?: boolean;
  // Ciclo de inmersión para tortugas (ms)
  diveT?: number;
  diveCycle?: number; // duración fase visible (ms)
  diveDown?: number; // duración fase sumergida (ms)
}

interface Lane {
  row: number;
  speed: number; // px/frame base (a 60fps)
  dir: 1 | -1;
  entities: Entity[];
}

interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
  fromCol: number;
  fromRow: number;
  dir: Direction;
}

interface Goal {
  col: number; // columna izquierda de la boca (ocupa GOAL_WIDTH columnas)
  filled: boolean;
}

interface GameState {
  frog: Frog;
  lanes: Lane[];
  goals: Goal[];
  score: number;
  lives: number;
  level: number;
  timeLeft: number; // segundos restantes de la ronda
  maxRow: number; // fila más arriba alcanzada en la ronda (para puntuar avance)
  dead: boolean;
}

// ── Lane construction ──────────────────────────────────────────────────────────

// Configuración base por carril. `speed` en px/frame (se convierte a celdas/frame
// dividiendo por CELL dentro del update). Cada nivel escala la velocidad un 15 %.
interface LaneConfig {
  row: number;
  dir: 1 | -1;
  speed: number;
  type: Entity['type'];
  width: number; // celdas que ocupa cada entidad (grupo de tortugas = nº tortugas)
  gap: number; // hueco mínimo en celdas entre entidades
}

const LANE_CONFIGS: LaneConfig[] = [
  // ── Río (filas 1–6), de arriba hacia abajo ──
  { row: 1, dir: -1, speed: 1.5, type: 'log', width: 3, gap: 2 },
  { row: 2, dir: 1, speed: 1.8, type: 'turtle', width: 2, gap: 3 },
  { row: 3, dir: -1, speed: 2.5, type: 'log', width: 2, gap: 2 },
  { row: 4, dir: 1, speed: 1.2, type: 'log', width: 4, gap: 3 },
  { row: 5, dir: -1, speed: 2.0, type: 'turtle', width: 3, gap: 3 },
  { row: 6, dir: 1, speed: 1.5, type: 'log', width: 3, gap: 2 },
  // ── Carretera (filas 8–12), de arriba hacia abajo ──
  { row: 8, dir: -1, speed: 3.0, type: 'truck', width: 3, gap: 6 },
  { row: 9, dir: 1, speed: 1.8, type: 'car', width: 2, gap: 4 },
  { row: 10, dir: -1, speed: 2.5, type: 'car', width: 1, gap: 3 },
  { row: 11, dir: 1, speed: 2.0, type: 'truck', width: 3, gap: 5 },
  { row: 12, dir: -1, speed: 1.5, type: 'car', width: 1, gap: 4 },
];

function buildLanes(level: number): Lane[] {
  const speedMul = Math.pow(1.15, level - 1);

  return LANE_CONFIGS.map((cfg, laneIdx) => {
    const step = cfg.width + cfg.gap;
    const count = Math.max(2, Math.ceil(COLS / step) + 1);
    const entities: Entity[] = [];

    for (let i = 0; i < count; i++) {
      const entity: Entity = {
        col: i * step,
        width: cfg.width,
        type: cfg.type,
      };
      if (cfg.type === 'turtle') {
        // Ciclo de inmersión: 3 s visible / 1.5 s sumergida, desfasado por carril.
        entity.diveCycle = 3000;
        entity.diveDown = 1500;
        entity.diveT = (laneIdx * 900) % (entity.diveCycle + entity.diveDown);
        entity.submerged = false;
      }
      entities.push(entity);
    }

    return {
      row: cfg.row,
      speed: cfg.speed * speedMul,
      dir: cfg.dir,
      entities,
    };
  });
}

// ── State helpers ──────────────────────────────────────────────────────────────

// 5 bocas de 2 columnas, repartidas en las 16 columnas (cols 1,4,7,10,13).
function buildGoals(): Goal[] {
  const goals: Goal[] = [];
  for (let i = 0; i < GOALS_COUNT; i++) {
    goals.push({ col: 1 + i * 3, filled: false });
  }
  return goals;
}

const CENTER_COL = Math.floor(COLS / 2);

function makeFrog(): Frog {
  return {
    col: CENTER_COL,
    row: ROW_START,
    animating: false,
    animT: 0,
    targetCol: CENTER_COL,
    targetRow: ROW_START,
    fromCol: CENTER_COL,
    fromRow: ROW_START,
    dir: 'up',
  };
}

function timeForLevel(level: number): number {
  return Math.max(6, BASE_TIME - (level - 1));
}

function initialState(): GameState {
  return {
    frog: makeFrog(),
    lanes: buildLanes(1),
    goals: buildGoals(),
    score: 0,
    lives: 3,
    level: 1,
    timeLeft: timeForLevel(1),
    maxRow: ROW_START,
    dead: false,
  };
}

// Solapamiento horizontal entre la rana (1 celda de ancho) y una entidad.
function overlaps(frogCol: number, entity: Entity): boolean {
  return frogCol < entity.col + entity.width && frogCol + 1 > entity.col;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FroggerGame({
  paused,
  skinKey = 'classic',
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
}: FroggerGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const skinRef = useRef<Skin>(SKINS[skinKey] ?? SKINS.classic);
  const stateRef = useRef<GameState>(initialState());
  const pendingDirRef = useRef<Direction | null>(null);
  const prevScoreRef = useRef(0);
  const prevLevelRef = useRef(1);
  const prevLivesRef = useRef(3);
  const deadFiredRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Sync paused ref so the loop reads the latest value without re-mounting.
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    skinRef.current = SKINS[skinKey] ?? SKINS.classic;
  }, [skinKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ── Colisiones y soporte (paso 5) ─────────────────────────────────────────
    function checkRoadCollision(s: GameState): boolean {
      for (const lane of s.lanes) {
        if (lane.row < ROW_ROAD_TOP || lane.row > ROW_ROAD_BOT) continue;
        if (lane.row !== s.frog.row) continue;
        for (const e of lane.entities) {
          if (overlaps(s.frog.col, e)) return true;
        }
      }
      return false;
    }

    function getSupport(s: GameState): Entity | null {
      for (const lane of s.lanes) {
        if (lane.row < ROW_RIVER_TOP || lane.row > ROW_RIVER_BOT) continue;
        if (lane.row !== s.frog.row) continue;
        for (const e of lane.entities) {
          if (e.type === 'turtle' && e.submerged) continue;
          if (overlaps(s.frog.col, e)) return e;
        }
      }
      return null;
    }

    // ── Gestión de muerte (paso 7) ────────────────────────────────────────────
    function killFrog(s: GameState) {
      if (deadFiredRef.current) return;
      s.lives -= 1;
      prevLivesRef.current = s.lives;
      onLivesChange(s.lives);
      if (s.lives <= 0) {
        s.dead = true;
        deadFiredRef.current = true;
        draw();
        onGameOver(s.score);
        return;
      }
      // Vuelve a la fila de inicio y resetea el temporizador de ronda.
      s.frog = makeFrog();
      pendingDirRef.current = null;
      s.timeLeft = timeForLevel(s.level);
    }

    // ── Ronda completada (paso 6) ─────────────────────────────────────────────
    function completeRound(s: GameState) {
      s.score += 200;
      s.level += 1;
      s.lanes = buildLanes(s.level);
      s.goals = buildGoals();
      s.frog = makeFrog();
      pendingDirRef.current = null;
      s.timeLeft = timeForLevel(s.level);
      s.maxRow = ROW_START;
    }

    // Llega a la fila de metas: resuelve boca ocupada / muerte.
    function resolveGoal(s: GameState) {
      const goal = s.goals.find(
        (g) =>
          !g.filled &&
          s.frog.col + 0.5 >= g.col &&
          s.frog.col + 0.5 < g.col + GOAL_WIDTH,
      );
      if (!goal) {
        // No hay boca libre bajo la rana → muerte.
        killFrog(s);
        return;
      }
      goal.filled = true;
      s.score += 50 + Math.ceil(s.timeLeft) * 10;
      if (s.goals.every((g) => g.filled)) {
        completeRound(s);
      } else {
        s.frog = makeFrog();
        pendingDirRef.current = null;
        s.timeLeft = timeForLevel(s.level);
        s.maxRow = ROW_START;
      }
    }

    // Resuelve la celda destino tras completar un salto.
    function resolveLanding(s: GameState) {
      // Puntuar avance hacia arriba por primera vez en la ronda.
      if (s.frog.row < s.maxRow && s.frog.row >= ROW_GOALS) {
        s.score += 10 * (s.maxRow - s.frog.row);
        s.maxRow = s.frog.row;
      }

      if (s.frog.row === ROW_GOALS) {
        resolveGoal(s);
        return;
      }
      if (s.frog.row >= ROW_ROAD_TOP && s.frog.row <= ROW_ROAD_BOT) {
        if (checkRoadCollision(s)) killFrog(s);
        return;
      }
      if (s.frog.row >= ROW_RIVER_TOP && s.frog.row <= ROW_RIVER_BOT) {
        if (!getSupport(s)) killFrog(s);
        return;
      }
      // Filas seguras (ROW_SAFE_MID, ROW_START): nada que resolver.
    }

    // ── Update (paso 4) ───────────────────────────────────────────────────────
    function update(dt: number) {
      const s = stateRef.current;
      if (s.dead) return;

      // Avanzar entidades y ciclo de inmersión de tortugas.
      for (const lane of s.lanes) {
        const delta = (lane.speed / CELL) * lane.dir * (dt / 16);
        for (const e of lane.entities) {
          e.col += delta;
          if (lane.dir === 1 && e.col >= COLS) e.col = -e.width;
          else if (lane.dir === -1 && e.col + e.width <= 0) e.col = COLS;
          if (e.type === 'turtle' && e.diveCycle && e.diveDown) {
            e.diveT = ((e.diveT ?? 0) + dt) % (e.diveCycle + e.diveDown);
            e.submerged = e.diveT >= e.diveCycle;
          }
        }
      }

      const frog = s.frog;

      if (!frog.animating) {
        const dir = pendingDirRef.current;
        if (dir) {
          pendingDirRef.current = null;
          frog.fromCol = frog.col;
          frog.fromRow = frog.row;
          frog.dir = dir;
          let tCol = frog.col;
          let tRow = frog.row;
          if (dir === 'up') tRow = frog.row - 1;
          else if (dir === 'down') tRow = frog.row + 1;
          else if (dir === 'left') tCol = Math.round(frog.col) - 1;
          else if (dir === 'right') tCol = Math.round(frog.col) + 1;
          // Bordes laterales: no se permite salir con un salto deliberado.
          tCol = Math.max(0, Math.min(COLS - 1, tCol));
          tRow = Math.max(ROW_GOALS, Math.min(ROW_START, tRow));
          frog.targetCol = tCol;
          frog.targetRow = tRow;
          frog.animating = true;
          frog.animT = 0;
        }
      } else {
        frog.animT += dt;
        if (frog.animT >= HOP_MS) {
          frog.col = frog.targetCol;
          frog.row = frog.targetRow;
          frog.animating = false;
          frog.animT = 0;
          resolveLanding(s);
        }
      }

      // Deriva en el río: la rana se mueve con su soporte si no está saltando.
      if (
        !s.dead &&
        !frog.animating &&
        frog.row >= ROW_RIVER_TOP &&
        frog.row <= ROW_RIVER_BOT
      ) {
        const support = getSupport(s);
        if (support) {
          const lane = s.lanes.find((l) => l.row === frog.row)!;
          frog.col += (lane.speed / CELL) * lane.dir * (dt / 16);
          // Arrastrado fuera de los bordes del río → muerte.
          if (frog.col < 0 || frog.col + 1 > COLS) {
            killFrog(s);
            return;
          }
        } else {
          // Sin soporte (cayó al agua o la tortuga se sumergió) → muerte.
          killFrog(s);
          return;
        }
      }

      // Temporizador de ronda.
      s.timeLeft -= dt / 1000;
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        killFrog(s);
      }

      // Callbacks sólo cuando el valor cambia.
      if (s.score !== prevScoreRef.current) {
        prevScoreRef.current = s.score;
        onScoreChange(s.score);
      }
      if (s.level !== prevLevelRef.current) {
        prevLevelRef.current = s.level;
        onLevelChange(s.level);
      }
      if (s.lives !== prevLivesRef.current) {
        prevLivesRef.current = s.lives;
        onLivesChange(s.lives);
      }
    }

    // ── Draw (paso 4) ─────────────────────────────────────────────────────────
    function rowY(row: number) {
      return row * CELL;
    }

    function drawLog(e: Entity, y: number, skin: Skin) {
      const x = e.col * CELL;
      const w = e.width * CELL;
      if (skin.glowColor) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff8800';
      }
      ctx.fillStyle = skin.logFill;
      ctx.beginPath();
      ctx.roundRect(x + 1, y + 6, w - 2, CELL - 12, 8);
      ctx.fill();
      if (skin.name === 'Retro') {
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + 1, y + 6, w - 2, 4);
      }
      ctx.shadowBlur = 0;
      ctx.strokeStyle = skin.logVein;
      ctx.lineWidth = 2;
      for (let i = 1; i < e.width; i++) {
        ctx.beginPath();
        ctx.moveTo(x + i * CELL, y + 8);
        ctx.lineTo(x + i * CELL, y + CELL - 8);
        ctx.stroke();
      }
    }

    function drawTurtles(e: Entity, y: number, skin: Skin) {
      for (let i = 0; i < e.width; i++) {
        const cx = (e.col + i + 0.5) * CELL;
        const cy = y + CELL / 2;
        if (e.submerged) {
          ctx.strokeStyle = skin.turtleSubmerged;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, CELL / 2 - 6, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          if (skin.glowColor) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = skin.turtleBody;
          }
          ctx.fillStyle = skin.turtleBody;
          ctx.beginPath();
          ctx.arc(cx, cy, CELL / 2 - 5, 0, Math.PI * 2);
          ctx.fill();
          if (skin.name === 'Neon') {
            ctx.strokeStyle = skin.turtleBody;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, CELL / 2 - 5, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
          ctx.fillStyle = skin.turtleShell;
          ctx.beginPath();
          ctx.arc(cx, cy, CELL / 2 - 11, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function drawFrog(s: GameState, skin: Skin) {
      const f = s.frog;
      let col = f.col;
      let row = f.row;
      let lift = 0;
      if (f.animating) {
        const t = Math.min(1, f.animT / HOP_MS);
        col = f.fromCol + (f.targetCol - f.fromCol) * t;
        row = f.fromRow + (f.targetRow - f.fromRow) * t;
        lift = Math.sin(t * Math.PI) * 8;
      }
      const cx = (col + 0.5) * CELL;
      const cy = (row + 0.5) * CELL - lift;

      if (skin.glowColor) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = skin.frogBody;
      }
      ctx.fillStyle = skin.frogBody;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      if (skin.name === 'Neon') {
        ctx.strokeStyle = skin.frogBody;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 14, 12, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Patas extendidas durante el salto
      if (f.animating) {
        ctx.fillStyle = skin.frogLegs;
        ctx.beginPath();
        ctx.ellipse(cx - 12, cy + 6, 5, 3, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 12, cy + 6, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      // Ojos
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 6, 4, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy - 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(cx - 6, cy - 6, 2, 0, Math.PI * 2);
      ctx.arc(cx + 6, cy - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw() {
      const s = stateRef.current;
      const skin = skinRef.current;

      // Fondo por zonas.
      if (skin.boardBg) {
        ctx.fillStyle = skin.boardBg;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }

      ctx.fillStyle = skin.zoneGoals;
      ctx.fillRect(0, rowY(ROW_GOALS), CANVAS_W, CELL);
      ctx.fillStyle = skin.zoneRiver;
      ctx.fillRect(
        0,
        rowY(ROW_RIVER_TOP),
        CANVAS_W,
        (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
      );
      ctx.fillStyle = skin.zoneSafe;
      ctx.fillRect(0, rowY(ROW_SAFE_MID), CANVAS_W, CELL);
      ctx.fillStyle = skin.zoneRoad;
      ctx.fillRect(
        0,
        rowY(ROW_ROAD_TOP),
        CANVAS_W,
        (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
      );
      ctx.fillStyle = skin.zoneStart;
      ctx.fillRect(0, rowY(ROW_START), CANVAS_W, CELL);

      // Líneas de carril en la carretera.
      ctx.strokeStyle = skin.laneDivider;
      ctx.setLineDash([12, 12]);
      ctx.lineWidth = 2;
      for (let r = ROW_ROAD_TOP; r <= ROW_ROAD_BOT; r++) {
        ctx.beginPath();
        ctx.moveTo(0, rowY(r));
        ctx.lineTo(CANVAS_W, rowY(r));
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Bocas destino.
      for (const g of s.goals) {
        const x = g.col * CELL;
        const w = GOAL_WIDTH * CELL;
        ctx.fillStyle = skin.zoneSafe;
        ctx.fillRect(x, rowY(ROW_GOALS) + 2, w, CELL - 4);
        if (skin.glowColor) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = skin.goalBorder;
        }
        ctx.strokeStyle = skin.goalBorder;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, rowY(ROW_GOALS) + 3, w - 2, CELL - 6);
        ctx.shadowBlur = 0;
        if (g.filled) {
          const cx = x + w / 2;
          const cy = rowY(ROW_GOALS) + CELL / 2;
          if (skin.glowColor) {
            ctx.shadowBlur = 14;
            ctx.shadowColor = skin.frogBody;
          }
          ctx.fillStyle = skin.frogBody;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 11, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Entidades por carril.
      for (const lane of s.lanes) {
        const y = rowY(lane.row);
        for (const e of lane.entities) {
          if (e.type === 'car') {
            const color =
              skin.carPalette[
                (Math.abs(Math.round(e.col)) + e.width) % skin.carPalette.length
              ];
            skin.drawCar(
              ctx,
              e.col * CELL,
              y,
              e.width * CELL,
              color,
              skin.glowColor,
            );
          } else if (e.type === 'truck') {
            skin.drawTruck(
              ctx,
              e.col * CELL,
              y,
              e.width * CELL,
              skin.truckBody,
              skin.truckCab,
              skin.glowColor,
            );
          } else if (e.type === 'log') {
            drawLog(e, y, skin);
          } else if (e.type === 'turtle') {
            drawTurtles(e, y, skin);
          }
        }
      }

      // Rana.
      drawFrog(s, skin);

      // ── HUD interno ──────────────────────────────────────────────────────────
      const frac = s.timeLeft / timeForLevel(s.level);
      const barColor =
        frac > 0.5 ? skin.barHigh : frac > 0.25 ? skin.barMid : skin.barLow;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, CANVAS_W, 6);
      if (skin.glowColor) {
        ctx.shadowBlur = 6;
        ctx.shadowColor = barColor;
      }
      ctx.fillStyle = barColor;
      ctx.fillRect(0, 0, CANVAS_W * Math.max(0, frac), 6);
      ctx.shadowBlur = 0;

      ctx.font = 'bold 15px monospace';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(`SCORE ${String(s.score).padStart(6, '0')}`, 8, 22);

      ctx.textAlign = 'center';
      ctx.fillText(`NIVEL ${s.level}`, CANVAS_W / 2, 22);

      // Vidas como iconos de rana (top-right).
      ctx.shadowBlur = 0;
      for (let i = 0; i < s.lives; i++) {
        const cx = CANVAS_W - 14 - i * 20;
        if (skin.glowColor) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = skin.frogBody;
        }
        ctx.fillStyle = skin.frogBody;
        ctx.beginPath();
        ctx.arc(cx, 22, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - 3, 19, 2, 0, Math.PI * 2);
        ctx.arc(cx + 3, 19, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.textAlign = 'left';
    }

    // ── Loop ──────────────────────────────────────────────────────────────────
    let last = 0;
    function frame(ts: number) {
      if (last === 0) last = ts;
      const dt = Math.min(50, ts - last); // clamp para evitar saltos tras pausa
      last = ts;
      if (!pausedRef.current) update(dt);
      draw();
      if (!stateRef.current.dead) {
        rafRef.current = requestAnimationFrame(frame);
      }
    }
    rafRef.current = requestAnimationFrame(frame);

    // ── Teclado ───────────────────────────────────────────────────────────────
    function handleKey(e: KeyboardEvent) {
      const map: Record<string, Direction> = {
        arrowup: 'up',
        w: 'up',
        arrowdown: 'down',
        s: 'down',
        arrowleft: 'left',
        a: 'left',
        arrowright: 'right',
        d: 'right',
      };
      const dir = map[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      pendingDirRef.current = dir;
    }

    document.addEventListener('keydown', handleKey);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      document.removeEventListener('keydown', handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  );
}
