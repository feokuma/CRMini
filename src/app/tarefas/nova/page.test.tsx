import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { TasksView } = vi.hoisted(() => ({
  TasksView: vi.fn(() => <div data-testid="tasks-view" />),
}));

vi.mock("@/components/tasks-view", () => ({ default: TasksView }));

import NewTaskPage from "./page";

afterEach(() => cleanup());

describe("Página Nova tarefa", () => {
  it("renderiza a visão de tarefas em modo formulário", () => {
    render(<NewTaskPage />);

    expect(TasksView).toHaveBeenCalledTimes(1);
    expect(TasksView.mock.calls[0][0]).toEqual({ mode: "form" });
    expect(screen.getByTestId("tasks-view")).toBeInTheDocument();
  });
});
