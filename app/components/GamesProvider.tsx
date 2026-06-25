"use client";

import { createContext, useContext } from "react";
import type { Game } from "@/lib/data";

// Catálogo de juegos leído en el servidor (desde la tabla `games`) y propagado
// al árbol cliente. Los consumidores usan `useGames()` en vez de importar un
// array estático.
const GamesContext = createContext<Game[] | null>(null);

export function GamesProvider({
  games,
  children,
}: {
  games: Game[];
  children: React.ReactNode;
}) {
  return (
    <GamesContext.Provider value={games}>{children}</GamesContext.Provider>
  );
}

export function useGames(): Game[] {
  const ctx = useContext(GamesContext);
  if (ctx === null)
    throw new Error("useGames debe usarse dentro de <GamesProvider>");
  return ctx;
}
