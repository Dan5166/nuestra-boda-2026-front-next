"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getSavedCode, saveCode } from "@/lib/localCode";

const PHOTO_COUNT = 8;

type GameStatus = "waiting" | "started" | "ended";

interface GameState {
  status: GameStatus;
  winnerNames?: string[];
}

interface FileItem {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

function BingoContent() {
  const searchParams = useSearchParams();
  const codigoFromUrl = searchParams.get("code")?.toUpperCase() ?? "";

  const [codigo, setCodigo] = useState(codigoFromUrl);
  const [codigoInput, setCodigoInput] = useState(codigoFromUrl);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const [game, setGame] = useState<GameState | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [countError, setCountError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-verify from saved code
  useEffect(() => {
    const code = codigoFromUrl || getSavedCode();
    if (code) handleVerify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll game status every 8 seconds
  useEffect(() => {
    if (!verified) return;
    const load = () =>
      fetch("/api/bingo/status")
        .then((r) => r.json())
        .then((data) => setGame(data))
        .catch(() => {});
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [verified]);

  async function handleVerify(code?: string) {
    const c = (code ?? codigoInput).toUpperCase().trim();
    if (!c) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch(`/api/users/by-code/${c}`);
      if (!res.ok) throw new Error("Código no encontrado");
      saveCode(c);
      setCodigo(c);
      const [gameRes] = await Promise.all([
        fetch("/api/bingo/status").then((r) => r.json()),
      ]);
      setGame(gameRes);
      setVerified(true);
    } catch (e: unknown) {
      setVerifyError(e instanceof Error ? e.message : "Código no encontrado");
    } finally {
      setVerifying(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    setCountError("");
    setUploadError("");

    if (selected.length !== PHOTO_COUNT) {
      setCountError(
        `Tenés que seleccionar exactamente ${PHOTO_COUNT} fotos. Seleccionaste ${selected.length}.`
      );
      setFiles([]);
      return;
    }

    const items: FileItem[] = selected.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
      progress: 0,
    }));
    setFiles(items);
  }

  async function handleUpload() {
    if (files.length !== PHOTO_COUNT) return;
    setUploading(true);
    setUploadError("");

    try {
      // 1. Get presigned URLs for all 8 files at once
      const presignRes = await fetch("/api/bingo/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo,
          files: files.map((f) => ({ name: f.file.name, type: f.file.type })),
        }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json();
        throw new Error(err.message ?? "Error al obtener URLs");
      }
      const { urls } = await presignRes.json() as { urls: Array<{ url: string; key: string }> };

      // 2. Upload all 8 files to S3 in parallel with progress tracking
      const keys = await Promise.all(
        urls.map(({ url, key }, i) =>
          new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", url);
            xhr.setRequestHeader("Content-Type", files[i].file.type);
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) {
                const pct = Math.round((ev.loaded / ev.total) * 100);
                setFiles((prev) =>
                  prev.map((f, idx) => (idx === i ? { ...f, status: "uploading", progress: pct } : f))
                );
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                setFiles((prev) =>
                  prev.map((f, idx) => (idx === i ? { ...f, status: "done", progress: 100 } : f))
                );
                resolve(key);
              } else {
                setFiles((prev) =>
                  prev.map((f, idx) => (idx === i ? { ...f, status: "error", error: `HTTP ${xhr.status}` } : f))
                );
                reject(new Error(`HTTP ${xhr.status}`));
              }
            };
            xhr.onerror = () => {
              setFiles((prev) =>
                prev.map((f, idx) => (idx === i ? { ...f, status: "error", error: "Error de red" } : f))
              );
              reject(new Error("Error de red"));
            };
            setFiles((prev) =>
              prev.map((f, idx) => (idx === i ? { ...f, status: "uploading", progress: 0 } : f))
            );
            xhr.send(files[i].file);
          })
        )
      );

      // 3. Record submission
      const submitRes = await fetch("/api/bingo/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, keys }),
      });
      if (!submitRes.ok) {
        const err = await submitRes.json();
        throw new Error(err.message ?? "Error al registrar envío");
      }

      setUploadDone(true);
      setAlreadySubmitted(true);
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Error al subir las fotos");
    } finally {
      setUploading(false);
    }
  }

  // ── Render: Code entry ─────────────────────────────────────────────────────
  if (!verified) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <p className="font-serif text-2xl text-[#5c4a2e] mb-2">Bingo de la boda</p>
          <p className="text-sm text-[#8a6d3b] mb-6">
            Ingresá tu código de invitación para participar
          </p>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-center tracking-widest uppercase text-[#5c4a2e] mb-4 focus:outline-none focus:border-[#bf953f]"
            placeholder="ABC123"
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          />
          {verifyError && <p className="text-red-500 text-sm mb-3">{verifyError}</p>}
          <button
            onClick={() => handleVerify()}
            disabled={verifying || !codigoInput}
            className="w-full py-2 rounded-lg bg-[#bf953f] text-white font-medium hover:bg-[#aa771c] transition disabled:opacity-50"
          >
            {verifying ? "Verificando..." : "Ingresar"}
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Waiting ────────────────────────────────────────────────────────
  if (!game || game.status === "waiting") {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex flex-col items-center justify-center px-4 gap-6 text-center">
        <div className="text-6xl">🎉</div>
        <p className="font-serif text-2xl text-[#5c4a2e]">Bingo de la boda</p>
        <p className="text-[#8a6d3b] max-w-xs">
          El juego todavía no comenzó. ¡Quedate atento cuando empiece!
        </p>
        <span className="text-xs text-gray-400">Código: <span className="font-mono">{codigo}</span></span>
      </div>
    );
  }

  // ── Render: Ended ──────────────────────────────────────────────────────────
  if (game.status === "ended") {
    const winner = game.winnerNames;
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex flex-col items-center justify-center px-4 gap-6 text-center">
        <div className="text-6xl">🏆</div>
        <p className="font-serif text-3xl text-[#5c4a2e]">¡El juego terminó!</p>
        {winner && winner.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm w-full">
            <p className="text-sm text-[#8a6d3b] mb-2">Ganador/a</p>
            <p className="font-serif text-2xl text-[#d4af37] font-bold">
              {winner.join(" & ")}
            </p>
          </div>
        ) : (
          <p className="text-[#8a6d3b]">Nadie completó el bingo esta vez.</p>
        )}
        <span className="text-xs text-gray-400">Código: <span className="font-mono">{codigo}</span></span>
      </div>
    );
  }

  // ── Render: Started — already submitted ───────────────────────────────────
  if (alreadySubmitted || uploadDone) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex flex-col items-center justify-center px-4 gap-5 text-center">
        <div className="text-6xl">✅</div>
        <p className="font-serif text-2xl text-[#5c4a2e]">¡Fotos enviadas!</p>
        <p className="text-[#8a6d3b] max-w-xs">
          Tus 8 fotos fueron registradas. El resultado se anunciará cuando termine el juego.
        </p>
        <span className="text-xs text-gray-400">Código: <span className="font-mono">{codigo}</span></span>
      </div>
    );
  }

  // ── Render: Started — upload form ─────────────────────────────────────────
  const pending = files.filter((f) => f.status === "pending").length;
  const allReady = files.length === PHOTO_COUNT && files.every((f) => f.status === "pending");

  return (
    <div className="min-h-screen bg-[#fdfaf6] text-[#5c4a2e] px-4 py-10">
      <div className="max-w-lg mx-auto space-y-8">
        <div className="text-center">
          <p className="font-serif text-3xl mb-1">Bingo de la boda</p>
          <p className="text-[#8a6d3b] text-sm">
            Subí tus {PHOTO_COUNT} fotos para completar tu cartón
          </p>
          <p className="text-xs text-gray-400 mt-1">Código: <span className="font-mono">{codigo}</span></p>
        </div>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-[#d4af37] rounded-2xl p-8 text-center cursor-pointer hover:bg-[#fdf5e8] transition"
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <p className="text-4xl mb-3">📸</p>
          <p className="text-[#8a6d3b] font-medium">
            Seleccioná exactamente {PHOTO_COUNT} fotos
          </p>
          <p className="text-xs text-gray-400 mt-1">
            JPG, PNG, WEBP, HEIC · Todas juntas de una vez
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </div>

        {/* Count error */}
        {countError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center">
            {countError}
          </div>
        )}

        {/* Photo grid preview */}
        {files.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{files.length} / {PHOTO_COUNT} fotos</span>
              {!uploading && (
                <button
                  onClick={() => {
                    files.forEach((f) => URL.revokeObjectURL(f.preview));
                    setFiles([]);
                    setCountError("");
                    setUploadError("");
                  }}
                  className="text-xs text-[#8a6d3b] underline hover:text-red-500 transition"
                >
                  Cambiar selección
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {files.map((item, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt="" className="w-full h-full object-cover" />
                  {item.status === "uploading" && (
                    <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mb-1" />
                      <span className="text-white text-xs">{item.progress}%</span>
                    </div>
                  )}
                  {item.status === "done" && (
                    <div className="absolute inset-0 bg-green-500/40 flex items-center justify-center">
                      <span className="text-white text-xl">✓</span>
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="absolute inset-0 bg-red-500/60 flex items-center justify-center">
                      <span className="text-white text-xl">✕</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm text-center">
            {uploadError}
          </div>
        )}

        {/* Upload button */}
        {allReady && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 rounded-xl bg-[#bf953f] text-white font-semibold hover:bg-[#aa771c] transition disabled:opacity-50 text-lg"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Subiendo fotos...
              </span>
            ) : (
              `Enviar mis ${PHOTO_COUNT} fotos`
            )}
          </button>
        )}

        {/* Hint when wrong count selected */}
        {files.length > 0 && files.length !== PHOTO_COUNT && !uploading && (
          <p className="text-center text-sm text-[#8a6d3b]">
            Necesitás exactamente {PHOTO_COUNT} fotos ({pending} seleccionadas actualmente)
          </p>
        )}
      </div>
    </div>
  );
}

export default function BingoPage() {
  return (
    <Suspense>
      <BingoContent />
    </Suspense>
  );
}
