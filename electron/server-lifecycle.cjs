const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

function createServerLifecycle({ processSpawner = spawn, projectDir, isDevelopment, host = "127.0.0.1", env = process.env }) {
  let child;
  let url;
  let stopping;

  async function reservePort() {
    const server = net.createServer();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, host, resolve);
    });
    const port = server.address().port;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    return port;
  }

  function waitForExit(processRef) {
    return new Promise((resolve) => processRef.once("exit", resolve));
  }

  async function start(databasePath, { request = require("node:http").get, timeoutMs = 30000 } = {}) {
    const port = await reservePort();
    url = `http://${host}:${port}`;
    const executable = path.join(projectDir, "node_modules", "next", "dist", "bin", "next");
    child = processSpawner(process.execPath, [executable, isDevelopment ? "dev" : "start", "--hostname", host, "--port", String(port)], {
      cwd: projectDir, stdio: "inherit", env: { ...env, ELECTRON_RUN_AS_NODE: "1", HOSTNAME: host, PORT: String(port), SQLITE_PATH: databasePath },
    });
    let finished = false;
    let retryTimer;
    const ready = new Promise((resolve, reject) => {
      const onExit = (code) => {
        finished = true;
        reject(new Error(`Next.js encerrou antes de ficar pronto (código ${code}).`));
      };
      child.once("exit", onExit);
      const deadline = Date.now() + timeoutMs;
      const check = () => {
        if (finished) return;
        if (Date.now() >= deadline) {
          finished = true;
          child.removeListener("exit", onExit);
          return reject(new Error("Next.js não ficou pronto dentro do prazo."));
        }
        const req = request(`${url}/`, (response) => {
          if (finished) return;
          finished = true;
          clearTimeout(retryTimer);
          child.removeListener("exit", onExit);
          response.resume();
          resolve(url);
        });
        req.on("error", () => { if (!finished) retryTimer = setTimeout(check, 150); });
      };
      check();
    });
    return ready;
  }

  function stop() {
    if (stopping) return stopping;
    const running = child;
    if (!running || running.exitCode !== null || running.signalCode !== null) {
      child = undefined;
      url = undefined;
      return Promise.resolve();
    }
    stopping = (async () => {
      await new Promise((resolve) => {
        if (running.exitCode !== null || running.signalCode !== null) return resolve();
        const exited = waitForExit(running);
        running.kill("SIGTERM");
        exited.then(resolve);
      });
      child = undefined;
      url = undefined;
    })().finally(() => { stopping = undefined; });
    return stopping;
  }

  return { start, stop, get url() { return url; } };
}

module.exports = { createServerLifecycle };
