import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OKR → Linear Planner",
  description: "Turn monthly goals into a capacity-checked Linear plan: projects, issues, estimates, owners, cycles and dependencies.",
};

const REPO = "https://github.com/JavierMonestel/okr-to-linear";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} antialiased`}>
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
          Demo with a fictional team and goals · independent portfolio project, not affiliated with any company.
        </div>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
                <rect width="32" height="32" rx="8" fill="#1e1b4b" />
                <circle cx="10" cy="16" r="4" fill="none" stroke="#a5b4fc" strokeWidth="2.2" />
                <path d="M15 16h11m-3.5-3.5L26 16l-3.5 3.5" fill="none" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="leading-tight">
                <div className="text-sm font-semibold">Founder OS · OKR → Linear Planner</div>
                <div className="text-xs text-slate-500">Monthly goals in, a capacity-checked Linear plan out</div>
              </div>
            </div>
            <nav className="flex items-center gap-1 text-sm">
              <a href="/docs" className="rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100">
                API
              </a>
              <a href={REPO} target="_blank" rel="noopener" className="rounded-md px-2.5 py-1.5 text-slate-600 hover:bg-slate-100">
                GitHub ↗
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">{children}</main>
        <footer className="pb-8 text-center text-xs text-slate-400">Built by Javier Monestel · Next.js · Claude API · Linear GraphQL</footer>
      </body>
    </html>
  );
}
