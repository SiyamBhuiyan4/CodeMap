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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint so there is no flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('codeatlas.theme');if(!t){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}if(t==='dark'){document.documentElement.classList.add('dark')}document.documentElement.style.colorScheme=t}catch(e){document.documentElement.classList.add('dark')}})();`,
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
