"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";

export type User = { name: string } | null;

export type ScoreEntry = {
  game: string;
  score: number;
  name: string;
};

type AuthContextValue = {
  user: User;
  login: (user: { name: string }) => void;
  signOut: () => void;
  saveScore: (entry: ScoreEntry) => Promise<void>;
};

const USER_KEY = "av_user";

// Store de sesión sobre localStorage. Snapshot cacheado para devolver la misma
// referencia mientras el valor crudo no cambie (evita bucles de re-render en
// useSyncExternalStore). El snapshot de servidor es null, por lo que el primer
// render cliente coincide con el SSR y no hay desajuste de hidratación.
let cachedRaw: string | null = null;
let cachedUser: User = null;
const listeners = new Set<() => void>();

function readUser(): User {
  const raw =
    typeof localStorage !== "undefined" ? localStorage.getItem(USER_KEY) : null;
  if (raw === cachedRaw) return cachedUser;
  cachedRaw = raw;
  try {
    cachedUser = JSON.parse(raw || "null");
  } catch {
    cachedUser = null;
  }
  return cachedUser;
}

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // Sincroniza entre pestañas.
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): User {
  return readUser();
}

function getServerSnapshot(): User {
  return null;
}

function writeUser(u: User) {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch {}
  emit();
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = (u: { name: string }) => writeUser(u);
  const signOut = () => writeUser(null);

  const saveScore = async (entry: ScoreEntry) => {
    try {
      const supabase = createClient();
      await supabase.from("scores").insert({
        game_id: entry.game,
        player_name: entry.name,
        score: entry.score,
      });
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, login, signOut, saveScore }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
