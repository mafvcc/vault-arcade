# Arquitectura de integración de un juego en Arcade Vault

Referencia para el skill `/add-game`. Documenta los **puntos de integración concretos** que un juego jugable con leaderboard toca, derivados de SPEC 06 (motor + player) y SPEC 07 (tablas + scores). El spec que genere el skill debe instanciar estos puntos con el `id` y el contrato del juego concreto.

Convención de nombres en este documento: `<id>` = slug del juego (p.ej. `tetris`), `<Game>` = PascalCase (p.ej. `Tetris`).

---

## 1. Registry id → componente — `app/jugar/[id]/page.tsx`

Server component que resuelve el juego y despacha al Player. Patrón actual:

```tsx
const PLAYERS: Record<string, (props: { game: Game }) => React.ReactElement> = {
  asteroides: AsteroidsPlayer,
};
// ...
const Player = PLAYERS[game.id] ?? MockPlayer;
return <Player game={game} />;
```

**Toque por juego nuevo:** importar `<Game>Player` y agregar **una línea** al record: `"<id>": <Game>Player`. Ids no mapeados caen a `MockPlayer`. `notFound()` se mantiene para ids inexistentes.

---

## 2. Player React — `app/jugar/[id]/<Game>Player.tsx`

`"use client"`. Es el puente entre React y el motor. Patrón canónico (de `AsteroidsPlayer.tsx`):

- Refs: `const canvasRef = useRef<HTMLCanvasElement>(null)`, `const gameRef = useRef<<Game>Game | null>(null)`.
- Estado React que **solo espeja** lo que emite el motor: `score`, `lives`/`lines`, `level`, `paused`, `over`, `saved` (según el modelo de HUD del juego).
- Ciclo de vida:
  ```tsx
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = create<Game>;
    Game(canvas, {
      onScore: setScore,
      onLives: setLives, // o onLines, según el juego
      onLevel: setLevel,
      onGameOver: (final) => {
        setScore(final);
        setOver(true);
      },
      onPlaying: () => {
        setOver(false);
        setSaved(false);
        setPaused(false);
      },
    });
    gameRef.current = engine;
    engine.start();
    canvas.focus();
    return () => {
      engine.stop();
      gameRef.current = null;
    };
  }, []);
  ```
- Controles UI cableados al motor: PAUSA → `pause()`/`resume()` (+ overlay "EN PAUSA"); FIN → fuerza game over con el score actual; SALIR → `router.push("/juego/<id>")`; "JUGAR DE NUEVO" del modal → `restart()`; "GUARDAR PUNTUACIÓN" → `saveScore({ game: game.id, score, name })` (deshabilita tras el primer guardado vía `saved`).
- JSX: mismo HUD React (Jugador/Puntuación/Vidas|Líneas/Nivel) y marco CRT, con `<canvas ref={canvasRef}>` dentro de la pantalla. El contenedor lleva la clase `av-player--canvas` (ver §4).
- `preventDefault` de flechas/espacio lo hace el motor; el canvas capta foco al montar.

---

## 3. Motor TS autónomo — `lib/games/<id>.ts`

Fábrica sin globales de módulo. Contrato canónico (de `asteroids.ts`):

```ts
export type <Game>Callbacks = {
  onScore?: (score: number) => void;
  onLives?: (lives: number) => void;   // adaptar al modelo del juego (ver abajo)
  onLevel?: (level: number) => void;
  onGameOver?: (finalScore: number) => void;
  onPlaying?: () => void; // motor vuelve a 'playing' (incluye reinicio interno)
};

export type <Game>Game = {
  start(): void;   // arranca requestAnimationFrame
  stop(): void;    // cancela el loop y retira listeners de teclado/mouse
  pause(): void;   // congela el update (sigue dibujando el último frame)
  resume(): void;
  restart(): void; // reinicia estado y vuelve a 'playing'
};

export function create<Game>Game(
  canvas: HTMLCanvasElement,
  callbacks?: <Game>Callbacks,
): <Game>Game;
```

Reglas invariantes al portar desde el `game.js` de referencia:

- **Sin estado a nivel de módulo:** todo vive en el cierre de la fábrica. Nada de `document`/`window` fuera de `start`/`stop` (SSR-safe).
- El `ctx` y dimensiones se derivan del `canvas` recibido; se fija `canvas.width = 800; canvas.height = 600` (lógica en coordenadas internas; el escalado es solo CSS).
- Listeners (`keydown`/`keyup`, y `mousemove`/`click` si el juego usa mouse) se añaden en `start()` y se quitan en `stop()`. `preventDefault` de `ArrowUp/Down/Left/Right` y `Space`.
- `pause()`/`resume()` con bandera que salta el `update` (sigue redibujando). `restart()` reinicia el estado y emite `onPlaying`.
- Emitir callbacks **solo en cambios** (no cada frame): `onScore` al cambiar el score, etc. `onGameOver` **una sola vez** en la transición a `gameover` (guardar con bandera). `onPlaying` al volver a `playing` (reinicio interno por tecla o `restart()`).
- `dt` capado (~50ms) para evitar saltos tras un freeze.
- Se conserva el HUD dibujado en canvas y el overlay "GAME OVER" del original; conviven con el HUD/modal React.

---

## 4. CSS — `app/globals.css`

- **Portada de la card** `cover-<id>`: gradientes/pseudo-elementos coherentes con las demás `cover-*` (sin binarios). Usa las variables de color del tema (`var(--cyan)`, etc.).
- **Escalado del canvas**: la clase `.av-player--canvas` ya escala el canvas manteniendo proporción 4:3 dentro del marco CRT (`width: min(100vw - 80px, calc(min(70vh, 600px) * 4 / 3))`, `aspect-ratio: 4 / 3`). El canvas usa `.game-canvas` (`width/height: 100%`, resolución interna 800×600). Reutilizar; normalmente no hay que crear CSS nuevo de canvas, solo la `cover-<id>`.

---

## 5. Catálogo en BD — tabla `games`

Fila por juego (columnas 1:1 con el type `Game` de `lib/data.ts` + `position`/`created_at`):

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values ('<id>', '<TITLE>', '<short>', '<long>', '<CAT>', 'cover-<id>', '<color>', <best>, '<plays>', <position>);
```

- `cat` ∈ ARCADE | PUZZLE | SHOOTER | VERSUS. `color` ∈ cyan | magenta | yellow | green.
- `position` = orden curado (entero; elegir según dónde va en el grid).
- Inserción **siempre vía migración versionada** `supabase/migrations/NNN_add_<id>.sql`, aplicada con `apply_migration` y commiteada. Nunca un INSERT suelto.
- Lectura: `app/layout.tsx` lee `games` (`order by position`) con `lib/supabase/server.ts` y lo propaga por `<GamesProvider>`/`useGames()`. No hay que tocar layout ni provider para agregar un juego.

---

## 6. Scores / leaderboard (reutilizar si SPEC 07 ya está hecho)

- **Guardar:** `saveScore` en `app/components/AuthProvider.tsx` inserta en `scores` (`game_id`, `player_name`, `score`) vía cliente de navegador. El Player solo lo llama; no se modifica.
- **Leer:** `app/salon/page.tsx` (pestañas, cliente) y `app/juego/[id]/page.tsx` (detalle, server) leen top scores de `scores` por `game_id` (`order by score desc limit N`), con estado vacío. Funcionan automáticamente para el juego nuevo (mismo `game_id`); no requieren cambios salvo que el detalle dependa de catálogo, que ya viene de BD.

---

## 7. Bootstrap (solo si faltan las tablas / la capa Supabase)

Si `list_tables` no muestra `public.games`/`public.scores`, o no existe `lib/supabase/`, el spec debe **anteponer** los pasos de SPEC 07 antes de agregar el juego:

- Migración `NNN_games_scores.sql`: tablas `games` y `scores`, índice `scores (game_id, score desc)`, RLS activado y políticas (SELECT público en ambas; INSERT público en `scores`; sin escritura pública en `games`). DDL:
  ```sql
  create table public.games (
    id text primary key, title text not null, short text not null, long text not null,
    cat text not null, cover text not null, color text not null,
    best int not null default 0, plays text not null default '0',
    position int not null, created_at timestamptz not null default now()
  );
  create table public.scores (
    id uuid primary key default gen_random_uuid(),
    game_id text not null references public.games(id),
    player_name text not null, score int not null,
    created_at timestamptz not null default now()
  );
  create index scores_game_score_idx on public.scores (game_id, score desc);
  alter table public.games  enable row level security;
  alter table public.scores enable row level security;
  create policy games_select_public  on public.games  for select using (true);
  create policy scores_select_public on public.scores for select using (true);
  create policy scores_insert_public on public.scores for insert with check (true);
  ```
- `lib/supabase/database.types.ts` vía `generate_typescript_types`; tipar `client.ts`/`server.ts` con `Database`.
- `app/components/GamesProvider.tsx` (`useGames()`); `app/layout.tsx` lee `games` server-side y envuelve con `<GamesProvider>` junto al `AuthProvider`.
- `saveScore` (AuthProvider) y los leaderboards de `/salon` y `/juego/[id]` cableados a `scores`.

Si las tablas **ya existen**, omitir todo esto: el juego nuevo solo agrega su fila (§5) y reutiliza §6.

---

## 8. Adaptar el contrato de callbacks al modelo de HUD del juego

El contrato canónico (Asteroides) es score/vidas/nivel. Otros juegos varían — adaptar callbacks, estado React y HUD en consecuencia:

| Juego (referencia) | Marcador                        | Controles           | Notas de port                                                                                                                                                                     |
| ------------------ | ------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `02-asteroids`     | score / vidas / nivel           | teclado             | power-ups (3x), canvas único, espacio toroidal. Contrato base.                                                                                                                    |
| `03-tetris`        | score / **líneas** / nivel      | teclado             | **segundo canvas** "next" (pasar un 2º ref o dibujar preview en el mismo canvas); HUD del original era DOM → mover a HUD React vía callbacks. Reemplazar `onLives` por `onLines`. |
| `04-arkanoid`      | score / vidas / nivel / **win** | **mouse** + teclado | sprites + audio (decidir si se portan o quedan fuera de alcance); niveles (`levels.js`); estado extra `win`. Listeners de mouse también en `start`/`stop`.                        |

Para fuentes externas (no de `references/started-games/`): inferir el modelo de marcador, controles y estados desde el código/descripción aportada y definir el contrato de callbacks análogo, manteniendo la API `{ start, stop, pause, resume, restart }`.
