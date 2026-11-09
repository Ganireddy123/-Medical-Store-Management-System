const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const userData = path.join(root, ".tsupgrader", "runtime-validation", "electron-user-data");
const serverUrl = "http://127.0.0.1:5174/";
let vite;

function stopVite() {
  return new Promise((resolve) => {
    if (!vite || vite.exitCode !== null) {
      resolve();
      return;
    }
    const timeout = setTimeout(resolve, 3000);
    timeout.unref();
    vite.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    vite.kill();
  });
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (vite.exitCode !== null) throw new Error(`Vite exited with code ${vite.exitCode}.`);
    try {
      const response = await fetch(serverUrl, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error("The isolated Vite server did not become ready.");
}

async function main() {
  vite = spawn(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), "--port", "5174"], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  vite.once("error", (error) => console.error("Could not start the isolated Vite server:", error));
  await waitForServer();

  const electronEnvironment = { ...process.env };
  delete electronEnvironment.ELECTRON_RUN_AS_NODE;
  const electron = spawn(require("electron"), [
    ".", "--no-sandbox", `--user-data-dir=${userData}`,
    `--medistore-smoke-user-data=${userData}`, "--smoke-test",
  ], {
    cwd: root,
    env: electronEnvironment,
    stdio: "inherit",
    windowsHide: false,
  });

  const exitCode = await new Promise((resolve, reject) => {
    electron.once("error", reject);
    electron.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Electron smoke process exited from signal ${signal}.`));
      else resolve(code ?? 1);
    });
  });
  if (exitCode !== 0) throw new Error(`Electron smoke process failed with exit code ${exitCode}.`);
}

main()
  .catch((error) => {
    console.error("Electron smoke runner failed:", error);
    process.exitCode = 1;
  })
  .finally(stopVite);
