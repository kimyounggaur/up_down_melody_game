import { spawn } from "node:child_process";
const args = process.argv.slice(2);
const port = args.includes("--port")
  ? args[args.indexOf("--port") + 1]
  : "3000";
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "--hostname",
    "0.0.0.0",
    "--port",
    port,
  ],
  { stdio: "inherit" },
);
for (const s of ["SIGTERM", "SIGINT"]) process.on(s, () => child.kill(s));
child.on("exit", (code) => process.exit(code ?? 0));
