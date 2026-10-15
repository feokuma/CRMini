import type { Metadata } from "next";
import "./globals.css";
import AppSidebar from "@/components/app-sidebar";

export const metadata: Metadata = {
  title: "Reply CRM",
  description: "Um espaço simples para acompanhar seus clientes e oportunidades.",
  icons: { icon: "/brand/reply-favicon.ico" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body><div className="app-shell"><AppSidebar />{children}</div></body>
    </html>
  );
}
