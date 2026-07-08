import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const desktopRoot = path.join(repoRoot, "desktop");

test("desktop package exposes an Electron entrypoint and local scripts", async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(desktopRoot, "package.json"), "utf8"),
  );

  assert.equal(packageJson.private, true);
  assert.equal(packageJson.main, "src/main.cjs");
  assert.equal(packageJson.scripts.dev, "electron .");
  assert.equal(packageJson.scripts.start, "electron .");
  assert.match(packageJson.devDependencies.electron, /^\^/);
});

test("main process starts managed frontend/backend runtime for /app/new", async () => {
  const main = await readFile(path.join(desktopRoot, "src", "main.cjs"), "utf8");

  assert.match(main, /findFreePort/);
  assert.match(main, /spawnManagedProcess/);
  assert.match(main, /\/app\/new/);
  assert.match(main, /LIVEDOCK_WORKSPACE_DIR/);
  assert.match(main, /frontend/);
  assert.match(main, /backend/);
  assert.match(main, /inline-agent/);
  assert.match(main, /docklive-inline-agent/);
  assert.match(main, /LIVEDOCK_API_URL/);
  assert.match(main, /excel-helper/);
  assert.match(main, /LIVEDOCK_EXCEL_HELPER_PYTHON/);
});

test("main process registers output folder picker ipc", async () => {
  const main = await readFile(path.join(desktopRoot, "src", "main.cjs"), "utf8");

  assert.match(main, /ipcMain\.handle\(["']livedock:select-output-folder["']/);
  assert.match(main, /dialog\.showOpenDialog/);
  assert.match(main, /openDirectory/);
  assert.match(main, /createDirectory/);
});

test("preload exposes a small desktop capability surface", async () => {
  const preload = await readFile(
    path.join(desktopRoot, "src", "preload.cjs"),
    "utf8",
  );

  assert.match(preload, /contextBridge/);
  assert.match(preload, /livedockDesktop/);
  assert.match(preload, /isDesktop/);
  assert.match(preload, /selectOutputFolder/);
  assert.match(preload, /ipcRenderer\.invoke\(["']livedock:select-output-folder["']\)/);
});
