const types = ["email", "telefone", "compromisso"] as const;
const isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export type TaskContactType = (typeof types)[number];
export type TaskValidationInput = Record<string, unknown>;

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const hasIsoTimestampFormat = isoTimestampPattern
    .test(value);

  if (!hasIsoTimestampFormat) {
    return false;
  }

  const date = value
    .slice(0, 10);
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const normalizedDate = parsedDate
    .toISOString()
    .slice(0, 10);

  if (normalizedDate !== date) {
    return false;
  }

  const timestamp = Date
    .parse(value);

  return Number
    .isFinite(timestamp);
}

export function validateTask(body: TaskValidationInput): string | null {
  if (!types.includes(String(body.contact_type) as TaskContactType)) {
    return "Tipo de contato inválido.";
  }

  if (
    typeof body.subject !== "string"
    || !body.subject.trim()
    || body.subject.length > 200
  ) {
    return "Informe um assunto (até 200 caracteres).";
  }

  if (typeof body.client_id !== "string" || typeof body.contact_id !== "string") {
    return "Informe cliente e contato.";
  }

  if (!isValidTimestamp(body.scheduled_at)) {
    return "Informe uma data e hora válidas.";
  }

  if (body.description != null && typeof body.description !== "string") {
    return "Descrição inválida.";
  }

  if (typeof body.description === "string" && body.description.length > 5000) {
    return "Descrição muito longa.";
  }

  return null;
}
