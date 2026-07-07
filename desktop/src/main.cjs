const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const managedProcesses = new Map();

function resolveRepoRoot() {
  return path.resolve(__dirname, "..", "..");
}

function findFreePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        findFreePort(startPort + 1).then(resolve, reject);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });

    server.listen(startPort, "127.0.0.1");
  });
}

function spawnManagedProcess(name, command, args, options) {
  if (managedProcesses.has(name)) {
    return managedProcesses.get(name);
  }

  const child = spawn(command, args, {
    ...options,
    env: {
      ...process.env,
      ...(options && options.env ? options.env : {}),
    },
    shell: false,
    stdio: "inherit",
    windowsHide: true,
  });

  child.once("exit", () => managedProcesses.delete(name));
  managedProcesses.set(name, child);
  return child;
}

function killManagedProcesses() {
  for (const child of managedProcesses.values()) {
    if (!child.killed) {
      child.kill();
    }
  }

  managedProcesses.clear();
}

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function startLocalRuntime() {
  const repoRoot = resolveRepoRoot();
  const frontendDir = path.join(repoRoot, "frontend");
  const backendDir = path.join(repoRoot, "backend");
  const excelHelperDir = path.join(repoRoot, "tools", "excel-helper");
  const workspaceDir = ensureDirectory(path.join(app.getPath("userData"), "workspaces"));

  const backendPort = await findFreePort(
    Number.parseInt(process.env.LIVEDOCK_BACKEND_PORT || "8000", 10),
  );
  const frontendPort = await findFreePort(
    Number.parseInt(process.env.LIVEDOCK_FRONTEND_PORT || "3111", 10),
  );
  const backendUrl = `http://127.0.0.1:${backendPort}`;
  const frontendUrl = `http://127.0.0.1:${frontendPort}/app/projects`;
  const runtimeEnv = {
    LIVEDOCK_DESKTOP: "1",
    LIVEDOCK_WORKSPACE_DIR: workspaceDir,
    LIVEDOCK_EXCEL_HELPER_DIR: excelHelperDir,
    NEXT_PUBLIC_API_URL: backendUrl,
  };

  spawnManagedProcess(
    "backend",
    process.env.LIVEDOCK_PYTHON || "python",
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(backendPort)],
    {
      cwd: backendDir,
      env: runtimeEnv,
    },
  );

  spawnManagedProcess("frontend", npmCommand(), ["run", "dev", "--", "-p", String(frontendPort)], {
    cwd: frontendDir,
    env: runtimeEnv,
  });

  return {
    backendUrl,
    excelHelperDir,
    frontendUrl,
    workspaceDir,
  };
}

async function createWindow() {
  const runtime = await startLocalRuntime();
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    title: "LiveDock Desktop",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  window.loadURL(runtime.frontendUrl);
}

app.whenReady().then(createWindow);

app.on("before-quit", killManagedProcesses);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

module.exports = {
  findFreePort,
  killManagedProcesses,
  resolveRepoRoot,
  spawnManagedProcess,
  startLocalRuntime,
};
