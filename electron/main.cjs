const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const host = "127.0.0.1";
const port = 3174;
let nextProcess;
let mainWindow;

function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on("error", () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("Next.js server did not become ready."));
        } else {
          setTimeout(check, 250);
        }
      });
    };
    check();
  });
}

async function createWindow() {
  const projectDir = path.resolve(__dirname, "..");
  nextProcess = spawn(
    "npm",
    ["run", "start", "--", "--hostname", host, "--port", String(port)],
    {
      cwd: projectDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: { ...process.env, HOSTNAME: host, PORT: String(port) },
    },
  );

  try {
    await waitForServer(`http://${host}:${port}`);
    mainWindow = new BrowserWindow({
      width: 1440,
      height: 900,
      minWidth: 900,
      minHeight: 600,
    });
    await mainWindow.loadURL(`http://${host}:${port}`);
  } catch (error) {
    console.error(error);
    app.quit();
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => nextProcess?.kill());
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
