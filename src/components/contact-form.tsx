"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import Breadcrumbs from "@/components/breadcrumbs";

type Client = { id: string; company_name: string; is_active?: boolean };

export default function ContactForm() {
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch("/api/clients").then(async (response) => {
      if (response.ok) setClients(await response.json());
    }).catch(() => setError("Não foi possível carregar os clientes."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar o contato.");
      window.location.assign("/contatos");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return <main className="records-page">
    <Breadcrumbs items={[{ label: "Meu espaço", href: "/" }, { label: "Contatos", href: "/contatos" }, { label: "Novo contato" }]} />
    <header className="records-header"><div><p className="eyebrow">RELACIONAMENTO</p><h1>Novo contato</h1><p className="subheading">Cadastre uma pessoa vinculada a um cliente.</p></div><Link className="text-link" href="/contatos">← Voltar aos contatos</Link></header>
    <section className="form-section"><h2>Dados do contato</h2>
      <form className="client-form" onSubmit={submit}><div className="form-grid">
        <label className="form-field">Nome completo *<input name="full_name" required maxLength={200} /></label>
        <label className="form-field">Cliente *<select name="client_id" required defaultValue=""><option value="" disabled>Selecione</option>{clients.filter((c) => c.is_active !== false).map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></label>
        <label className="form-field">Cargo<input name="job_title" maxLength={200} /></label>
        <label className="form-field">E-mail<input name="email" type="email" maxLength={254} /></label>
        <label className="form-field">Telefone<input name="phone" type="tel" maxLength={50} /></label>
        <label className="form-field">Celular<input name="mobile" type="tel" maxLength={50} /></label>
        <label className="form-field">Aniversário<input name="birthday" type="date" /></label>
        <label className="form-field">LinkedIn<input name="linkedin_url" type="url" maxLength={500} /></label>
        <label className="form-field">Observações<textarea name="notes" maxLength={5000} /></label>
        <label className="form-field"><span className="contact-primary-checkbox"><input name="is_primary" type="checkbox" value="true" /> Contato principal</span></label>
      </div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando…" : "Cadastrar contato"}</button></form>
    </section>
  </main>;
}
