import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import TasksView from "./tasks-view";

describe("TasksView date filter", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("starts with no date filter and remembers a selected date in the session", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);
    const { unmount } = render(<TasksView />);

    expect(screen.getByLabelText("Filtrar tarefas por dia")).toHaveValue("");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/tasks"));
    fireEvent.change(screen.getByLabelText("Filtrar tarefas por dia"), {
      target: { value: "2026-10-14" },
    });
    await waitFor(() => expect(sessionStorage.getItem("tasks-date-filter")).toBe("2026-10-14"));
    unmount();

    render(<TasksView />);
    await waitFor(() => expect(screen.getByLabelText("Filtrar tarefas por dia")).toHaveValue("2026-10-14"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/tasks?date=2026-10-14"));
  });

  it("clears the saved date filter when the date is cleared", async () => {
    sessionStorage.setItem("tasks-date-filter", "2026-10-14");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => [] } as Response);
    render(<TasksView />);
    const input = await screen.findByLabelText("Filtrar tarefas por dia");
    await waitFor(() => expect(input).toHaveValue("2026-10-14"));
    fireEvent.change(input, { target: { value: "" } });
    await waitFor(() => expect(sessionStorage.getItem("tasks-date-filter")).toBeNull());
  });
});
