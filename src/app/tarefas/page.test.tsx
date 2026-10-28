import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { TasksView } = vi.hoisted(() => ({
  TasksView: vi.fn(() => <div data-testid="tasks-view" />),
}));

vi.mock("@/components/tasks-view", () => ({ default: TasksView }));

import TasksPage from "./page";

afterEach(() => cleanup());

describe("Página Tarefas", () => {
  it("renderiza a visão de tarefas", () => {
    render(<TasksPage />);

    expect(TasksView).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("tasks-view")).toBeInTheDocument();
  });
});
