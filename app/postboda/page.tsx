"use client";

import Link from "next/link";

const links = [
  {
    emoji: "📷",
    title: "Subir fotos y videos",
    description: "Comparte los recuerdos que capturaste ese día",
    href: "/subir",
  },
  {
    emoji: "🖼️",
    title: "Ver la galería",
    description: "Revive el día a través de los ojos de todos",
    href: "/galeria",
  },
];

export default function PostbodaPage() {
  return (
    <main className="min-h-screen bg-[#fdfaf6] text-[#5c4a2e]">
      {/* Header */}
      <div
        className="relative py-14 px-6 text-center bg-cover bg-center"
        style={{ backgroundImage: "url(/assets/fondo-movil.webp)" }}
      >
        <div
          className="absolute inset-0 hidden md:block bg-cover bg-center"
          style={{ backgroundImage: "url(/assets/fondo-desktop.webp)" }}
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 space-y-2">
          <p className="uppercase tracking-[0.3em] text-xs text-white/70">
            Dominic & Danyael · 2026
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-white">
            Post-boda
          </h1>
          <p className="text-white/80 text-sm md:text-base max-w-sm mx-auto leading-relaxed">
            Gracias por haber sido parte de este día tan especial.
            Aquí puedes subir tus fotos y ver los recuerdos de todos.
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="px-4 py-12 max-w-md mx-auto space-y-4">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-5 px-6 py-6 rounded-2xl bg-white border border-[#e8d9c0] shadow-sm hover:shadow-md hover:border-[#d4af37] transition-all duration-150 active:scale-[0.98]"
          >
            <span className="text-5xl shrink-0" role="img" aria-label={item.title}>
              {item.emoji}
            </span>
            <span className="flex flex-col">
              <span className="font-serif text-xl text-[#5c4a2e]">{item.title}</span>
              <span className="text-sm text-[#8a6d3b] mt-0.5 leading-snug">
                {item.description}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {/* Verse */}
      <div className="pb-14 text-center px-6">
        <p className="font-serif text-base italic text-[#8a6d3b] leading-relaxed max-w-xs mx-auto">
          &ldquo;Dios es amor; y el que permanece en amor,
          permanece en Dios, y Dios en él.&rdquo;
        </p>
        <p className="text-sm mt-2 text-[#aa771c]">1 Juan 4:16</p>
      </div>
    </main>
  );
}
