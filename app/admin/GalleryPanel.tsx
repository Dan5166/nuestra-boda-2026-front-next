"use client";

import { useEffect, useRef, useState } from "react";

interface UploadedFile {
  key: string;
  url: string;
  size: number;
  lastModified: string | null;
  codigo: string;
  names: string[];
  involvedCodes: string[];
  involvedNames: string[];
}

interface Settings {
  maxPhotosPerCode: number;
  maxVideosPerCode: number;
  maxFileSizeMB: number;
  enabled: boolean;
  deletionLocked: boolean;
}

interface LightboxItem {
  key: string;
  url: string;
  isVideo: boolean;
  names: string[];
  codigo: string;
  involvedNames: string[];
  involvedCodes: string[];
}

function isVideo(key: string) {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "webm"].includes(ext);
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function GalleryPanel() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({
    maxPhotosPerCode: 10,
    maxVideosPerCode: 2,
    maxFileSizeMB: 50,
    enabled: true,
    deletionLocked: false,
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [filterCodigo, setFilterCodigo] = useState("");
  const [lightbox, setLightbox] = useState<LightboxItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function handleDownloadAll() {
    const keys = filtered.map((f) => f.key);
    if (keys.length === 0) return;
    setDownloadingAll(true);
    setDownloadProgress(0);
    for (let i = 0; i < keys.length; i++) {
      const a = document.createElement("a");
      a.href = `/api/download?key=${encodeURIComponent(keys[i])}`;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadProgress(i + 1);
      if (i < keys.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
    setDownloadingAll(false);
    setDownloadProgress(0);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/gallery").then((r) => r.json()),
      fetch("/api/admin/gallery/settings").then((r) => r.json()),
    ]).then(([galleryData, settingsData]) => {
      setFiles(galleryData.files ?? []);
      if (settingsData && !settingsData.message) setSettings(settingsData);
      setLoading(false);
    });
  }, []);

  // Close lightbox on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filtered = files.filter(
    (f) =>
      !filterCodigo ||
      f.codigo.toLowerCase().includes(filterCodigo.toLowerCase()) ||
      f.names.some((n) => n.toLowerCase().includes(filterCodigo.toLowerCase()))
  );

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  function openLightbox(file: UploadedFile) {
    setLightbox({
      key: file.key,
      url: file.url,
      isVideo: isVideo(file.key),
      names: file.names,
      codigo: file.codigo,
      involvedNames: file.involvedNames,
      involvedCodes: file.involvedCodes,
    });
  }

  async function handleSaveSettings() {
    setSavingSettings(true);
    setSettingsSaved(false);
    try {
      const res = await fetch("/api/admin/gallery/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) setSettingsSaved(true);
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleDelete(key: string) {
    if (!confirm("¿Eliminar este archivo?")) return;
    setDeleting(key);
    try {
      await fetch("/api/admin/gallery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      setFiles((prev) => prev.filter((f) => f.key !== key));
      if (lightbox?.key === key) {
        setLightbox(null);
      }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-8">
      {/* Settings */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-serif text-lg mb-4">Configuración de la galería</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Fotos por código
            <input
              type="number"
              min={0}
              value={settings.maxPhotosPerCode}
              onChange={(e) =>
                setSettings((s) => ({ ...s, maxPhotosPerCode: Number(e.target.value) }))
              }
              className="border border-gray-300 rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Videos por código
            <input
              type="number"
              min={0}
              value={settings.maxVideosPerCode}
              onChange={(e) =>
                setSettings((s) => ({ ...s, maxVideosPerCode: Number(e.target.value) }))
              }
              className="border border-gray-300 rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Tamaño máx. (MB)
            <input
              type="number"
              min={1}
              value={settings.maxFileSizeMB}
              onChange={(e) =>
                setSettings((s) => ({ ...s, maxFileSizeMB: Number(e.target.value) }))
              }
              className="border border-gray-300 rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Estado
            <select
              value={settings.enabled ? "on" : "off"}
              onChange={(e) =>
                setSettings((s) => ({ ...s, enabled: e.target.value === "on" }))
              }
              className="border border-gray-300 rounded px-3 py-2"
            >
              <option value="on">Activada</option>
              <option value="off">Desactivada</option>
            </select>
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={settings.deletionLocked}
            onChange={(e) => setSettings((s) => ({ ...s, deletionLocked: e.target.checked }))}
            className="accent-red-500 w-4 h-4"
          />
          Bloquear borrado de archivos (invitados)
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-4 py-2 bg-[#bf953f] text-white text-sm rounded hover:bg-[#aa771c] transition disabled:opacity-50"
          >
            {savingSettings ? "Guardando…" : "Guardar configuración"}
          </button>
          {settingsSaved && (
            <span className="text-green-600 text-sm">Guardado</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow text-center">
          <p className="text-2xl font-bold text-[#bf953f]">{files.length}</p>
          <p className="text-xs text-gray-500 mt-1">Archivos totales</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow text-center">
          <p className="text-2xl font-bold text-blue-500">
            {files.filter((f) => !isVideo(f.key)).length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Fotos</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow text-center">
          <p className="text-2xl font-bold text-purple-500">
            {files.filter((f) => isVideo(f.key)).length}
          </p>
          <p className="text-xs text-gray-500 mt-1">Videos</p>
        </div>
      </div>

      {/* Filter + download all */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Filtrar por código o nombre..."
          className="border border-gray-300 rounded px-3 py-2 text-sm w-56"
          value={filterCodigo}
          onChange={(e) => setFilterCodigo(e.target.value)}
        />
        <span className="text-sm text-gray-400">
          {filtered.length} archivo{filtered.length !== 1 ? "s" : ""} · {formatBytes(totalSize)} total
        </span>
        <button
          onClick={handleDownloadAll}
          disabled={downloadingAll || filtered.length === 0}
          className="ml-auto px-4 py-2 bg-[#bf953f] text-white text-sm rounded-lg hover:bg-[#aa771c] transition disabled:opacity-50 flex items-center gap-2"
        >
          {downloadingAll ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {downloadProgress}/{filtered.length}
            </>
          ) : (
            <>↓ Descargar {filterCodigo ? "filtrados" : "todos"} ({filtered.length})</>
          )}
        </button>
      </div>

      {/* Gallery grid */}
      {loading ? (
        <p className="text-center text-gray-400 py-10">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-400 py-10">Sin archivos</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filtered.map((file) => (
            <div
              key={file.key}
              className="rounded-xl overflow-hidden bg-white shadow-sm flex flex-col"
            >
              {/* Image / video — clickable to open lightbox */}
              <div
                className="relative aspect-square bg-gray-100 cursor-pointer group overflow-hidden"
                onClick={() => openLightbox(file)}
              >
                {isVideo(file.key) ? (
                  <>
                    <video
                      src={file.url}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/50 rounded-full p-2 text-white text-xl">▶</div>
                    </div>
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={file.url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                )}
              </div>

              {/* Info below image — always visible */}
              <div className="px-2.5 py-2 flex flex-col gap-1">
                {/* Uploader */}
                <div className="flex items-baseline gap-1.5 min-w-0">
                  <span className="font-mono text-xs text-gray-400 shrink-0">{file.codigo}</span>
                  {file.names.length > 0 && (
                    <span className="text-xs text-[#5c4a2e] truncate">{file.names.join(", ")}</span>
                  )}
                </div>

                {/* Tagged */}
                {file.involvedCodes.length > 0 && (
                  <div className="text-xs text-[#8a6d3b] leading-snug">
                    <span className="text-gray-400">Con </span>
                    {file.involvedNames.length > 0
                      ? file.involvedNames.join(", ")
                      : file.involvedCodes.join(", ")}
                  </div>
                )}

                {/* Delete */}
                <button
                  onClick={() => handleDelete(file.key)}
                  disabled={deleting === file.key}
                  className="text-xs text-red-400 hover:text-red-600 transition text-left mt-0.5 disabled:opacity-40"
                >
                  {deleting === file.key ? "Eliminando…" : "Eliminar"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* Media */}
          <div
            className="relative max-w-5xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.isVideo ? (
              <video
                ref={videoRef}
                src={lightbox.url}
                className="w-full max-h-[80vh] rounded-xl"
                controls
                autoPlay
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt=""
                className="w-full max-h-[80vh] object-contain rounded-xl"
              />
            )}
          </div>

          {/* Info bar */}
          <div
            className="mt-4 flex flex-col items-center gap-2 text-white text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="font-mono bg-white/10 px-3 py-1 rounded-full">
                {lightbox.codigo}
              </span>
              {lightbox.names.length > 0 && (
                <span className="text-white/80">{lightbox.names.join(", ")}</span>
              )}
            </div>
            {lightbox.involvedCodes.length > 0 && (
              <div className="flex items-center gap-2 text-white/60 text-xs">
                <span>También aparecen:</span>
                {lightbox.involvedCodes.map((c, i) => (
                  <span key={c} className="font-mono bg-white/10 px-2 py-0.5 rounded-full">
                    {c}
                    {lightbox.involvedNames[i] ? ` · ${lightbox.involvedNames[i]}` : ""}
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-1">
              <a
                href={`/api/download?key=${encodeURIComponent(lightbox.key)}`}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition"
                onClick={(e) => e.stopPropagation()}
              >
                Descargar
              </a>
              <button
                disabled={deleting === lightbox.key}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(lightbox.key);
                }}
                className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white text-sm rounded-lg transition disabled:opacity-50"
              >
                {deleting === lightbox.key ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none transition"
            onClick={() => setLightbox(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
