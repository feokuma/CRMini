import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { ClientForm } = vi.hoisted(() => ({
  ClientForm: vi.fn(() => <div data-testid="client-form" />),
}));

vi.mock("@/components/client-form", () => ({ default: ClientForm }));

import NewClientPage from "./page";

afterEach(() => cleanup());

describe("Página Novo cliente", () => {
  it("renderiza o formulário de novo cliente sem id", () => {
    render(<NewClientPage />);

    expect(ClientForm).toHaveBeenCalledTimes(1);
    expect(ClientForm.mock.calls[0][0]).toEqual({});
    expect(screen.getByTestId("client-form")).toBeInTheDocument();
  });
});
