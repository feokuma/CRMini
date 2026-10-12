const hoursPerUnit = Object.freeze({ hours: 1, days: 8, weeks: 40, months: 160 });
const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;

export type ProjectTimeUnit = keyof typeof hoursPerUnit;
export type ProjectTimeValue = number | string | null | undefined;

export function toProjectHours(
  value: ProjectTimeValue,
  unit: ProjectTimeUnit,
): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("Duração inválida.");
  }

  return amount * hoursPerUnit[unit];
}

export function getBrazilDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function formatBrazilDate(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const dateOnly = dateOnlyPattern
    .exec(String(value));

  if (dateOnly) {
    return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
  })
    .format(date);
}

export function formatBrazilDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  })
    .format(date);
}
