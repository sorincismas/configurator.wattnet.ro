import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WATTNET · Configurator instalații electrice",
  description: "Inventar doze, tablouri în cascadă, deviz de manoperă și plan de execuție — faza la roșu.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
