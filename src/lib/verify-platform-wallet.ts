// @ts-nocheck

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

type IdentityJson = {
  ok?: boolean;
  walletAddress?: string;
  skipWalletBindingCheck?: boolean;
};

/**
 * Ensure local WALLET_PRIVATE_KEY matches Scout.walletAddress on Swarm (self-hosted).
 * Managed Rovers: server returns skipWalletBindingCheck — no compare.
 */
export async function assertWalletMatchesScoutOnSwarm(opts: {
  swarmBaseUrl: string;
  scoutKey: string;
  privateKeyBase58: string;
}): Promise<void> {
  if (
    process.env.GOROVER_SKIP_SCOUT_WALLET_CHECK === "1" ||
    process.env.GOROVER_SKIP_SCOUT_WALLET_CHECK === "true"
  ) {
    process.stderr.write(
      "[gorover-agent] Skipping wallet binding check (GOROVER_SKIP_SCOUT_WALLET_CHECK).\n"
    );
    return;
  }

  const base = String(opts.swarmBaseUrl || "")
    .trim()
    .replace(/\/+$/, "");
  if (!base) {
    throw new Error("Swarm base URL missing (goroverSwarmUrl / GOROVER_SWARM_API_BASE).");
  }

  const url = new URL("scout/registered-wallet", base).toString();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-gorover-scout-key": opts.scoutKey,
    },
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  let j: IdentityJson;
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    j = {};
  }

  if (!res.ok) {
    throw new Error(
      `Swarm identity check failed: HTTP ${res.status}. Is GOROVER_SWARM_API_BASE correct and this Scout key valid?`
    );
  }
  if (!j.ok) {
    throw new Error("Swarm identity check: unexpected response.");
  }
  if (j.skipWalletBindingCheck) {
    process.stderr.write(
      "[gorover-agent] Managed / platform-hosted Rover — skipping wallet=account binding check.\n"
    );
    return;
  }

  let pub: string;
  try {
    const kp = Keypair.fromSecretKey(bs58.decode(opts.privateKeyBase58.trim()));
    pub = kp.publicKey.toBase58();
  } catch {
    throw new Error(
      "Invalid WALLET_PRIVATE_KEY (base58 secret key) — cannot verify against GoRover account."
    );
  }

  const expected = (j.walletAddress || "").trim();
  if (!expected) {
    throw new Error("Swarm returned no walletAddress for this Scout.");
  }
  if (pub !== expected) {
    throw new Error(
      `Wallet mismatch: this keypair is ${pub} but GoRover has ${expected} for this Scout. ` +
        `Use the same wallet you connected at app.gorover.xyz, or for emergencies only: GOROVER_SKIP_SCOUT_WALLET_CHECK=1.`
    );
  }

  process.stderr.write(
    `[gorover-agent] Wallet matches GoRover account (${pub.slice(0, 4)}...${pub.slice(-4)}).\n`
  );
}
