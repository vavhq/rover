/**
 * Rover signal ingest service (ToS-compliant).
 * Accepts POST webhook payloads, extracts Solana addresses, runs pre-checks,
 * then appends pending records into `discord-signals.json` (legacy queue name kept for compatibility).
 *
 * Env:
 *   SIGNAL_INGEST_TOKEN   required shared secret (Bearer token)
 *   SIGNAL_INGEST_PORT    optional, default 8787
 *   SIGNAL_INGEST_HOST    optional, default 0.0.0.0
 */
// @ts-nocheck

import fs from "node:fs";
import { workspacePath, writeFileAtomic } from "@/lib/paths";
import { runPreChecks } from "./pre-checks";
import "dotenv/config";

const SIGNALS_FILE = workspacePath("discord-signals.json");
const SIGNAL_INGEST_TOKEN = String(process.env.SIGNAL_INGEST_TOKEN || "").trim();
const SIGNAL_INGEST_PORT = Number(process.env.SIGNAL_INGEST_PORT || 8787);
const SIGNAL_INGEST_HOST = String(process.env.SIGNAL_INGEST_HOST || "0.0.0.0");

const SOL_ADDR_RE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;
const FALSE_POSITIVE_SKIP = new Set(["solana", "meteora", "jupiter", "raydium", "orca"]);

function isLikelySolanaAddress(str) {
  if (str.length < 32 || str.length > 44) return false;
  if (FALSE_POSITIVE_SKIP.has(str.toLowerCase())) return false;
  if (!/\d/.test(str)) return false;
  return true;
}

function loadSignals() {
  if (!fs.existsSync(SIGNALS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(SIGNALS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveSignal(record) {
  const signals = loadSignals();
  signals.unshift(record);
  writeFileAtomic(SIGNALS_FILE, JSON.stringify(signals.slice(0, 100), null, 2));
}

async function processAddress(address, meta) {
  const result = await runPreChecks(address);
  if (!result.pass) return { queued: false, reason: result.reason || "pre-check rejected" };

  const record = {
    id: `${address.slice(0, 8)}-${Date.now()}`,
    pool_address: result.pool_address,
    base_mint: result.base_mint,
    base_symbol: result.symbol || "?",
    signal_source: meta.source || "webhook",
    discord_guild: meta.guild || "n/a",
    discord_channel: meta.channel || "n/a",
    discord_author: meta.author || "unknown",
    discord_message_snippet: String(meta.text || "").slice(0, 120),
    queued_at: new Date().toISOString(),
    rug_score: result.rug_score ?? null,
    total_fees_sol: result.total_fees_sol ?? null,
    token_age_minutes: result.token_age_minutes ?? null,
    status: "pending",
  };
  saveSignal(record);
  return { queued: true, pool: record.pool_address, symbol: record.base_symbol };
}

function extractTokenFromAuthHeader(request) {
  const auth = String(request.headers.get("authorization") || "");
  if (!auth.toLowerCase().startsWith("bearer ")) return "";
  return auth.slice(7).trim();
}

if (!SIGNAL_INGEST_TOKEN) {
  console.error("CONFIG ERROR: SIGNAL_INGEST_TOKEN is required.");
  process.exit(1);
}

console.log(
  `[signal-ingest] listening on http://${SIGNAL_INGEST_HOST}:${SIGNAL_INGEST_PORT} (queue: ${SIGNALS_FILE})`
);

Bun.serve({
  hostname: SIGNAL_INGEST_HOST,
  port: SIGNAL_INGEST_PORT,
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "signal-ingest" });
    }

    if (request.method !== "POST" || url.pathname !== "/signals/ingest") {
      return new Response("Not found", { status: 404 });
    }

    const token = extractTokenFromAuthHeader(request);
    if (!token || token !== SIGNAL_INGEST_TOKEN) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const text = String(body.text || body.message || "").trim();
    if (!text) {
      return Response.json({ ok: false, error: "text is required" }, { status: 400 });
    }

    const matches = [...text.matchAll(SOL_ADDR_RE)].map((m) => m[0]);
    const unique = [...new Set(matches)].filter(isLikelySolanaAddress);
    if (unique.length === 0) {
      return Response.json({ ok: true, queued: 0, addresses: [] });
    }

    const meta = {
      source: body.source || "webhook",
      guild: body.guild || body.server || "",
      channel: body.channel || "",
      author: body.author || body.sender || "",
      text,
    };

    const results = [];
    for (const address of unique) {
      // Sequential on purpose: easier to trace and avoid spiky upstream calls.
      // eslint-disable-next-line no-await-in-loop
      const out = await processAddress(address, meta);
      results.push({ address, ...out });
    }

    const queued = results.filter((r) => r.queued).length;
    return Response.json({
      ok: true,
      queued,
      addresses: unique,
      results,
    });
  },
});
