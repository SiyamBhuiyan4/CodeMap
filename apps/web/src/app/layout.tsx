import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import TopBar from "@/components/TopBar";
import NightSky from "@/components/NightSky";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "CodeAtlas",
  description: "AI-Powered Codebase Architecture Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        {/* Apply the saved moonlight setting before first paint so there is no flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var d=document.documentElement;d.classList.add('dark');try{var t=localStorage.getItem('codeatlas.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}d.dataset.moon=t==='light'?'bright':'dim'}catch(e){d.dataset.moon='dim'}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col text-slate-900`}>
        <NightSky />
        <TopBar />
        {children}
      </body>
    </html>
  );
}
