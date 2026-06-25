"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";
import { useGames } from "@/app/components/GamesProvider";
import { createClient } from "@/lib/supabase/client";

type Row = { name: string; score: number; date: string };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function HallOfFame() {
  const router = useRouter();
  const { user } = useAuth();
  const GAMES = useGames();
  const [tab, setTab] = useState(GAMES[0]?.id ?? "");
  const [cache, setCache] = useState<Record<string, Row[]>>({});

  useEffect(() => {
    if (!tab || cache[tab]) return;
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("scores")
        .select("player_name, score, created_at")
        .eq("game_id", tab)
        .order("score", { ascending: false })
        .limit(12);
      if (!active) return;
      const rows: Row[] = (data ?? []).map((r) => ({
        name: r.player_name,
        score: r.score,
        date: formatDate(r.created_at),
      }));
      setCache((c) => ({ ...c, [tab]: rows }));
    })();
    return () => {
      active = false;
    };
  }, [tab, cache]);

  const game = GAMES.find((g) => g.id === tab);
  const rows = cache[tab] ?? [];
  const ready = !!tab && cache[tab] !== undefined;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {!ready && (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--ink-faint)",
            letterSpacing: "0.12em",
          }}
        >
          CARGANDO MARCAS…
        </div>
      )}

      {ready && rows.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--ink-faint)",
          }}
        >
          <div
            className="pixel"
            style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
          >
            AÚN NO HAY MARCAS
          </div>
          <div>Sé el primero en dejar tu nombre en {game?.title}.</div>
        </div>
      )}

      {ready && rows.length > 0 && (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].name}</div>
                <div className="score">
                  {rows[1].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[1].date}</div>
              </div>
            )}
            <div className="podium-slot gold">
              <div
                className="pixel"
                style={{
                  fontSize: 9,
                  color: "var(--gold)",
                  letterSpacing: "0.18em",
                }}
              >
                CAMPEÓN
              </div>
              <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
                01
              </div>
              <div className="name">{rows[0].name}</div>
              <div className="score" style={{ fontSize: 20 }}>
                {rows[0].score.toLocaleString("es-ES")}
              </div>
              <div className="date">{rows[0].date}</div>
            </div>
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].name}</div>
                <div className="score">
                  {rows[2].score.toLocaleString("es-ES")}
                </div>
                <div className="date">{rows[2].date}</div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.name + i}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">{r.date}</div>
              </div>
            ))}
            {user && game && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    #{String(Math.floor(8 + (tab.length % 4))).padStart(2, "0")}
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {user.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {((rows[5]?.score ?? 0) - 2400 || 9999).toLocaleString(
                      "es-ES",
                    )}
                  </div>
                  <div className="dt">11/05/2026</div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button className="btn lg" onClick={() => router.push("/juego")}>
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  );
}
