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

test("main process starts managed frontend/backend runtime for /app/projects", async () => {
  const main = await readFile(path.join(desktopRoot, "src", "main.cjs"), "utf8");

  assert.match(main, /findFreePort/);
  assert.match(main, /spawnManagedProcess/);
  assert.match(main, /\/app\/projects/);
  assert.match(main, /LIVEDOCK_WORKSPACE_DIR/);
  assert.match(main, /frontend/);
  assert.match(main, /backend/);
  assert.match(main, /excel-helper/);
});

test("preload exposes a small desktop capability surface", async () => {
  const preload = await readFile(
    path.join(desktopRoot, "src", "preload.cjs"),
    "utf8",
  );

  assert.match(preload, /contextBridge/);
  assert.match(preload, /livedockDesktop/);
  assert.match(preload, /isDesktop/);
});
