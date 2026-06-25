// ===== lib/data.ts — tipos y constantes compartidas del catálogo =====
// El catálogo de juegos vive ahora en la tabla `games` de Supabase (sembrada en
// la migración 20260625001759_games_scores). Se lee en el servidor y se propaga
// vía <GamesProvider> / useGames(). Aquí solo quedan el tipo `Game` y la lista
// estática de categorías de filtro.

export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type SkinId = "neon" | "retro" | "clasico";

export type Game = {
  id: string; // slug, p.ej. "bloque-buster"
  title: string;
  short: string; // descripción corta (card)
  long: string; // descripción larga (detalle)
  cat: string; // "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS"
  cover: string; // clase CSS de portada, p.ej. "cover-bricks"
  color: GameColor; // color del botón JUGAR
  best: number; // mejor puntuación
  plays: string; // partidas, p.ej. "12.4K"
};

export const CATS: string[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];
