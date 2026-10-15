export type DashboardMetrics = {
  contactsCount: number;
  opportunitiesCount: number;
  openOpportunitiesCount: number;
  conversionRate: number;
  openValueByCurrency: Record<string, string | number>;
};

export function getDashboardMetrics(
  query: (sql: string) => Promise<{
    rows: Array<{
      contacts_count: number;
      opportunities_count: number;
      open_opportunities_count: number;
      won_count: number;
      lost_count: number;
      open_value_by_currency: Record<string, string | number>;
    }>;
  }>,
): Promise<DashboardMetrics>;
