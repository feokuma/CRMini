"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { formatBrazilDate } from "@/lib/project-time";
import { CLIENT_SEGMENTS } from "@/lib/segments";

type Contact = {
  id: string;
  full_name: string;
  job_title?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  birthday?: string;
  linkedin_url?: string;
  is_primary: boolean;
  client_id: string;
  company_name: string;
  trade_name?: string;
  industry?: string;
  logo_path?: string;
};

export default function ContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (segment) params.set("segment", segment);
      fetch(`/api/contacts${params.size ? `?${params}` : ""}`)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Falha ao carregar contatos.");
          setContacts(data);
          setError("");
        })
        .catch((reason: Error) => setError(reason.message));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, segment]);

  return (
    <main className="records-page">
      <header className="records-header">
        <div><p className="eyebrow">RELACIONAMENTO</p><h1>Contatos</h1><p className="subheading">Pessoas e informações de contato dos seus clientes.</p></div>
        <Link className="primary-button" href="/clientes/novo">＋ Cadastrar cliente</Link>
      </header>
      <div className="contact-filters">
        <input aria-label="Buscar contatos" placeholder="Buscar por nome, empresa, e-mail ou telefone..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <label><span>Segmento</span><select aria-label="Filtrar por segmento" value={segment} onChange={(event) => setSegment(event.target.value)}><option value="">Todos</option>{CLIENT_SEGMENTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <span className="contact-count">{contacts.length} contato(s)</span>
      </div>
      {error && <p className="form-error">{error}</p>}
      {!contacts.length && !error ? <div className="empty-state"><span>♙</span><h2>Nenhum contato encontrado</h2><p>Experimente ajustar a busca ou o filtro de segmento.</p><Link className="text-link" href="/clientes">Ver clientes →</Link></div> : <div className="contact-list">
        {contacts.map((contact) => <article className="contact-row" key={contact.id}>
          <div className="contact-list-avatar">{contact.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
          <div className="contact-list-person"><div className="contact-name-line"><b>{contact.full_name}</b>{contact.is_primary && <span className="primary-badge">Principal</span>}</div><small>{contact.job_title || "Cargo não informado"}</small>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : <span>E-mail não informado</span>}</div>
          <div className="contact-list-company">{contact.logo_path ? <Image src={contact.logo_path} alt="" width={30} height={30} unoptimized /> : <span className="company-mini-mark">{contact.company_name.slice(0, 1)}</span>}<span><Link href={`/clientes/${contact.client_id}`}>{contact.trade_name || contact.company_name}</Link><small>{contact.industry || "Segmento não informado"}</small></span></div>
          <div className="contact-list-details"><span><b>Telefone</b>{contact.mobile || contact.phone || "—"}</span><span><b>Aniversário</b>{formatBrazilDate(contact.birthday)}</span></div>
          {contact.linkedin_url ? <a className="linkedin-link" href={contact.linkedin_url} target="_blank" rel="noreferrer" aria-label={`LinkedIn de ${contact.full_name}`}>in</a> : <span className="linkedin-placeholder" aria-hidden="true">in</span>}
        </article>)}
      </div>}
    </main>
  );
}
