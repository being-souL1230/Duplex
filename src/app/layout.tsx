import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Duplex - context switching killer",
  description:
    "Duplex detects the work context behind your tabs, asks for confirmation, and restores only what belongs.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="grain bg-ink text-fg antialiased">
        <div className="aura" aria-hidden />
        <div className="relative z-[2]">{children}</div>
      </body>
    </html>
  );
}
