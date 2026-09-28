// Runs browser test scripts sequentially with a reusable project-local Chromium installation.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
// Respect an explicit browser path; otherwise use the locally downloaded browser when present.
const local = resolve("node_modules/.cache/ms-playwright");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(local))
  process.env.PLAYWRIGHT_BROWSERS_PATH = local;
const files = process.argv.slice(2);
// Use Node directly across shells and stop at the first failed suite.
for (const file of files) {
  const result = spawnSync(process.execPath, [file], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
