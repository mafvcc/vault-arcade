# SPEC 07 — Tablas de catálogo y leaderboard en Supabase

> **Estado:** Implementado · **Depende de:** SPEC 05 (integración Supabase), SPEC 02 (biblioteca en juego) · **Fecha:** 2026-06-24
> **Objetivo:** Crear las tablas `games` y `scores` en Supabase (con RLS y migración versionada), sembrar `games` desde el catálogo actual, y cablear `saveScore` para que inserte puntuaciones reales y el Salón de la Fama para que las lea desde la BD.

---

## Alcance

**Dentro:**

- **Migración SQL** (`supabase/migrations/NNN_games_scores.sql`, aplicada al remoto vía `apply_migration` y versionada en repo) que crea:
  - **Tabla `public.games`** — espejo del catálogo: `id text primary key`, `title`, `short`, `long`, `cat`, `cover`, `color`, `best int`, `plays text`, `position int not null` (orden curado del catálogo), `created_at timestamptz default now()`. RLS activado, **SELECT público** (anon); sin INSERT/UPDATE/DELETE público (no se edita en este spec).
  - **Tabla `public.scores`** — `id uuid primary key default gen_random_uuid()`, `game_id text references games(id)`, `player_name text not null`, `score int not null`, `created_at timestamptz default now()`. RLS activado, **SELECT público** e **INSERT público** (anon); sin UPDATE/DELETE público.
  - **Índice** en `scores (game_id, score desc)` para el ranking por juego.
  - **Seed** de `games` con las entradas actuales de `GAMES`, copiando `best`/`plays`/orden tal cual.
- **`lib/supabase/database.types.ts`** — tipos TypeScript generados (`generate_typescript_types`).
- **`app/components/GamesProvider.tsx`** (nuevo) — `<GamesProvider games={…}>` cliente + hook `useGames()`. Recibe el catálogo ya leído en el servidor.
- **`app/layout.tsx`** — lee `games` en el servidor (`lib/supabase/server.ts`, ordenado por `position`) y envuelve el árbol con `<GamesProvider>` junto al `AuthProvider` existente.
- **Consumidores del catálogo** — cambian `import { GAMES }` por `useGames()`: `app/page.tsx` (preview 6), `app/juego/page.tsx` (grid + filtro; `CATS` sigue estático), `app/jugar/[id]/page.tsx` (dispatch).
- **`app/juego/[id]/page.tsx`** (server) — lee el juego desde `games` por `id` (`notFound()` si no existe) y los **top scores reales** de `scores` para ese `game_id`; **estado vacío** si no hay marcas.
- **`app/salon/page.tsx`** (client) — pestañas desde `useGames()`; cada pestaña consulta los **top scores reales** de `scores` para ese `game_id` vía cliente de navegador; **estado vacío** ("Aún no hay marcas"); se elimina `seededScores` del render.
- **`app/components/AuthProvider.tsx`** — `saveScore` inserta una fila en `scores` vía el cliente de navegador; **deja de escribir** `localStorage` `av_scores`.
- **`lib/data.ts`** — se conservan el type `Game` y `CATS`; se eliminan `GAMES` y `seededScores` (el seed vive ya en la migración; ningún componente los importa).

**Fuera de alcance (specs futuros):**

- **Edición/alta/baja de juegos** (CRUD de `games`, UI de admin): solo lectura en este spec.
- **Auth real** y enlazar `scores` a `auth.users` (sin `user_id`; identidad solo por `player_name`).
- **Derivar `best`/`plays` desde `scores`** (vista/trigger): columnas estáticas sembradas.
- **Anti-fraude / validación server-side de puntuaciones**: el INSERT anon acepta cualquier score (riesgo aceptado en demo).
- **Migrar las puntuaciones existentes** de `localStorage` a la BD.
- **Bloque "TU MEJOR MARCA"** del Salón: se mantiene el comportamiento actual basado en `useAuth` (no se recalcula contra la BD).
- Tests automatizados (no hay runner).

---

## Modelo de datos

**SQL de las tablas (forma, no la migración completa):**

```sql
create table public.games (
  id          text primary key,        -- slug, p.ej. "asteroides"
  title       text not null,
  short       text not null,
  long        text not null,
  cat         text not null,           -- ARCADE | PUZZLE | SHOOTER | VERSUS
  cover       text not null,           -- clase CSS, p.ej. "cover-asteroids"
  color       text not null,           -- cyan | magenta | yellow | green
  best        int  not null default 0,
  plays       text not null default '0',
  position    int  not null,           -- orden curado del catálogo (0 = primero)
  created_at  timestamptz not null default now()
);

create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id),
  player_name text not null,
  score       int  not null,
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);
```

**RLS:**

```sql
alter table public.games  enable row level security;
alter table public.scores enable row level security;

-- games: lectura pública, sin escritura
create policy games_select_public  on public.games  for select using (true);

-- scores: lectura e inserción públicas
create policy scores_select_public on public.scores for select using (true);
create policy scores_insert_public on public.scores for insert with check (true);
```

**Mapeo BD → tipo `Game` de la app:** las columnas coinciden 1:1 con el type `Game` (`id, title, short, long, cat, cover, color, best, plays`). `GamesProvider` castea `color` al union `GameColor`. `position` y `created_at` solo se usan para ordenar y no entran en `Game`.

**Lectura del leaderboard** (Salón y detalle): `select player_name, score, created_at from scores where game_id = $1 order by score desc limit N`. El `rank` se calcula en el cliente por índice; la fecha se formatea desde `created_at`. Si la consulta vuelve vacía → estado vacío.

**Escritura de puntuación** (`saveScore`): `insert into scores (game_id, player_name, score) values ($1, $2, $3)`. `player_name` viene de `useAuth().user.name`; `game_id` del juego en curso.

**Tipos generados:** `lib/supabase/database.types.ts` (vía `generate_typescript_types`) tipa los clientes; las consultas usan esos tipos en lugar de `any`.

---

## Plan de implementación

1. **Migración + seed (BD).** Escribir `supabase/migrations/NNN_games_scores.sql` con las tablas `games` y `scores`, índice, RLS y políticas (sección anterior), más el `insert` de seed de `games` (todas las entradas actuales del catálogo, con su `position`). Aplicar al remoto con `apply_migration`. _Verificación:_ `list_tables` muestra `public.games` y `public.scores` con RLS activado; `select count(*) from games` devuelve el nº de juegos del catálogo; `select * from games order by position` respeta el orden actual.

2. **Tipos generados.** Ejecutar `generate_typescript_types` y guardar en `lib/supabase/database.types.ts`. Tipar las fábricas de cliente (`client.ts`/`server.ts`) con el `Database` generado. _Verificación:_ `npm run lint` sin errores; los clientes exponen los tipos de `games`/`scores`.

3. **`GamesProvider` + layout.** Crear `app/components/GamesProvider.tsx` (`"use client"`: context + `useGames()`). En `app/layout.tsx` (server), leer `games` con `lib/supabase/server.ts` (`order by position`), mapear a `Game[]` y envolver el árbol con `<GamesProvider games={…}>` junto al `AuthProvider`. _Verificación:_ la app levanta; `useGames()` devuelve el catálogo; aún nada cambia visualmente.

4. **Migrar consumidores del catálogo a `useGames()`.** Cambiar `import { GAMES }` por `useGames()` en `app/page.tsx` (preview 6), `app/juego/page.tsx` (grid + filtro) y `app/jugar/[id]/page.tsx` (dispatch). _Verificación:_ home muestra 6 juegos; `/juego` lista y filtra igual que antes; `/jugar/asteroides` y `/jugar/rocas` siguen resolviendo el juego correcto.

5. **Detalle `/juego/[id]` desde la BD.** Reescribir el server component para leer el juego desde `games` por `id` (`notFound()` si no existe) y los top scores reales de `scores` (`order by score desc limit N`); render con estado vacío si no hay marcas. Quitar `seededScores`. _Verificación:_ `/juego/asteroides` carga el juego desde BD; su leaderboard muestra el estado vacío (aún sin scores); un id inexistente da 404.

6. **`saveScore` → BD.** En `AuthProvider.tsx`, reescribir `saveScore` para `insert` en `scores` vía cliente de navegador (`game_id`, `player_name`, `score`); eliminar la escritura a `localStorage` `av_scores`. _Verificación:_ jugar Asteroides, perder y "GUARDAR PUNTUACIÓN" crea una fila (`select * from scores` la muestra); ya no se escribe `av_scores`.

7. **Salón desde la BD.** Reescribir `app/salon/page.tsx`: pestañas desde `useGames()`; al cambiar de pestaña, consultar los top scores reales de `scores` para ese `game_id` (cliente de navegador) con estado de carga y estado vacío; eliminar `seededScores` del render. Mantener el bloque "TU MEJOR MARCA" como está. _Verificación:_ tras guardar en el paso 6, la pestaña de Asteroides muestra esa marca real; un juego sin scores muestra "Aún no hay marcas".

8. **Limpieza.** Eliminar `GAMES` y `seededScores` de `lib/data.ts` (conservar `Game` y `CATS`). `npm run build` y `npm run lint` sin errores ni warnings. _Verificación:_ no quedan imports rotos; build/lint limpios; flujo completo (ver catálogo → jugar → guardar → ver en Salón y detalle) funciona end-to-end.

Nota: cada paso deja el sistema funcional. Los pasos 1–3 no cambian la UI; el catálogo migra a BD en el 4–5 y el scoring en el 6–7.

---

## Criterios de aceptación

- [ ] Existen `public.games` y `public.scores` en Supabase con RLS activado y las políticas descritas (SELECT público en ambas; INSERT público en `scores`; sin escritura pública en `games`).
- [ ] La migración está versionada en `supabase/migrations/NNN_games_scores.sql` y registrada en el remoto (`list_migrations` la muestra).
- [ ] `select count(*) from games` = nº de juegos del catálogo; `select id, position from games order by position` respeta el orden actual; `best`/`plays` coinciden con los valores previos.
- [ ] Existe `lib/supabase/database.types.ts` generado y los clientes están tipados con `Database` (sin `any` en las consultas a `games`/`scores`).
- [ ] Existe `app/components/GamesProvider.tsx` que expone `useGames()`; `app/layout.tsx` lee `games` en el servidor y envuelve el árbol con `<GamesProvider>`.
- [ ] Home muestra 6 juegos, `/juego` lista y filtra por categoría, y `/jugar/[id]` resuelve el juego — todos desde `useGames()` (BD), sin importar `GAMES`.
- [ ] `/juego/[id]` lee el juego desde la BD (`notFound()` para id inexistente) y muestra los top scores reales de ese juego, con estado vacío cuando no hay marcas.
- [ ] `saveScore` inserta una fila en `scores` (`game_id`, `player_name`, `score`) y **no** escribe `localStorage` `av_scores`.
- [ ] Tras guardar una puntuación, esa marca aparece en la pestaña correspondiente del Salón y en el leaderboard del detalle.
- [ ] El Salón lee scores reales por pestaña, muestra estado de carga y estado vacío ("Aún no hay marcas"); ya no usa `seededScores`.
- [ ] `GAMES` y `seededScores` ya no existen en `lib/data.ts`; `Game` y `CATS` se conservan; no quedan imports rotos.
- [ ] `npm run build` y `npm run lint` terminan sin errores ni warnings.

---

## Decisiones

- **Sí:** crear `games` como tabla real y **leer el catálogo desde la BD** (vía `GamesProvider`). Lo pediste; convierte la BD en fuente de lectura del catálogo.
- **No:** edición/CRUD de `games` ni UI de admin. Lo pediste así: solo lectura por ahora; el seed entra por la migración.
- **Sí:** `lib/data.ts` deja de exportar `GAMES`/`seededScores`; el catálogo vive en la BD y el seed en la migración. Evita dos fuentes de verdad divergentes.
- **Sí:** `GamesProvider` alimentado por un fetch en el `layout` (server) + `useGames()`. Una sola lectura, sin parpadeo, refactor mínimo y consistente con el patrón de `AuthProvider`.
- **No:** fetch del catálogo por componente (useEffect en cada página). Descartado: más queries, parpadeo de carga repetido y código duplicado.
- **No:** convertir las páginas cliente a Server Components. Descartado: refactor grande y arriesgado en páginas con mucha interactividad.
- **Sí:** identidad de `scores` solo por `player_name` (texto), sin `user_id`. No hay auth real todavía; añadir la FK a `auth.users` es trabajo del spec de auth.
- **Sí:** `best`/`plays` como columnas estáticas sembradas. Simple, sin joins; derivarlas de `scores` se pospone.
- **Sí:** columna `position` para fijar el orden curado del catálogo. El `select` ordena por ella; sin esto el orden de filas no está garantizado.
- **Sí:** RLS con SELECT público en ambas e INSERT público en `scores`. Sin auth real, es la única forma de que `saveScore` funcione; se asume el riesgo de scores falsificables (demo).
- **No:** validación anti-fraude server-side de puntuaciones. Abre alcance propio; fuera de este spec.
- **Sí:** `saveScore` deja de escribir `localStorage`. La puntuación pasa a ser global/compartida; mantener ambos arrastraría dos fuentes que divergen.
- **Sí:** detalle `/juego/[id]` también con scores reales y estado vacío. Consistencia: ningún score falso queda en la app.
- **No:** migrar los scores previos de `localStorage` a la BD. Son datos de prueba locales; no vale la pena el código de migración.
- **Sí:** migración aplicada vía `apply_migration` **y** versionada en `supabase/migrations/`. Trazabilidad en git además del registro remoto.
- **Sí:** tipos generados en `lib/supabase/database.types.ts`. Consultas tipadas en vez de `any`.

---

## Riesgos

| Riesgo                                                                                              | Mitigación                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INSERT público en `scores` permite puntuaciones falsificadas desde cualquier cliente.               | Riesgo aceptado en demo (decisión explícita). El anti-fraude y el INSERT solo-autenticado van en el spec de auth.                                       |
| El `layout` server falla al leer `games` (BD caída, env mal) y tumba toda la app.                   | Manejar el error en el fetch del layout (try/catch → `[]`); `useGames()` devuelve lista vacía y la UI degrada en vez de romper. Verificar en el paso 3. |
| Quitar `GAMES`/`seededScores` de `lib/data.ts` deja imports rotos en algún consumidor no detectado. | El grep de consumidores ya está hecho; el paso 8 corre `build`/`lint`, que falla ante cualquier import roto.                                            |
| Las pestañas del Salón disparan una query por cambio de pestaña (cliente) y parpadean o se repiten. | Estado de carga por pestaña; cachear por `game_id` en el componente para no re-consultar al volver a una pestaña ya vista.                              |
| `color` en BD es `text` y el type `Game.color` es un union; un valor inesperado rompe el tipado.    | `GamesProvider` castea/normaliza `color` a `GameColor` al mapear; el seed solo inserta valores válidos del catálogo.                                    |
| Desfase entre el seed de la migración y el catálogo (si alguien edita `lib/data.ts` luego).         | Tras este spec, `lib/data.ts` ya no tiene `GAMES`; la BD es la única fuente, así que no hay desfase posible.                                            |
| FK `scores.game_id → games.id`: insertar un score con un `game_id` inexistente falla.               | `game_id` proviene siempre de un juego del catálogo (BD); los slugs coinciden por construcción.                                                         |

---

## Lo que **no** entra en este spec

- Edición/alta/baja de juegos (CRUD de `games`) ni UI de admin.
- Auth real y enlazar `scores` a `auth.users` (`user_id`).
- Derivar `best`/`plays` desde `scores` (vista/trigger).
- Validación anti-fraude server-side de puntuaciones.
- Migrar las puntuaciones previas de `localStorage` a la BD.
- Conectar el bloque "TU MEJOR MARCA" del Salón a la BD.
- Tests automatizados.

Cada uno, si llega, va en su propio spec.
