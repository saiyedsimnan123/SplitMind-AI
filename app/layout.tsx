import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitMind AI — One Group. One Smart Money Mind.",
  description: "A calmer way to plan, track and settle shared group spending.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
