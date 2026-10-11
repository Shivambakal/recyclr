"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/scanner", label: "Scanner" },
  { href: "/verify", label: "Verify a record" },
  { href: "/materials", label: "Materials" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-50 border-b border-white/10 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="RECYCLR home" className="flex items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-leaf via-emerald to-leaf-deep font-display text-xl font-black text-black"
            style={{ boxShadow: "0 0 24px rgba(34,197,94,.55)" }}
          >
            R
          </div>
          <div className="leading-none">
            <p className="display-tight text-xl text-ink">RECYCLR</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-faint">
              Trustworthy e-waste
            </p>
          </div>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition ${
                pathname === l.href
                  ? "bg-leaf/15 text-leaf"
                  : "text-mute hover:bg-white/5 hover:text-ink"
              }`}
              style={pathname === l.href ? { boxShadow: "0 0 18px rgba(34,197,94,.25)" } : undefined}
            >
              {l.label}
            </Link>
          ))}
          <Link href="/scanner" className="btn-bloom btn-primary-bloom ml-3 px-5 py-2.5 text-sm">
            Start scanning →
          </Link>
        </nav>

        <button
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 font-display font-black text-ink md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
        >
          ☰
        </button>
      </div>

      {open && (
        <nav aria-label="Mobile navigation" className="border-t border-white/10 bg-black px-4 py-3 md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`block rounded-lg px-3 py-2.5 font-display text-sm font-bold uppercase tracking-wider ${
                pathname === l.href ? "bg-leaf/15 text-leaf" : "text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/scanner"
            onClick={() => setOpen(false)}
            className="btn-bloom btn-primary-bloom mt-2 block px-4 py-2.5 text-center text-sm"
          >
            Start scanning →
          </Link>
        </nav>
      )}
    </header>
  );
}
