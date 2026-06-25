# Game Suggestions

Registro de juegos evaluados para Arcade Vault. Actualizado por el agente `game-planner`.

| Juego           | Categoría | Estado    | Fecha      |
| --------------- | --------- | --------- | ---------- |
| PONG            | SPORTS    | pendiente | 2026-06-25 |
| AIR HOCKEY NEON | SPORTS    | pendiente | 2026-06-25 |
| TRACK & FIELD   | SPORTS    | pendiente | 2026-06-25 |
| ARCHERY         | SPORTS    | pendiente | 2026-06-25 |
| MINESWEEPER     | STRATEGY  | pendiente | 2026-06-25 |
| 2048            | STRATEGY  | pendiente | 2026-06-25 |
| PAC-MAN         | ARCADE    | pendiente | 2026-06-25 |
| FROGGER         | ARCADE    | pendiente | 2026-06-25 |
| DIG DUG         | ARCADE    | pendiente | 2026-06-25 |
| DONKEY KONG     | ARCADE    | pendiente | 2026-06-25 |
| BOMBERMAN       | ARCADE    | pendiente | 2026-06-25 |
| SPACE INVADERS  | SHOOTER   | pendiente | 2026-06-25 |
| GALAGA          | SHOOTER   | pendiente | 2026-06-25 |
| CENTIPEDE       | SHOOTER   | pendiente | 2026-06-25 |
| GALAXIAN        | SHOOTER   | pendiente | 2026-06-25 |
| DEFENDER        | SHOOTER   | pendiente | 2026-06-25 |
| COLUMNS         | PUZZLE    | pendiente | 2026-06-25 |
| DR. MARIO       | PUZZLE    | pendiente | 2026-06-25 |
| PUZZLE BOBBLE   | PUZZLE    | pendiente | 2026-06-25 |
| BEJEWELED       | PUZZLE    | pendiente | 2026-06-25 |
| LUMINES         | PUZZLE    | pendiente | 2026-06-25 |

## PONG — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: SPORTS
- **Factibilidad**: alta
- **Justificación**: Estrena la categoría SPORTS, hoy vacía, mejorando la variedad del catálogo. Clásico arcade de máximo reconocimiento que traduce perfectamente a neon-pixel (paletas, pelota y línea central como trazos de neón sobre negro) sin assets externos. Ideal para canvas 2D + teclado: física de rebote AABB simple e IA trivial (seguir Y de la pelota con velocidad limitada). SSR-safe, sin networking ni sprites.
- **Riesgos**: Gameplay minimalista; necesita rampa de dificultad (velocidad creciente, ángulo según punto de impacto en la paleta) y capa de puntuación para encajar en el sistema competitivo de scores. Riesgo de parecer "demasiado simple" frente al resto del catálogo; mitigable con efectos neon (trails, partículas al rebotar). Definir modo 1P vs IA como principal; 2P local opcional.
- **Notas**: Categorías sin representar al momento de sugerir: SPORTS y STRATEGY. Se prioriza SPORTS por estar totalmente vacía y por la altísima factibilidad/nostalgia de Pong. Siguiente paso sugerido: crear spec con `/add-game`.

## AIR HOCKEY NEON — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: SPORTS
- **Factibilidad**: alta
- **Justificación**: Refuerza SPORTS (hoy vacía) y complementa a Pong sin solaparse: aquí el control es 2D con mouse/arrastre del mazo, no paleta 1D. Canvas 2D puro: disco con física de rebote AABB/circular, fricción y rebote en bordes/porterías. Estética neon-pixel directa (mesa negra con líneas cian, disco como punto luminoso con trail, partículas al golpear). SSR-safe, sin assets ni networking. IA por seguimiento del disco con agresividad escalable.
- **Riesgos**: La física disco-mazo (colisión círculo-círculo con transferencia de momento según velocidad del mazo) es más fina que el rebote de Pong; mal calibrada se siente "pegajosa" o expulsa el disco demasiado rápido. Control con mouse requiere clamp del mazo a su mitad de mesa. Definir condición de score competitiva (goles a tiempo o a N puntos con cronómetro).
- **Notas**: Nostalgia media. Veredicto: recomendado. Junto a Minesweeper, candidato prioritario por estrenar/reforzar categoría vacía con esfuerzo bajo.

## TRACK & FIELD — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: SPORTS
- **Factibilidad**: media
- **Justificación**: Clásico Konami de máximo reconocimiento; estrena un subgénero "deporte de habilidad/botón" distinto a los juegos de pelota. Encaja con el sistema competitivo de scores (cada prueba da puntos acumulables → leaderboard natural). Mecánica button-mashing (alternar dos teclas para velocidad + tecla de ángulo/salto) trivial en canvas 2D. Estética neon-pixel para pista, atleta sprite simple y barra de potencia/ángulo.
- **Riesgos**: Para sentirse completo necesita 2-3 pruebas (100m, salto largo, jabalina), lo que multiplica el trabajo de animación y tuning (complejidad media-alta si son muchas). Mitigable lanzando con 1-2 pruebas. El button-mashing puede fatigar; conviene curva de dificultad y récords por prueba. Animación del atleta es lo más costoso visualmente.
- **Notas**: Nostalgia alta. Veredicto: recomendado.

## ARCHERY — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: SPORTS
- **Factibilidad**: alta
- **Justificación**: SPORTS de "puntería" muy traducible: física de proyectil simple (gravedad + viento opcional) y colisión flecha-diana por anillos = score directo y competitivo. Input mouse (arrastrar para tensar ángulo/fuerza) o teclado. Neon-pixel ideal: diana de anillos luminosos, arco como trazos, trail de la flecha. SSR-safe, sin assets externos, baja complejidad de sistemas.
- **Riesgos**: Gameplay puede volverse repetitivo sin variación (viento variable, dianas a distinta distancia/tamaño, tiempo límite). Riesgo de solaparse en "sensación" con la jabalina si también se hace Track & Field; elegir uno o diferenciarlos (parábola libre vs anillos de precisión). Indicador de fuerza/ángulo debe ser muy legible.
- **Notas**: Nostalgia media. Veredicto: condicional.

## MINESWEEPER — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: STRATEGY
- **Factibilidad**: alta
- **Justificación**: Estrena STRATEGY (vacía y prioritaria) con altísima factibilidad: grid de casillas, flood-fill de revelado, conteo de minas adyacentes y banderas con click izquierdo/derecho. Cero física, cero IA, generación procedural trivial (sembrado aleatorio, opcional primer click seguro). Estética neon-pixel excelente: grid con bordes cian, números en colores neon, minas como destellos. SSR-safe, sin assets. Score competitivo por tiempo y/o tablero más grande resuelto.
- **Riesgos**: Es puzzle-lógico más que "estrategia" pura; encaja en STRATEGY por planificación/deducción pero conviene confirmar el encuadre. Score competitivo requiere normalizar (mejor tiempo por dificultad: 9x9, 16x16, 16x30). Click derecho en móvil/trackpad necesita gesto alternativo (long-press / botón de modo bandera).
- **Notas**: Nostalgia alta. Veredicto: recomendado. Candidato prioritario por estrenar categoría vacía con esfuerzo bajo.

## 2048 — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: STRATEGY
- **Factibilidad**: alta
- **Justificación**: Refuerza STRATEGY con un clásico moderno ultra-reconocible y perfecto para scores (la puntuación ES el núcleo). Implementación canvas 2D + teclado (flechas/WASD o swipe) muy contenida: grid 4x4, lógica de deslizar/fusionar fichas, spawn aleatorio de 2/4, detección de game over. Estética neon-pixel inmejorable: fichas como bloques luminosos con color por valor y animación de fusión con glow. SSR-safe, sin assets, baja complejidad.
- **Riesgos**: Animación de deslizamiento/fusión suave es lo único delicado (interpolar posiciones para que no se vea "saltón"); jugable incluso sin animación. Es de 2014, menos "arcade retro" que el resto del catálogo, aunque su estética pixel-grid encaja bien. Soporte de swipe deseable para coherencia.
- **Notas**: Nostalgia alta. Veredicto: recomendado.

## PAC-MAN — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: ARCADE
- **Factibilidad**: media
- **Justificación**: El clásico maze por excelencia y el más reconocible del género. Traduce de forma natural a neon-pixel (laberinto como trazos neon sobre negro, fantasmas de colores saturados, dots brillantes). Solo necesita canvas 2D + teclado, movimiento sobre rejilla (tile grid) y colisión por celda. Aporta el subgénero "maze chase" inexistente en el catálogo, complementando los dos ARCADE actuales (paddle y snake) sin solaparse.
- **Riesgos**: La IA de los cuatro fantasmas con personalidades distintas (scatter/chase, targeting individual de Blinky/Pinky/Inky/Clyde) es el reto principal. El diseño del laberinto y los túneles de wrap-around requieren editor de mapa o layout hardcodeado. Estados de power-pellet (fantasmas vulnerables, retorno a casa) añaden máquina de estados. Complejidad media-alta sin assets.
- **Notas**: Nostalgia alta. Veredicto: recomendado.

## FROGGER — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: ARCADE
- **Factibilidad**: alta
- **Justificación**: Clásico single-screen de cruce con apellido icónico. Muy factible en canvas 2D: movimiento por celdas, carriles de obstáculos (coches, troncos, tortugas) como rectángulos que se desplazan a velocidad constante, colisión AABB simple. Sin IA ni física compleja. Estética neon-pixel ideal: carriles de tráfico y río como bandas de color, la rana como sprite verde brillante. Buen encaje con sistema de score (tiempo, ranas salvadas, bonus).
- **Riesgos**: La mecánica de plataformas flotantes (rana se mueve con el tronco) requiere lógica de "anclaje" al objeto bajo el jugador. Equilibrar velocidades y densidad de carriles para una curva de dificultad justa. Riesgo menor; de los más sencillos del lote.
- **Notas**: Nostalgia alta. Veredicto: recomendado. Alto valor/esfuerzo: máxima factibilidad, subgénero nuevo, bajo riesgo.

## DIG DUG — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: ARCADE
- **Factibilidad**: media
- **Justificación**: Clásico de excavación. Mecánica distintiva: cavar túneles en terreno destructible y eliminar enemigos inflándolos o aplastándolos con rocas. Terreno como grid de celdas sólido/vacío, fácil de representar en canvas. Estética neon-pixel atractiva (capas de tierra por colores, enemigos Pooka/Fygar luminosos). Añade variedad mecánica real frente al resto del catálogo.
- **Riesgos**: Terreno destructible por celdas + pathfinding de enemigos que persiguen al jugador por túneles (y el modo "ghost" en que atraviesan tierra) es la parte compleja. Física de rocas que caen al socavar su soporte añade un sistema extra. Mecánica de inflado (mantener botón) y aplastamiento exigen tuning. Complejidad media; más alta que Frogger.
- **Notas**: Nostalgia media-alta. Veredicto: recomendado.

## DONKEY KONG — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: ARCADE
- **Factibilidad**: media
- **Justificación**: El platformer single-screen fundacional; estrena el subgénero plataformas en el catálogo. Reconocimiento altísimo. Canvas 2D viable: plataformas/rampas, escaleras, barriles que ruedan con gravedad simple, saltos del jugador. Estética neon-pixel encaja muy bien (vigas, escaleras y barriles como elementos luminosos). Buen sistema de score (altura, barriles saltados, bonus por tiempo).
- **Riesgos**: El más demandante en física de plataformas del lote: gravedad, salto con arco, colisión jugador-plataforma por borde, subir/bajar escaleras (cambio de modo de movimiento), y barriles que eligen rampa/escalera. Varios niveles distintos si se quiere fidelidad. Requiere más sprites/animación. Complejidad media-alta; recomendable empezar con un solo nivel (las rampas de barriles).
- **Notas**: Nostalgia alta. Veredicto: condicional.

## BOMBERMAN — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: ARCADE
- **Factibilidad**: media
- **Justificación**: Clásico maze de un solo screen con grid claro: jugador se mueve por celdas, coloca bombas que explotan en cruz tras un temporizador, destruye bloques blandos y enemigos. Encaja perfecto en canvas 2D tile-based, sin física continua. Estética neon-pixel muy lograda (rejilla, explosiones radiantes, power-ups brillantes). Aporta mecánica de "colocación + temporización" inexistente en el catálogo.
- **Riesgos**: IA de enemigos que patrullan/persiguen por el grid, propagación de explosiones bloqueada por muros, cadenas de explosiones (bombas que detonan a otras) y power-ups (rango, nº bombas, velocidad). Sin networking se pierde el atractivo multijugador clásico; el modo 1P contra IA debe diseñarse bien. Complejidad media.
- **Notas**: Nostalgia alta. Veredicto: recomendado.

## SPACE INVADERS — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: SHOOTER
- **Factibilidad**: alta
- **Justificación**: El fixed shooter por antonomasia y el clásico más reconocible del género; estrena el subgénero gallery shooter (distinto de Asteroides, de movimiento libre 360°). Encaje neon-pixel perfecto: sprites de invasores ya son pixel art puro, paleta verde/cyan sobre negro. Canvas 2D + teclado: cañón horizontal, grid de enemigos que desciende, disparos AABB, búnkeres destructibles. SSR-safe, sin física compleja ni networking.
- **Riesgos**: Lógica del descenso/aceleración del enjambre (velocidad sube al quedar menos enemigos) y la nave nodriza bonus. Búnkeres con destrucción granular requieren máscara por píxel/celda; mitigable con grid de bloques pequeños. Aceleración audio "marcha" icónica es opcional.
- **Notas**: Nostalgia alta. Veredicto: recomendado. Alto valor/esfuerzo: máxima nostalgia, factibilidad alta, estrena gallery shooter.

## GALAGA — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: SHOOTER
- **Factibilidad**: media
- **Justificación**: Evolución del fixed shooter con identidad propia: enemigos que entran en formación mediante patrones de vuelo curvos y pican en picado. Apellido icónico, altísimo reconocimiento. Neon-pixel ideal (naves coloridas, estrellas de fondo). Añade profundidad sobre Space Invaders sin salir del subgénero.
- **Riesgos**: Complejidad media-alta por patrones de entrada (curvas Bézier/splines) y la IA de picado. Mecánica del rayo tractor (captura de nave + nave dual al rescatarla) es el sello distintivo pero añade estados; podría posponerse a v2. Más sistemas que Space Invaders.
- **Notas**: Nostalgia alta. Veredicto: condicional. En la familia "shooter de formación" elegir UNO entre Galaga (más icónico) y Galaxian (más simple).

## CENTIPEDE — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: SHOOTER
- **Factibilidad**: media
- **Justificación**: Clásico de Atari; gallery shooter con twist único: ciempiés que serpentea por un campo de setas y se fragmenta al recibir disparos. Jugador con movimiento en zona inferior (apto teclado o mouse). Estética neon-pixel vibrante (setas, ciempiés segmentado, araña). Aporta variedad clara de mecánica de disparo frente a Invaders/Galaga.
- **Riesgos**: Lógica del ciempiés al partirse en dos al impactar un segmento intermedio, y su rebote/descenso al chocar con setas, requiere cuidado. Enemigos secundarios (araña, pulga, escorpión) añaden alcance. Grid de setas persistente como estado de tablero.
- **Notas**: Nostalgia alta. Veredicto: recomendado.

## GALAXIAN — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: SHOOTER
- **Factibilidad**: alta
- **Justificación**: Predecesor directo de Galaga; fixed shooter de formación con enemigos que rompen filas y atacan en picado, pero sin tractor ni nave dual, lo que lo hace notablemente más simple de implementar que Galaga conservando el atractivo del "picado". Buen punto medio para un shooter de formación de baja-media complejidad y entrega rápida.
- **Riesgos**: Solapamiento conceptual con Galaga/Space Invaders: conviene elegir uno de la familia "formación con picado". Reconocimiento algo menor que Galaga (nostalgia media). Patrones de picado más simples pero aún requieren trayectorias.
- **Notas**: Nostalgia media. Veredicto: condicional. Alternativa más simple a Galaga.

## DEFENDER — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: SHOOTER
- **Factibilidad**: media
- **Justificación**: Side-scrolling shooter pionero con scroll horizontal bidireccional, minimapa/radar y rescate de humanoides. Aporta el subgénero scrolling shooter, totalmente ausente (Asteroides es 360° estático, los demás fixed), maximizando variedad dentro de SHOOTER. Neon-pixel encaja muy bien (terreno montañoso, naves, radar como HUD de trazos).
- **Riesgos**: Complejidad media-alta: mundo con scroll y wrap horizontal, cámara, radar sincronizado, varios tipos de enemigos (Lander, Mutant, Baiter) y la mecánica de rescate de humanoides que caen. El esquema de control original es denso (varios botones); habría que simplificarlo a teclado moderno.
- **Notas**: Nostalgia alta. Veredicto: condicional. Apuesta de variedad (scrolling) cuando haya margen para más sistemas.

## COLUMNS — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: PUZZLE
- **Factibilidad**: alta
- **Justificación**: Clásico de SEGA, "primo" de Tetris pero con mecánica diferenciada: caen columnas de 3 gemas de colores que el jugador reordena, y se eliminan al alinear 3+ del mismo color en cualquier dirección (horizontal, vertical, diagonal). Reaprovecha casi toda la infraestructura de Tetris (grid, gravedad, bucle de caída, detección por celda), reduciendo el coste. Estética neon-pixel ideal: gemas brillantes con glow sobre fondo negro. Canvas 2D + teclado puro, SSR-safe, sin assets.
- **Riesgos**: La detección de matches en 8 direcciones más reacciones en cadena (combos por gravedad tras eliminar) es más compleja que las líneas de Tetris. Riesgo de parecer "Tetris con colores" si no se comunica bien la diferencia; mitigable con sistema de combos y efectos de cadena llamativos.
- **Notas**: Nostalgia alta. Veredicto: recomendado. Mejor relación valor/esfuerzo en PUZZLE (reusa infra de Tetris).

## DR. MARIO — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: PUZZLE
- **Factibilidad**: media
- **Justificación**: Icónico de Nintendo con apellido reconocible. Cápsulas bicolor que caen sobre un frasco con virus; eliminas alineando 4+ del mismo color. Aporta variedad real frente a Tetris: objetivo de "limpieza" (eliminar todos los virus) en vez de supervivencia infinita, dando progresión por niveles natural. Grid + gravedad reaprovechables. Paleta de 3 colores (rojo/azul/amarillo) traduce muy bien a neon.
- **Riesgos**: Mecánica de cápsula partida (cuando media cápsula queda flotando tras eliminar la otra mitad, debe caer de forma independiente) añade lógica de gravedad por celda no trivial. Generación/colocación de virus por nivel y condición de victoria requieren sistema de niveles. Complejidad media.
- **Notas**: Nostalgia alta. Veredicto: recomendado.

## PUZZLE BOBBLE — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: PUZZLE
- **Factibilidad**: media
- **Justificación**: Clásico de Taito (Bust-a-Move) muy querido y vistoso. Disparas burbujas de colores con un cañón apuntable; al juntar 3+ del mismo color caen, junto con las que quedan colgando sin soporte. Introduce input de apuntado (mouse/teclado) y un tablero hexagonal, diferenciándose del resto del catálogo. Burbujas con glow neon encajan perfecto. Muy adictivo y reconocible.
- **Riesgos**: Grid hexagonal con offset por filas más colisión de proyectil (rebote en paredes y snap a la celda más cercana) es la parte técnica más exigente. Algoritmo flood-fill para matches y un segundo pase de "burbujas huérfanas" que caen. Complejidad media-alta, la mayor del lote PUZZLE.
- **Notas**: Nostalgia alta. Veredicto: recomendado.

## BEJEWELED — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: PUZZLE
- **Factibilidad**: alta
- **Justificación**: Pionero del match-3, base de un género enorme y muy reconocible. Intercambias gemas adyacentes para alinear 3+; las eliminadas caen y se rellenan desde arriba generando cascadas. Sin gravedad de "pieza que cae" ni timing de reflejos: puzzle puro basado en input de mouse (swap por click/drag), aportando un ritmo distinto al catálogo dominado por reflejos. Tablero estático sencillo de renderizar, gemas con glow neon. Factibilidad alta sobre canvas 2D.
- **Riesgos**: Detección de matches, cascadas en cadena y garantizar que siempre exista al menos un movimiento válido (o detectar deadlock y rebarajar) requieren cuidado. Sin presión temporal puede sentirse menos "arcade"; mitigable con un modo contrarreloj para encajar en el sistema de scores.
- **Notas**: Nostalgia media. Veredicto: recomendado. Abre el subgénero match-3 con input de mouse.

## LUMINES — sugerido 2026-06-25

- **Estado**: pendiente
- **Categoría**: PUZZLE
- **Factibilidad**: media
- **Justificación**: Puzzle rítmico de bloques 2x2 (de Tetsuya Mizuguchi) donde formas cuadrados 2x2 de un mismo color y una "línea de tiempo" que barre la pantalla los elimina al compás. Su identidad audiovisual sincronizada con la música es un calce excepcional con la estética neon-pixel y una experiencia premium difícil de replicar. Reaprovecha grid y gravedad tipo Tetris.
- **Riesgos**: La mecánica de la barra de tiempo (timeline sweep) que elimina periódicamente todos los cuadrados marcados es única y debe implementarse con cuidado para sentirse satisfactoria. El factor musical/rítmico es central pero la plataforma trata el sonido como opcional: sin audio pierde gran parte de su gracia. Nostalgia media. Complejidad media.
- **Notas**: Nostalgia media. Veredicto: condicional.
