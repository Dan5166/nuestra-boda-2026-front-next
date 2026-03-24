"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSavedCode, clearCode } from "@/lib/localCode";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/invitation", label: "Invitación" },
  { href: "/rsvp", label: "RSVP" },
  { href: "/galeria", label: "Galería" },
  { href: "/bingo", label: "Bingo" },
];

export default function Navbar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const codeFromUrl = searchParams.get("code");
  const [code, setCode] = useState(codeFromUrl);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const sync = () => setCode(codeFromUrl || getSavedCode() || null);
    sync();
    window.addEventListener('boda-code-changed', sync);
    return () => window.removeEventListener('boda-code-changed', sync);
  }, [codeFromUrl]);

  // Close menu on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  const withCode = (path: string) => code ? `${path}?code=${code}` : path;
  const isActive = (path: string) => pathname === path;

  const baseClasses = "transition font-medium";
  const activeClasses = "text-[#d4af37] border-b-2 border-[#d4af37] pb-1";
  const inactiveClasses = "text-gray-700 hover:text-[#d4af37]";

  function handleSalir() {
    clearCode();
    setCode(null);
    setOpen(false);
    router.replace("/");
  }

  return (
    <nav className="w-full bg-white/80 backdrop-blur shadow-sm sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <span className="font-semibold tracking-wide text-[#d4af37]">D & D</span>

        {/* Desktop links */}
        <div className="hidden md:flex gap-6 text-sm items-center">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={withCode(l.href)}
              className={`${baseClasses} ${isActive(l.href) ? activeClasses : inactiveClasses}`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop: code pill + hamburger toggle */}
        <div className="flex items-center gap-3">
          {code && (
            <button
              onClick={handleSalir}
              className="hidden md:flex items-center gap-1.5 text-xs text-[#8a6d3b] border border-[#d4af37]/50 rounded-full px-3 py-1.5 hover:bg-red-50 hover:text-red-500 hover:border-red-300 transition-all duration-200"
            >
              <span className="font-mono tracking-wider">{code}</span>
              <span className="text-[10px] opacity-60">✕</span>
            </button>
          )}

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex flex-col justify-center gap-1.5 w-8 h-8"
            onClick={() => setOpen((o) => !o)}
            aria-label="Menú"
          >
            <span className={`block h-0.5 bg-[#8a6d3b] transition-all duration-200 ${open ? "rotate-45 translate-y-2" : ""}`} />
            <span className={`block h-0.5 bg-[#8a6d3b] transition-all duration-200 ${open ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 bg-[#8a6d3b] transition-all duration-200 ${open ? "-rotate-45 -translate-y-2" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden bg-white/95 border-t border-gray-100 px-4 py-4 flex flex-col gap-4 text-sm">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={withCode(l.href)}
              className={`${baseClasses} ${isActive(l.href) ? "text-[#d4af37] font-semibold" : inactiveClasses}`}
            >
              {l.label}
            </Link>
          ))}

          {code && (
            <button
              onClick={handleSalir}
              className="flex items-center gap-2 text-xs text-[#8a6d3b] border border-[#d4af37]/50 rounded-full px-3 py-1.5 w-fit hover:bg-red-50 hover:text-red-500 hover:border-red-300 transition-all duration-200"
            >
              <span className="font-mono tracking-wider">{code}</span>
              <span className="text-[10px] opacity-60">✕</span>
            </button>
          )}
        </div>
      )}
    </nav>
  );
}
