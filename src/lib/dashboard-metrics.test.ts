import { describe, expect, it, vi } from "vitest";
import { getDashboardMetrics } from "./dashboard-metrics";

describe("getDashboardMetrics", () => {
  it("calcula totais, taxa de conversão e valores agregados por moeda", async () => {
    let receivedQuery = "";
    const query = vi.fn(async (statement: string) => {
      receivedQuery = statement;

      return {
        rows: [
          {
            contacts_count: 10,
            opportunities_count: 8,
            open_opportunities_count: 5,
            won_count: 2,
            lost_count: 1,
            open_value_by_currency: { BRL: "1500.00", USD: "300.00" },
          },
        ],
      };
    });

    await expect(getDashboardMetrics(query)).resolves.toEqual({
      contactsCount: 10,
      opportunitiesCount: 8,
      openOpportunitiesCount: 5,
      conversionRate: 67,
      openValueByCurrency: { BRL: "1500.00", USD: "300.00" },
    });
    expect(receivedQuery).toContain("FROM contacts");
    expect(receivedQuery).toContain("status NOT IN ('Ganha', 'Perdida')");
    expect(receivedQuery).toContain("GROUP BY currency");
  });

  it("retorna conversão zero sem oportunidades encerradas", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          contacts_count: 0,
          opportunities_count: 0,
          open_opportunities_count: 0,
          won_count: 0,
          lost_count: 0,
          open_value_by_currency: {},
        },
      ],
    }));

    const metrics = await getDashboardMetrics(query);

    expect(metrics.conversionRate).toBe(0);
    expect(metrics.openValueByCurrency).toEqual({});
  });

  it("falha claramente quando a consulta não retorna linha", async () => {
    await expect(
      getDashboardMetrics(async () => ({ rows: [] })),
    ).rejects.toThrow("A consulta do painel não retornou métricas.");
  });

  it("propaga falhas do banco", async () => {
    await expect(
      getDashboardMetrics(async () => {
        throw new Error("banco indisponível");
      }),
    ).rejects.toThrow("banco indisponível");
  });
});
