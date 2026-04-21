/**
 * HTTP client for optional discovery / relay API (pool signals, chart bundles, execution relay).
 * Base URL and key come from env / user config — no baked-in third-party defaults.
 */
import { config } from "@/core/config";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function retryDelayMs(error: { retryAfter?: string | null }, attempt: number) {
  const retryAfter = Number(error?.retryAfter);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 10_000);
  }
  return Math.min(500 * 2 ** attempt, 5_000);
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number | null) {
  if (!Number.isFinite(timeoutMs as number) || (timeoutMs as number) <= 0) {
    return fetch(url, options);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs as number);
  const signal = options.signal;
  const abortFromParent = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", abortFromParent, { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abortFromParent);
  }
}

export function getRelayApiBase(): string {
  return String(config.api.url || "").replace(/\/+$/, "");
}

export function getRelayApiHeaders(opts: { json?: boolean } = {}): Record<string, string> {
  const headers: Record<string, string> = {};
  if (opts.json) headers["Content-Type"] = "application/json";
  if (config.api.publicApiKey) headers["x-api-key"] = config.api.publicApiKey;
  return headers;
}

/** Stable id forwarded to relay requests (from local user config). */
export function getRoverRequestAgentId(): string {
  return config.swarm?.agentId || "rover-local";
}

async function relayApiJsonOnce(
  pathname: string,
  options: RequestInit = {},
  timeoutMs: number | null = null
) {
  const base = getRelayApiBase();
  if (!base) {
    throw new Error(
      "RELAY_API_NOT_CONFIGURED: set VAV_DISCOVERY_API_URL or discoveryApiUrl in config"
    );
  }
  const res = await fetchWithTimeout(`${base}${pathname}`, options, timeoutMs);
  const text = await res.text().catch(() => "");
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    payload = { raw: text };
  }
  if (!res.ok) {
    const error = new Error(
      String((payload as { error?: string }).error || `${pathname} ${res.status}`)
    ) as Error & {
      status?: number;
      payload?: unknown;
      retryAfter?: string | null;
    };
    error.status = res.status;
    error.payload = payload;
    error.retryAfter = res.headers.get("retry-after");
    throw error;
  }
  return payload;
}

export async function relayApiJson(
  pathname: string,
  options: RequestInit & {
    retry?: { maxElapsedMs?: number; maxAttempts?: number; perAttemptTimeoutMs?: number };
  } = {}
) {
  const { retry, ...fetchOptions } = options;
  if (!retry) {
    return relayApiJsonOnce(pathname, fetchOptions);
  }

  const maxElapsedMs = Number(retry.maxElapsedMs || 30_000);
  const maxAttempts = Number(retry.maxAttempts || 10);
  const startedAt = Date.now();
  let attempt = 0;
  let lastError: Error | null = null;

  while (Date.now() - startedAt < maxElapsedMs && attempt < maxAttempts) {
    const elapsedMs = Date.now() - startedAt;
    const remainingMs = Math.max(1, maxElapsedMs - elapsedMs);
    try {
      return await relayApiJsonOnce(
        pathname,
        fetchOptions,
        Math.min(Number(retry.perAttemptTimeoutMs || 10_000), remainingMs)
      );
    } catch (e) {
      lastError = e as Error;
      const status = Number((e as { status?: number })?.status || 0);
      if (!isRetryableStatus(status) || attempt >= maxAttempts - 1) {
        throw e;
      }
      const waitMs = Math.min(
        retryDelayMs(e as { retryAfter?: string | null }, attempt),
        Math.max(0, remainingMs - 1)
      );
      if (waitMs <= 0) break;
      await sleep(waitMs);
      attempt += 1;
    }
  }

  throw lastError || new Error(`${pathname} retry budget exhausted`);
}
