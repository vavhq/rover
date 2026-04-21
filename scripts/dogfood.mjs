import { spawnSync } from "node:child_process";

function run(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

// Always keep dogfood safe by default.
process.env.DRY_RUN ||= "true";

run("bun", ["run", "vocab"]);
run("bun", ["run", "typecheck"]);
run("bun", ["run", "lint"]);

// Tests can be slow/flaky depending on env. Keep them on, but allow opt-out.
if (process.env.DOGFOOD_SKIP_TESTS !== "1") {
  run("bun", ["run", "test"]);
}

// Swarm smoke is optional (needs VAV_SCOUT_KEY). If present, verify server+client path.
if (process.env.VAV_SCOUT_KEY && String(process.env.VAV_SCOUT_KEY).trim()) {
  run("node", ["scripts/smoke-swarm.mjs"]);
} else {
  process.stdout.write("SKIP: Swarm smoke (missing VAV_SCOUT_KEY).\n");
}

process.stdout.write("OK: dogfood checks passed.\n");

