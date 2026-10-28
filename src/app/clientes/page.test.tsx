import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { ClientsView } = vi.hoisted(() => ({
  ClientsView: vi.fn(() => <div data-testid="clients-view" />),
}));

vi.mock("@/components/clients-view", () => ({ default: ClientsView }));

import ClientsPage from "./page";

afterEach(() => cleanup());

describe("Página Clientes", () => {
  it("renderiza a visão de clientes", () => {
    render(<ClientsPage />);

    expect(ClientsView).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("clients-view")).toBeInTheDocument();
  });
});
