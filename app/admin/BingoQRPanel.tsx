"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";

interface QRToken {
  token: string;
  targetCodigo: string;
  targetNames: string[];
}

export default function BingoQRPanel() {
  const [tokens, setTokens] = useState<QRToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const printRef = useRef<HTMLDivElement>(null);

  async function loadTokens() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/bingo/qr-tokens");
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTokens(); }, []);

  // Regenerate QR image data URLs when tokens change
  useEffect(() => {
    if (tokens.length === 0) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const promises = tokens.map(async ({ token }) => {
      const url = `${base}/bingo/escanear?t=${token}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 240,
        margin: 2,
        color: { dark: "#3d2c10", light: "#fffdf7" },
      });
      return [token, dataUrl] as [string, string];
    });
    Promise.all(promises).then((entries) =>
      setQrUrls(Object.fromEntries(entries))
    );
  }, [tokens]);

  async function handleGenerate() {
    if (
      !confirm(
        "¿Generar nuevos códigos QR? Los QRs anteriores dejarán de funcionar."
      )
    )
      return;
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/bingo/qr-tokens", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setTokens(data.tokens ?? []);
        flash(`${data.tokens?.length ?? 0} códigos QR generados`, "ok");
      } else {
        flash(data.message || "Error al generar", "err");
      }
    } finally {
      setGenerating(false);
    }
  }

  function flash(text: string, type: "ok" | "err") {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  }

  function handlePrint() {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Códigos QR Bingo</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Georgia, serif; background: #fff; padding: 20px; }
          h1 { text-align: center; font-size: 18px; color: #3d2c10; margin-bottom: 16px; }
          .grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            max-width: 700px;
            margin: 0 auto;
          }
          .card {
            border: 2px solid #d4af37;
            border-radius: 10px;
            padding: 12px;
            text-align: center;
            background: #fffdf7;
            break-inside: avoid;
          }
          .card img { width: 140px; height: 140px; display: block; margin: 0 auto 8px; }
          .name { font-size: 13px; font-weight: bold; color: #3d2c10; line-height: 1.3; }
          .token { font-size: 9px; color: #a0856a; font-family: monospace; margin-top: 4px; }
          @media print {
            body { padding: 10px; }
            .grid { gap: 8px; }
          }
        </style>
      </head>
      <body>
        <h1>Bingo de la boda — Códigos QR</h1>
        <div class="grid">
          ${tokens
            .map(
              ({ token, targetNames }) => `
            <div class="card">
              <img src="${qrUrls[token] ?? ""}" alt="QR"/>
              <div class="name">${targetNames.join(" &amp; ")}</div>
              <div class="token">${token}</div>
            </div>
          `
            )
            .join("")}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 300);
  }

  return (
    <section className="bg-[#fffdf7] border border-[#e8d9c0] rounded-xl p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-[#5c4a2e]">Códigos QR para imprimir</h3>
          <p className="text-sm text-gray-500">
            {tokens.length > 0
              ? `${tokens.length} QRs generados — uno por persona/grupo target`
              : "Genera los QRs luego de crear los cartones"}
          </p>
        </div>
        <div className="flex gap-2">
          {tokens.length > 0 && (
            <button
              onClick={handlePrint}
              className="px-4 py-2 border border-[#d4af37] text-[#8a6d3b] rounded-lg text-sm font-medium hover:bg-amber-50 transition"
            >
              🖨️ Imprimir
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 bg-[#d4af37] text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-[#bf953f] transition"
          >
            {generating ? "Generando..." : tokens.length > 0 ? "Regenerar QRs" : "Generar QRs"}
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`mb-4 text-sm px-4 py-2 rounded-lg ${
            msgType === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}
        >
          {msg}
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-4">Cargando...</p>}

      {/* Preview grid */}
      {tokens.length > 0 && !loading && (
        <div ref={printRef} className="grid grid-cols-3 gap-3 mt-2">
          {tokens.map(({ token, targetNames }) => (
            <div
              key={token}
              className="border border-[#e8d9c0] rounded-xl p-3 text-center bg-white"
            >
              {qrUrls[token] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrUrls[token]}
                  alt={`QR ${targetNames[0]}`}
                  className="w-full aspect-square object-contain mx-auto mb-2 rounded"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-100 rounded mb-2 animate-pulse" />
              )}
              <div className="text-xs font-semibold text-[#5c4a2e] leading-tight">
                {targetNames.join(" & ")}
              </div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5">{token}</div>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      {tokens.length > 0 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
          <p>
            <strong>Cómo usar:</strong> Imprime la hoja y coloca cada QR junto a la persona
            correspondiente. Los invitados escanean el QR con su cámara y suben una selfie.
          </p>
          <p>
            Si ya tienen una foto, la app les preguntará si quieren reemplazarla.
          </p>
        </div>
      )}
    </section>
  );
}
