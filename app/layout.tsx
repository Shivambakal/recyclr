import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/* System font stack — pulseops-ai design system (no webfont dependency). */

export const metadata: Metadata = {
  title: "RECYCLR — An AI agent for trustworthy e-waste recycling",
  description:
    "Capture e-waste, verify it passed through a recycling process, detect fraud, and prove recovery — with a Strands AI agent and tamper-evident SHA-256 evidence records.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-void text-ink">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Suspense>
          <Navbar />
        </Suspense>
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
