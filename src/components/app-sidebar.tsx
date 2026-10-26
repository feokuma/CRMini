"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  ["/", "⌂", "Visão geral"],
  ["/clientes", "♙", "Clientes"],
  ["/contatos", "♧", "Contatos"],
  ["/oportunidades", "◈", "Oportunidades"],
  ["/tarefas", "✓", "Tarefas"],
] as const;

export default function AppSidebar() {
  const pathname = usePathname();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => setDesktop(Boolean(window.crmDesktop)), []);
  return (
    <aside className="sidebar">
      <Link className="brand" href="/" aria-label="CRMini">
        <Image
          className="brand-mark"
          src="/brand/crmini-symbol.svg"
          alt="CRMini"
          width={32}
          height={32}
          priority
        />
        <span className="brand-name" aria-hidden="true">
          <span className="brand-name-crm">CRM</span>
          <span className="brand-name-mini">ini</span>
        </span>
      </Link>
      <nav aria-label="Navegação principal">
        {items.map(([href, icon, label]) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              title={label}
              className={`nav-item${active ? " active" : ""}`}
              href={href}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>
      {desktop && <Link className={`nav-item sidebar-settings${pathname === "/configuracoes" ? " active" : ""}`} href="/configuracoes" aria-current={pathname === "/configuracoes" ? "page" : undefined}><span aria-hidden="true">⚙</span>Configurações</Link>}
    </aside>
  );
}
