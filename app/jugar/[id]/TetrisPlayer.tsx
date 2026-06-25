"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/data";
import { useAuth } from "@/app/components/AuthProvider";
import { createTetrisGame, type TetrisGame } from "@/lib/games/tetris";

export default function TetrisPlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useAuth();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TetrisGame | null>(null);

  // El canvas es la fuente de verdad: estos estados sólo reflejan sus callbacks.
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [editedName, setEditedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const name = editedName ?? user?.name ?? "INVITADO";

  // Instancia el motor en el cliente; lo detiene (loop + listeners) al desmontar.
  useEffect(() => {
    const canvas = canvasRef.current;
    const nextCanvas = nextCanvasRef.current;
    if (!canvas || !nextCanvas) return;

    const engine = createTetrisGame(canvas, nextCanvas, {
      onScore: setScore,
      onLines: setLines,
      onLevel: setLevel,
      onGameOver: (finalScore) => {
        setScore(finalScore);
        setOver(true);
      },
      // Cubre el restart() interno: cierra el modal y resetea el estado React.
      onPlaying: () => {
        setOver(false);
        setSaved(false);
        setPaused(false);
      },
    });
    gameRef.current = engine;
    engine.start();
    // El canvas capta el teclado al montar (los flechazos no scrollean).
    canvas.focus();

    return () => {
      engine.stop();
      gameRef.current = null;
    };
  }, []);

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
        <div
          style={{
            display: "flex",
            gap: 24,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
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
          <div className="hud-stat">
            <div className="l">Líneas</div>
            <div className="v">{lines}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          <div className="hud-stat next">
            <div className="l">Siguiente</div>
            <canvas
              ref={nextCanvasRef}
              className="next-canvas"
              aria-label={`${game.title} — pieza siguiente`}
            />
          </div>
        </div>
        <div className="hud-actions">
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
