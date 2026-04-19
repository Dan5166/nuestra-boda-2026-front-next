"use client";

import { useEffect, useState } from "react";

type HomePage = "landing" | "menu";

export default function SiteSettingsPanel() {
  const [homePage, setHomePage] = useState<HomePage>("landing");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.homePage) setHomePage(data.homePage);
        setLoading(false);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homePage }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-center text-gray-400 py-10">Cargando…</p>;
  }

  const options: { value: HomePage; label: string; description: string; preview: string }[] = [
    {
      value: "landing",
      label: "Landing page actual",
      description:
        "La página de inicio con el hero, nuestra historia y galería de fotos.",
      preview: "/",
    },
    {
      value: "menu",
      label: "Menú de invitados",
      description:
        "Un menú con botones grandes y claros, ideal para que todos los invitados naveguen fácilmente.",
      preview: "/menu",
    },
  ];

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-serif text-lg mb-1">Página de inicio</h3>
        <p className="text-sm text-[#8a6d3b] mb-6">
          Elige qué ven los invitados al ingresar a la web.
        </p>

        <div className="flex flex-col gap-4">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-4 rounded-xl border-2 p-4 cursor-pointer transition-all ${
                homePage === opt.value
                  ? "border-[#bf953f] bg-[#fdf8ef]"
                  : "border-[#e8d9c0] hover:border-[#d4af37]"
              }`}
            >
              <input
                type="radio"
                name="homePage"
                value={opt.value}
                checked={homePage === opt.value}
                onChange={() => setHomePage(opt.value)}
                className="mt-1 accent-[#bf953f] w-4 h-4 shrink-0"
              />
              <div className="flex-1">
                <p className="font-medium text-[#5c4a2e]">{opt.label}</p>
                <p className="text-sm text-gray-500 mt-0.5">{opt.description}</p>
                <a
                  href={opt.preview}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs text-[#bf953f] hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Vista previa →
                </a>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-[#bf953f] text-white text-sm rounded hover:bg-[#aa771c] transition disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          {saved && (
            <span className="text-green-600 text-sm">
              ✓ Guardado correctamente
            </span>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Nota:</strong> el cambio se aplica de inmediato para todos los
        visitantes. Si eliges &quot;Menú de invitados&quot;, quienes ingresen a{" "}
        <code className="font-mono bg-amber-100 px-1 rounded">/</code> serán
        redirigidos automáticamente a{" "}
        <code className="font-mono bg-amber-100 px-1 rounded">/menu</code>.
      </div>
    </div>
  );
}
