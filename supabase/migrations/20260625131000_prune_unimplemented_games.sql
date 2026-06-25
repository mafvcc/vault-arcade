-- Catálogo: dejar solo los juegos realmente implementados (asteroides, tetris,
-- arkanoid). Se eliminan del catálogo los slots mock que nunca se implementaron.
-- Ninguno de ellos tiene filas en `scores`, así que no hay FK que romper.

delete from public.games
where id not in ('asteroides', 'tetris', 'arkanoid');
