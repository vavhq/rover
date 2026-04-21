import fs from "node:fs";
import { workspacePath } from "@/lib/paths";

type BeaconState = {
  lastSentAt?: string | null;
  sentWindow?: { ts: string; count: number } | null;
};

const STATE_PATH = workspacePath("swarm-cache.json");

function nowIso() {
  return new Date().toISOString();
}

function parseIso(s: string | null | undefined) {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

function loadState(): BeaconState {
  try {
    if (!fs.existsSync(STATE_PATH)) return {};
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as BeaconState;
  } catch {
    return {};
  }
}

function saveState(state: BeaconState) {
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch {
    // ignore
  }
}

/**
 * Roadmap policy:
 * - max 6/hour per Scout  (≈ 1 every 10 minutes)
 * - min 1/day to stay active
 */
export function shouldSendBeacon({ force = false }: { force?: boolean } = {}) {
  const state = loadState();
  const now = Date.now();

  if (force) return { ok: true, reason: "FORCE" as const };

  const lastSentAtMs = parseIso(state.lastSentAt) ?? 0;
  const minIntervalMs = 10 * 60 * 1000; // 6/hour

  if (lastSentAtMs && now - lastSentAtMs < minIntervalMs) {
    return { ok: false, reason: "RATE_MAX_6_PER_HOUR" as const };
  }

  return { ok: true, reason: "OK" as const };
}

export function markBeaconSent() {
  const state = loadState();
  state.lastSentAt = nowIso();
  saveState(state);
}

export function needsDailyBeacon() {
  const state = loadState();
  const lastSentAtMs = parseIso(state.lastSentAt);
  if (!lastSentAtMs) return true;
  return Date.now() - lastSentAtMs > 24 * 60 * 60 * 1000;
}

export function getLastBeaconSentAt(): string | null {
  const state = loadState();
  return typeof state.lastSentAt === "string" ? state.lastSentAt : null;
}
