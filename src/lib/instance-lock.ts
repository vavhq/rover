import fs from "node:fs";
import { workspacePath } from "@/lib/paths";

type LockInfo = {
  pid: number;
  createdAt: string;
  argv: string[];
};

const LOCK_PATH = workspacePath(".rover.lock");

function isProcessAlive(pid: number) {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readLock(): LockInfo | null {
  try {
    if (!fs.existsSync(LOCK_PATH)) return null;
    const raw = fs.readFileSync(LOCK_PATH, "utf8");
    return JSON.parse(raw) as LockInfo;
  } catch {
    return null;
  }
}

export function acquireInstanceLock() {
  const existing = readLock();
  if (existing?.pid && isProcessAlive(existing.pid)) {
    const msg = `Another Rover instance is already running (pid=${existing.pid}). Refusing to start.`;
    const err = new Error(msg);
    // @ts-expect-error
    err.code = "ROVER_LOCKED";
    throw err;
  }

  const info: LockInfo = {
    pid: process.pid,
    createdAt: new Date().toISOString(),
    argv: process.argv.slice(0, 10),
  };

  // Best-effort: avoid partial writes.
  fs.writeFileSync(LOCK_PATH, JSON.stringify(info, null, 2));

  const cleanup = () => {
    try {
      const current = readLock();
      if (current?.pid === process.pid) fs.unlinkSync(LOCK_PATH);
    } catch {
      // ignore
    }
  };

  process.on("exit", cleanup);
  process.on("SIGINT", () => cleanup());
  process.on("SIGTERM", () => cleanup());

  return { lockPath: LOCK_PATH };
}
