"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

interface UploadedFile {
  key: string;
  url: string;
  size: number;
  lastModified: string | null;
  uploadedBy: string;
  involvedCodes: string[];
  isOwn: boolean;
}

interface Settings {
  maxPhotosPerCode: number;
  maxVideosPerCode: number;
  maxFileSizeMB: number;
  enabled: boolean;
}

interface FileItem {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

interface LightboxItem {
  url: string;
  isVideo: boolean;
}

function isVideo(key: string) {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "webm"].includes(ext);
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function GaleriaContent() {
  const searchParams = useSearchParams();
  const codigoFromUrl = searchParams.get("code")?.toUpperCase() ?? "";

  const [codigo, setCodigo] = useState(codigoFromUrl);
  const [codigoInput, setCodigoInput] = useState(codigoFromUrl);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");

  const [settings, setSettings] = useState<Settings | null>(null);
  const [allFiles, setAllFiles] = useState<UploadedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [queue, setQueue] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);

  // Codes to tag as involved in this upload batch
  const [involvedInput, setInvolvedInput] = useState("");
  const [involvedCodes, setInvolvedCodes] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (codigoFromUrl) handleVerify(codigoFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify(code?: string) {
    const c = (code ?? codigoInput).toUpperCase().trim();
    if (!c) return;
    setVerifying(true);
    setVerifyError("");
    try {
      const res = await fetch(`/api/users/by-code/${c}`);
      if (!res.ok) throw new Error("Código no encontrado");
      setCodigo(c);
      await loadFiles(c);
      setVerified(true);
    } catch (e: unknown) {
      setVerifyError(e instanceof Error ? e.message : "Código no encontrado");
    } finally {
      setVerifying(false);
    }
  }

  async function loadFiles(c: string) {
    setLoadingFiles(true);
    try {
      const res = await fetch(`/api/gallery/files?codigo=${c}`);
      const data = await res.json();
      setAllFiles(data.files ?? []);
      setSettings(data.settings ?? null);
    } finally {
      setLoadingFiles(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const maxMB = settings?.maxFileSizeMB ?? 50;
    const newItems: FileItem[] = [];
    for (const file of Array.from(e.target.files)) {
      if (file.size > maxMB * 1024 * 1024) {
        newItems.push({ file, preview: "", status: "error", error: `Supera el límite de ${maxMB} MB` });
        continue;
      }
      newItems.push({ file, preview: URL.createObjectURL(file), status: "pending" });
    }
    setQueue((prev) => [...prev, ...newItems]);
    e.target.value = "";
  }

  function removeFromQueue(index: number) {
    setQueue((prev) => {
      const item = prev[index];
      if (item.preview) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function addInvolvedCode() {
    const c = involvedInput.toUpperCase().trim();
    if (!c || c === codigo || involvedCodes.includes(c)) {
      setInvolvedInput("");
      return;
    }
    setInvolvedCodes((prev) => [...prev, c]);
    setInvolvedInput("");
  }

  function removeInvolvedCode(c: string) {
    setInvolvedCodes((prev) => prev.filter((x) => x !== c));
  }

  async function uploadAll() {
    const pending = queue.filter((q) => q.status === "pending");
    if (!pending.length) return;
    setUploading(true);

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status !== "pending") continue;

      setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: "uploading" } : q)));

      try {
        const item = queue[i];

        // 1. Get presigned URL
        const presignRes = await fetch("/api/gallery/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo, fileName: item.file.name, contentType: item.file.type }),
        });
        if (!presignRes.ok) {
          const err = await presignRes.json();
          throw new Error(err.message ?? "Error al obtener URL");
        }
        const { url, key } = await presignRes.json();

        // 2. Upload directly to S3
        await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": item.file.type },
          body: item.file,
        });

        // 3. Save metadata (involvedCodes) to DynamoDB
        await fetch("/api/gallery/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo, key, involvedCodes, size: item.file.size }),
        });

        setQueue((prev) => prev.map((q, idx) => (idx === i ? { ...q, status: "done" } : q)));
      } catch (e: unknown) {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? { ...q, status: "error", error: e instanceof Error ? e.message : "Error al subir" }
              : q
          )
        );
      }
    }

    setUploading(false);
    loadFiles(codigo);
  }

  const ownFiles = allFiles.filter((f) => f.isOwn);
  const involvedFiles = allFiles.filter((f) => !f.isOwn);

  const ownPhotos = ownFiles.filter((f) => !isVideo(f.key)).length;
  const ownVideos = ownFiles.filter((f) => isVideo(f.key)).length;

  if (!verified) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm text-center">
          <p className="font-serif text-2xl text-[#5c4a2e] mb-2">Galería de fotos</p>
          <p className="text-sm text-[#8a6d3b] mb-6">
            Ingresa tu código de invitación para acceder
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

  if (settings && !settings.enabled) {
    return (
      <div className="min-h-screen bg-[#fdfaf6] flex items-center justify-center">
        <p className="text-[#8a6d3b] font-serif text-xl">
          La galería está temporalmente desactivada
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] text-[#5c4a2e] px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="text-center">
          <h1 className="font-serif text-3xl mb-1">Galería compartida</h1>
          <p className="text-[#8a6d3b] text-sm">
            Código: <span className="font-mono tracking-widest">{codigo}</span>
          </p>
        </div>

        {/* Límites */}
        {settings && (
          <div className="flex justify-center gap-6 text-sm">
            <span className="bg-[#f5ede0] px-3 py-1 rounded-full">
              📷 {ownPhotos} / {settings.maxPhotosPerCode} fotos
            </span>
            <span className="bg-[#f5ede0] px-3 py-1 rounded-full">
              🎬 {ownVideos} / {settings.maxVideosPerCode} videos
            </span>
          </div>
        )}

        {/* Upload zone */}
        <div>
          <div
            className="border-2 border-dashed border-[#d4af37] rounded-2xl p-8 text-center cursor-pointer hover:bg-[#fdf5e8] transition"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const fakeEvent = {
                target: { files: e.dataTransfer.files, value: "" },
              } as unknown as React.ChangeEvent<HTMLInputElement>;
              handleFileChange(fakeEvent);
            }}
          >
            <p className="text-[#8a6d3b] text-sm">
              Arrastra tus fotos y videos aquí o{" "}
              <span className="underline text-[#bf953f]">selecciona archivos</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">
              JPG, PNG, WEBP, HEIC · MP4, MOV · máx. {settings?.maxFileSizeMB ?? 50} MB por archivo
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Involved codes field — only shown when there are files queued */}
          {queue.some((q) => q.status === "pending") && (
            <div className="mt-4 bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm font-medium mb-2">
                ¿Quién aparece en estas fotos?
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Agrega los códigos de invitación de otras personas que aparecen.
                Ellas podrán ver estas fotos en su galería.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Código (ej. DEF456)"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase tracking-widest focus:outline-none focus:border-[#bf953f]"
                  value={involvedInput}
                  onChange={(e) => setInvolvedInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && addInvolvedCode()}
                />
                <button
                  onClick={addInvolvedCode}
                  disabled={!involvedInput}
                  className="px-3 py-2 bg-[#f5ede0] text-[#8a6d3b] rounded-lg text-sm hover:bg-[#e8d9c0] transition disabled:opacity-40"
                >
                  Agregar
                </button>
              </div>
              {involvedCodes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {involvedCodes.map((c) => (
                    <span
                      key={c}
                      className="flex items-center gap-1.5 bg-[#f5ede0] text-[#5c4a2e] text-xs px-3 py-1 rounded-full font-mono"
                    >
                      {c}
                      <button
                        onClick={() => removeInvolvedCode(c)}
                        className="text-[#8a6d3b] hover:text-red-400 transition leading-none"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Queue */}
        {queue.length > 0 && (
          <div className="space-y-2">
            {queue.map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm">
                {item.file.type.startsWith("video/") ? (
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-xl shrink-0">🎬</div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.preview} alt="" className="w-12 h-12 object-cover rounded-lg shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.file.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(item.file.size)}</p>
                  {item.status === "error" && <p className="text-xs text-red-500">{item.error}</p>}
                </div>
                <div className="shrink-0 text-sm">
                  {item.status === "pending" && (
                    <button onClick={() => removeFromQueue(i)} className="text-gray-400 hover:text-red-400 text-lg">✕</button>
                  )}
                  {item.status === "uploading" && <span className="text-[#bf953f]">Subiendo…</span>}
                  {item.status === "done" && <span className="text-green-600">✓</span>}
                  {item.status === "error" && <span className="text-red-500">✕</span>}
                </div>
              </div>
            ))}

            {queue.some((q) => q.status === "pending") && (
              <button
                onClick={uploadAll}
                disabled={uploading}
                className="w-full py-2 rounded-lg bg-[#bf953f] text-white font-medium hover:bg-[#aa771c] transition disabled:opacity-50 mt-1"
              >
                {uploading
                  ? "Subiendo…"
                  : `Subir ${queue.filter((q) => q.status === "pending").length} archivo(s)`}
              </button>
            )}
          </div>
        )}

        {/* Own files */}
        <section>
          <h2 className="font-serif text-xl mb-4">Mis fotos y videos</h2>
          <FileGrid
            files={ownFiles}
            loading={loadingFiles}
            emptyText="Aún no has subido archivos"
            onOpen={(f) => setLightbox({ url: f.url, isVideo: isVideo(f.key) })}
          />
        </section>

        {/* Involved files */}
        {(involvedFiles.length > 0 || !loadingFiles) && (
          <section>
            <h2 className="font-serif text-xl mb-1">Fotos donde aparezco</h2>
            <p className="text-xs text-[#8a6d3b] mb-4">
              Fotos y videos de otros invitados donde te etiquetaron
            </p>
            <FileGrid
              files={involvedFiles}
              loading={loadingFiles}
              emptyText="Nadie te ha etiquetado aún"
              onOpen={(f) => setLightbox({ url: f.url, isVideo: isVideo(f.key) })}
            />
          </section>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="max-w-5xl w-full">
            {lightbox.isVideo ? (
              <video
                src={lightbox.url}
                className="w-full max-h-[85vh] rounded-xl"
                controls
                autoPlay
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt=""
                className="w-full max-h-[85vh] object-contain rounded-xl"
              />
            )}
          </div>
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none"
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function FileGrid({
  files,
  loading,
  emptyText,
  onOpen,
}: {
  files: UploadedFile[];
  loading: boolean;
  emptyText: string;
  onOpen: (f: UploadedFile) => void;
}) {
  if (loading) return <p className="text-center text-gray-400 py-8">Cargando…</p>;
  if (files.length === 0) return <p className="text-center text-gray-400 py-6">{emptyText}</p>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {files.map((file) => (
        <button
          key={file.key}
          className="aspect-square bg-gray-100 rounded-xl overflow-hidden relative"
          onClick={() => onOpen(file)}
        >
          {isVideo(file.key) ? (
            <>
              <video src={file.url} className="w-full h-full object-cover" preload="metadata" muted />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/50 rounded-full p-2 text-white text-xl">▶</div>
              </div>
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.url}
              alt=""
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
            />
          )}
        </button>
      ))}
    </div>
  );
}

export default function GaleriaPage() {
  return (
    <Suspense>
      <GaleriaContent />
    </Suspense>
  );
}
