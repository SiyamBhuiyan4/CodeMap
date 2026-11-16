import type { Metadata } from "next";
import "./globals.css";
import TopBar from "@/components/TopBar";

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
    <html lang="en">
      <body className="font-sans min-h-full flex flex-col">
        <TopBar />
        {children}
      </body>
    </html>
  );
}
