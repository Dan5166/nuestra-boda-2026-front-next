"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getSavedCode, clearCode } from "@/lib/localCode";

export default function Navbar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const codeFromUrl = searchParams.get("code");
  const [code, setCode] = useState(codeFromUrl);

  useEffect(() => {
    setCode(codeFromUrl || getSavedCode() || null);
  }, [codeFromUrl]);

  const withCode = (path: string) => {
    if (!code) return path;
    return `${path}?code=${code}`;
  };

  const baseClasses = "transition font-medium";
  const activeClasses = "text-[#d4af37] border-b-2 border-[#d4af37] pb-1";
  const inactiveClasses = "text-gray-700 hover:text-[#d4af37]";

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="w-full bg-white/80 backdrop-blur shadow-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
        <span className="font-semibold tracking-wide text-[#d4af37]">
          D & D
        </span>

        <div className="flex gap-6 text-sm">
          <Link
            href={withCode("/")}
            className={`${baseClasses} ${isActive("/") ? activeClasses : inactiveClasses}`}
          >
            Inicio
          </Link>

          <Link
            href={withCode("/invitation")}
            className={`${baseClasses} ${isActive("/invitation") ? activeClasses : inactiveClasses}`}
          >
            Invitación
          </Link>

          <Link
            href={withCode("/rsvp")}
            className={`${baseClasses} ${isActive("/rsvp") ? activeClasses : inactiveClasses}`}
          >
            RSVP
          </Link>

          <Link
            href={withCode("/galeria")}
            className={`${baseClasses} ${isActive("/galeria") ? activeClasses : inactiveClasses}`}
          >
            Galería
          </Link>
        </div>

        {code && (
          <button
            onClick={() => { clearCode(); setCode(null); }}
            className="flex items-center gap-1.5 text-xs text-[#8a6d3b] border border-[#d4af37]/50 rounded-full px-3 py-1.5 hover:bg-red-50 hover:text-red-500 hover:border-red-300 transition-all duration-200"
          >
            <span className="font-mono tracking-wider">{code}</span>
            <span className="text-[10px] opacity-60">✕</span>
          </button>
        )}
      </div>
    </nav>
  );
}
