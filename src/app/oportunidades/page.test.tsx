import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { OpportunitiesView } = vi.hoisted(() => ({
  OpportunitiesView: vi.fn(() => <div data-testid="opportunities-view" />),
}));

vi.mock("@/components/opportunities-view", () => ({
  default: OpportunitiesView,
}));

import OpportunitiesPage from "./page";

afterEach(() => cleanup());

describe("Página Oportunidades", () => {
  it("renderiza a visão de oportunidades em modo lista", () => {
    render(<OpportunitiesPage />);

    expect(OpportunitiesView).toHaveBeenCalledTimes(1);
    expect(OpportunitiesView.mock.calls[0][0]).toEqual({ mode: "list" });
    expect(screen.getByTestId("opportunities-view")).toBeInTheDocument();
  });
});
