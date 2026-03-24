"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSavedCode } from "@/lib/localCode";
import Loader from "../components/Loader";

interface Cell {
  position: number;
  targetCodigo: string;
  targetNames: string[];
  completedAt: string | null;
  mediaKey: string | null;
  mediaUrl: string | null;
}

interface Card {
  codigo: string;
  cells: Cell[];
  createdAt: string;
  completedAt: string | null;
}

interface BingoSettings {
  cols: number;
  enabled: boolean;
}

// ── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({
  cell,
  codigo,
  onClose,
  onDone,
}: {
  cell: Cell;
  codigo: string;
  onClose: () => void;
  onDone: (updatedCard: Card) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setError("");
    const url = URL.createObjectURL(f);
    setPreview(url);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError("");

    try {
      // 1. Get presigned URL
      const presignRes = await fetch("/api/bingo/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          position: cell.position,
          fileName: file.name,
          contentType: file.type,
        }),
      });
      if (!presignRes.ok) {
        const d = await presignRes.json();
        throw new Error(d.message || "Error al preparar la subida");
      }
      const { url, key } = await presignRes.json();

      // 2. Upload directly to S3
      const s3Res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!s3Res.ok) throw new Error("Error al subir el archivo");

      // 3. Confirm completion
      const confirmRes = await fetch("/api/bingo/complete-cell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, position: cell.position, key, size: file.size }),
      });
      if (!confirmRes.ok) {
        const d = await confirmRes.json();
        throw new Error(d.message || "Error al confirmar");
      }
      const { card: updated } = await confirmRes.json();
      onDone(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-xl leading-none"
        >
          ✕
        </button>

        <h3 className="font-semibold text-lg text-[#5c4a2e] mb-1">
          Foto con {cell.targetNames.join(" y ")}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Sube una foto junto a esta persona.
        </p>

        {!preview ? (
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full border-2 border-dashed border-[#d4af37] rounded-lg p-8 text-center text-[#8a6d3b] hover:bg-amber-50 transition"
          >
            <div className="text-3xl mb-2">📷</div>
            <div className="text-sm font-medium">Seleccionar foto</div>
          </button>
        ) : (
          <div className="relative mb-4">
            {file?.type.startsWith("video/") ? (
              <video src={preview} controls className="w-full rounded-lg max-h-48 object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="w-full rounded-lg max-h-48 object-cover" />
            )}
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              className="absolute top-2 right-2 bg-white/80 rounded-full w-6 h-6 text-xs text-gray-600 hover:bg-white"
            >
              ✕
            </button>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full py-3 bg-[#8a6d3b] text-white font-bold rounded-lg disabled:opacity-50"
          >
            {uploading ? "Subiendo..." : "Confirmar"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Bingo grid ────────────────────────────────────────────────────────────────

function BingoGrid({
  card,
  cols,
  codigo,
  onCellClick,
  onCardUpdate,
}: {
  card: Card;
  cols: number;
  codigo: string;
  onCellClick: (cell: Cell) => void;
  onCardUpdate: (card: Card) => void;
}) {
  const [deleting, setDeleting] = useState<number | null>(null);
  const sorted = [...card.cells].sort((a, b) => a.position - b.position);

  async function handleDelete(cell: Cell, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`¿Borrar la foto de "${cell.targetNames.join(" y ")}"?`)) return;
    setDeleting(cell.position);
    try {
      const res = await fetch("/api/bingo/delete-cell", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, position: cell.position }),
      });
      if (!res.ok) throw new Error();
      // Reload card from server to get updated state
      const cardRes = await fetch(`/api/bingo/card?codigo=${encodeURIComponent(codigo)}`);
      if (cardRes.ok) {
        const data = await cardRes.json();
        if (data.card) onCardUpdate(data.card);
      }
    } catch {
      alert("No se pudo borrar la foto");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {sorted.map((cell) => {
        const done = cell.completedAt !== null;
        return (
          <div
            key={cell.position}
            onClick={() => !done && onCellClick(cell)}
            className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-center p-2 border-2 transition-all duration-200 ${
              done
                ? "border-[#d4af37] bg-[#d4af37]/10"
                : "border-[#e8d9c0] bg-white hover:border-[#d4af37] hover:shadow-md active:scale-95 cursor-pointer"
            }`}
          >
            {done && cell.mediaUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cell.mediaUrl}
                  alt="bingo"
                  className="absolute inset-0 w-full h-full object-cover rounded-[10px]"
                />
                <div className="absolute inset-0 bg-black/30 rounded-[10px]" />
              </>
            )}
            <div className="relative z-10">
              {done ? (
                <div className="text-2xl">✓</div>
              ) : (
                <div className="text-[11px] leading-tight text-[#5c4a2e] font-medium">
                  {cell.targetNames.join("\n")}
                </div>
              )}
              {done && (
                <div className="text-[10px] text-white/90 mt-1 font-medium">
                  {cell.targetNames[0]}
                </div>
              )}
            </div>

            {done && (
              <button
                onClick={(e) => handleDelete(cell, e)}
                disabled={deleting === cell.position}
                className="absolute top-1 right-1 z-20 w-5 h-5 rounded-full bg-black/50 text-white text-[10px] flex items-center justify-center hover:bg-red-500 transition disabled:opacity-50"
                title="Borrar foto"
              >
                {deleting === cell.position ? "…" : "✕"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────

function BingoContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code")?.toUpperCase() || "";

  const [codigo, setCodigo] = useState(codeFromUrl);
  const [codigoInput, setCodigoInput] = useState(codeFromUrl);
  const [step, setStep] = useState<"codigo" | "bingo">(codeFromUrl ? "bingo" : "codigo");
  const [card, setCard] = useState<Card | null>(null);
  const [settings, setSettings] = useState<BingoSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCell, setSelectedCell] = useState<Cell | null>(null);
  const [showWin, setShowWin] = useState(false);

  async function loadCard(code: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/bingo/card?codigo=${encodeURIComponent(code)}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Error al cargar el cartón");
      }
      const data = await res.json();
      setSettings(data.settings);

      if (!data.settings.enabled) {
        setError("El bingo aún no está disponible.");
        return;
      }
      if (!data.card) {
        setError("Todavía no se generaron los cartones. Espera a que el admin los cree.");
        return;
      }
      setCard(data.card);
      setStep("bingo");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const code = codeFromUrl || getSavedCode();
    if (code) {
      setCodigo(code);
      setCodigoInput(code);
      loadCard(code);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCellDone(updatedCard: Card) {
    setSelectedCell(null);
    // Re-fetch the enriched card so targetNames are populated
    const res = await fetch(`/api/bingo/card?codigo=${encodeURIComponent(codigo)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.card) setCard(data.card);
    }
    if (updatedCard.completedAt) setShowWin(true);
  }

  const completedCells = card ? card.cells.filter((c) => c.completedAt !== null).length : 0;
  const totalCells = card ? card.cells.length : 0;

  if (loading) return <Loader />;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={{ backgroundImage: "url(/assets/fondo-desktop.webp)" }}
    >
      <div
        className="fixed inset-0 bg-cover bg-center md:hidden"
        style={{ backgroundImage: "url(/assets/fondo-movil.webp)" }}
      />

      <div className="relative z-10 w-full max-w-lg">
        {step === "codigo" && (
          <div className="bg-white/95 p-6 border-8 [border-image:linear-gradient(to_right,#bf953f,#fcf6ba,#b38728)1]">
            <h2 className="text-xl font-bold mb-2 text-[#5c4a2e]">Bingo de la boda</h2>
            <p className="text-sm text-gray-500 mb-4">Ingresa tu código de invitación</p>
            <input
              placeholder="Código"
              className="w-full border p-2 mb-4 uppercase"
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && codigoInput && loadCard(codigoInput)}
            />
            <button
              onClick={() => { setCodigo(codigoInput); loadCard(codigoInput); }}
              disabled={!codigoInput || loading}
              className="w-full py-3 bg-[#8a6d3b] text-white font-bold disabled:opacity-50"
            >
              {loading ? "Cargando..." : "Ver mi cartón"}
            </button>
            {error && (
              <div className="mt-4 border border-red-300 bg-red-50 text-red-700 rounded-lg p-3 text-sm text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {step === "bingo" && card && settings && (
          <div className="bg-white/95 p-4 border-8 [border-image:linear-gradient(to_right,#bf953f,#fcf6ba,#b38728)1]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-bold text-[#5c4a2e]">Tu cartón</h2>
                <p className="text-xs text-gray-400 font-mono">{codigo}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-[#d4af37]">
                  {completedCells}/{totalCells}
                </div>
                <div className="text-xs text-gray-400">casillas</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#bf953f] to-[#d4af37] transition-all duration-500"
                style={{ width: `${totalCells ? (completedCells / totalCells) * 100 : 0}%` }}
              />
            </div>

            <BingoGrid
              card={card}
              cols={settings.cols}
              codigo={codigo}
              onCellClick={setSelectedCell}
              onCardUpdate={setCard}
            />

            <p className="mt-4 text-xs text-center text-gray-400">
              Toca una casilla para subir tu foto con esa persona
            </p>

            {error && (
              <div className="mt-3 border border-red-300 bg-red-50 text-red-700 rounded-lg p-3 text-sm text-center">
                {error}
              </div>
            )}
          </div>
        )}

        {step === "bingo" && !card && !loading && (
          <div className="bg-white/95 p-6 border-8 [border-image:linear-gradient(to_right,#bf953f,#fcf6ba,#b38728)1] text-center">
            <div className="text-4xl mb-3">🎲</div>
            <p className="text-[#5c4a2e] font-semibold">{error || "Cargando..."}</p>
          </div>
        )}
      </div>

      {selectedCell && (
        <UploadModal
          cell={selectedCell}
          codigo={codigo}
          onClose={() => setSelectedCell(null)}
          onDone={handleCellDone}
        />
      )}

      {showWin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xs w-full p-8 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-[#5c4a2e] mb-2">¡BINGO!</h2>
            <p className="text-gray-600 mb-6">
              ¡Completaste todas las casillas! ¡Eres el primero en terminar!
            </p>
            <button
              onClick={() => setShowWin(false)}
              className="w-full py-3 bg-[#8a6d3b] text-white font-bold rounded-lg"
            >
              Ver mi cartón
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BingoPage() {
  return (
    <Suspense fallback={<Loader />}>
      <BingoContent />
    </Suspense>
  );
}
