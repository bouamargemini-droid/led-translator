import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LED Translator",
  description: "Traduction FR → ZH d'appels d'offres LED (CPS, BPU, DPGF)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-[var(--color-border)]">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
              <h1 className="text-lg font-semibold tracking-tight">
                LED Translator
                <span className="ml-2 text-xs text-[var(--color-muted)] font-normal">
                  FR → ZH
                </span>
              </h1>
              <nav className="flex gap-4 text-sm text-[var(--color-muted)]">
                <a href="/" className="hover:text-white">
                  Nouveau lot
                </a>
                <a href="/history" className="hover:text-white">
                  Historique
                </a>
              </nav>
            </div>
          </header>
          <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
