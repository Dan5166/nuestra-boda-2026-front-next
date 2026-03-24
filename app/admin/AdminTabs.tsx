"use client";

import { useState } from "react";
import GuestsTable from "./GuestsTable";
import GalleryPanel from "./GalleryPanel";

const TABS = [
  { key: "invitados", label: "Invitados" },
  { key: "galeria", label: "Galería" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function AdminTabs() {
  const [active, setActive] = useState<Tab>("invitados");

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-[#e8d9c0]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition -mb-px border-b-2 ${
              active === tab.key
                ? "border-[#bf953f] text-[#bf953f]"
                : "border-transparent text-[#8a6d3b] hover:text-[#5c4a2e]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "invitados" && <GuestsTable />}
      {active === "galeria" && <GalleryPanel />}
    </div>
  );
}
