import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const local = resolve("node_modules/.cache/ms-playwright");
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(local))
  process.env.PLAYWRIGHT_BROWSERS_PATH = local;
const files = process.argv.slice(2);
for (const file of files) {
  const result = spawnSync(process.execPath, [file], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
