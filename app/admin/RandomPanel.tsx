"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface User {
  nombre: string;
  codigo: string;
  estado: string;
}

// ── Confetti ───────────────────────────────────────────────────────────────────

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  color: string;
  w: number;
  h: number;
  rotation: number;
  rotSpeed: number;
  shape: "rect" | "circle" | "ribbon";
}

const CONFETTI_COLORS = [
  "#d4af37", "#fcf6ba", "#bf953f",
  "#ff6b6b", "#ffd43b", "#69db7c",
  "#74c0fc", "#da77f2", "#ff8787",
  "#63e6be", "#f783ac", "#ff922b",
];

function mkParticle(canvasW: number): Particle {
  return {
    x: Math.random() * canvasW,
    y: -14,
    vx: (Math.random() - 0.5) * 6,
    vy: Math.random() * 4 + 2,
    gravity: Math.random() * 0.12 + 0.08,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    w: Math.random() * 10 + 5,
    h: Math.random() * 6 + 3,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.18,
    shape: (["rect", "circle", "ribbon"] as Particle["shape"][])[
      Math.floor(Math.random() * 3)
    ],
  };
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rotation);
  ctx.fillStyle = p.color;
  if (p.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.shape === "ribbon") {
    ctx.fillRect(-p.w / 2, -p.h / 4, p.w, p.h / 2);
  } else {
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
  }
  ctx.restore();
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RandomPanel() {
  const [allNames, setAllNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const dropRef = useRef<HTMLDivElement>(null);
  // Track latest saved state to avoid redundant writes
  const savedRef = useRef<string>("[]");

  // ── Load guests + saved participants ────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/random").then((r) => r.json()),
    ]).then(([usersData, randomData]) => {
      const names: string[] = (usersData.users ?? [])
        .filter((u: User) => u.estado === "confirmado")
        .map((u: User) => u.nombre)
        .filter(Boolean)
        .sort((a: string, b: string) => a.localeCompare(b));
      setAllNames(names);

      const saved: string[] = randomData.participants ?? [];
      setParticipants(saved);
      savedRef.current = JSON.stringify(saved);

      setLoading(false);
    });
  }, []);

  // ── Persist participants on every change ─────────────────────────────────────
  const persistParticipants = useCallback(async (list: string[]) => {
    const json = JSON.stringify(list);
    if (json === savedRef.current) return; // nothing changed
    savedRef.current = json;
    setSaving(true);
    try {
      await fetch("/api/admin/random", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: list }),
      });
    } finally {
      setSaving(false);
    }
  }, []);

  // ── Confetti loop ────────────────────────────────────────────────────────────
  const stopConfetti = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    particlesRef.current = [];
  }, []);

  const startConfetti = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    // Size canvas to its CSS layout size
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = canvas.offsetHeight || 400;
    particlesRef.current = [];

    // Capture dimensions into locals so the closure is always non-null
    const cw = canvas.width;
    const ch = canvas.height;
    let tick = 0;

    function loop() {
      ctx.clearRect(0, 0, cw, ch);

      // Spawn a burst every 2 frames
      tick++;
      if (tick % 2 === 0) {
        for (let i = 0; i < 4; i++) {
          particlesRef.current.push(mkParticle(cw));
        }
      }

      // Update & draw, cull off-screen
      particlesRef.current = particlesRef.current.filter(
        (p) => p.y < ch + 20
      );
      for (const p of particlesRef.current) {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        drawParticle(ctx, p);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    loop();
  }, []);

  useEffect(() => {
    if (winner) {
      // Small delay so the canvas is mounted in the DOM first
      const t = setTimeout(startConfetti, 50);
      return () => { clearTimeout(t); stopConfetti(); };
    } else {
      stopConfetti();
    }
  }, [winner, startConfetti, stopConfetti]);

  // ── Close dropdown on outside click ─────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const filtered = allNames.filter(
    (n) =>
      !participants.includes(n) &&
      n.toLowerCase().includes(query.toLowerCase())
  );

  function add(name: string) {
    const next = [...participants, name];
    setParticipants(next);
    persistParticipants(next);
    setQuery("");
    setDropOpen(false);
  }

  function remove(name: string) {
    const next = participants.filter((p) => p !== name);
    setParticipants(next);
    persistParticipants(next);
  }

  function clearAll() {
    setParticipants([]);
    persistParticipants([]);
  }

  function pickWinner() {
    if (participants.length < 1) return;
    const idx = Math.floor(Math.random() * participants.length);
    setWinner(null); // reset first so confetti restarts on re-launch
    setTimeout(() => setWinner(participants[idx]), 10);
  }

  function resetAll() {
    setWinner(null);
    setParticipants([]);
    persistParticipants([]);
    setQuery("");
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return <p className="text-center text-gray-400 py-10">Cargando invitados…</p>;
  }

  return (
    <div className="space-y-6">
      {winner ? (
        /* ── Winner screen ──────────────────────────────────────────────────── */
        <div className="relative rounded-2xl overflow-hidden border-2 border-[#d4af37] bg-gradient-to-br from-[#fdfaf6] to-[#f5ede0] min-h-[420px] flex flex-col items-center justify-center p-8 text-center select-none">
          {/* Confetti canvas — pointer-events:none so it doesn't block buttons */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          <div className="relative z-10 flex flex-col items-center gap-5">
            <p className="font-serif text-[#8a6d3b] text-lg tracking-wide">
              ✨ ¡El elegido es…! ✨
            </p>

            {/* Winner name — scales with viewport */}
            <p
              className="font-serif font-bold text-[#5c4a2e] break-words max-w-lg leading-tight"
              style={{ fontSize: "clamp(2.2rem, 7vw, 4.5rem)" }}
            >
              {winner}
            </p>

            <div className="flex gap-3 mt-2 flex-wrap justify-center">
              <button
                onClick={pickWinner}
                className="px-6 py-2.5 bg-[#bf953f] text-white font-medium rounded-xl hover:bg-[#aa771c] transition shadow-md"
              >
                Relanzar
              </button>
              <button
                onClick={resetAll}
                className="px-6 py-2.5 border-2 border-[#d4af37] text-[#8a6d3b] font-medium rounded-xl hover:bg-[#fdf5e8] transition"
              >
                Empezar de nuevo
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ── Selection screen ───────────────────────────────────────────────── */
        <>
          <div className="bg-white rounded-xl shadow p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-serif text-lg text-[#5c4a2e]">
                  Participantes
                  {participants.length > 0 && (
                    <span className="ml-2 text-sm font-sans font-normal text-gray-400">
                      ({participants.length})
                    </span>
                  )}
                </h3>
                {saving && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    Guardando…
                  </span>
                )}
              </div>
              {participants.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-gray-400 hover:text-red-400 transition"
                >
                  Limpiar todo
                </button>
              )}
            </div>

            {/* Search + dropdown */}
            <div ref={dropRef} className="relative">
              <input
                type="text"
                placeholder="Buscar invitado para agregar…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#bf953f]"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setDropOpen(true);
                }}
                onFocus={() => setDropOpen(true)}
              />

              {dropOpen && filtered.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  {filtered.slice(0, 40).map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm text-[#5c4a2e] hover:bg-[#fdf5e8] transition"
                        onMouseDown={(e) => e.preventDefault()} // keep focus on input
                        onClick={() => add(name)}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                  {filtered.length > 40 && (
                    <li className="px-4 py-2 text-xs text-gray-400 border-t">
                      + {filtered.length - 40} más — seguí escribiendo para filtrar
                    </li>
                  )}
                </ul>
              )}

              {dropOpen && filtered.length === 0 && query.trim() && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
                  Sin resultados para &ldquo;{query}&rdquo;
                </div>
              )}
            </div>

            {/* Chips */}
            {participants.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {participants.map((name) => (
                  <span
                    key={name}
                    className="flex items-center gap-1.5 bg-[#f5ede0] text-[#5c4a2e] text-sm px-3 py-1.5 rounded-full"
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => remove(name)}
                      className="text-[#8a6d3b] hover:text-red-400 transition leading-none ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Agrega al menos dos personas para sortear.
              </p>
            )}
          </div>

          {/* Launch button */}
          <button
            onClick={pickWinner}
            disabled={participants.length < 2}
            className="w-full py-4 bg-[#bf953f] text-white font-serif text-xl rounded-xl hover:bg-[#aa771c] active:scale-95 transition disabled:opacity-40 shadow-md"
          >
            ¡Elegir al azar!
          </button>
        </>
      )}
    </div>
  );
}
