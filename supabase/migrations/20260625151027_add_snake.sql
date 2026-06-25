-- SPEC 10 — Snake jugable. Inserta la fila del catálogo para el juego "snake".
-- No crea tablas ni políticas (ya existen por SPEC 07); no reordena posiciones existentes.
insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values (
  'snake',
  'SNAKE',
  'Crece comiendo fruta sin morderte la cola.',
  'El clásico de la serpiente: guíala por la grilla para comer fruta y crecer. Cada bocado suma puntos y un segmento más, pero también más cola que esquivar. Chocar contra una pared o contra ti misma termina la partida. ¿Hasta qué largo llegás?',
  'ARCADE',
  'cover-snake',
  'green',
  9600,
  '0',
  11
);
