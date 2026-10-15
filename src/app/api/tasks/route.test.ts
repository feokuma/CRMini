import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { listTasks } = vi.hoisted(() => ({ listTasks: vi.fn() }));
vi.mock("@/lib/repositories/tasks", () => ({ listTasks, createTask: vi.fn() }));

import { GET } from "./route";

describe("GET /api/tasks", () => {
  beforeEach(() => listTasks.mockReset().mockResolvedValue([]));

  it("requests tasks without a date range when date is omitted", async () => {
    const response = await GET(new NextRequest("http://localhost/api/tasks"));
    expect(response.status).toBe(200);
    expect(listTasks).toHaveBeenCalledWith(null, null, null);
  });

  it("applies the requested day and status filters", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost/api/tasks?date=2026-10-14&status=Aberto",
      ),
    );
    expect(response.status).toBe(200);
    expect(listTasks).toHaveBeenCalledWith(
      "2026-10-14T03:00:00.000Z",
      "2026-10-15T03:00:00.000Z",
      "Aberto",
    );
  });

  it("rejects an unsupported status", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/tasks?status=Inválido"),
    );
    expect(response.status).toBe(400);
    expect(listTasks).not.toHaveBeenCalled();
  });
});
