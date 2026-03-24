"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import BotonesRegaloYTransferencia from "../components/BotonesRegaloYTransferencia";
import Loader from "../components/Loader";
import { getSavedCode, saveCode } from "@/lib/localCode";

interface Invitado {
  nombre: string;
}

function InvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const codeFromUrl = searchParams.get("code")?.toUpperCase() || "";

  const [step, setStep] = useState<"codigo" | "invitacion">(
    codeFromUrl ? "invitacion" : "codigo",
  );

  const [codigoInput, setCodigoInput] = useState(codeFromUrl);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const buscarCodigo = async (codigo: string) => {
    if (!codigo) return;

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/users/by-code/${codigo}`);
      if (!res.ok) throw new Error("Código inválido");

      const data = await res.json();

      const invitadosMap = data.usuarios.map((u: { nombre: string }) => ({
        nombre: u.nombre,
      }));

      if (invitadosMap.length === 0) {
        setErrorMsg("El código ingresado no tiene invitados asociados.");
        setInvitados([]);
        setStep("codigo");
        return;
      }

      saveCode(codigo);
      setInvitados(invitadosMap);
      setStep("invitacion");

      router.replace(`/invitation?code=${codigo}`);
    } catch (error) {
      console.error(error);
      setErrorMsg("El código ingresado no es válido.");
      setInvitados([]);
      setStep("codigo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const code = codeFromUrl || getSavedCode();
    if (code) buscarCodigo(code);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nombresInvitados =
    invitados.length === 0 ? (
      <span className="font-serif text-3xl md:text-4xl">
        Te queremos en nuestra boda
      </span>
    ) : invitados.length === 1 ? (
      <span className="font-serif text-3xl md:text-4xl">
        {invitados[0].nombre}
      </span>
    ) : invitados.length === 2 ? (
      <div className="flex flex-col items-center text-center">
        <span className="font-serif text-3xl md:text-4xl">
          {invitados[0].nombre}
        </span>
        <span className="font-serif text-3xl md:text-4xl">
          {invitados[1].nombre}
        </span>
      </div>
    ) : (
      <div className="flex flex-col items-center text-center">
        {invitados
          .reduce<Invitado[][]>((grupos, _, index, arr) => {
            if (index % 2 === 0) grupos.push(arr.slice(index, index + 2));
            return grupos;
          }, [])
          .map((grupo: Invitado[], index) => (
            <div key={index} className="font-serif text-2xl md:text-3xl">
              {grupo.map((invitado: Invitado, idx) => (
                <span key={idx}>
                  {invitado.nombre}
                  {idx === 0 && grupo.length === 2 && " - "}
                </span>
              ))}
            </div>
          ))}
      </div>
    );

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="min-h-screen bg-[#fdfaf6] text-[#5c4a2e] flex items-center justify-center px-4">
      {/* PASO 1: INGRESAR CÓDIGO */}
      {step === "codigo" && (
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl text-center">
          <h1 className="font-serif text-3xl mb-6">Invitación de matrimonio</h1>

          <p className="text-sm text-gray-600 mb-6">
            Ingresa el código que recibiste para ver tu invitación
          </p>

          <input
            placeholder="Código de invitación"
            className="w-full border p-3 mb-4 text-center tracking-widest uppercase"
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
          />

          <button
            onClick={() => buscarCodigo(codigoInput)}
            disabled={!codigoInput || loading}
            className="w-full py-3 bg-[#8a6d3b] text-white font-bold disabled:opacity-50"
          >
            {loading ? "Verificando..." : "Continuar"}
          </button>

          {errorMsg && (
            <div className="mt-4 text-sm text-red-600">{errorMsg}</div>
          )}
        </div>
      )}

      {/* PASO 2: INVITACIÓN */}
      {step === "invitacion" && (
        <div className="w-full">
          {/* HEADER */}
          <header className="py-10 text-center px-4">
            <h1 className="font-serif text-3xl md:text-4xl mb-2">
              {loading ? "Cargando invitación..." : nombresInvitados}
            </h1>

            <p className="text-sm tracking-widest uppercase text-gray-500">
              Con mucho amor, Dominic & Danyael
            </p>
          </header>

          {/* INVITACIÓN */}
          <main className="max-w-4xl mx-auto px-4">
            <div className="rounded-2xl overflow-hidden shadow-xl bg-white">
              <img
                src="/assets/invitacion_compressed_page-0001.jpg"
                alt="Invitación de matrimonio"
                className="w-full object-contain"
              />
            </div>

            {/* BOTONES REGALO / TRANSFERENCIA */}
            <div className="mt-10">
              <BotonesRegaloYTransferencia />
            </div>
          </main>

          {/* CTA RSVP */}
          <section className="py-20 text-center px-6">
            <p className="font-serif text-xl md:text-2xl mb-8">
              Será un honor contar con tu presencia
            </p>

            <Link
              href={`/rsvp${codeFromUrl ? `?code=${codeFromUrl}` : ""}`}
              className="
                inline-block
                px-12 py-4
                bg-linear-to-r from-[#bf953f] via-[#d4af37] to-[#aa771c]
                text-white
                font-bold
                uppercase
                tracking-[0.25em]
                text-xs
                rounded-full
                shadow-xl
                hover:brightness-110
                transition
              "
            >
              Confirmar asistencia
            </Link>
          </section>

          {/* FOOTER */}
          <footer className="py-10 text-center text-xs text-gray-500">
            Dominic & Danyael · 19 · Abril · 2026
          </footer>
        </div>
      )}
    </div>
  );
}

export default function Invitation() {
  return (
    <Suspense fallback={<Loader />}>
      <InvitationContent />
    </Suspense>
  );
}
