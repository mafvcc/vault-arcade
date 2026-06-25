# FROGGER — Diseño de juego

> **Estado:** Borrador · **Fecha:** 2026-06-25
> **Objetivo:** Llevar el clásico arcade de cruce de Konami a Arcade Vault como un juego de timing y reflejos donde guiás una rana por tráfico y río hasta llegar a sus refugios, con estética neon-pixel de bandas de color vibrantes.

---

## Concepto

Frogger (Konami, 1981) es un clásico single-screen donde el jugador mueve una rana de abajo hacia arriba cruzando dos zonas peligrosas: una carretera con coches y una zona fluvial con troncos y tortugas flotantes. Es icónico por combinar dos mecánicas distintas en una pantalla — esquivar en la carretera, montar en la zona de río — y por exigir planificación y timing sin necesidad de disparo ni física compleja.

Encaja perfectamente en Arcade Vault: movimiento por celdas (sin física continua), colisión AABB simple, sin IA de enemigos, estética de bandas de color que traduce directamente a neon-pixel. La carretera son franjas cyan/magenta y el río franjas azul oscuro. La rana es un rectángulo verde brillante. El resultado es visualmente nítido y mecánicamente directo.

---

## Mecánicas clave

- **Controles:** Flechas (↑ ↓ ← →) o WASD — una celda por pulsación. Cada tecla mueve la rana exactamente una celda en la dirección indicada. No hay movimiento continuo: el input produce un salto discreto inmediato.
- **Objetivo:** Llevar la rana desde la franja inferior (zona segura) hasta alguno de los 5 refugios en la fila superior, ocupándolos todos para completar la ronda.
- **Progresión:** Cada vez que la rana llega a un refugio, reaparece en la zona de salida y debe llenar el siguiente. Al llenar los 5 refugios comienza una nueva ronda (nivel +1) con velocidades ligeramente aumentadas para coches y flotadores. La dificultad aumenta hasta el nivel 5 y luego se estabiliza.
- **Muerte / fin de ronda:** La rana muere si:
  1. Choca frontalmente con un coche (zona de tráfico).
  2. Cae al agua — está en el río pero no está sobre ningún tronco o tortuga.
  3. Un tronco o tortuga la lleva fuera del borde lateral del canvas.
  4. El timer de rana llega a cero.
     Al morir se pierde una vida y la rana reaparece en la base. Si las vidas llegan a cero: GAME OVER.
- **Puntuación:**
  - +10 por cada celda nueva avanzada hacia arriba (no se suman celdas al retroceder).
  - +50 por llegar a un refugio libre.
  - +200 por completar los 5 refugios (bonus de ronda).
  - Bonus de tiempo: al llegar a un refugio, cada segundo restante en el timer de rana vale +10 puntos.
  - Multiplicador de ronda aplicado al bonus de refugio: ronda × 50 (ronda 1 = ×1, ronda 2 = ×2, etc., máximo ×5).

---

## Modelo de HUD

**score / vidas / nivel**

Igual que Arkanoid y Asteroides. El timer de rana se dibuja como barra de progreso directamente en el canvas (overlay visual), no como contador numérico en el HUD React.

Callbacks resultantes: `onScore(score)`, `onLives(lives)`, `onLevel(level)`, `onGameOver(finalScore)`, `onPlaying()`.

---

## Layout del mapa (13 filas × 16 columnas)

El canvas es 800×600 con celdas de 50×46 px (800/16 = 50 px ancho, 600/13 ≈ 46 px alto). Las franjas se asignan por índice de fila (0 = arriba):

| Filas | Zona                          | Tipo       |
| ----- | ----------------------------- | ---------- |
| 0     | Refugios (5 huecos + 4 muros) | Meta       |
| 1–5   | Río (troncos/tortugas)        | Flotadores |
| 6     | Isla central (zona segura)    | Segura     |
| 7–11  | Carretera (coches)            | Tráfico    |
| 12    | Base (zona de salida)         | Segura     |

---

## Carriles

### Zona de tráfico (filas 7–11) — 5 carriles

| Carril (fila) | Obstáculo | Velocidad base | Dirección |
| ------------- | --------- | -------------- | --------- |
| 11            | Coches ×4 | 80 px/s        | →         |
| 10            | Coches ×5 | 120 px/s       | ←         |
| 9             | Coches ×3 | 90 px/s        | →         |
| 8             | Coches ×4 | 140 px/s       | ←         |
| 7             | Coches ×3 | 100 px/s       | →         |

### Zona de río (filas 1–5) — 5 carriles

| Carril (fila) | Obstáculo            | Velocidad base | Dirección |
| ------------- | -------------------- | -------------- | --------- |
| 5             | Troncos cortos ×4    | 60 px/s        | →         |
| 4             | Tortugas ×3 (grupos) | 80 px/s        | ←         |
| 3             | Troncos largos ×2    | 50 px/s        | →         |
| 2             | Tortugas ×4 (grupos) | 90 px/s        | ←         |
| 1             | Troncos medios ×3    | 70 px/s        | →         |

Todos los obstáculos hacen wrap horizontal: al salir por un borde reaparecen por el opuesto.

---

## Alcance

**Dentro:**

- Movimiento por celdas con una tecla = una celda.
- 13 filas × 16 columnas, celdas 50×46 px sobre canvas 800×600.
- 5 carriles de tráfico (coches, AABB kill) + 5 carriles de río (troncos/tortugas, ride + kill si fuera de borde).
- 5 refugios en fila 0; completar los 5 inicia nueva ronda.
- Timer de rana por refugio (12 s), dibujado como barra en canvas.
- 3 vidas iniciales. Lives-down al morir; game over a 0.
- Sistema de puntuación: avance por celda, bonus refugio, bonus tiempo, multiplicador de ronda.
- Niveles 1–5 con velocidad incremental (factor 1.0 → 1.5 cada ronda); nivel 5+ velocidad estabilizada.
- Overlay "PAUSA" y "GAME OVER" dibujados en canvas.
- Portada CSS `.cover-frogger` (sin assets externos).
- HUD React: score / vidas / nivel.

**Fuera de alcance:**

- Tortugas que se sumergen (blink + desaparición periódica).
- Crocodillos en el río.
- Moscas en los refugios (bonus extra).
- Serpiente en el tronco (kill oculto).
- Hembra de rana (bonus por llevarla al refugio).
- Más de 5 niveles o variación de layout por ronda.
- Efectos de sonido.
- Controles táctiles / swipe.
- Animación de salto de la rana (solo traslación instantánea por celda).
- Multijugador.

---

## Estética y portada

- **Color principal:** cyan (carriles de tráfico) + green (rana) sobre fondo oscuro. Río en azul profundo. Fila de meta en verde oscuro.
- **Categoría:** ARCADE
- **Clase CSS portada:** `.cover-frogger` — fondo con franjas horizontales de colores neon (negro → bandas cyan/magenta para tráfico, bandas azul para río, verde para meta); pseudo-elemento `::after` con un rectángulo verde (rana pixel) centrado en la franja central.
- **Assets necesarios:** ninguno — solo primitivas canvas (rectángulos con color y glow con `shadowBlur`/`shadowColor`). Coches = rectángulos redondeados con color. Troncos = rectángulos marrón/verde. Tortugas = rectángulos verde oscuro con borde. Rana = rectángulo verde con ojos (dos puntos blancos). Refugios = arcos de color en fila 0.

---

## Decisiones

| Decisión                           | Elección                         | Justificación                                                                                                       |
| ---------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Celdas vs movimiento continuo      | Celdas (50×46 px por input)      | Fiel al original; elimina física de interpolación; código más simple y predecible.                                  |
| Grilla 16×13                       | 16 cols × 13 filas               | Celdas cuadradas-ish (50×46) que llenan 800×600 sin margin. 5 refugios caben cómodamente con separadores.           |
| Timer de rana en canvas, no en HUD | Barra en canvas                  | Ocupa espacio en el tablero (como el juego original), deja el HUD React limpio con solo score/vidas/nivel.          |
| Tortugas sin inmersión             | Fuera de alcance v1              | La inmersión agrega un estado extra (timer de blink) que complica el carril sin cambiar la mecánica de fondo.       |
| Puntuación por avance por celda    | +10 por celda nueva hacia arriba | Premia el progreso continuo, coherente con el score competitivo del vault. Solo celdas nuevas (no retrocesos).      |
| Multiplicador de ronda en bonus    | Ronda × 50 (máx ×5)              | Da valor real al progreso de ronda sin disparar el score con velocidades solas. Simple de calcular.                 |
| Velocidad estabilizada en nivel 5+ | Factor fijo 1.5 desde nivel 5    | Evita que el juego se vuelva injugable en rondas altas; el score sigue creciendo por el multiplicador de bonus.     |
| Sin assets de imagen               | Primitivas canvas                | No hay recursos de frogger en `references/resources/`. Primitivas son SSR-safe y suficientes para la estética neon. |
| Colisión AABB                      | Rect-rect con margen de 4 px     | Simple, sin errores de punto flotante. El margen evita falsos positivos en los bordes de celda.                     |

---

## Riesgos

| Riesgo                                                        | Mitigación                                                                                                                                                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | ------------------------------------------------------------ |
| Lógica de anclaje al tronco/tortuga (rana se mueve con ellos) | En cada frame: si la rana está en el río, buscar el flotador cuyo rect contiene el centro de la rana y aplicar su `dx` a la posición x de la rana. Si ninguno contiene el centro → muerte. |
| Rana arrastrada fuera del borde lateral por un flotador       | Detectar si `rana.x < 0                                                                                                                                                                    |     | rana.x + rana.w > 800` después de aplicar el drift → muerte. |
| Densidad de carriles que hace el juego imposible              | Velocidades y gaps calibrados a mano en las constantes de carril; el factor de nivel es gradual (0.1 por ronda).                                                                           |
| `dt` grande tras pausa/focus-loss causa saltos de obstáculos  | Cap de `dt` a 50 ms en el loop. Los obstáculos no "saltan" más de `velocidad × 0.05 s` por frame.                                                                                          |
| Refugios — detectar cuál está libre vs. ya ocupado            | Array de 5 booleanos `homeFilled[0..4]`; se marca al llegar; se resetea al comenzar nueva ronda.                                                                                           |
| Fila 0 con 5 refugios y 4 separadores en 16 columnas          | Refugios en columnas 1, 4, 7, 10, 13 (ancho 2 cols); separadores en 0, 3, 6, 9, 12, 15 (ancho 1 col). Total: 5×2 + 6×1 = 16 columnas exactas.                                              |
