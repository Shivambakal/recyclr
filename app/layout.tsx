import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Archivo } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/* Archivo — condensed grotesque, 500–900. The voice of RECLAIMED. */

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RECYCLR — An AI agent for trustworthy e-waste recycling",
  description:
    "Capture e-waste, verify it passed through a recycling process, detect fraud, and prove recovery — with a Strands AI agent and tamper-evident SHA-256 evidence records.",
  openGraph: {
    title: "RECYCLR — An AI agent for trustworthy e-waste recycling",
    description:
      "Capture → Verify → Detect Fraud → Prove Recovery. Trustworthy digital evidence that e-waste actually got recycled.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${archivo.variable}`}>
      <body className="min-h-full flex flex-col bg-paper text-ink">
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
