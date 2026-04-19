"use client";

import { useEffect, useState } from "react";
import BingoPrintPanel from "./BingoPrintPanel";

type GameStatus = "waiting" | "started" | "ended";

interface BingoGame {
  status: GameStatus;
  startedAt?: string;
  endedAt?: string;
  winnerCodigo?: string;
  winnerNames?: string[];
}

interface BingoSubmission {
  codigo: string;
  names: string[];
  submittedAt: string;
  photoKeys: string[];
}

interface GameData {
  game: BingoGame;
  submissions: BingoSubmission[];
}

const STATUS_LABELS: Record<GameStatus, string> = {
  waiting: "Sin iniciar",
  started: "En curso",
  ended: "Finalizado",
};

const STATUS_COLORS: Record<GameStatus, string> = {
  waiting: "bg-gray-100 text-gray-600",
  started: "bg-green-100 text-green-700",
  ended: "bg-[#f5ede0] text-[#8a6d3b]",
};

export default function BingoPanel() {
  const [data, setData] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      const res = await fetch("/api/admin/bingo/game");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      setError("Error al cargar el estado del juego");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 10000);
    return () => clearInterval(id);
  }, []);

  async function sendAction(action: "start" | "end" | "reset") {
    setActing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/bingo/game", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message ?? "Error");
      }
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al ejecutar la acción");
    } finally {
      setActing(false);
    }
  }

  const game = data?.game;
  const submissions = data?.submissions ?? [];

  return (
    <div className="space-y-6">
      {/* Game control section */}
      <div className="bg-[#fffdf7] border border-[#e8d9c0] rounded-xl p-5 space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="font-serif text-xl text-[#5c4a2e]">Control del juego</h2>
          {game && (
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[game.status]}`}>
              {STATUS_LABELS[game.status]}
            </span>
          )}
        </div>

        {loading && <p className="text-sm text-gray-400">Cargando...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {game && (
          <div className="flex flex-wrap gap-3">
            {game.status === "waiting" && (
              <button
                onClick={() => sendAction("start")}
                disabled={acting}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {acting ? "..." : "Iniciar juego"}
              </button>
            )}
            {game.status === "started" && (
              <button
                onClick={() => {
                  if (!confirm("¿Terminar el juego ahora? Se determinará el ganador automáticamente.")) return;
                  sendAction("end");
                }}
                disabled={acting}
                className="px-5 py-2 bg-[#bf953f] hover:bg-[#aa771c] text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {acting ? "..." : "Terminar juego"}
              </button>
            )}
            {game.status === "ended" && (
              <button
                onClick={() => {
                  if (!confirm("¿Reiniciar el juego? Se borrará el estado pero no las fotos.")) return;
                  sendAction("reset");
                }}
                disabled={acting}
                className="px-5 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {acting ? "..." : "Reiniciar juego"}
              </button>
            )}
          </div>
        )}

        {/* Winner banner */}
        {game?.status === "ended" && (
          <div className="bg-[#fdf5e8] border border-[#d4af37] rounded-xl px-5 py-4">
            {game.winnerNames && game.winnerNames.length > 0 ? (
              <>
                <p className="text-xs text-[#8a6d3b] mb-1">🏆 Ganador/a del bingo</p>
                <p className="font-serif text-xl text-[#d4af37] font-bold">
                  {game.winnerNames.join(" & ")}
                </p>
                <p className="text-xs text-gray-400 mt-1">Código: {game.winnerCodigo}</p>
              </>
            ) : (
              <p className="text-sm text-[#8a6d3b]">Nadie completó el bingo en este juego.</p>
            )}
          </div>
        )}

        {/* Submissions */}
        <div>
          <p className="text-sm font-medium text-[#5c4a2e] mb-3">
            Envíos recibidos ({submissions.length})
          </p>
          {submissions.length === 0 ? (
            <p className="text-sm text-gray-400">Aún no hay envíos.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((sub, i) => {
                const isWinner = game?.status === "ended" && sub.codigo === game.winnerCodigo;
                return (
                  <div
                    key={sub.codigo}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm ${
                      isWinner
                        ? "bg-[#fdf5e8] border border-[#d4af37]"
                        : "bg-white border border-gray-100"
                    }`}
                  >
                    <div>
                      <span className="font-medium text-[#5c4a2e]">
                        {i === 0 && game?.status !== "waiting" && "🥇 "}
                        {sub.names.join(" & ")}
                      </span>
                      <span className="ml-2 text-xs text-gray-400 font-mono">{sub.codigo}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {new Date(sub.submittedAt).toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-gray-300">{sub.photoKeys.length} fotos</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Print panel */}
      <div className="bg-[#fffdf7] border border-[#e8d9c0] rounded-xl p-5">
        <BingoPrintPanel />
      </div>
    </div>
  );
}
