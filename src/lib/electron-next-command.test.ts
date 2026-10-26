import { describe, expect, it } from "vitest";

const { getNextCommand } = require("../../electron/next-command.cjs") as {
  getNextCommand: (
    isDevelopment: boolean,
    host: string,
    port: number,
  ) => string[];
};

describe("getNextCommand", () => {
  it("starts the Next.js development server for Electron development", () => {
    expect(getNextCommand(true, "127.0.0.1", 3174)).toEqual([
      "run",
      "dev",
      "--",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3174",
    ]);
  });

  it("keeps the production server as the default command", () => {
    expect(getNextCommand(false, "127.0.0.1", 3174)).toEqual([
      "run",
      "start",
      "--",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3174",
    ]);
  });
});
