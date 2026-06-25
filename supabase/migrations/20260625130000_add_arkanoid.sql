-- SPEC 09 — Arkanoid jugable: alta de la fila en el catálogo (games)

insert into public.games (id, title, short, long, cat, cover, color, best, plays, position)
values (
  'arkanoid',
  'ARKANOID',
  'Rompe todos los ladrillos rebotando la pelota con tu paleta.',
  'El clásico breakout: mueve la paleta con el mouse o las flechas y rebota la pelota para destruir la pared de ladrillos. Cinco niveles con velocidad creciente y diseños cada vez más traicioneros; pierdes una de tus 3 vidas cada vez que la pelota cae. Limpia el último nivel para completar el juego.',
  'ARCADE',
  'cover-arkanoid',
  'magenta',
  18900,
  '0',
  10
);
