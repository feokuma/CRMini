export type RecentOpportunity = {
  id: string;
  name: string;
  company_name: string;
  contact_name: string;
  status: string;
  value: string | null;
  currency: string;
  updated_at: string;
};

export function getRecentOpportunities(
  query: (sql: string) => Promise<{ rows: RecentOpportunity[] }>,
): Promise<RecentOpportunity[]>;
