"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface GalleryFile {
  key: string;
  url: string;
  size: number;
  uploadedAt: string;
  uploaderLabel: string;
}

function isVideo(key: string) {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "webm"].includes(ext);
}

export default function GaleriaPage() {
  const [files, setFiles] = useState<GalleryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [lightbox, setLightbox] = useState<GalleryFile | null>(null);

  useEffect(() => {
    fetch("/api/gallery/public")
      .then((r) => r.json())
      .then((data) => {
        if (!data.enabled) { setDisabled(true); return; }
        setFiles(data.files ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fdfaf6]">
        <div className="w-6 h-6 border-2 border-[#bf953f] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (disabled) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#fdfaf6] p-6">
        <p className="font-serif text-xl text-[#8a6d3b]">
          La galería está temporalmente desactivada
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fdfaf6] px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-widest text-[#bf953f]">Nuestra boda · 2026</p>
          <h1 className="font-serif text-3xl text-[#5c4a2e]">Galería de fotos</h1>
          <p className="text-sm text-[#8a6d3b]">{files.length} recuerdos compartidos</p>
        </div>

        {/* Grid */}
        {files.length === 0 ? (
          <p className="text-center text-[#8a6d3b] py-16">
            Aún no hay fotos. ¡Sé el primero en subir!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {files.map((file) => (
              <button
                key={file.key}
                className="aspect-square rounded-xl overflow-hidden bg-white shadow-sm relative group"
                onClick={() => setLightbox(file)}
              >
                {isVideo(file.key) ? (
                  <>
                    <video
                      src={`${file.url}#t=0.001`}
                      className="w-full h-full object-cover"
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="bg-black/50 rounded-full p-2 text-white text-xl">▶</div>
                    </div>
                  </>
                ) : (
                  <Image
                    src={file.url}
                    alt=""
                    fill
                    quality={60}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                )}
                {/* Uploader overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{file.uploaderLabel}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl w-full flex flex-col items-center gap-4"
          >
            {isVideo(lightbox.key) ? (
              <video
                src={lightbox.url}
                className="w-full max-h-[78vh] rounded-xl"
                controls
                autoPlay
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lightbox.url}
                alt=""
                className="w-full max-h-[78vh] object-contain rounded-xl"
              />
            )}

            <div className="flex items-center gap-5 text-sm">
              <span className="text-white/60">
                <span className="text-white/40">Por </span>
                <span className="text-white/90">{lightbox.uploaderLabel}</span>
              </span>
              <a
                href={`/api/download?key=${encodeURIComponent(lightbox.key)}`}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition"
                onClick={(e) => e.stopPropagation()}
              >
                Descargar
              </a>
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
    </main>
  );
}
