"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import BingoQRPanel from "./BingoQRPanel";

interface BingoSettings {
  cols: number;
  enabled: boolean;
  deletionLocked: boolean;
}

interface EnrichedCell {
  position: number;
  targetCodigo: string;
  targetNames: string[];
  completedAt: string | null;
  mediaKey: string | null;
  mediaUrl: string | null;
}

interface EnrichedCard {
  codigo: string;
  ownerNames: string[];
  cells: EnrichedCell[];
  completedAt: string | null;
  completedCells: number;
  totalCells: number;
}

// ── Override modal ────────────────────────────────────────────────────────────

function OverrideModal({
  cell,
  ownerCodigo,
  allCards,
  onClose,
  onSaved,
}: {
  cell: EnrichedCell;
  ownerCodigo: string;
  allCards: { codigo: string; ownerNames: string[] }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [newCode, setNewCode] = useState(cell.targetCodigo);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function label(codigo: string, names: string[]) {
    const full = `${names.join(", ")} (${codigo})`;
    return full.length > 40 ? `${full.slice(0, 37)}…` : full;
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/bingo/cards/${ownerCodigo}/${cell.position}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newTargetCodigo: newCode }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      onSaved();
    } catch {
      setError("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="font-semibold text-[#5c4a2e] mb-1">Cambiar asignación</h3>
        <p className="text-sm text-gray-500 mb-4">
          Casilla {cell.position + 1} de <span className="font-mono">{ownerCodigo}</span>
        </p>
        <select
          className="w-full border border-gray-300 rounded-lg p-2 mb-4 text-sm"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
        >
          {allCards.map(({ codigo, ownerNames }) => (
            <option key={codigo} value={codigo}>{label(codigo, ownerNames)}</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || newCode === cell.targetCodigo}
            className="flex-1 py-2 bg-[#8a6d3b] text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin image lightbox ──────────────────────────────────────────────────────

function AdminImageLightbox({
  cell,
  ownerCodigo,
  onClose,
  onDeleted,
}: {
  cell: EnrichedCell;
  ownerCodigo: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`¿Borrar la foto de "${cell.targetNames.join(" y ")}" (${ownerCodigo})?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/bingo/cards/${ownerCodigo}/${cell.position}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      onDeleted();
    } catch {
      alert("No se pudo borrar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/60 hover:text-white text-2xl leading-none"
        >
          ✕
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cell.mediaUrl!}
          alt={cell.targetNames.join(" y ")}
          className="w-full rounded-2xl max-h-[65vh] object-contain"
        />

        <div className="text-center space-y-0.5">
          <p className="text-white font-semibold text-base">{cell.targetNames.join(" y ")}</p>
          <p className="text-white/50 text-xs">foto de {ownerCodigo}</p>
        </div>

        <div className="flex gap-2 w-full">
          {cell.mediaKey && (
            <a
              href={`/api/download?key=${encodeURIComponent(cell.mediaKey)}`}
              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold text-center transition"
            >
              Descargar
            </a>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition"
          >
            {deleting ? "Borrando..." : "Borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bingo card viewer ─────────────────────────────────────────────────────────

function CardViewer({
  card,
  allCards,
  onRefresh,
}: {
  card: EnrichedCard;
  allCards: { codigo: string; ownerNames: string[] }[];
  onRefresh: () => void;
}) {
  const [overrideCell, setOverrideCell] = useState<EnrichedCell | null>(null);
  const [lightboxCell, setLightboxCell] = useState<EnrichedCell | null>(null);
  const sorted = [...card.cells].sort((a, b) => a.position - b.position);
  const cols = Math.round(Math.sqrt(card.totalCells));

  return (
    <div className="border border-[#e8d9c0] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-mono text-sm font-semibold text-[#5c4a2e]">{card.codigo}</span>
          <span className="ml-2 text-sm text-gray-500">{card.ownerNames.join(", ")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{card.completedCells}/{card.totalCells}</span>
          {card.completedAt && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">¡BINGO!</span>
          )}
        </div>
      </div>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {sorted.map((cell) => {
          const done = cell.completedAt !== null;
          return (
            <div
              key={cell.position}
              onClick={() => done ? setLightboxCell(cell) : setOverrideCell(cell)}
              className={`relative aspect-square rounded-lg border text-center flex flex-col items-center justify-center p-1 cursor-pointer transition-transform active:scale-95 ${
                done ? "border-[#d4af37] bg-[#d4af37]/10" : "border-gray-200 bg-gray-50 hover:border-[#d4af37]"
              }`}
            >
              {done && cell.mediaUrl && (
                <>
                  <Image src={cell.mediaUrl} alt="bingo" fill sizes="120px" className="object-cover rounded-[6px]" />
                  <div className="absolute inset-0 bg-black/20 rounded-[6px]" />
                </>
              )}
              <div className="relative z-10">
                <div className={`text-[10px] font-medium leading-tight ${done ? "text-white" : "text-[#5c4a2e]"}`}>
                  {cell.targetNames[0] ?? cell.targetCodigo}
                </div>
                {!done && (
                  <div className="mt-0.5 text-[9px] text-[#d4af37]">cambiar</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {lightboxCell && (
        <AdminImageLightbox
          cell={lightboxCell}
          ownerCodigo={card.codigo}
          onClose={() => setLightboxCell(null)}
          onDeleted={() => { setLightboxCell(null); onRefresh(); }}
        />
      )}

      {overrideCell && (
        <OverrideModal
          cell={overrideCell}
          ownerCodigo={card.codigo}
          allCards={allCards}
          onClose={() => setOverrideCell(null)}
          onSaved={() => { setOverrideCell(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ── Collage view ──────────────────────────────────────────────────────────────

interface PhotoItem {
  url: string;
  targetNames: string[];
  ownerNames: string[];
  completedAt: string;
}

function CollageView({ cards }: { cards: EnrichedCard[] }) {
  const photos: PhotoItem[] = cards
    .flatMap((card) =>
      card.cells
        .filter((c) => c.completedAt && c.mediaUrl)
        .map((c) => ({
          url: c.mediaUrl!,
          targetNames: c.targetNames,
          ownerNames: card.ownerNames,
          completedAt: c.completedAt!,
        }))
    )
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-4xl mb-2">📷</div>
        <p className="text-sm">Aún no hay fotos</p>
      </div>
    );
  }

  return (
    <div className="columns-2 sm:columns-3 gap-2 space-y-2">
      {photos.map((photo, i) => (
        <div key={i} className="break-inside-avoid relative group rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={photo.targetNames.join(" y ")}
            className="w-full object-cover block"
            loading="lazy"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <p className="text-white text-[11px] font-semibold leading-tight">
              {photo.targetNames.join(" & ")}
            </p>
            <p className="text-white/70 text-[10px]">{photo.ownerNames.join(", ")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function BingoPanel() {
  const [settings, setSettings] = useState<BingoSettings>({ cols: 3, enabled: false, deletionLocked: false });
  const [cards, setCards] = useState<EnrichedCard[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [expandedCode, setExpandedCode] = useState<string | null>(null);
  const [leaderboardMode, setLeaderboardMode] = useState<"bingo" | "collage">("bingo");

  async function loadSettings() {
    const res = await fetch("/api/admin/bingo/settings");
    if (res.ok) setSettings(await res.json());
  }

  async function loadCards() {
    setLoadingCards(true);
    const res = await fetch("/api/admin/bingo/cards");
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards);
    }
    setLoadingCards(false);
  }

  useEffect(() => { loadSettings(); loadCards(); }, []);

  async function saveSettings() {
    setSavingSettings(true);
    const res = await fetch("/api/admin/bingo/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSavingSettings(false);
    if (res.ok) flash("Configuración guardada", "ok");
    else flash("Error al guardar", "err");
  }

  async function generate() {
    if (!confirm("¿Generar cartones para todos los invitados confirmados? Esto sobreescribe los cartones existentes.")) return;
    setGenerating(true);
    const res = await fetch("/api/admin/bingo/generate", { method: "POST" });
    const data = await res.json();
    setGenerating(false);
    if (res.ok) {
      flash(`${data.generated} cartones generados${data.warning ? ` — ${data.warning}` : ""}`, "ok");
      loadCards();
    } else {
      flash(data.message || "Error al generar", "err");
    }
  }

  function flash(text: string, type: "ok" | "err") {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  }

  const allCards = cards.map((c) => ({ codigo: c.codigo, ownerNames: c.ownerNames }));
  const winnerCard = cards.find((c) => c.completedAt !== null);
  const totalCells = cards[0]?.totalCells ?? 0;
  const totalPhotos = cards.reduce((sum, c) => sum + c.completedCells, 0);

  return (
    <div className="space-y-8">
      {/* Settings */}
      <section className="bg-[#fffdf7] border border-[#e8d9c0] rounded-xl p-5">
        <h3 className="font-semibold text-[#5c4a2e] mb-4">Configuración</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Tamaño de la grilla</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={settings.cols}
              onChange={(e) => setSettings((s) => ({ ...s, cols: Number(e.target.value) }))}
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}×{n} ({n * n} casillas)</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-[#d4af37]"
              checked={settings.enabled}
              onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
            />
            Bingo habilitado
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="w-4 h-4 accent-red-500"
              checked={settings.deletionLocked}
              onChange={(e) => setSettings((s) => ({ ...s, deletionLocked: e.target.checked }))}
            />
            Bloquear borrado de fotos
          </label>
          <button
            onClick={saveSettings}
            disabled={savingSettings}
            className="px-4 py-2 bg-[#8a6d3b] text-white rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {savingSettings ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </section>

      {/* Generate */}
      <section className="bg-[#fffdf7] border border-[#e8d9c0] rounded-xl p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-[#5c4a2e]">Cartones</h3>
            <p className="text-sm text-gray-500">
              {cards.length > 0
                ? `${cards.length} cartones · ${totalCells} casillas c/u · ${totalPhotos} fotos subidas`
                : "Aún no se generaron cartones"}
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="px-4 py-2 bg-[#d4af37] text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-[#bf953f] transition"
          >
            {generating ? "Generando..." : "Generar cartones"}
          </button>
        </div>
        {msg && (
          <div className={`mt-3 text-sm px-4 py-2 rounded-lg ${msgType === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg}
          </div>
        )}
      </section>

      {/* Leaderboard / Collage */}
      {cards.length > 0 && (
        <section className="bg-[#fffdf7] border border-[#e8d9c0] rounded-xl p-5">
          {/* Section header with toggle */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-semibold text-[#5c4a2e]">
              {leaderboardMode === "bingo" ? "Ranking" : "Collage de fotos"}
            </h3>
            <div className="flex rounded-lg border border-[#e8d9c0] overflow-hidden text-sm">
              <button
                onClick={() => setLeaderboardMode("bingo")}
                className={`px-4 py-1.5 font-medium transition ${leaderboardMode === "bingo" ? "bg-[#8a6d3b] text-white" : "bg-white text-gray-500 hover:bg-amber-50"}`}
              >
                Bingo
              </button>
              <button
                onClick={() => setLeaderboardMode("collage")}
                className={`px-4 py-1.5 font-medium transition ${leaderboardMode === "collage" ? "bg-[#8a6d3b] text-white" : "bg-white text-gray-500 hover:bg-amber-50"}`}
              >
                Collage
              </button>
            </div>
          </div>

          {/* Bingo ranking */}
          {leaderboardMode === "bingo" && (
            <>
              {winnerCard && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  <div>
                    <div className="font-semibold text-yellow-800 text-sm">
                      ¡{winnerCard.ownerNames.join(" y ")} ganaron el bingo!
                    </div>
                    <div className="text-xs text-yellow-600 font-mono">{winnerCard.codigo}</div>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {cards.map((card, idx) => {
                  const pct = totalCells ? Math.round((card.completedCells / totalCells) * 100) : 0;
                  const isExpanded = expandedCode === card.codigo;
                  return (
                    <div key={card.codigo}>
                      <div
                        className="flex items-center gap-3 cursor-pointer hover:bg-amber-50 rounded-lg p-2 transition"
                        onClick={() => setExpandedCode(isExpanded ? null : card.codigo)}
                      >
                        <span className="text-sm font-semibold text-gray-400 w-5 text-right">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-[#5c4a2e] truncate">
                              {card.ownerNames.join(", ")}
                              <span className="font-mono text-xs text-gray-400 ml-1">({card.codigo})</span>
                            </span>
                            <span className="text-xs text-gray-500 shrink-0 ml-2">{card.completedCells}/{totalCells}</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#bf953f] to-[#d4af37] transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        {card.completedAt && <span className="text-sm">🏆</span>}
                        <span className="text-xs text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 mb-1">
                          <CardViewer card={card} allCards={allCards} onRefresh={loadCards} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Collage */}
          {leaderboardMode === "collage" && <CollageView cards={cards} />}
        </section>
      )}

      {loadingCards && <p className="text-center text-sm text-gray-400">Cargando cartones...</p>}

      {/* QR Codes */}
      <BingoQRPanel />
    </div>
  );
}
