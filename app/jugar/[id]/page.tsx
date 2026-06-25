"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { type Game } from "@/lib/data";
import { useGames } from "@/app/components/GamesProvider";
import MockPlayer from "./MockPlayer";
import AsteroidsPlayer from "./AsteroidsPlayer";
import TetrisPlayer from "./TetrisPlayer";
import ArkanoidPlayer from "./ArkanoidPlayer";
import SnakePlayer from "./SnakePlayer";

// Registry id → reproductor real. Cualquier id no mapeado cae al MockPlayer.
// Añadir un juego real es una sola entrada aquí.
const PLAYERS: Record<string, (props: { game: Game }) => React.ReactElement> = {
  asteroides: AsteroidsPlayer,
  tetris: TetrisPlayer,
  arkanoid: ArkanoidPlayer,
  snake: SnakePlayer,
};

export default function GamePlayer({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const GAMES = useGames();
  const game = GAMES.find((g) => g.id === id);

  if (!game) notFound();

  const Player = PLAYERS[game.id] ?? MockPlayer;
  return <Player game={game} />;
}
