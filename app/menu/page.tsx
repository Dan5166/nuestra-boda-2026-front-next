"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { getSavedCode, saveCode } from "@/lib/localCode";
import Loader from "../components/Loader";

const LINK_GOOGLE_MAPS =
  "https://www.google.com/maps/place/Hacienda+Los+Naranjos/@-33.6741379,-70.7297751,17z/data=!3m1!4b1!4m6!3m5!1s0x966320a82211b543:0xd22ecaa048bc51a8!8m2!3d-33.6741424!4d-70.7272002!16s%2Fg%2F11bwm7x0gb?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D";

interface MenuCard {
  emoji: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
}

function MenuContent() {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code")?.toUpperCase() || "";

  const buscarCodigo = async (code: string) => {
    if (!code) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/by-code/${code}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.usuarios?.length > 0) {
        saveCode(code);
        setCodigo(code);
      }
    } catch {
      console.error("Error al buscar código");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const code = codeFromUrl || getSavedCode();
    if (code) buscarCodigo(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withCode = (path: string) =>
    codigo ? `${path}?code=${codigo}` : path;

  const cards: MenuCard[] = [
    {
      emoji: "💌",
      title: "Ver mi invitación",
      description: "Lee la invitación de la boda",
      href: withCode("/invitation"),
    },
    {
      emoji: "🗺️",
      title: "Cómo llegar",
      description: "Ver el lugar en el mapa",
      href: LINK_GOOGLE_MAPS,
      external: true,
    },
    {
      emoji: "📸",
      title: "Subir fotos y videos",
      description: "Comparte un recuerdo de la boda",
      href: withCode("/galeria"),
    },
    {
      emoji: "🎁",
      title: "Regalos",
      description: "Opciones para bendecirnos",
      href:
        withCode("/rsvp") +
        (codigo ? "&seccion=regalos" : "?seccion=regalos"),
    },
  ];

  if (loading) return <Loader />;

  return (
    <div className="min-h-screen bg-[#fdfaf6] text-[#5c4a2e]">
      {/* ===== CABECERA ===== */}
      <div
        className="relative py-10 md:py-16 px-6 text-center bg-cover bg-center"
        style={{ backgroundImage: "url(/assets/fondo-movil.webp)" }}
      >
        <div
          className="absolute inset-0 hidden md:block bg-cover bg-center"
          style={{ backgroundImage: "url(/assets/fondo-desktop.webp)" }}
        />
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10">
          <p className="uppercase tracking-[0.3em] text-xs text-white/70 mb-2">
            Bienvenido a nuestra boda
          </p>
          <h1 className="font-serif text-3xl md:text-5xl text-white mb-2">
            Dominic <span className="italic">&</span> Danyael
          </h1>
          <p className="text-white/80 text-sm md:text-lg tracking-widest">
            19 · Abril · 2026
          </p>
        </div>
      </div>

      {/* ===== PREGUNTA ===== */}
      <div className="pt-7 pb-4 px-6 text-center">
        <h2 className="font-serif text-2xl md:text-3xl text-[#5c4a2e]">
          ¿Qué deseas hacer?
        </h2>
        <p className="text-[#8a6d3b] mt-1.5 text-sm md:text-base">
          Toca una opción para continuar
        </p>
      </div>

      {/* ===== TARJETAS ===== */}
      <div className="px-4 pb-14 max-w-xl mx-auto">
        {/* Mobile: lista vertical full-width | Desktop: grilla 2×2 */}
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4">
          {cards.map((card, i) => {
            const inner = (
              <>
                {/* Emoji */}
                <span
                  className="
                    text-5xl leading-none shrink-0
                    sm:text-6xl sm:mb-3
                  "
                  role="img"
                  aria-label={card.title}
                >
                  {card.emoji}
                </span>

                {/* Texto */}
                <span className="flex flex-col sm:items-center sm:text-center">
                  <span className="font-serif text-xl leading-tight text-[#5c4a2e]">
                    {card.title}
                  </span>
                  <span className="text-sm text-[#8a6d3b] mt-0.5 leading-snug">
                    {card.description}
                  </span>
                </span>
              </>
            );

            const baseCard = `
              flex flex-row items-center gap-5 px-5 py-5 min-h-[80px]
              sm:flex-col sm:items-center sm:justify-center sm:gap-0 sm:px-4 sm:py-7 sm:min-h-[190px]
              rounded-2xl sm:rounded-3xl
              bg-white border border-[#e8d9c0]
              shadow-sm hover:shadow-md hover:border-[#d4af37]
              transition-all duration-150 active:scale-[0.98]
              cursor-pointer select-none
            `;

            if (card.external) {
              return (
                <a
                  key={i}
                  href={card.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={baseCard}
                >
                  {inner}
                </a>
              );
            }

            return (
              <Link key={i} href={card.href} className={baseCard}>
                {inner}
              </Link>
            );
          })}
        </div>

        {/* ===== FRASE BÍBLICA ===== */}
        <div className="mt-10 text-center px-4">
          <p className="font-serif text-base md:text-lg italic text-[#8a6d3b] leading-relaxed">
            &ldquo;Dios es amor; y el que permanece en amor,
            permanece en Dios, y Dios en él.&rdquo;
          </p>
          <p className="text-sm mt-2 text-[#aa771c]">1 Juan 4:16</p>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <footer className="py-8 text-center text-xs text-gray-400 border-t border-[#e8d9c0]">
        Dominic & Danyael · 2026 · Con amor 💛
      </footer>
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={<Loader />}>
      <MenuContent />
    </Suspense>
  );
}
