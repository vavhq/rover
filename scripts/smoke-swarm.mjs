import crypto from "node:crypto";

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v).trim();
}

function sanitizeUrl(url) {
  const u = String(url || "").trim().replace(/\/+$/, "");
  if (!u) return "";
  // Will throw if invalid.
  new URL(u);
  return u;
}

function signBeacon(body, key) {
  return crypto.createHmac("sha256", key).update(JSON.stringify(body)).digest("hex");
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const txt = await res.text();
  let json = null;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {
    json = null;
  }
  return { res, json, text: txt };
}

const base = sanitizeUrl(process.env.VAV_SWARM_API_BASE || "https://swarm.vav.sh");
const scoutKey = requireEnv("VAV_SCOUT_KEY");

// 1) thresholds
{
  const url = new URL("/thresholds", base).toString();
  const { res } = await fetchJson(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Swarm thresholds failed: HTTP ${res.status}`);
  }
}

// 2) beacon
{
  const unsigned = {
    logs: [{ at: new Date().toISOString(), level: "info", msg: "dogfood_smoke" }],
    stakes: [],
    thresholds: {},
    roverVersion: "dogfood",
  };
  const signature = signBeacon(unsigned, scoutKey);
  const body = { ...unsigned, signature };

  const url = new URL("/beacon", base).toString();
  const { res, json } = await fetchJson(url, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-vav-scout-key": scoutKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const msg = json?.error ? ` (${json.error})` : "";
    throw new Error(`Swarm beacon failed: HTTP ${res.status}${msg}`);
  }
}

process.stdout.write("OK: Swarm thresholds + beacon smoke passed.\n");

