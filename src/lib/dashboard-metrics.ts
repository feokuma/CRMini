export interface DashboardMetricRow {
  contacts_count: number;
  opportunities_count: number;
  open_opportunities_count: number;
  won_count: number;
  lost_count: number;
  open_value_by_currency: Record<string, string | number>;
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
) => Promise<{ rows: DashboardMetricRow[] }>;

export async function getDashboardMetrics(
  query: DashboardMetricsQuery,
): Promise<DashboardMetrics> {
  const result = await query(`SELECT
    (SELECT COUNT(*)::int FROM contacts) AS contacts_count,
    (SELECT COUNT(*)::int FROM opportunities) AS opportunities_count,
    (SELECT COUNT(*)::int FROM opportunities WHERE status NOT IN ('Ganha', 'Perdida')) AS open_opportunities_count,
    (SELECT COUNT(*)::int FROM opportunities WHERE status = 'Ganha') AS won_count,
    (SELECT COUNT(*)::int FROM opportunities WHERE status = 'Perdida') AS lost_count,
    COALESCE((SELECT jsonb_object_agg(currency, currency_total) FROM (
      SELECT currency, SUM(value) AS currency_total FROM opportunities
      WHERE status NOT IN ('Ganha', 'Perdida') AND value IS NOT NULL GROUP BY currency
    ) totals), '{}'::jsonb) AS open_value_by_currency`);
  const row = result.rows[0];

  if (!row) {
    throw new Error("A consulta do painel não retornou métricas.");
  }

  const decided = row.won_count + row.lost_count;

  return {
    contactsCount: row.contacts_count,
    opportunitiesCount: row.opportunities_count,
    openOpportunitiesCount: row.open_opportunities_count,
    conversionRate: decided ? Math.round((row.won_count / decided) * 100) : 0,
    openValueByCurrency: row.open_value_by_currency,
  };
}
