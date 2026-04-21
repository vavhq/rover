// @ts-nocheck
import crypto from "node:crypto";
import { config } from "@/core/config";
import { log } from "@/platform/logger";

export function signBeacon(body: object, key: string) {
  // HMAC-SHA256 over canonical JSON (stable enough for our payload shape).
  // Output is lowercase hex.
  return crypto.createHmac("sha256", key).update(JSON.stringify(body)).digest("hex");
}

function sanitizeText(text: unknown, maxLen = 400) {
  if (text == null) return null;
  const cleaned = String(text)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[<>`]/g, "")
    .trim()
    .slice(0, maxLen);
  return cleaned || null;
}

function swarmBaseUrl() {
  return sanitizeText(config.swarm?.url || "", 500) || "";
}

function scoutKey() {
  // Swarm uses the Scout key for both auth and HMAC signature verification.
  return sanitizeText(process.env.VAV_SCOUT_KEY || config.swarm?.scoutKey || "", 600) || "";
}

export function ensureAgentId() {
  // Keep agentId stable across runs (used for logs / optional relay correlation).
  if (config.swarm?.agentId) return config.swarm.agentId;
  const agentId = `rv_${crypto.randomBytes(12).toString("hex")}`;
  if (!config.swarm) config.swarm = { url: swarmBaseUrl() };
  config.swarm.agentId = agentId;
  return agentId;
}

export function isSwarmEnabled() {
  return !!(swarmBaseUrl() && scoutKey());
}

export async function sendBeacon(payload: {
  logs: unknown[];
  stakes: unknown[];
  thresholds: Record<string, unknown>;
  roverVersion?: string | null;
}) {
  if (!isSwarmEnabled()) {
    return { ok: false, error: "SWARM_NOT_CONFIGURED" };
  }

  const url = new URL("/beacon", swarmBaseUrl()).toString();

  const unsigned = {
    logs: Array.isArray(payload.logs) ? payload.logs : [],
    stakes: Array.isArray(payload.stakes) ? payload.stakes : [],
    thresholds: payload.thresholds || {},
    roverVersion: payload.roverVersion ?? null,
  };
  const signature = signBeacon(unsigned, scoutKey());
  const body = { ...unsigned, signature };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-vav-scout-key": scoutKey(),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    log("swarm_warn", `Beacon rejected: HTTP ${res.status}`);
    return { ok: false, status: res.status, error: json?.error || "BEACON_REJECTED" };
  }
  return json;
}

export async function fetchThresholds() {
  if (!swarmBaseUrl()) return { ok: false, error: "SWARM_NOT_CONFIGURED" };
  const url = new URL("/thresholds", swarmBaseUrl()).toString();
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const json = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, error: json?.error || "THRESHOLDS_FAILED" };
  return json;
}

// Swarm does not currently provide shared lessons/presets endpoints.
// These functions remain as explicit no-ops for now, so the Rover memory
// system can evolve locally without network dependencies.
export function getSharedLessonsForPrompt() {
  return null;
}

export async function pushSharedLesson() {
  return null;
}

export async function pushPerformanceEvent() {
  return null;
}
