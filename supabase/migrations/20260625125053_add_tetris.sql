-- SPEC 08 — Tetris jugable: alta de la fila en el catálogo (games)

insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values (
  'tetris',
  'TETRIS',
  'Encaja las piezas que caen y completa líneas.',
  'El clásico de bloques que caen: rota y desliza tetrominós (y alguna tuerca traviesa) para completar líneas antes de que la pila toque el techo. Cada 10 líneas sube el nivel y las piezas caen más rápido. Usa el descenso fantasma para colocar con precisión.',
  'PUZZLE',
  'cover-tetris',
  'magenta',
  42800,
  '0',
  9
);
