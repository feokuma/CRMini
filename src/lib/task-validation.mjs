const types = ["email", "telefone", "compromisso"];
export function validateTask(body) {
  if (!types.includes(String(body.contact_type))) return "Tipo de contato inválido.";
  if (typeof body.subject !== "string" || !body.subject.trim() || body.subject.length > 200) return "Informe um assunto (até 200 caracteres).";
  if (typeof body.client_id !== "string" || typeof body.contact_id !== "string") return "Informe cliente e contato.";
  if (typeof body.scheduled_at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.scheduled_at) || !Number.isFinite(Date.parse(body.scheduled_at))) return "Informe uma data e hora válidas.";
  if (body.description != null && typeof body.description !== "string") return "Descrição inválida.";
  if (typeof body.description === "string" && body.description.length > 5000) return "Descrição muito longa.";
  return null;
}
