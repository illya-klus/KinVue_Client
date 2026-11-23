import { spawnSync } from "node:child_process";

const result = spawnSync(
  "pnpm",
  ["exec", "playwright", "test", ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: { ...process.env, E2E_STACK: "1" },
    stdio: "inherit",
    shell: true,
  },
);

if (result.error) {
  console.error(`Could not start Playwright: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
