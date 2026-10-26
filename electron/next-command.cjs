function getNextCommand(isDevelopment, host, port) {
  return [
    "run",
    isDevelopment ? "dev" : "start",
    "--",
    "--hostname",
    host,
    "--port",
    String(port),
  ];
}

module.exports = { getNextCommand };
