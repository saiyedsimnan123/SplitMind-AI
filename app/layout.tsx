import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SplitMind AI — One Group. One Smart Money Mind.",
  description:
    "AI-powered group financial coordination platform: shared budgets, SmartSplit settlements, Proof verification, MoneyTwin scenarios, and IntentPay.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
