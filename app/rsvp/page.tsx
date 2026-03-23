"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Loader from "../components/Loader";
import ConfirmModal from "../components/ConfirmModal";

export const EstadoUsuario = {
  PENDIENTE: "pendiente",
  CONFIRMADO: "confirmado",
  RECHAZADO: "rechazado",
} as const;
export type EstadoUsuario = (typeof EstadoUsuario)[keyof typeof EstadoUsuario];

export const AlergiaAlimentaria = {
  NINGUNA: "ninguna",
  VEGANA: "vegana",
  CELIACA: "celiaca",
  SIN_LACTOSA: "sin lactosa",
} as const;
export type AlergiaAlimentaria =
  (typeof AlergiaAlimentaria)[keyof typeof AlergiaAlimentaria];

interface Invitado {
  userId: string;
  nombre: string;
  telefono: string;
  mail: string;
  estado: EstadoUsuario;
  alergiaAlimentaria?: AlergiaAlimentaria;
  otrasAlergias?: string;
  mensaje?: string;
}

function RSVPContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code")?.toUpperCase() || "";
  const router = useRouter();

  const [step, setStep] = useState<"codigo" | "formulario">(
    codeFromUrl ? "formulario" : "codigo",
  );
  const [codigoInput, setCodigoInput] = useState(codeFromUrl);
  const [invitados, setInvitados] = useState<Invitado[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingCode, setLoadingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: string; msg: string }>({
    type: "",
    msg: "",
  });
  const [showThanksModal, setShowThanksModal] = useState(false);

  const buscarCodigo = async (codigoABuscar: string) => {
    setLoadingCode(true);
    setLoading(true);
    try {
      const res = await fetch(`/api/users/by-code/${codigoABuscar}`);
      if (!res.ok) throw new Error();

      const data = await res.json();

      const invitadosMap: Invitado[] = data.usuarios.map(
        (u: { userId: string; nombre: string; estado?: EstadoUsuario }) => ({
          userId: u.userId,
          nombre: u.nombre,
          telefono: "",
          mail: "",
          estado: u.estado ?? EstadoUsuario.PENDIENTE,
          alergiaAlimentaria: AlergiaAlimentaria.NINGUNA,
          otrasAlergias: "",
          mensaje: "",
        }),
      );

      setInvitados(invitadosMap);
      setStep("formulario");
    } catch {
      setStatusMsg({
        type: "error",
        msg: "El código no existe o es inválido.",
      });
    } finally {
      setLoading(false);
      setLoadingCode(false);
    }
  };

  useEffect(() => {
    if (codeFromUrl) buscarCodigo(codeFromUrl);
  }, []);

  const updateInvitado = (index: number, field: keyof Invitado, value: string) => {
    const copia = [...invitados];
    copia[index] = { ...copia[index], [field]: value };
    setInvitados(copia);
  };

  const todosRespondieron = invitados.every(
    (i) =>
      i.estado === EstadoUsuario.CONFIRMADO ||
      i.estado === EstadoUsuario.RECHAZADO,
  );

  const enviarRSVP = async () => {
    setLoading(true);
    setStatusMsg({ type: "", msg: "" });

    try {
      for (const inv of invitados) {
        const body = {
          telefono: inv.telefono,
          mail: inv.mail || undefined,
          estado: inv.estado,
          alergiaAlimentaria:
            inv.estado === EstadoUsuario.CONFIRMADO
              ? inv.alergiaAlimentaria
              : undefined,
          otrasAlergias:
            inv.estado === EstadoUsuario.CONFIRMADO
              ? inv.otrasAlergias
              : undefined,
          mensaje: inv.mensaje || undefined,
        };

        const res = await fetch(`/api/users/${inv.userId}/rsvp`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok) throw new Error("Error guardando RSVP");
      }

      setShowThanksModal(true);
    } catch {
      setStatusMsg({
        type: "error",
        msg: "Ocurrió un error al guardar el RSVP",
      });
    } finally {
      setLoading(false);
    }
  };

  const invitado = invitados[activeIndex];

  if (loadingCode) return <Loader />;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center"
      style={{ backgroundImage: "url(/assets/fondo-desktop.webp)" }}
    >
      <div
        className="fixed inset-0 bg-cover bg-center md:hidden"
        style={{ backgroundImage: "url(/assets/fondo-movil.webp)" }}
      />

      <div className="relative z-10 w-full max-w-xl bg-white/95 p-6 border-8 [border-image:linear-gradient(to_right,#bf953f,#fcf6ba,#b38728)1]">
        {step === "codigo" && (
          <div className="relative z-10 w-full max-w-xl bg-white/95">
            <h2 className="text-xl font-bold mb-4">Ingresa tu código</h2>
            <input
              placeholder="Código"
              className="w-full border p-2 mb-4"
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
            />
            <button
              onClick={() => buscarCodigo(codigoInput)}
              disabled={!codigoInput || loading}
              className="w-full py-3 bg-[#8a6d3b] text-white font-bold disabled:opacity-50"
            >
              {loading ? "Buscando..." : "Continuar"}
            </button>

            {statusMsg.msg && (
              <div
                className={`mt-4 rounded-lg border p-4 text-center ${
                  statusMsg.type === "error"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-green-300 bg-green-50 text-green-700"
                }`}
              >
                {statusMsg.msg}
              </div>
            )}
          </div>
        )}

        {step === "formulario" && invitado && (
          <>
            {/* Tabs */}
            <div className="flex gap-2 border-b mb-4">
              {invitados.map((i, idx) => (
                <button
                  key={i.userId}
                  onClick={() => setActiveIndex(idx)}
                  className={`px-3 py-2 text-sm ${
                    idx === activeIndex
                      ? "border-b-2 border-[#bf953f]"
                      : "text-gray-400"
                  }`}
                >
                  {i.nombre}
                </button>
              ))}
            </div>

            {/* Form */}
            <div className="space-y-4">
              <input
                placeholder="Teléfono *"
                className="w-full border p-2"
                value={invitado.telefono}
                onChange={(e) =>
                  updateInvitado(activeIndex, "telefono", e.target.value)
                }
              />

              <input
                placeholder="Email (opcional)"
                className="w-full border p-2"
                value={invitado.mail}
                onChange={(e) =>
                  updateInvitado(activeIndex, "mail", e.target.value)
                }
              />

              <select
                className="w-full border p-2"
                value={invitado.estado}
                onChange={(e) =>
                  updateInvitado(
                    activeIndex,
                    "estado",
                    e.target.value as EstadoUsuario,
                  )
                }
              >
                <option value="">¿Asistirás?</option>
                <option value="confirmado">Confirmo asistencia</option>
                <option value="rechazado">No podré asistir</option>
              </select>

              {invitado.estado === EstadoUsuario.CONFIRMADO && (
                <>
                  <select
                    className="w-full border p-2"
                    value={invitado.alergiaAlimentaria}
                    onChange={(e) =>
                      updateInvitado(
                        activeIndex,
                        "alergiaAlimentaria",
                        e.target.value,
                      )
                    }
                  >
                    <option value="ninguna">Sin alergias</option>
                    <option value="vegana">Vegana</option>
                    <option value="celiaca">Celíaca</option>
                    <option value="sin lactosa">Sin lactosa</option>
                  </select>

                  <input
                    placeholder="Otras alergias"
                    className="w-full border p-2"
                    value={invitado.otrasAlergias}
                    onChange={(e) =>
                      updateInvitado(
                        activeIndex,
                        "otrasAlergias",
                        e.target.value,
                      )
                    }
                  />
                </>
              )}

              <textarea
                placeholder="Mensaje"
                className="w-full border p-2"
                value={invitado.mensaje}
                onChange={(e) =>
                  updateInvitado(activeIndex, "mensaje", e.target.value)
                }
              />
            </div>

            {statusMsg.type !== "success" && (
              <button
                disabled={!todosRespondieron || loading}
                onClick={enviarRSVP}
                className="w-full mt-6 py-3 bg-[#8a6d3b] text-white font-bold disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Confirmar Invitación"}
              </button>
            )}
          </>
        )}

        {step === "formulario" && statusMsg.msg && (
          <div
            className={`mt-6 rounded-lg border p-4 text-center ${
              statusMsg.type === "error"
                ? "border-red-300 bg-red-50 text-red-700"
                : "border-green-300 bg-green-50 text-green-700"
            }`}
          >
            <p className="font-semibold">{statusMsg.msg}</p>
          </div>
        )}
      </div>

      <ConfirmModal
        open={showThanksModal}
        onClose={() => {
          setShowThanksModal(false);
          router.push(`/${codeFromUrl ? `?code=${codeFromUrl}` : ""}`);
        }}
      />
    </div>
  );
}

export default function RSVPPage() {
  return (
    <Suspense fallback={<Loader />}>
      <RSVPContent />
    </Suspense>
  );
}
