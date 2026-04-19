"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Guest {
  userId: string;
  nombre: string;
  codigo: string;
  estado: string;
  telefono: string | null;
  mail: string | null;
  alergiaAlimentaria: string | null;
  otrasAlergias: string | null;
  mensaje: string | null;
  rsvpAt: string | null;
}

const COLUMNS = [
  { key: "nombre", label: "Nombre" },
  { key: "codigo", label: "Código" },
  { key: "estado", label: "Estado" },
  { key: "telefono", label: "Teléfono" },
  { key: "mail", label: "Email" },
  { key: "alergiaAlimentaria", label: "Alergia" },
  { key: "otrasAlergias", label: "Otras alergias" },
  { key: "mensaje", label: "Mensaje" },
  { key: "rsvpAt", label: "RSVP el" },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

const ESTADO_COLORS: Record<string, string> = {
  confirmado: "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-700",
  pendiente: "bg-yellow-100 text-yellow-700",
};

async function generateQRDataUrl(codigo: string): Promise<string> {
  const url = `https://nuestraboda2026.cl?code=${codigo}`;
  const qrSize = 300;
  const padding = 20;
  const textHeight = 100;

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    width: qrSize,
    margin: 2,
    color: { dark: "#1a1a1a", light: "#00000000" },
  });

  const final = document.createElement("canvas");
  final.width = qrSize + padding * 2;
  final.height = qrSize + textHeight + padding * 2;

  const ctx = final.getContext("2d")!;
  ctx.drawImage(qrCanvas, padding, padding);

  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 72px monospace";
  ctx.textAlign = "center";
  ctx.fillText(codigo, final.width / 2, qrSize + padding + textHeight - 4);

  return final.toDataURL("image/png");
}

export default function GuestsTable() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterNombre, setFilterNombre] = useState("");
  const [filterEstado, setFilterEstado] = useState("todos");
  const [hiddenCols, setHiddenCols] = useState<Set<ColumnKey>>(new Set());
  const [downloadingQRs, setDownloadingQRs] = useState(false);
  const [qrProgress, setQrProgress] = useState(0);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => setGuests(data.users ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleDownloadQRs() {
    // Group confirmed guests by codigo, one QR per unique codigo
    const byCode = new Map<string, string[]>();
    for (const g of guests.filter((g) => g.estado === "confirmado")) {
      byCode.set(g.codigo, [...(byCode.get(g.codigo) ?? []), g.nombre]);
    }
    const entries = [...byCode.entries()];
    if (entries.length === 0) return;

    setDownloadingQRs(true);
    setQrProgress(0);

    for (let i = 0; i < entries.length; i++) {
      const [codigo, nombres] = entries[i];
      const dataUrl = await generateQRDataUrl(codigo);
      const safeName = nombres.join(" y ").replace(/[^a-zA-ZÀ-ÿ0-9 _-]/g, "").trim();
      const link = document.createElement("a");
      link.download = `QR_${safeName}.png`;
      link.href = dataUrl;
      link.click();
      setQrProgress(i + 1);
      if (i < entries.length - 1) await new Promise((r) => setTimeout(r, 350));
    }

    setDownloadingQRs(false);
    setQrProgress(0);
  }

  const toggleCol = (key: ColumnKey) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const filtered = guests.filter((g) => {
    const matchNombre = g.nombre
      .toLowerCase()
      .includes(filterNombre.toLowerCase());
    const matchEstado =
      filterEstado === "todos" || g.estado === filterEstado;
    return matchNombre && matchEstado;
  });

  const confirmados = guests.filter((g) => g.estado === "confirmado").length;
  const rechazados = guests.filter((g) => g.estado === "rechazado").length;
  const pendientes = guests.filter((g) => g.estado === "pendiente").length;
  const confirmedCodigos = [...new Set(guests.filter((g) => g.estado === "confirmado").map((g) => g.codigo))];

  const visibleCols = COLUMNS.filter((c) => !hiddenCols.has(c.key));

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow text-center">
          <p className="text-2xl font-bold text-green-600">{confirmados}</p>
          <p className="text-xs text-gray-500 mt-1">Confirmados</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow text-center">
          <p className="text-2xl font-bold text-yellow-500">{pendientes}</p>
          <p className="text-xs text-gray-500 mt-1">Pendientes</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow text-center">
          <p className="text-2xl font-bold text-red-500">{rechazados}</p>
          <p className="text-xs text-gray-500 mt-1">Rechazados</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Buscar por nombre..."
          className="border border-gray-300 rounded px-3 py-2 text-sm w-56"
          value={filterNombre}
          onChange={(e) => setFilterNombre(e.target.value)}
        />

        <select
          className="border border-gray-300 rounded px-3 py-2 text-sm"
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="confirmado">Confirmado</option>
          <option value="pendiente">Pendiente</option>
          <option value="rechazado">Rechazado</option>
        </select>

        <span className="text-sm text-gray-400">
          {filtered.length} invitado{filtered.length !== 1 ? "s" : ""}
        </span>

        <button
          onClick={handleDownloadQRs}
          disabled={downloadingQRs || loading || confirmados === 0}
          className="ml-auto flex items-center gap-2 px-4 py-2 border border-[#d4af37] text-[#8a6d3b] text-sm rounded-lg hover:bg-[#fdf5e8] transition disabled:opacity-50"
        >
          {downloadingQRs ? (
            <>
              <span className="w-3.5 h-3.5 border border-[#bf953f] border-t-transparent rounded-full animate-spin" />
              {qrProgress}/{confirmedCodigos.length}
            </>
          ) : (
            <>↓ QRs confirmados ({confirmedCodigos.length})</>
          )}
        </button>
      </div>

      {/* Toggle columnas */}
      <div className="flex flex-wrap gap-2">
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            onClick={() => toggleCol(col.key)}
            className={`px-3 py-1 rounded-full text-xs border transition ${
              hiddenCols.has(col.key)
                ? "border-gray-300 text-gray-400 bg-white"
                : "border-[#8a6d3b] text-[#8a6d3b] bg-[#8a6d3b]/10"
            }`}
          >
            {hiddenCols.has(col.key) ? "+" : "−"} {col.label}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl shadow">
        <table className="w-full text-sm bg-white">
          <thead>
            <tr className="bg-[#f5ede0] text-[#5c4a2e] text-left">
              {visibleCols.map((col) => (
                <th key={col.key} className="px-4 py-3 font-semibold whitespace-nowrap">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={visibleCols.length} className="text-center py-10 text-gray-400">
                  Cargando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length} className="text-center py-10 text-gray-400">
                  Sin resultados
                </td>
              </tr>
            ) : (
              filtered.map((guest) => (
                <tr key={guest.userId} className="border-t border-gray-100 hover:bg-gray-50">
                  {visibleCols.map((col) => (
                    <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                      {col.key === "estado" ? (
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            ESTADO_COLORS[guest.estado] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {guest.estado}
                        </span>
                      ) : col.key === "rsvpAt" ? (
                        guest.rsvpAt
                          ? new Date(guest.rsvpAt).toLocaleDateString("es-CL")
                          : <span className="text-gray-300">—</span>
                      ) : (
                        (guest[col.key as keyof Guest] as string) || (
                          <span className="text-gray-300">—</span>
                        )
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
