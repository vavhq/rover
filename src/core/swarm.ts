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
  return sanitizeText(process.env.GOROVER_SCOUT_KEY || config.swarm?.scoutKey || "", 600) || "";
}

function swarmHeaders() {
  const key = scoutKey();
  return {
    accept: "application/json",
    "content-type": "application/json",
    ...(key ? { "x-gorover-scout-key": key } : {}),
  };
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

const _sharedLessonsCache = new Map<string, { value: string | null; ts: number }>();
const _sharedLessonsInFlight = new Map<string, Promise<void>>();
const SHARED_LESSONS_TTL_MS = 60_000;

export async function sendBeacon(payload: {
  logs: unknown[];
  stakes: unknown[];
  thresholds: Record<string, unknown>;
  roverVersion?: string | null;
}) {
  if (!isSwarmEnabled()) {
    return { ok: false, error: "SWARM_NOT_CONFIGURED" };
  }

  const url = new URL("beacon", swarmBaseUrl()).toString();
  const strategyKind = sanitizeText(config.strategyContract?.kind, 20) || "custom";
  const strategyId =
    sanitizeText(config.strategyContract?.id, 120) ||
    `selfhosted.${sanitizeText(config.strategy?.strategy, 40) || "bid_ask"}`;
  const strategySpecVersion = sanitizeText(config.strategyContract?.specVersion, 40) || "1.0.0";
  const protocolVersion = sanitizeText(config.strategyContract?.protocolVersion, 20) || "1.0";

  const unsigned = {
    logs: Array.isArray(payload.logs) ? payload.logs : [],
    stakes: Array.isArray(payload.stakes) ? payload.stakes : [],
    thresholds: payload.thresholds || {},
    version: sanitizeText(payload.roverVersion, 80) || "0.1.0",
    protocolVersion,
    strategyKind,
    strategyId,
    strategySpecVersion,
  };
  const signature = signBeacon(unsigned, scoutKey());
  const body = { ...unsigned, signature };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-gorover-scout-key": scoutKey(),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const details = json?.error || json?.message || null;
    const validation =
      json?.details && typeof json.details === "object"
        ? JSON.stringify(json.details).slice(0, 500)
        : null;
    log(
      "swarm_warn",
      `Beacon rejected: HTTP ${res.status}${details ? ` (${sanitizeText(details, 180)})` : ""}${
        validation ? ` details=${validation}` : ""
      }`
    );
    return { ok: false, status: res.status, error: details || "BEACON_REJECTED", raw: json };
  }
  return json;
}

export async function fetchThresholds() {
  if (!swarmBaseUrl()) return { ok: false, error: "SWARM_NOT_CONFIGURED" };
  const url = new URL("thresholds", swarmBaseUrl()).toString();
  const res = await fetch(url, {
    headers: swarmHeaders(),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, error: json?.error || "THRESHOLDS_FAILED" };
  return json;
}

export function getSharedLessonsForPrompt({
  agentType = "GENERAL",
  maxLessons = 6,
} = {}) {
  const role = sanitizeText(agentType, 20) || "GENERAL";
  const limit = Number.isFinite(Number(maxLessons))
    ? Math.max(1, Math.min(20, Number(maxLessons)))
    : 6;
  const cacheKey = `${role}:${limit}`;
  const now = Date.now();
  const cached = _sharedLessonsCache.get(cacheKey);
  const fresh = cached && now - cached.ts < SHARED_LESSONS_TTL_MS;

  if (!fresh && !_sharedLessonsInFlight.has(cacheKey) && isSwarmEnabled()) {
    const run = (async () => {
      const url = new URL("lessons/shared", swarmBaseUrl());
      url.searchParams.set("role", role);
      url.searchParams.set("limit", String(limit));
      try {
        const res = await fetch(url.toString(), {
          headers: swarmHeaders(),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok || !Array.isArray(json?.lessons)) {
          _sharedLessonsCache.set(cacheKey, { value: null, ts: Date.now() });
          return;
        }
        const lines = json.lessons
          .map((entry) => sanitizeText(entry?.rule, 260))
          .filter(Boolean)
          .slice(0, limit);
        const value = lines.length ? lines.map((line) => `[SHARED] ${line}`).join("\n") : null;
        _sharedLessonsCache.set(cacheKey, { value, ts: Date.now() });
      } catch (error) {
        log("swarm_warn", `Shared lessons fetch failed: ${error?.message || String(error)}`);
        _sharedLessonsCache.set(cacheKey, { value: null, ts: Date.now() });
      } finally {
        _sharedLessonsInFlight.delete(cacheKey);
      }
    })();
    _sharedLessonsInFlight.set(cacheKey, run);
  }
  return cached?.value ?? null;
}

export async function pushSharedLesson(lesson = null) {
  if (!isSwarmEnabled() || !lesson) return null;
  const url = new URL("lessons/shared", swarmBaseUrl()).toString();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: swarmHeaders(),
      body: JSON.stringify(lesson),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      log(
        "swarm_warn",
        `Shared lesson push failed: HTTP ${res.status}${json?.error ? ` (${sanitizeText(json.error, 120)})` : ""}`
      );
      return null;
    }
    return { ok: true };
  } catch (error) {
    log("swarm_warn", `Shared lesson push error: ${error?.message || String(error)}`);
    return null;
  }
}

export async function pushPerformanceEvent(event = null) {
  if (!isSwarmEnabled() || !event) return null;
  const url = new URL("events/performance", swarmBaseUrl()).toString();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: swarmHeaders(),
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      log(
        "swarm_warn",
        `Performance event push failed: HTTP ${res.status}${json?.error ? ` (${sanitizeText(json.error, 120)})` : ""}`
      );
      return null;
    }
    return { ok: true };
  } catch (error) {
    log("swarm_warn", `Performance event push error: ${error?.message || String(error)}`);
    return null;
  }
}
