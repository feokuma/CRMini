import type { Metadata } from "next";
import "./globals.css";
import AppSidebar from "@/components/app-sidebar";
import UpdateChip from "@/components/update-chip";

export const metadata: Metadata = {
  title: "CRMini",
  description:
    "Um espaço simples para acompanhar seus clientes e oportunidades.",
  icons: { icon: "/brand/crmini-favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="app-shell">
          <AppSidebar />
          {children}
          <UpdateChip />
        </div>
      </body>
    </html>
  );
}
