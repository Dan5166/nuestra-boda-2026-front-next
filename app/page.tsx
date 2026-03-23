"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import WeddingCountdown from "./components/WeddingCountdown";
import BotonesRegaloYTransferencia from "./components/BotonesRegaloYTransferencia";
import WeddingMap from "./components/WeddingMap";
import Loader from "./components/Loader";

const LINK_GOOGLE_MAPS =
  "https://www.google.com/maps/place/Hacienda+Los+Naranjos/@-33.6741379,-70.7297751,17z/data=!3m1!4b1!4m6!3m5!1s0x966320a82211b543:0xd22ecaa048bc51a8!8m2!3d-33.6741424!4d-70.7272002!16s%2Fg%2F11bwm7x0gb?entry=ttu&g_ep=EgoyMDI2MDIxNi4wIKXMDSoASAFQAw%3D%3D";

const images = [
  "/assets/1-261.webp",
  "/assets/1-246.webp",
  "/assets/1-196.webp",
  "/assets/1-155.webp",
  "/assets/1-61.webp",
  "/assets/1-98.webp",
  "/assets/1-44.webp",
  "/assets/1-68.webp",
  "/assets/1-51.webp",
  "/assets/1-74.webp",
  "/assets/1-14.webp",
  "/assets/1-22.webp",
  "/assets/1-133.webp",
  "/assets/1-145.webp",
  "/assets/1-153.webp",
];

export default function Home() {
  const [mostrarMapa, setMostrarMapa] = useState(false);
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code")?.toUpperCase() || "";

  const buscarCodigo = async (codigo: string) => {
    setLoading(true);

    try {
      if (!codigo) {
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/users/by-code/${codigo}`);
      if (!res.ok) throw new Error();

      const data = await res.json();

      const invitadosMap = data.usuarios.map((u: { nombre: string }) => ({
        nombre: u.nombre,
      }));

      if (invitadosMap.length > 0) {
        setMostrarMapa(true);
      }
    } catch {
      console.error("Error al buscar código");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      buscarCodigo(code.toUpperCase());
    }
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="relative min-h-screen text-[#5c4a2e]">
      {/* ===== HERO ===== */}
      <section
        className="
          relative min-h-svh md:min-h-screen
          flex items-center justify-center
          bg-cover bg-center
        "
        style={{ backgroundImage: "url(/assets/fondo-movil.webp)" }}
      >
        <div
          className="absolute inset-0 hidden md:block bg-cover bg-center"
          style={{ backgroundImage: "url(/assets/fondo-desktop.webp)" }}
        />

        <div className="absolute inset-0 bg-black/30" />

        <div className="relative z-10 text-center px-6">
          <p className="uppercase tracking-[0.35em] text-sm md:text-lg text-white mb-4">
            Nos casamos
          </p>

          <h1 className="font-serif text-4xl md:text-7xl text-white mb-6">
            Dominic <span className="italic">&</span> Danyael
          </h1>

          <p className="text-white mb-10 text-sm md:text-lg tracking-widest">
            19 · Abril · 2026
          </p>

          <WeddingCountdown />

          <Link
            href={`/rsvp${codeFromUrl ? `?code=${codeFromUrl}` : ""}`}
            className="inline-block px-10 py-4 bg-linear-to-r from-[#bf953f] via-[#d4af37] to-[#aa771c] text-white font-bold uppercase tracking-[0.25em] text-xs rounded-full shadow-xl"
          >
            Confirmar asistencia
          </Link>
        </div>
      </section>

      {/* ===== FRASE ===== */}
      <section className="py-24 bg-[#fdfaf6] text-center px-6">
        <p className="font-serif text-2xl md:text-3xl italic max-w-3xl mx-auto">
          "Y nosotros hemos conocido y creído el amor que Dios tiene para con
          nosotros. Dios es amor; y el que permanece en amor, permanece en Dios,
          y Dios en él."
        </p>
        <p className="text-lg mt-6 opacity-90">1 Juan 4:16</p>
      </section>

      {/* ===== NUESTRA HISTORIA ===== */}
      <section className="py-24 px-6 max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <div>
          <h2 className="font-serif text-4xl mb-6">Nuestra historia</h2>
          <p className="text-sm leading-relaxed text-gray-700">
            Nuestra historia comenzó bajo la guía de Dios, quien unió nuestros
            caminos en el momento perfecto. Desde entonces, hemos aprendido que
            el amor verdadero se construye con fe, paciencia, perdón y oración.
            <br />
            <br />
            Creemos que este paso no es solo una promesa entre nosotros, sino un
            pacto delante del Señor, confiando en que Él será siempre el centro
            y fundamento de nuestra vida juntos.
            <br />
            <br />
            Hoy queremos celebrar este regalo que Dios nos ha dado, rodeados de
            quienes han sido parte de nuestro caminar y han orado por nosotros
            🤍
          </p>
        </div>

        <div className="grid grid-cols-3 grid-rows-2 gap-4">
          <img
            src="/assets/foto-pichilemnu-iglesia.webp"
            alt=""
            className="col-span-2 row-span-2 rounded-2xl shadow-lg object-cover w-full h-full"
          />
          <img
            src="/assets/foto-anillos.webp"
            alt=""
            className="rounded-2xl shadow-lg object-cover w-full h-full"
          />
          <img
            src="/assets/pelotini.webp"
            alt=""
            className="rounded-2xl shadow-lg object-cover w-full h-full"
          />
        </div>
      </section>

      {/* ===== GALERÍA ===== */}
      <section className="py-24 bg-[#fdfaf6] px-6">
        <h2 className="font-serif text-4xl text-center mb-12">Nosotros</h2>

        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 auto-rows-[180px] gap-6">
          {images.map((img, i) => {
            const bentoClass =
              i === 0
                ? "col-span-2 row-span-2"
                : i === 2
                  ? ""
                  : i === images.length - 1
                    ? ""
                    : i === 3
                      ? "col-span-2"
                      : i % 2 === 0
                        ? "row-span-2"
                        : "";

            return (
              <img
                key={i}
                src={img}
                alt=""
                className={`${bentoClass} rounded-2xl shadow-md hover:scale-105 transition-transform duration-300 object-cover w-full h-full`}
              />
            );
          })}
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="py-28 bg-linear-to-b from-[#bf953f] via-[#d4af37] to-[#aa771c] text-center text-white px-6">
        <h2 className="font-serif text-4xl mb-6">
          ¿Nos acompañas en este día tan especial?
        </h2>

        <p className="text-sm mb-10 opacity-90">
          Tu presencia es el mejor regalo que podríamos recibir
        </p>

        <Link
          href={`/rsvp${codeFromUrl ? `?code=${codeFromUrl}` : ""}`}
          className="inline-block px-12 py-4 bg-white text-[#8a6d3b] font-bold uppercase tracking-[0.25em] text-xs rounded-full shadow-xl hover:bg-[#fdf3d7] transition"
        >
          Ir al RSVP
        </Link>
      </section>

      {/* ===== Sección de regalos ===== */}
      <section className="py-28 px-6 bg-[#fdfaf6]">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="font-serif text-4xl mb-4">Regalos</h2>

          <p className="text-sm mb-12 text-gray-600">
            Tu presencia es el mejor regalo que podríamos recibir.
            <br />
            Si deseas bendecirnos de otra forma, aquí te dejamos algunas
            opciones.
          </p>

          <BotonesRegaloYTransferencia />
        </div>
      </section>

      {mostrarMapa && <WeddingMap googleMapsUrl={LINK_GOOGLE_MAPS} />}

      {/* ===== FOOTER ===== */}
      <footer className="py-10 text-center text-xs text-gray-500 bg-[#fdfaf6]">
        Dominic & Danyael · 2026 · Con amor 💛
      </footer>
    </div>
  );
}
