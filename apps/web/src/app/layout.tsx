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
        {/* Every visit starts at night (dim moon); tapping the moon brightens it */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('dark');document.documentElement.dataset.moon='dim';`,
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
