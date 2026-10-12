"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/", "⌂", "Visão geral"],
  ["/clientes", "♙", "Clientes"],
  ["/contatos", "♧", "Contatos"],
  ["/oportunidades", "◈", "Oportunidades"],
  ["/tarefas", "✓", "Tarefas"],
] as const;

export default function AppSidebar() {
  const pathname = usePathname();
  return <aside className="sidebar">
    <Link className="brand" href="/"><span className="brand-mark">r</span><span>reply<span className="brand-dot"> crm</span></span></Link>
    <nav aria-label="Navegação principal">
      {items.map(([href, icon, label]) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return <Link key={href} title={label} className={`nav-item${active ? " active" : ""}`} href={href} aria-current={active ? "page" : undefined}><span aria-hidden="true">{icon}</span>{label}</Link>;
      })}
    </nav>
  </aside>;
}
