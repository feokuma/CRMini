import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reply CRM",
  description: "Um espaço simples para acompanhar seus clientes e oportunidades.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
