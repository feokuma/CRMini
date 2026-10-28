import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { ContactsView } = vi.hoisted(() => ({
  ContactsView: vi.fn(() => <div data-testid="contacts-view" />),
}));

vi.mock("@/components/contacts-view", () => ({ default: ContactsView }));

import ContactsPage from "./page";

afterEach(() => cleanup());

describe("Página Contatos", () => {
  it("renderiza a visão de contatos", () => {
    render(<ContactsPage />);

    expect(ContactsView).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("contacts-view")).toBeInTheDocument();
  });
});
