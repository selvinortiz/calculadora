import { spawn, spawnSync } from "node:child_process";

const status = spawnSync("npx", ["supabase", "status", "-o", "json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
if (status.status !== 0) process.exit(status.status || 1);
const local = JSON.parse(status.stdout);
const child = spawn("npm", ["run", "dev"], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
    NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.PUBLISHABLE_KEY || local.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code || 0));
