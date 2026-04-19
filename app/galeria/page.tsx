"use client";

import { useEffect, useRef, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getSavedCode, saveCode } from "@/lib/localCode";

interface UploadedFile {
  key: string;
  url: string;
  size: number;
  lastModified: string | null;
  uploadedBy: string;
  uploaderNames: string[];
  involvedCodes: string[];
  involvedNames: string[];
  isOwn: boolean;
}

interface Settings {
  maxPhotosPerCode: number;
  maxVideosPerCode: number;
  maxFileSizeMB: number;
  enabled: boolean;
  deletionLocked: boolean;
}

interface FileItem {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  progress: number; // 0-100
  error?: string;
}

interface LightboxItem {
  key: string;
  url: string;
  isVideo: boolean;
  uploaderNames: string[];
  involvedNames: string[];
  isOwn: boolean;
}

interface GuestGroup {
  codigo: string;
  nombres: string[];
  label: string;
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
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Codes to tag as involved in this upload batch
  const [involvedCodes, setInvolvedCodes] = useState<string[]>([]);
  const [guestGroups, setGuestGroups] = useState<GuestGroup[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
  const [deletingLightbox, setDeletingLightbox] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const code = codigoFromUrl || getSavedCode();
    if (code) handleVerify(code);
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
      saveCode(c);
      setCodigo(c);
      await Promise.all([
        loadFiles(c),
        fetch("/api/gallery/guests")
          .then((r) => r.json())
          .then((data) => setGuestGroups(data.groups ?? [])),
      ]);
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
        newItems.push({ file, preview: "", status: "error", progress: 0, error: `Supera el límite de ${maxMB} MB` });
        continue;
      }
      newItems.push({ file, preview: URL.createObjectURL(file), status: "pending", progress: 0 });
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

  function toggleInvolved(c: string) {
    setInvolvedCodes((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  }

  async function uploadAll() {
    const hasPending = queue.some((q) => q.status === "pending");
    if (!hasPending) return;
    setUploading(true);

    // Snapshot indices at the start to avoid stale closure issues
    const indices = queue.reduce<number[]>((acc, q, i) => {
      if (q.status === "pending") acc.push(i);
      return acc;
    }, []);

    for (const i of indices) {
      const item = queue[i];

      setQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: "uploading", progress: 0 } : q))
      );

      try {
        // 1. Presigned URL
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

        // 2. Upload to S3 con XHR para rastrear progreso
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", item.file.type);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setQueue((prev) =>
                prev.map((q, idx) => (idx === i ? { ...q, progress: pct } : q))
              );
            }
          };
          xhr.onload = () =>
            xhr.status >= 200 && xhr.status < 300
              ? resolve()
              : reject(new Error(`HTTP ${xhr.status}`));
          xhr.onerror = () => reject(new Error("Error de red"));
          xhr.send(item.file);
        });

        // 3. Confirmar metadatos en DynamoDB
        await fetch("/api/gallery/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo, key, involvedCodes, size: item.file.size }),
        });

        setQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: "done", progress: 100 } : q))
        );
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

  async function downloadAllOwn() {
    if (ownFiles.length === 0) return;
    setDownloadingAll(true);
    setDownloadProgress(0);
    for (let i = 0; i < ownFiles.length; i++) {
      const a = document.createElement("a");
      a.href = `/api/download?key=${encodeURIComponent(ownFiles[i].key)}`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadProgress(i + 1);
      if (i < ownFiles.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
    setDownloadProgress(0);
  }

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
              <p className="text-sm font-medium mb-1">
                ¿Quién aparece en estas fotos?
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Selecciona a los invitados que aparecen. Ellos podrán ver estas
                fotos en su galería.
              </p>
              <GuestCombobox
                groups={guestGroups.filter((g) => g.codigo !== codigo)}
                selected={involvedCodes}
                onToggle={toggleInvolved}
              />
            </div>
          )}
        </div>

        {/* Queue — grilla de tarjetas con progreso */}
        {queue.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {queue.map((item, i) => (
                <QueueCard
                  key={i}
                  item={item}
                  onRemove={() => removeFromQueue(i)}
                />
              ))}
            </div>

            {queue.some((q) => q.status === "pending") && (
              <button
                onClick={uploadAll}
                disabled={uploading}
                className="w-full py-2 rounded-lg bg-[#bf953f] text-white font-medium hover:bg-[#aa771c] transition disabled:opacity-50"
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
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="font-serif text-xl">Mis fotos y videos</h2>
            {ownFiles.length > 0 && (
              <button
                onClick={downloadAllOwn}
                disabled={downloadingAll}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#d4af37] text-[#8a6d3b] text-xs rounded-lg hover:bg-[#fdf5e8] transition disabled:opacity-50"
              >
                {downloadingAll ? (
                  <>
                    <span className="w-3 h-3 border border-[#bf953f] border-t-transparent rounded-full animate-spin" />
                    {downloadProgress}/{ownFiles.length}
                  </>
                ) : (
                  <>↓ Descargar todas ({ownFiles.length})</>
                )}
              </button>
            )}
          </div>
          <FileGrid
            files={ownFiles}
            loading={loadingFiles}
            emptyText="Aún no has subido archivos"
            onOpen={(f) => setLightbox({ key: f.key, url: f.url, isVideo: isVideo(f.key), uploaderNames: f.uploaderNames, involvedNames: f.involvedNames, isOwn: f.isOwn })}
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
              onOpen={(f) => setLightbox({ key: f.key, url: f.url, isVideo: isVideo(f.key), uploaderNames: f.uploaderNames, involvedNames: f.involvedNames, isOwn: f.isOwn })}
            />
          </section>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          <div onClick={(e) => e.stopPropagation()} className="max-w-5xl w-full flex flex-col items-center gap-4">
            {lightbox.isVideo ? (
              <video
                src={lightbox.url}
                className="w-full max-h-[78vh] rounded-xl"
                controls
                autoPlay
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt=""
                className="w-full max-h-[78vh] object-contain rounded-xl"
              />
            )}

            {/* Info */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
              {lightbox.uploaderNames.length > 0 && (
                <span className="text-white/60">
                  {lightbox.isOwn ? "Subida por ti" : (
                    <><span className="text-white/40">Subida por </span><span className="text-white/90">{lightbox.uploaderNames.join(" & ")}</span></>
                  )}
                </span>
              )}
              {lightbox.involvedNames.length > 0 && (
                <span className="text-white/60">
                  <span className="text-white/40">Con </span>
                  <span className="text-white/90">{lightbox.involvedNames.join(", ")}</span>
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <a
                href={`/api/download?key=${encodeURIComponent(lightbox.key)}`}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition"
                onClick={(e) => e.stopPropagation()}
              >
                Descargar
              </a>
              {lightbox.isOwn && !settings?.deletionLocked && (
                <button
                  disabled={deletingLightbox}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm('¿Eliminar este archivo?')) return;
                    setDeletingLightbox(true);
                    try {
                      await fetch('/api/gallery/delete', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ codigo, key: lightbox.key }),
                      });
                      setAllFiles((prev) => prev.filter((f) => f.key !== lightbox.key));
                      setLightbox(null);
                    } finally {
                      setDeletingLightbox(false);
                    }
                  }}
                  className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-sm rounded-lg transition disabled:opacity-50"
                >
                  {deletingLightbox ? 'Eliminando…' : 'Eliminar'}
                </button>
              )}
            </div>
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

function QueueCard({ item, onRemove }: { item: FileItem; onRemove: () => void }) {
  const isVid = item.file.type.startsWith("video/");

  return (
    <div className="rounded-xl overflow-hidden bg-white shadow-sm relative aspect-square">
      {/* Preview */}
      {isVid ? (
        <video
          src={item.preview}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.preview}
          alt=""
          className="w-full h-full object-cover"
        />
      )}

      {/* Overlay según estado */}
      {item.status === "pending" && (
        <div className="absolute inset-0 flex flex-col justify-between p-2">
          {/* Botón quitar */}
          <div className="flex justify-end">
            <button
              onClick={onRemove}
              className="w-7 h-7 rounded-full bg-black/60 text-white text-sm flex items-center justify-center hover:bg-black/80 transition"
              aria-label="Quitar"
            >
              ✕
            </button>
          </div>
          {/* Nombre del archivo */}
          <div className="bg-black/50 rounded-lg px-2 py-1">
            <p className="text-white text-xs truncate">{item.file.name}</p>
            <p className="text-white/60 text-xs">{formatBytes(item.file.size)}</p>
          </div>
        </div>
      )}

      {item.status === "uploading" && (
        <div className="absolute inset-x-0 bottom-0">
          {/* Barra de progreso */}
          <div className="bg-black/40 px-3 pt-2 pb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-white text-xs font-medium">Subiendo…</span>
              <span className="text-white text-xs font-mono">{item.progress}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-[#bf953f] via-[#d4af37] to-[#aa771c] rounded-full transition-all duration-200"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {item.status === "done" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-10 h-10 rounded-full bg-green-500/90 flex items-center justify-center shadow-lg">
            <span className="text-white text-xl leading-none">✓</span>
          </div>
        </div>
      )}

      {item.status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 px-3 text-center">
          <span className="text-red-400 text-2xl mb-1">✕</span>
          <p className="text-white text-xs leading-snug">{item.error}</p>
        </div>
      )}
    </div>
  );
}

function GuestCombobox({
  groups,
  selected,
  onToggle,
}: {
  groups: GuestGroup[];
  selected: string[];
  onToggle: (codigo: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? groups.filter(
        (g) =>
          g.label.toLowerCase().includes(query.toLowerCase()) ||
          g.codigo.toLowerCase().includes(query.toLowerCase())
      )
    : groups;

  const closeOnOutside = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [closeOnOutside]);

  const selectedGroups = groups.filter((g) => selected.includes(g.codigo));

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder="Buscar por nombre..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#bf953f]"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map((g) => {
            const isSelected = selected.includes(g.codigo);
            return (
              <li key={g.codigo}>
                <button
                  type="button"
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-[#fdf5e8] transition ${
                    isSelected ? "bg-[#f5ede0]" : ""
                  }`}
                  onClick={() => {
                    onToggle(g.codigo);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  <span>
                    <span className="text-[#5c4a2e]">{g.label}</span>
                    <span className="ml-2 text-xs text-gray-400 font-mono">{g.codigo}</span>
                  </span>
                  {isSelected && <span className="text-[#bf953f] text-base">✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
          Sin resultados
        </div>
      )}

      {/* Selected tags */}
      {selectedGroups.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {selectedGroups.map((g) => (
            <span
              key={g.codigo}
              className="flex items-center gap-1.5 bg-[#f5ede0] text-[#5c4a2e] text-xs px-3 py-1.5 rounded-full"
            >
              {g.label}
              <button
                type="button"
                onClick={() => onToggle(g.codigo)}
                className="text-[#8a6d3b] hover:text-red-400 transition leading-none ml-0.5"
              >
                ×
              </button>
            </span>
          ))}
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
      {files.map((file) => {
        const tagged = file.involvedNames;
        return (
          <div key={file.key} className="rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
            <button
              className="aspect-square bg-gray-100 relative overflow-hidden"
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

            {tagged.length > 0 && (
              <div className="px-2.5 py-2 text-xs text-[#8a6d3b] leading-snug">
                <span className="text-gray-400">Con </span>
                {tagged.join(", ")}
              </div>
            )}
          </div>
        );
      })}
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
