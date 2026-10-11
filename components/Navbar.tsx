"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/scanner", label: "Scanner" },
  { href: "/verify", label: "Verify a record" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-50 border-b border-white/[0.08] bg-void/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="RECYCLR home" className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-neon to-electric font-display text-lg font-bold text-void shadow-[0_0_25px_rgba(0,242,254,0.35)]"
          >
            R
          </div>
          <div className="leading-none">
            <p className="font-display text-lg font-bold tracking-wide text-ink">RECYCLR</p>
            <p className="text-[10px] uppercase tracking-[0.22em] text-mute">Trustworthy e-waste</p>
          </div>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                pathname === l.href
                  ? "bg-neon/10 text-neon"
                  : "text-mute hover:bg-white/5 hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/scanner" className="btn-primary ml-3 rounded-lg px-5 py-2.5 text-sm">
            Start scanning
          </Link>
        </nav>

        <button
          className="rounded-lg border border-white/10 px-3 py-2 text-ink md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          ☰
        </button>
      </div>

      {open && (
        <nav aria-label="Mobile navigation" className="border-t border-white/[0.08] px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === l.href ? "page" : undefined}
              className="block rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-white/5"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/scanner"
            onClick={() => setOpen(false)}
            className="btn-primary mt-2 block rounded-lg px-4 py-2.5 text-center text-sm"
          >
            Start scanning
          </Link>
        </nav>
      )}
    </header>
  );
}
