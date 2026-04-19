"use client";

import { useState } from "react";
import GuestsTable from "./GuestsTable";
import GalleryPanel from "./GalleryPanel";
import BingoPanel from "./BingoPanel";
import PlaylistPanel from "./PlaylistPanel";
import SiteSettingsPanel from "./SiteSettingsPanel";
import RandomPanel from "./RandomPanel";

const TABS = [
  { key: "invitados", label: "Invitados" },
  { key: "galeria", label: "Galería" },
  { key: "bingo", label: "Bingo" },
  { key: "playlist", label: "Playlist" },
  { key: "random", label: "Random" },
  { key: "configuracion", label: "Configuración" },
] as const;

type Tab = (typeof TABS)[number]["key"];

export default function AdminTabs({ username }: { username: string }) {
  const [active, setActive] = useState<Tab>("invitados");

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-[#e8d9c0] overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition -mb-px border-b-2 whitespace-nowrap ${
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
      {active === "bingo" && <BingoPanel />}
      {active === "playlist" && <PlaylistPanel username={username} />}
      {active === "random" && <RandomPanel />}
      {active === "configuracion" && <SiteSettingsPanel />}
    </div>
  );
}
