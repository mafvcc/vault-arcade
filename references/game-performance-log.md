# Game Performance Log

> Mantenido por el agente `perf-optimizer`. Un juego por corrida. No editar manualmente sin avisar al agente.
> Fixes: F1=constantes de módulo · F2=pause-draw skip · F3=React.memo · F4=refs score/lives/level · F5=timer modulo · F6=O(n)→Map · F7=neon sprite cache

| Juego     | Fecha      | F1 const                   | F2 pause | F3 memo | F4 refs | F5 timer                            | F6 O(n)                | F7 neon | Notas                                                                                         |
| --------- | ---------- | -------------------------- | -------- | ------- | ------- | ----------------------------------- | ---------------------- | ------- | --------------------------------------------------------------------------------------------- |
| snake     | 2026-06-25 | –(sin setLineDash en loop) | ✓        | ✓       | ✓       | –(sin acumuladores dt)              | –(sin indexOf en loop) | ✓       | Loop es setInterval, no RAF; neon cache para head+body                                        |
| tetris    | 2026-06-25 | –(sin setLineDash en RAF)  | ✓        | ✓       | ✓       | –(dropAccum tiene reset periódico)  | –(sin indexOf en loop) | ✓       | neon skin confirmado; shadowBlur en drawBlock por cada bloque del board, ghost y pieza activa |
| arkanoid  | 2026-06-25 | –(sin setLineDash en loop) | ✓        | ✓       | ✓       | –(sin timers acumulativos sin cota) | –(sin indexOf en loop) | ✓       | neon cache horneado por color de bloque (7 sprites)                                           |
| asteroids | 2026-06-25 | –(sin setLineDash en RAF)  | ✓        | ✓       | ✓       | –(sin timers acumulativos sin cota) | –(sin indexOf en loop) | ✓       | neon cache: bullet+ship+lifeIcon por tipo; per-instance offscreen en Asteroid (verts únicos)  |
