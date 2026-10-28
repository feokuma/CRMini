import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { OpportunitiesView } = vi.hoisted(() => ({
  OpportunitiesView: vi.fn(() => <div data-testid="opportunities-view" />),
}));

vi.mock("@/components/opportunities-view", () => ({
  default: OpportunitiesView,
}));

import NewOpportunityPage from "./page";

afterEach(() => cleanup());

describe("Página Nova oportunidade", () => {
  it("renderiza a visão de oportunidades em modo formulário", () => {
    render(<NewOpportunityPage />);

    expect(OpportunitiesView).toHaveBeenCalledTimes(1);
    expect(OpportunitiesView.mock.calls[0][0]).toEqual({ mode: "form" });
    expect(screen.getByTestId("opportunities-view")).toBeInTheDocument();
  });
});
