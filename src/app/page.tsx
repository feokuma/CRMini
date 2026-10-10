import Link from "next/link";

const metrics = [
  { label: "Contatos", value: "128", change: "+12 este mês", icon: "◎" },
  { label: "Oportunidades", value: "24", change: "8 em andamento", icon: "↗" },
  { label: "Conversão", value: "32%", change: "+4% neste mês", icon: "◌" },
];

const leads = [
  { name: "Mariana Costa", company: "Estúdio Aurora", initials: "MC", color: "peach", stage: "Qualificação", value: "R$ 4.800", date: "Hoje" },
  { name: "Rafael Mendes", company: "Norte & Sul", initials: "RM", color: "blue", stage: "Proposta enviada", value: "R$ 8.200", date: "Ontem" },
  { name: "Luiza Ferreira", company: "Casa Botânica", initials: "LF", color: "green", stage: "Novo contato", value: "R$ 2.400", date: "12 jun" },
  { name: "Pedro Almeida", company: "Ponto Criativo", initials: "PA", color: "lilac", stage: "Negociação", value: "R$ 6.100", date: "11 jun" },
];

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#inicio"><span className="brand-mark">r</span><span>reply<span className="brand-dot"> crm</span></span></a>
        <div className="workspace"><span className="workspace-icon">✳</span><span><b>Meu espaço</b><small>Plano inicial</small></span><span className="chevron">⌄</span></div>
        <p className="nav-label">MENU</p>
        <nav aria-label="Navegação principal">
          <a className="nav-item active" href="#inicio"><span>⌂</span> Visão geral</a>
          <Link className="nav-item" href="/clientes"><span>♙</span> Clientes <em>128</em></Link>
          <Link className="nav-item" href="/contatos"><span>♧</span> Contatos</Link>
          <Link className="nav-item" href="/oportunidades"><span>◈</span> Oportunidades</Link>
          <a className="nav-item" href="#tarefas"><span>✓</span> Tarefas</a>
        </nav>
        <div className="sidebar-bottom"><div className="help-card"><span className="help-icon">✦</span><b>Vamos começar?</b><p>Organize seus contatos e acompanhe suas vendas em um só lugar.</p><a href="#contatos">Adicionar contato <span>→</span></a></div><div className="profile"><div className="profile-avatar">AF</div><div><b>Alex Ferreira</b><small>Administrador</small></div><span className="chevron">···</span></div></div>
      </aside>

      <section className="main-area" id="inicio">
        <header className="topbar"><div className="breadcrumb">Meu espaço <span>/</span> <b>Visão geral</b></div><div className="top-actions"><button className="icon-button" aria-label="Ajuda">?</button><button className="icon-button notification" aria-label="Notificações">♧</button><div className="top-avatar">AF</div></div></header>
        <div className="content">
          <div className="welcome-row"><div><p className="eyebrow">QUARTA-FEIRA, 18 DE JUNHO</p><h1>Bom dia, Alex <span>✳</span></h1><p className="subheading">Aqui está o resumo do que acontece no seu espaço.</p></div><button className="primary-button"><span>＋</span> Novo contato</button></div>
          <div className="metric-grid">{metrics.map((metric) => <article className="metric-card" key={metric.label}><div className="metric-top"><span>{metric.label}</span><span className="metric-icon">{metric.icon}</span></div><div className="metric-value">{metric.value}</div><div className="metric-change"><span>↗</span> {metric.change}</div></article>)}</div>
          <div className="section-heading"><div><h2>Oportunidades recentes</h2><p>Acompanhe seus contatos em andamento.</p></div><a className="text-link" href="#oportunidades">Ver todas <span>→</span></a></div>
          <section className="table-card" id="oportunidades"><div className="table-toolbar"><div className="search-box"><span>⌕</span><input aria-label="Buscar oportunidades" placeholder="Buscar oportunidade..." /></div><button className="filter-button">☷ <span>Filtros</span></button></div><div className="table-scroll"><table><thead><tr><th>CONTATO</th><th>ETAPA</th><th>VALOR</th><th>ATUALIZADO</th><th></th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.name}><td><div className="contact-cell"><span className={`contact-avatar ${lead.color}`}>{lead.initials}</span><span><b>{lead.name}</b><small>{lead.company}</small></span></div></td><td><span className={`stage stage-${lead.color}`}><i />{lead.stage}</span></td><td className="amount">{lead.value}</td><td className="date">{lead.date}</td><td className="row-more">···</td></tr>)}</tbody></table></div><div className="table-footer"><span>Mostrando <b>4</b> de <b>24</b> oportunidades</span><div><button disabled aria-label="Página anterior">←</button><button aria-label="Próxima página">→</button></div></div></section>
          <footer className="page-footer">Feito para relações que fazem sentido <span>✳</span></footer>
        </div>
      </section>
    </main>
  );
}
