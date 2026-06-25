import type { Metadata } from "next";
import {
  Press_Start_2P,
  JetBrains_Mono,
  Courier_Prime,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./components/AuthProvider";
import { GamesProvider } from "./components/GamesProvider";
import Nav from "./components/Nav";
import { createClient } from "@/lib/supabase/server";
import type { Game, GameColor } from "@/lib/data";

// Lee el catálogo desde la tabla `games` (ordenado por `position`) y lo mapea al
// tipo `Game`. Si la lectura falla (BD caída, env mal), degrada a lista vacía en
// vez de tumbar toda la app.
async function loadGames(): Promise<Game[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("games")
      .select("id, title, short, long, cat, cover, color, best, plays")
      .order("position", { ascending: true });
    if (error || !data) return [];
    return data.map((g) => ({ ...g, color: g.color as GameColor }));
  } catch {
    return [];
  }
}

// Pixel display font (only ships weight 400)
const pressStart = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

// Primary monospace UI font (variable font)
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-jb",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

// Monospace fallback used in the original stylesheet
const courierPrime = Courier_Prime({
  variable: "--font-courier",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arcade Vault",
  description: "Online gaming platform to compete for points",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const games = await loadGames();

  return (
    <html
      lang="es"
      className={`${pressStart.variable} ${jetbrainsMono.variable} ${courierPrime.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="av-bg"></div>
        <div className="av-noise"></div>
        <AuthProvider>
          <GamesProvider games={games}>
            <Nav />
            <main className="av-main">{children}</main>
            <footer
              style={{
                borderTop: "1px solid var(--line)",
                padding: "20px 32px",
                textAlign: "center",
                color: "var(--ink-faint)",
                fontFamily: "var(--mono)",
                fontSize: 11,
                letterSpacing: "0.16em",
              }}
            >
              © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN · v2.6.0
            </footer>
          </GamesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
