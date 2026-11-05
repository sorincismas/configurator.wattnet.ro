import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WATTNET · Configurator instalatii electrice",
  description: "Inventar doze, tablouri in cascada, deviz de manopera si plan de executie — faza la rosu.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ro" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
