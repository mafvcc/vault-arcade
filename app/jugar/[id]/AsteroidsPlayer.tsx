"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game, SkinId } from "@/lib/data";
import { useAuth } from "@/app/components/AuthProvider";
import { createAsteroidsGame, type AsteroidsGame } from "@/lib/games/asteroids";

const SKIN_OPTIONS: { id: SkinId; label: string }[] = [
  { id: "clasico", label: "CLÁSICO" },
  { id: "neon", label: "NEÓN" },
  { id: "retro", label: "RETRO" },
];

export default function AsteroidsPlayer({
  game,
  skin: initialSkin = "clasico",
}: {
  game: Game;
  skin?: SkinId;
}) {
  const router = useRouter();
  const { user, saveScore } = useAuth();

  const [skin, setSkin] = useState<SkinId>(initialSkin);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<AsteroidsGame | null>(null);

  // El canvas es la fuente de verdad: estos estados sólo reflejan sus callbacks.
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [editedName, setEditedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const name = editedName ?? user?.name ?? "INVITADO";

  // Instancia el motor en el cliente; lo detiene (loop + listeners) al desmontar.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createAsteroidsGame(
      canvas,
      {
        onScore: setScore,
        onLives: setLives,
        onLevel: setLevel,
        onGameOver: (finalScore) => {
          setScore(finalScore);
          setOver(true);
        },
        // Cubre el reinicio con ESPACIO dentro del canvas: cierra el modal
        // y resetea el estado React de fin de juego.
        onPlaying: () => {
          setOver(false);
          setSaved(false);
          setPaused(false);
        },
      },
      { skin },
    );
    gameRef.current = engine;
    engine.start();
    // El contenedor capta el teclado al montar (los flechazos no scrollean).
    canvas.focus();

    return () => {
      engine.stop();
      gameRef.current = null;
    };
    // El motor se crea una sola vez; el skin se cambia en caliente (efecto aparte).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambia la paleta del motor sin reiniciar la partida.
  useEffect(() => {
    gameRef.current?.setSkin(skin);
  }, [skin]);

  const togglePause = () => {
    const engine = gameRef.current;
    if (!engine) return;
    if (paused) {
      engine.resume();
      setPaused(false);
    } else {
      engine.pause();
      setPaused(true);
    }
  };

  // FIN: congela el motor y abre el modal con el score actual.
  const endGame = () => {
    gameRef.current?.pause();
    setPaused(false);
    setOver(true);
  };

  // JUGAR DE NUEVO: reinicia el motor y resetea el estado React.
  const restartGame = () => {
    gameRef.current?.restart();
    setOver(false);
    setSaved(false);
    setPaused(false);
  };

  return (
    <div className="av-player av-player--canvas fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <div className="skin-picker" role="group" aria-label="Skin">
            <span className="l">Skin</span>
            {SKIN_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className={`btn ghost${skin === opt.id ? " active" : ""}`}
                aria-pressed={skin === opt.id}
                onClick={() => setSkin(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          <canvas
            ref={canvasRef}
            className="game-canvas"
            tabIndex={0}
            aria-label={`${game.title} — área de juego`}
          />
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setEditedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    saveScore({ game: game.id, score, name });
                    setSaved(true);
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restartGame}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/juego")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
