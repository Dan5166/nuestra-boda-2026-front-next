"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function Navbar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const code = searchParams.get("code");

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
        </div>
      </div>
    </nav>
  );
}
