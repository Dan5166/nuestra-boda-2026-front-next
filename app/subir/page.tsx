"use client";

import { useEffect, useRef, useState } from "react";

interface PublicSettings {
  enabled: boolean;
  maxFileSizeMBPhoto: number;
  maxFileSizeMBVideo: number;
  maxPhotosPerSession: number;
  maxVideosPerSession: number;
}

interface FileItem {
  id: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  preview?: string;
}

const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ALLOWED_TYPES = [...ALLOWED_PHOTO_TYPES, ...ALLOWED_VIDEO_TYPES];

function isVideoFile(file: File) {
  return ALLOWED_VIDEO_TYPES.includes(file.type);
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export default function SubirPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [queue, setQueue] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sessionPhotos, setSessionPhotos] = useState(0);
  const [sessionVideos, setSessionVideos] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    fetch("/api/public-upload/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => setLoadError(true));
  }, []);

  const pendingPhotos = queue.filter(
    (f) => f.status !== "done" && !isVideoFile(f.file)
  ).length;
  const pendingVideos = queue.filter(
    (f) => f.status !== "done" && isVideoFile(f.file)
  ).length;

  function validateAndAdd(files: File[]) {
    if (!settings) return;
    const toAdd: FileItem[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) continue;

      const preview = URL.createObjectURL(file);
      previewUrlsRef.current.add(preview);

      const isVideo = isVideoFile(file);
      const maxMB = isVideo
        ? settings.maxFileSizeMBVideo
        : settings.maxFileSizeMBPhoto;

      if (file.size > maxMB * 1024 * 1024) {
        toAdd.push({
          id: uid(),
          file,
          preview,
          status: "error",
          progress: 0,
          error: `Tamaño excede ${maxMB} MB`,
        });
        continue;
      }

      // Soft session limit check
      const currentPhotos = sessionPhotos + pendingPhotos;
      const currentVideos = sessionVideos + pendingVideos;
      if (!isVideo && currentPhotos >= settings.maxPhotosPerSession) {
        toAdd.push({
          id: uid(),
          file,
          preview,
          status: "error",
          progress: 0,
          error: `Límite de sesión: ${settings.maxPhotosPerSession} fotos`,
        });
        continue;
      }
      if (isVideo && currentVideos >= settings.maxVideosPerSession) {
        toAdd.push({
          id: uid(),
          file,
          preview,
          status: "error",
          progress: 0,
          error: `Límite de sesión: ${settings.maxVideosPerSession} videos`,
        });
        continue;
      }

      toAdd.push({ id: uid(), file, preview, status: "pending", progress: 0 });
    }

    setQueue((prev) => [...prev, ...toAdd]);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    validateAndAdd(Array.from(e.dataTransfer.files));
  }

  async function handleUpload() {
    if (uploading) return;
    const pending = queue.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    setUploading(true);

    for (const item of pending) {
      setQueue((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: "uploading" as const } : f
        )
      );

      try {
        // 1. Get presigned URL
        const presignRes = await fetch("/api/public-upload/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: item.file.name,
            contentType: item.file.type,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json();
          setQueue((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, status: "error" as const, error: err.message }
                : f
            )
          );
          continue;
        }

        const { url, key } = await presignRes.json();

        // 2. Upload directly to S3 with XHR for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setQueue((prev) =>
                prev.map((f) =>
                  f.id === item.id ? { ...f, progress: pct } : f
                )
              );
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`HTTP ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error("Error de red"));
          xhr.open("PUT", url);
          xhr.setRequestHeader("Content-Type", item.file.type);
          xhr.send(item.file);
        });

        // 3. Confirm metadata
        await fetch("/api/public-upload/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            size: item.file.size,
            uploaderName: name.trim() || undefined,
          }),
        });

        setQueue((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: "done" as const, progress: 100 }
              : f
          )
        );

        if (isVideoFile(item.file)) setSessionVideos((n) => n + 1);
        else setSessionPhotos((n) => n + 1);
      } catch {
        setQueue((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, status: "error" as const, error: "Error al subir" }
              : f
          )
        );
      }
    }

    setUploading(false);
  }

  function removeItem(id: string) {
    setQueue((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.preview) {
        URL.revokeObjectURL(item.preview);
        previewUrlsRef.current.delete(item.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  }

  const doneCount = queue.filter((f) => f.status === "done").length;
  const hasPending = queue.some((f) => f.status === "pending");

  // ─── Render: disabled / loading states ─────────────────────────────────────

  if (loadError) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fdf6ee] p-4">
        <p className="text-[#8a6d3b]">No se pudieron cargar los ajustes. Intenta de nuevo.</p>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fdf6ee]">
        <div className="w-6 h-6 border-2 border-[#bf953f] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!settings.enabled) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fdf6ee] p-6">
        <div className="text-center space-y-2">
          <p className="font-serif text-2xl text-[#5c4a2e]">Las subidas están desactivadas</p>
          <p className="text-sm text-[#8a6d3b]">Por el momento no se pueden subir archivos.</p>
        </div>
      </main>
    );
  }

  // ─── Main page ──────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-[#fdf6ee] py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-[#bf953f]">Nuestra boda · 2026</p>
          <h1 className="font-serif text-3xl text-[#5c4a2e]">Comparte tus fotos y videos</h1>
          <p className="text-sm text-[#8a6d3b]">
            Sube los recuerdos que quieres compartir con los novios
          </p>
        </div>

        {/* Name input */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-1">
          <label className="text-sm text-[#5c4a2e] font-medium">
            Tu nombre <span className="text-[#8a6d3b] font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            placeholder="Ej: María García"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="w-full border border-[#e8d9c0] rounded-lg px-3 py-2 text-sm text-[#3d2b1f] placeholder-[#c2a87a] focus:outline-none focus:ring-2 focus:ring-[#bf953f]/40"
          />
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`bg-white rounded-2xl shadow-sm border-2 border-dashed cursor-pointer transition p-8 flex flex-col items-center gap-3 ${
            dragOver
              ? "border-[#bf953f] bg-[#fdf1e0]"
              : "border-[#e8d9c0] hover:border-[#bf953f]/60"
          }`}
        >
          <div className="text-4xl select-none">📷</div>
          <p className="text-sm text-[#5c4a2e] font-medium text-center">
            Arrastra archivos aquí o toca para elegir
          </p>
          <p className="text-xs text-[#8a6d3b] text-center">
            Fotos (JPG, PNG, WEBP, HEIC) · Videos (MP4, MOV, WEBM)
            <br />
            Máx. {settings.maxFileSizeMBPhoto} MB por foto · {settings.maxFileSizeMBVideo} MB por video
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) validateAndAdd(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
        </div>

        {/* Session info */}
        {settings && (
          <div className="flex gap-3 text-xs text-[#8a6d3b]">
            <span className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
              Fotos esta sesión: <strong className="text-[#5c4a2e]">{sessionPhotos}</strong>/{settings.maxPhotosPerSession}
            </span>
            <span className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
              Videos esta sesión: <strong className="text-[#5c4a2e]">{sessionVideos}</strong>/{settings.maxVideosPerSession}
            </span>
          </div>
        )}

        {/* File queue */}
        {queue.length > 0 && (
          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3"
              >
                {/* Preview thumbnail */}
                <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-[#f0e6d3] flex items-center justify-center">
                  {item.preview ? (
                    isVideoFile(item.file) ? (
                      <video
                        src={item.preview}
                        className="w-full h-full object-cover"
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className="w-full h-full object-cover"
                      />
                    )
                  ) : (
                    <span className="text-xl select-none">
                      {isVideoFile(item.file) ? "🎬" : "🖼️"}
                    </span>
                  )}
                </div>

                {/* Info + progress */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#3d2b1f] truncate">{item.file.name}</p>
                  <p className="text-xs text-[#8a6d3b]">{formatBytes(item.file.size)}</p>

                  {item.status === "uploading" && (
                    <div className="mt-1.5 h-1.5 bg-[#f0e6d3] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#bf953f] rounded-full transition-all duration-200"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {item.status === "error" && (
                    <p className="text-xs text-red-500 mt-0.5">{item.error}</p>
                  )}
                </div>

                {/* Status badge */}
                <div className="shrink-0">
                  {item.status === "done" && (
                    <span className="text-green-500 text-lg">✓</span>
                  )}
                  {item.status === "uploading" && (
                    <span className="w-4 h-4 border-2 border-[#bf953f] border-t-transparent rounded-full animate-spin block" />
                  )}
                  {item.status === "pending" && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-[#c2a87a] hover:text-red-400 text-lg leading-none transition"
                    >
                      ×
                    </button>
                  )}
                  {item.status === "error" && (
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none transition"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {hasPending && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 rounded-xl bg-[#bf953f] text-white font-medium text-sm hover:bg-[#aa771c] transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Subiendo…
              </>
            ) : (
              <>Subir archivos ({queue.filter((f) => f.status === "pending").length})</>
            )}
          </button>
        )}

        {/* Success summary */}
        {doneCount > 0 && !hasPending && !uploading && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-1">
            <p className="text-2xl">🎉</p>
            <p className="font-serif text-lg text-[#5c4a2e]">
              {doneCount === 1
                ? "¡Archivo subido con éxito!"
                : `¡${doneCount} archivos subidos con éxito!`}
            </p>
            <p className="text-xs text-[#8a6d3b]">
              Gracias por compartir este momento con nosotros
            </p>
            <button
              onClick={() => {
                queue.forEach((item) => {
                  if (item.preview) {
                    URL.revokeObjectURL(item.preview);
                    previewUrlsRef.current.delete(item.preview);
                  }
                });
                setQueue([]);
              }}
              className="mt-2 text-xs text-[#bf953f] underline underline-offset-2"
            >
              Subir más archivos
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
