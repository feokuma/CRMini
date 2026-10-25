export interface DashboardMetricRow {
  contacts_count: number;
  opportunities_count: number;
  open_opportunities_count: number;
  won_count: number;
  lost_count: number;
  /** Array JSON serializado de { currency, value } das oportunidades abertas. */
  open_values: string;
}

export interface DashboardMetrics {
  contactsCount: number;
  opportunitiesCount: number;
  openOpportunitiesCount: number;
  conversionRate: number;
  openValueByCurrency: Record<string, string | number>;
}

type DashboardMetricsQuery = (
  statement: string,
) => { rows: DashboardMetricRow[] } | Promise<{ rows: DashboardMetricRow[] }>;

interface OpenValueRow {
  currency: string;
  value: string;
}

const decimalTextPattern = /^-?\d+(?:\.\d+)?$/;

// Converte decimal em texto para centavos inteiros, evitando erro de ponto
// flutuante na agregação de valores monetários.
function toCents(value: string): number {
  const negative = value.startsWith("-");
  const [integerPart, fractionPart = ""] = (negative ? value.slice(1) : value)
    .split(".");
  const cents =
    Number(integerPart) * 100 + Number((fractionPart + "00").slice(0, 2));
  const roundingDigit = Number(fractionPart[2] ?? "0");
  const rounded = roundingDigit >= 5 ? cents + 1 : cents;
  return negative ? -rounded : rounded;
}

function formatCents(cents: number): string {
  const negative = cents < 0;
  const absolute = Math.abs(cents);
  const integerPart = Math.floor(absolute / 100);
  const fractionPart = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${integerPart}.${fractionPart}`;
}

export function sumOpenValuesByCurrency(
  openValues: OpenValueRow[],
): Record<string, string> {
  const totals = new Map<string, number>();
  for (const { currency, value } of openValues) {
    const text = String(value);
    if (!decimalTextPattern.test(text)) continue;
    totals.set(currency, (totals.get(currency) ?? 0) + toCents(text));
  }
  return Object.fromEntries(
    [...totals.entries()].map(([currency, cents]) => [
      currency,
      formatCents(cents),
    ]),
  );
}

export async function getDashboardMetrics(
  query: DashboardMetricsQuery,
): Promise<DashboardMetrics> {
  const result = await query(`SELECT
    (SELECT COUNT(*) FROM contacts) AS contacts_count,
    (SELECT COUNT(*) FROM opportunities) AS opportunities_count,
    (SELECT COUNT(*) FROM opportunities WHERE status NOT IN ('Ganha', 'Perdida')) AS open_opportunities_count,
    (SELECT COUNT(*) FROM opportunities WHERE status = 'Ganha') AS won_count,
    (SELECT COUNT(*) FROM opportunities WHERE status = 'Perdida') AS lost_count,
    (SELECT json_group_array(json_object('currency', currency, 'value', value))
      FROM opportunities
      WHERE status NOT IN ('Ganha', 'Perdida') AND value IS NOT NULL) AS open_values`);
  const row = result.rows[0];

  if (!row) {
    throw new Error("A consulta do painel não retornou métricas.");
  }

  const decided = row.won_count + row.lost_count;
  const openValues = JSON.parse(row.open_values || "[]") as OpenValueRow[];

  return {
    contactsCount: row.contacts_count,
    opportunitiesCount: row.opportunities_count,
    openOpportunitiesCount: row.open_opportunities_count,
    conversionRate: decided ? Math.round((row.won_count / decided) * 100) : 0,
    openValueByCurrency: sumOpenValuesByCurrency(openValues),
  };
}
