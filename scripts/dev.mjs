import { spawn } from "node:child_process";

const children = [];

function start(name, command, args, cwd = process.cwd()) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: false,
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`${name} stopped with signal ${signal}`);
      return;
    }

    if (code && code !== 0) {
      console.log(`${name} exited with code ${code}`);
    }
  });

  children.push(child);
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
}

process.on("SIGINT", () => {
  shutdown();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdown();
  process.exit(0);
});

start("frontend", "npm", ["run", "dev:web"]);
start("backend", "npm", ["run", "dev"], new URL("../server", import.meta.url).pathname);
