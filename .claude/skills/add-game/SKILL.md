---
name: add-game
description: Autor de specs para agregar un juego jugable con leaderboard a Arcade Vault. Hace preguntas guiadas y redacta specs/NN-<id>-jugable.md siguiendo el patrón de SPEC 06/07, sin tocar código. Luego se implementa con /spec-impl.
disable-model-invocation: true
argument-hint: "descripción del juego o id de references/started-games (p.ej. 03-tetris)"
---

# /add-game — Autor de specs de juegos para Arcade Vault

Este skill produce un **spec** para agregar un juego jugable con leaderboard a Arcade Vault, siguiendo el patrón ya implementado en SPEC 06 (motor TS + Player React + registry + portada) y SPEC 07 (tablas `games`/`scores` + scoring). **No escribes código aquí.** Tu trabajo es hacer preguntas guiadas y redactar `specs/NN-<id>-jugable.md` sección por sección, listo para aprobarse y ejecutarse con `/spec-impl`.

Este skill es una **especialización del skill `/spec`**: aplica su mismo método spec-driven (fases, preguntas en bloques, no escribir código, guardar en `specs/`) pero precargado con el dominio de integración de juegos de Arcade Vault. Tratá a `/spec` como la base: si tenés acceso a él, **lee su `SKILL.md` y su `template.md`** para respetar su estructura de secciones, su definición de estados (Borrador/Aprobado/…) y sus criterios de cuándo dejar de preguntar; este skill solo añade las preguntas y los puntos de integración propios de los juegos. La implementación posterior la hace `/spec-impl`, igual que con cualquier spec de `/spec`.

El juego puede venir de `references/started-games/` (portas su `game.js`) o de código/descripción externa que aporte el usuario.

## Filosofía

Un spec no es documentación decorativa: es el contrato que guía la implementación. Si el spec es vago, el código improvisa. Por eso este flujo es **deliberadamente lento al definir** y **rápido al escribir**. Apóyate en `architecture.md` (hermano de este skill) en cada paso: contiene los puntos de integración concretos (registry, contrato del motor, Player, CSS, migración, bootstrap) que el spec debe instanciar.

## Flujo del comando

Sigue las cuatro fases en orden. **No saltes fases.** Responde en el mismo idioma del prompt inicial.

### Fase 1 — Contexto

Antes de preguntar nada:

1. Lee el archivo de memoria del proyecto si existe (en orden, primer acierto): `CLAUDE.md`, `AGENTS.md`, `README.md`.
2. Lee el skill base `/spec` (su `SKILL.md` y `template.md`, normalmente en `~/.claude/skills/spec/` o `.claude/skills/spec/`) si está disponible — de ahí heredas la estructura de secciones, los estados del spec y el método de preguntas. Si no lo encontrás, usa SPEC 06/07 como molde.
3. Lee `architecture.md` (en este mismo directorio) — es tu mapa de los puntos de integración.
4. `ls specs/` para ver la numeración y elegir el próximo `NN`. Lee los 2 specs más recientes (especialmente SPEC 06 y 07) para captar convenciones.
5. `ls references/started-games/` para ver qué juegos hay disponibles para portar.
6. **Detecta bootstrap.** Comprueba si existe `lib/supabase/` y, vía `list_tables` (MCP supabase), si existen `public.games` y `public.scores`. Esto decide si el spec debe **crear** las tablas/tipos/Provider (SPEC 07) o solo **reutilizarlos**. Anótalo.

Si `$ARGUMENTS` apunta a un juego de referencia (p.ej. `03-tetris`), **lee su `game.js`** (y `levels.js`/assets si los tiene) para inferir su modelo de marcador, controles, estados y mecánicas. Si `$ARGUMENTS` viene vacío, pide al usuario una descripción de una frase del juego y su fuente.

### Fase 2 — Preguntas guiadas

Es la fase más importante. **Detecta ambigüedades y pregunta**, no asumas. Pregunta en bloques de 3 a 5 y espera respuesta antes de seguir. Ofrece 2–4 opciones concretas cuando aplique y marca tu recomendación.

Cubre estas categorías (precarga respuestas tentativas desde el `game.js` leído en Fase 1, y confírmalas):

- **Fuente y port.** ¿Juego de `references/started-games/` (cuál) o código/descripción externa? Si es externo, pide el código o una descripción precisa de mecánica, controles y fin de juego.
- **Catálogo.** `id` (slug en kebab-case), `title`, `cat` (ARCADE | PUZZLE | SHOOTER | VERSUS), `color` (cyan | magenta | yellow | green), `short` (card), `long` (detalle), valores seed `best`/`plays`, y `position` en el grid.
- **Motor.** Modelo de marcador (score/vidas/nivel · score/líneas/nivel · +estado `win`), controles (teclado · mouse · ambos), ¿power-ups?, ¿segundo canvas/preview (estilo "next" de Tetris)?, ¿assets/sprites/audio? → decide si se portan o quedan **fuera de alcance**.
- **Portada.** Estilo de la `cover-<id>` (qué evocar; siempre CSS, sin binarios).
- **Bootstrap.** Confirma lo detectado en Fase 1: ¿el spec crea las tablas `games`/`scores` (y tipos/Provider) o ya existen y solo se reutilizan?

Si una respuesta abre un alcance nuevo (multijugador, sonido elaborado, dificultad configurable, anti-fraude), señala que merece su propio spec y proponé dejarlo **fuera de alcance**.

**Cuándo dejar de preguntar:** cuando puedas responder sin asumir: (1) qué archivos aparecen o cambian, (2) cuál es el primer paso ejecutable y cuál el último, (3) cómo se verifica que funciona.

### Fase 3 — Redacción

Redacta el spec sección por sección **con la estructura del `template.md` de `/spec`** (y SPEC 06/07 como molde concreto):

1. **Header** — `# SPEC NN — <Título> jugable en /jugar/<id>` + blockquote con `Estado: Borrador · Depende de: ... · Fecha: <hoy>` y `Objetivo:` de una frase.
2. **Alcance** — **Dentro** (lista de archivos exactos a crear/tocar, instanciados desde `architecture.md` con el `id`/`<Game>` del juego) y **Fuera de alcance** (assets/sonido/etc. que se descartaron).
3. **Modelo de datos** — la fila `games` concreta (con sus valores) + el contrato de callbacks del motor adaptado al modelo de HUD del juego (§8 de `architecture.md`). Si hay bootstrap, incluye el DDL de `games`/`scores` (§7).
4. **Plan de implementación** — pasos numerados, cada uno commitable y con su verificación. Si falta bootstrap, **antepón** los pasos de tablas/tipos/Provider antes de los del juego. Orden típico del juego: (a) migración + seed de la fila; (b) motor `lib/games/<id>.ts`; (c) `<Game>Player.tsx`; (d) línea en el registry de `app/jugar/[id]/page.tsx`; (e) `cover-<id>` en `globals.css`; (f) limpieza (`build`/`lint`, sin fugas de rAF/listeners).
5. **Criterios de aceptación** — checklist booleano (juego real jugable, HUD canvas + React coherentes, game over + modal, guardar score en `scores`, reinicio sin recargar, escalado 4:3, ids no mapeados → MockPlayer, sin fugas al entrar/salir).
6. **Decisiones** — tomadas y descartadas (port fiel vs reescritura, qué mecánicas se conservan, bootstrap sí/no, etc.).
7. **Riesgos** — tabla riesgo/mitigación (fugas de rAF/listeners, globales de módulo, `onGameOver` en bucle, desincronía canvas↔modal, escalado borroso).

Instancia siempre los puntos de integración con el `id` concreto; no dejes placeholders genéricos en el spec final.

### Fase 4 — Guardar

Escribe el spec en `specs/NN-<id>-jugable.md` con `Estado: Borrador`. **No escribas código ni toques ningún otro archivo.** Avisa al usuario que revise/apruebe (cambie el estado a Aprobado) y luego ejecute `/spec-impl NN-<id>-jugable` para implementarlo.

## Reglas duras

- **No escribes código.** Solo el archivo del spec en `specs/`.
- La inserción del juego en BD es **siempre** una migración versionada (`apply_migration` + commit), nunca un INSERT suelto.
- `saveScore` y los leaderboards (`/salon`, `/juego/[id]`) **se reutilizan** si ya existen (SPEC 07 hecho); solo se crean en el bloque de bootstrap.
- El motor es SSR-safe: sin `document`/`window` a nivel de módulo; listeners en `start`/`stop`; estado en el cierre, no global.
- Responde en el idioma del prompt inicial.
