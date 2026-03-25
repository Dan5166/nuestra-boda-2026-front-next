"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { getSavedCode, saveCode } from "@/lib/localCode";
import Loader from "../components/Loader";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Cell {
  position: number;
  targetCodigo: string;
  targetNames: string[];
  completedAt: string | null;
  mediaUrl: string | null;
}

interface Card {
  codigo: string;
  cells: Cell[];
  completedAt: string | null;
}

interface ScannedCell {
  targetNames: string[];
  position: number;
  completedAt: string | null;
  mediaUrl: string | null;
  token: string;
}

type Phase = "idle" | "presign" | "upload" | "confirm";

// ── Upload modal ──────────────────────────────────────────────────────────────

function UploadModal({
  cell,
  codigo,
  replacing,
  onClose,
  onDone,
}: {
  cell: ScannedCell;
  codigo: string;
  replacing: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [deletingOld, setDeletingOld] = useState(false);
  const [readyToUpload, setReadyToUpload] = useState(!replacing);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setError("");
    setPreview(URL.createObjectURL(f));
  }

  async function handleDeleteAndProceed() {
    setDeletingOld(true);
    setError("");
    try {
      const res = await fetch("/api/bingo/delete-cell", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, position: cell.position }),
      });
      if (!res.ok) throw new Error("No se pudo borrar la foto anterior");
      setReadyToUpload(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al borrar");
    } finally {
      setDeletingOld(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError("");

    try {
      setPhase("presign");
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

      setPhase("upload");
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new Error("Error al subir el archivo"));
        xhr.onerror = () => reject(new Error("Error de red al subir"));
        xhr.open("PUT", url);
        xhr.setRequestHeader("Content-Type", file.type);
        xhr.send(file);
      });

      setPhase("confirm");
      const confirmRes = await fetch("/api/bingo/complete-cell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, position: cell.position, key, size: file.size }),
      });
      if (!confirmRes.ok) {
        const d = await confirmRes.json();
        throw new Error(d.message || "Error al confirmar");
      }
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setUploading(false);
      setPhase("idle");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (!uploading && !deletingOld && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Foto con</p>
            <h3 className="text-lg font-bold text-[#5c4a2e]">
              {cell.targetNames.join(" y ")}
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={uploading || deletingOld}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none disabled:opacity-30"
          >
            ✕
          </button>
        </div>

        {/* Replace confirmation step */}
        {replacing && !readyToUpload && (
          <div className="space-y-4">
            {cell.mediaUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cell.mediaUrl}
                alt="foto actual"
                className="w-full rounded-xl max-h-40 object-cover opacity-70"
              />
            )}
            <p className="text-sm text-gray-600 text-center">
              Ya tienes una foto con esta persona. ¿Querés reemplazarla?
            </p>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button
              onClick={handleDeleteAndProceed}
              disabled={deletingOld}
              className="w-full py-3 bg-[#8a6d3b] text-white font-bold rounded-xl disabled:opacity-50"
            >
              {deletingOld ? "Borrando..." : "Sí, reemplazar"}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-gray-400 hover:text-gray-600"
            >
              Cancelar
            </button>
          </div>
        )}

        {/* Upload step */}
        {readyToUpload && (
          <div className="space-y-4">
            {!preview ? (
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-[#d4af37] rounded-xl p-10 text-center text-[#8a6d3b] hover:bg-amber-50 transition disabled:opacity-50"
              >
                <div className="text-4xl mb-2">📷</div>
                <div className="text-sm font-medium">Seleccionar foto</div>
              </button>
            ) : (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt="preview"
                  className="w-full rounded-xl max-h-52 object-cover"
                />
                <button
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute top-2 right-2 bg-white/80 rounded-full w-7 h-7 text-sm text-gray-600 hover:bg-white shadow"
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

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            {uploading && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>
                    {phase === "presign" && "Preparando..."}
                    {phase === "upload" && "Subiendo foto..."}
                    {phase === "confirm" && "Guardando..."}
                  </span>
                  {phase === "upload" && <span>{progress}%</span>}
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#bf953f] to-[#d4af37] transition-all duration-200"
                    style={{
                      width:
                        phase === "presign" ? "10%" : phase === "confirm" ? "100%" : `${progress}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {file && !uploading && (
              <button
                onClick={handleUpload}
                className="w-full py-3 bg-[#8a6d3b] text-white font-bold rounded-xl"
              >
                Confirmar y subir
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── QR Scanner component ──────────────────────────────────────────────────────

function QRScanner({
  onDetected,
  active,
}: {
  onDetected: (text: string) => void;
  active: boolean;
}) {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const startedRef = useRef(false);
  const divId = "qr-scanner-viewfinder";

  useEffect(() => {
    if (!active) {
      if (startedRef.current && scannerRef.current) {
        startedRef.current = false;
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      return;
    }

    let unmounted = false;

    async function startScanner() {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (unmounted) return;

      const scanner = new Html5Qrcode(divId, { verbose: false });
      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (text) => { if (!unmounted) onDetected(text); },
          () => {}
        );
        if (!unmounted) startedRef.current = true;
      } catch {
        // Camera permission denied or unavailable
        scannerRef.current = null;
      }
    }

    startScanner();

    return () => {
      unmounted = true;
      if (startedRef.current && scannerRef.current) {
        startedRef.current = false;
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  return (
    <div className="relative">
      <div
        id={divId}
        className="w-full overflow-hidden rounded-xl"
        style={{ minHeight: 260 }}
      />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative w-48 h-48">
          {["top-0 left-0 border-t-4 border-l-4", "top-0 right-0 border-t-4 border-r-4",
            "bottom-0 left-0 border-b-4 border-l-4", "bottom-0 right-0 border-b-4 border-r-4",
          ].map((cls, i) => (
            <span key={i} className={`absolute w-6 h-6 border-[#d4af37] rounded-sm ${cls}`} />
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-gray-400 mt-2">
        Apuntá la cámara al código QR del papel
      </p>
    </div>
  );
}

// ── Progress grid ─────────────────────────────────────────────────────────────

function ProgressGrid({ card, cols }: { card: Card; cols: number }) {
  const sorted = [...card.cells].sort((a, b) => a.position - b.position);
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {sorted.map((cell) => {
        const done = cell.completedAt !== null;
        return (
          <div
            key={cell.position}
            className={`relative aspect-square rounded-lg border flex flex-col items-center justify-center text-center p-1 ${
              done ? "border-[#d4af37] bg-[#d4af37]/10" : "border-gray-200 bg-gray-50"
            }`}
          >
            {done && cell.mediaUrl && (
              <>
                <Image
                  src={cell.mediaUrl}
                  alt="bingo"
                  fill
                  sizes="80px"
                  className="object-cover rounded-[5px]"
                />
                <div className="absolute inset-0 bg-black/25 rounded-[5px]" />
              </>
            )}
            <div className="relative z-10 text-[10px] leading-tight font-medium">
              {done ? (
                <span className="text-white text-sm">✓</span>
              ) : (
                <span className="text-[#5c4a2e]">{cell.targetNames[0] ?? "?"}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────

function BingoContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code")?.toUpperCase() ?? "";

  const [codigo, setCodigo] = useState(codeFromUrl);
  const [codigoInput, setCodigoInput] = useState(codeFromUrl);
  const [step, setStep] = useState<"codigo" | "scanner">(codeFromUrl ? "scanner" : "codigo");
  const [card, setCard] = useState<Card | null>(null);
  const [cols, setCols] = useState(3);
  const [loadingCard, setLoadingCard] = useState(false);
  const [cardError, setCardError] = useState("");

  const [scannerActive, setScannerActive] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [scannedCell, setScannedCell] = useState<ScannedCell | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  const [toast, setToast] = useState("");
  const lastToken = useRef("");

  async function loadCard(code: string) {
    setLoadingCard(true);
    setCardError("");
    try {
      const res = await fetch(`/api/bingo/card?codigo=${encodeURIComponent(code)}`);
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
      const data = await res.json();
      if (!data.settings.enabled) throw new Error("El bingo está desactivado.");
      if (!data.card) throw new Error("Todavía no se generaron los cartones.");
      setCols(data.settings.cols);
      setCard(data.card);
      setStep("scanner");
    } catch (e: unknown) {
      setCardError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoadingCard(false);
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

  useEffect(() => {
    setScannerActive(step === "scanner" && card !== null && scannedCell === null);
  }, [step, card, scannedCell]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleQRDetected(raw: string) {
    if (scanning || scannedCell) return;

    let token = raw;
    try {
      const url = new URL(raw);
      const t = url.searchParams.get("t");
      if (t) token = t;
    } catch {
      // raw is already a plain token
    }

    if (!token || token === lastToken.current) return;
    lastToken.current = token;
    setScanning(true);

    try {
      const res = await fetch(
        `/api/bingo/escanear?t=${encodeURIComponent(token)}&codigo=${encodeURIComponent(codigo)}`
      );
      const data = await res.json();

      if (!res.ok) {
        showToast(data.message || "QR no reconocido");
        setTimeout(() => { lastToken.current = ""; }, 2000);
        return;
      }

      setScannedCell({
        targetNames: data.targetNames,
        position: data.position,
        completedAt: data.completedAt,
        mediaUrl: data.mediaUrl,
        token,
      });
      setIsReplacing(data.completedAt !== null);
    } catch {
      showToast("Error al leer el QR");
      setTimeout(() => { lastToken.current = ""; }, 2000);
    } finally {
      setScanning(false);
    }
  }

  async function handleUploadDone() {
    setScannedCell(null);
    lastToken.current = "";
    const res = await fetch(`/api/bingo/card?codigo=${encodeURIComponent(codigo)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.card) setCard(data.card);
    }
    showToast("¡Foto guardada! ✓");
  }

  function handleModalClose() {
    setScannedCell(null);
    lastToken.current = "";
  }

  const completedCells = card ? card.cells.filter((c) => c.completedAt !== null).length : 0;
  const totalCells = card ? card.cells.length : 0;

  if (loadingCard) return <Loader />;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={{ backgroundImage: "url(/assets/fondo-desktop.webp)" }}
    >
      <div
        className="fixed inset-0 bg-cover bg-center md:hidden"
        style={{ backgroundImage: "url(/assets/fondo-movil.webp)" }}
      />

      <div className="relative z-10 w-full max-w-lg space-y-4">
        {/* Code entry */}
        {step === "codigo" && (
          <div className="bg-white/95 p-6 border-8 [border-image:linear-gradient(to_right,#bf953f,#fcf6ba,#b38728)1]">
            <h2 className="text-xl font-bold mb-1 text-[#5c4a2e]">Bingo de la boda</h2>
            <p className="text-sm text-gray-500 mb-4">Ingresá tu código de invitación</p>
            <input
              placeholder="Código"
              className="w-full border p-2.5 mb-4 uppercase font-mono tracking-widest text-sm rounded-lg"
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter" && codigoInput) {
                  saveCode(codigoInput);
                  setCodigo(codigoInput);
                  loadCard(codigoInput);
                }
              }}
              autoCapitalize="characters"
              autoCorrect="off"
            />
            <button
              onClick={() => { saveCode(codigoInput); setCodigo(codigoInput); loadCard(codigoInput); }}
              disabled={!codigoInput || loadingCard}
              className="w-full py-3 bg-[#8a6d3b] text-white font-bold rounded-xl disabled:opacity-50"
            >
              Continuar
            </button>
            {cardError && (
              <p className="mt-3 text-sm text-red-600 text-center">{cardError}</p>
            )}
          </div>
        )}

        {step === "scanner" && card && (
          <>
            {/* Header */}
            <div className="bg-white/95 px-5 py-4 border-8 [border-image:linear-gradient(to_right,#bf953f,#fcf6ba,#b38728)1]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold text-[#5c4a2e]">Bingo de la boda</h2>
                  <p className="text-xs text-gray-400 font-mono">{codigo}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#d4af37]">
                    {completedCells}/{totalCells}
                  </div>
                  <div className="text-xs text-gray-400">fotos</div>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#bf953f] to-[#d4af37] transition-all duration-500"
                  style={{ width: `${totalCells ? (completedCells / totalCells) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Scanner */}
            <div className="bg-white/95 p-4 border-8 [border-image:linear-gradient(to_right,#bf953f,#fcf6ba,#b38728)1]">
              {scanning && (
                <div className="flex items-center justify-center gap-2 py-2 mb-2 text-sm text-[#8a6d3b]">
                  <div className="w-4 h-4 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
                  Verificando...
                </div>
              )}
              <QRScanner onDetected={handleQRDetected} active={scannerActive} />
            </div>

            {/* Progress grid */}
            <div className="bg-white/95 p-4 border-8 [border-image:linear-gradient(to_right,#bf953f,#fcf6ba,#b38728)1]">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Tu cartón</p>
              <ProgressGrid card={card} cols={cols} />
              <button
                onClick={() => { setCodigo(""); setCard(null); setStep("codigo"); setScannerActive(false); }}
                className="mt-4 w-full text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Cambiar código
              </button>
            </div>
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-[#3d2c10] text-white text-sm px-5 py-3 rounded-full shadow-xl">
          {toast}
        </div>
      )}

      {/* Upload modal */}
      {scannedCell && (
        <UploadModal
          cell={scannedCell}
          codigo={codigo}
          replacing={isReplacing}
          onClose={handleModalClose}
          onDone={handleUploadDone}
        />
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
