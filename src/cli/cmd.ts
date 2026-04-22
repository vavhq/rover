#!/usr/bin/env node
/**
 * gorover-agent — Rover CLI (Solana DLMM)
 * Direct tool invocation with JSON output (automation friendly).
 */
// @ts-nocheck

import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

// ─── DRY_RUN must be set before any tool imports ─────────────────
if (process.argv.includes("--dry-run")) process.env.DRY_RUN = "true";

// ─── Load optional env from ~/.gorover-agent/ if present ─────────────
const dataDir = path.join(os.homedir(), ".gorover-agent");
const dataEnv = path.join(dataDir, ".env");
if (fs.existsSync(dataEnv)) {
  const { config: loadDotenv } = await import("dotenv");
  loadDotenv({ path: dataEnv, override: false });
}

// ─── Output helpers ───────────────────────────────────────────────
function out(data) {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

function die(msg, extra = {}) {
  process.stderr.write(`${JSON.stringify({ error: msg, ...extra })}\n`);
  process.exit(1);
}

// ─── SKILL.md generation ──────────────────────────────────────────
const SKILL_MD = `# gorover-agent — Rover CLI (Solana DLMM)

Data dir: ~/.gorover-agent/

## Commands

### gorover-agent balance
Returns wallet SOL and token balances.
\`\`\`
Output: { wallet, sol, sol_usd, usdc, tokens: [{mint, symbol, balance, usd_value}], total_usd }
\`\`\`

### gorover-agent positions
Returns all open Stakes (DLMM positions).
\`\`\`
Output: { stakes: [{position, pool, pair, in_range, age_minutes, ...}], total_stakes }
\`\`\`

### gorover-agent pnl <position_address>
Returns PnL for a specific Stake (position).
\`\`\`
Output: { pnl_pct, pnl_usd, unclaimed_fee_usd, all_time_fees_usd, current_value_usd, lower_bin, upper_bin, active_bin }
\`\`\`

### gorover-agent screen [--dry-run] [--silent]
Runs one AI scan cycle to find and (optionally) enter new Stakes.
\`\`\`
Output: { done: true, report: "..." }
\`\`\`

### gorover-agent manage [--dry-run] [--silent]
Runs one management cycle over open Stakes.
\`\`\`
Output: { done: true, report: "..." }
\`\`\`

### gorover-agent deploy --pool <addr> --amount <sol> [--bins-below 69] [--bins-above 0] [--strategy bid_ask|spot] [--dry-run]
Enters a new Stake (LP position). All safety checks apply.
\`\`\`
Output: { success, position, pool_name, txs, price_range, bin_step }
\`\`\`

### gorover-agent claim --position <addr>
Claims accumulated swap fees for a Stake.
\`\`\`
Output: { success, position, txs, base_mint }
\`\`\`

### gorover-agent close --position <addr> [--skip-swap] [--dry-run]
Exits a Stake. Auto-swaps base token to SOL unless --skip-swap.
\`\`\`
Output: { success, pnl_pct, pnl_usd, txs, base_mint }
\`\`\`

### gorover-agent swap --from <mint> --to <mint> --amount <n> [--dry-run]
Swaps tokens via Jupiter. Use "SOL" as mint shorthand.
\`\`\`
Output: { success, tx, input_amount, output_amount }
\`\`\`

### gorover-agent candidates [--limit 5]
Returns top pool candidates fully enriched: pool metrics, token audit, holders, smart wallets, narrative, active bin, and pool memory.
\`\`\`
Output: { candidates: [{name, pool, bin_step, fee_pct, volume, tvl, organic_score, active_bin, smart_wallets, token: {holders, audit, global_fees_sol, ...}, holders, narrative, pool_memory}] }
\`\`\`

### gorover-agent study --pool <addr> [--limit 4]
Studies top LPers on a pool. Returns behaviour patterns, hold times, win rates, strategies.
\`\`\`
Output: { pool, patterns: {top_lper_count, avg_hold_hours, avg_win_rate, ...}, lpers: [{owner, summary, positions}] }
\`\`\`

### gorover-agent token-info --query <mint_or_symbol>
Returns token audit, mcap, launchpad, price stats, fee data.
\`\`\`
Output: { results: [{mint, symbol, mcap, launchpad, audit, stats_1h, global_fees_sol, ...}] }
\`\`\`

### gorover-agent token-holders --mint <addr> [--limit 20]
Returns holder distribution, bot %, top holder concentration.
\`\`\`
Output: { mint, holders, top_10_real_holders_pct, bundlers_pct_in_top_100, global_fees_sol, ... }
\`\`\`

### gorover-agent token-narrative --mint <addr>
Returns AI-generated narrative about the token.
\`\`\`
Output: { mint, narrative }
\`\`\`

### gorover-agent pool-detail --pool <addr> [--timeframe 5m]
Returns detailed pool metrics for a specific pool.
\`\`\`
Output: { pool, name, bin_step, fee_pct, volume, tvl, volatility, ... }
\`\`\`

### gorover-agent search-pools --query <name_or_symbol> [--limit 10]
Searches pools by name or token symbol.
\`\`\`
Output: { pools: [{pool, name, bin_step, fee_pct, tvl, volume, ...}] }
\`\`\`

### gorover-agent active-bin --pool <addr>
Returns the current active bin for a pool.
\`\`\`
Output: { pool, binId, price }
\`\`\`

### gorover-agent wallet-positions --wallet <addr>
Returns DLMM positions for any wallet address.
\`\`\`
Output: { wallet, positions: [...], total_positions }
\`\`\`

### gorover-agent config get
Returns the full runtime config.

### gorover-agent config set <key> <value>
Updates a config key. Parses value as JSON when possible.
\`\`\`
Valid keys: minTvl, maxTvl, minVolume, maxPositions, deployAmountSol, managementIntervalMin, screeningIntervalMin, managementModel, screeningModel, generalModel, autoSwapAfterClaim, minClaimAmount, outOfRangeWaitMinutes
\`\`\`

### gorover-agent lessons [--limit 50]
Lists all lessons from memory.json. Shows rule, tags, pinned status, outcome, role.
\`\`\`
Output: { total, lessons: [{id, rule, tags, outcome, pinned, role, created_at}] }
\`\`\`

### gorover-agent lessons add <text>
Adds a manual lesson with outcome=manual, role=null (applies to all roles).
\`\`\`
Output: { saved: true, rule, outcome, role }
\`\`\`

### gorover-agent pool-memory --pool <addr>
Returns deploy history for a specific pool from poollog.json.
\`\`\`
Output: { pool_address, known, name, total_deploys, win_rate, avg_pnl_pct, last_outcome, notes, history }
\`\`\`

### gorover-agent evolve
Runs Adapt over closed Stake data and updates the local config file.
\`\`\`
Output: { evolved, changes, rationale }
\`\`\`

### gorover-agent blacklist add --mint <addr> --reason <text>
Permanently blacklists a token mint so it is never deployed into.
\`\`\`
Output: { blacklisted, mint, reason }
\`\`\`

### gorover-agent blacklist list
Lists all blacklisted token mints with reasons and timestamps.
\`\`\`
Output: { count, blacklist: [{mint, symbol, reason, added_at}] }
\`\`\`

### gorover-agent performance [--limit 200]
Shows closed Stake performance history with summary stats.
\`\`\`
Output: { summary: { total_positions_closed, total_pnl_usd, avg_pnl_pct, win_rate_pct, total_lessons }, count, positions: [...] }
\`\`\`

### gorover-agent discord-signals [clear]
Shows pending Discord signal queue from the Rover signal listener.
\`\`\`
Output: { count, pending, processed, signals: [{id, symbol, pool, author, channel, queued_at, rug_score, status}] }
\`\`\`

### gorover-agent start [--dry-run]
Starts Rover in autonomous mode with cron jobs (management + scan).

## Flags
--dry-run     Skip all on-chain transactions
--silent      Suppress Telegram notifications for this run
`;

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, "SKILL.md"), SKILL_MD);

// ─── Parse args ───────────────────────────────────────────────────
const argv = process.argv.slice(2);
const subcommand = argv.find((a) => !a.startsWith("-"));
const sub2 = argv.filter((a) => !a.startsWith("-"))[1]; // for "config get/set"
const silent = argv.includes("--silent");

if (!subcommand || subcommand === "help" || argv.includes("--help")) {
  process.stdout.write(SKILL_MD);
  process.exit(0);
}

// ─── Parse flags ──────────────────────────────────────────────────
const { values: flags } = parseArgs({
  args: argv,
  options: {
    pool: { type: "string" },
    amount: { type: "string" },
    position: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    strategy: { type: "string" },
    query: { type: "string" },
    mint: { type: "string" },
    wallet: { type: "string" },
    timeframe: { type: "string" },
    reason: { type: "string" },
    "bins-below": { type: "string" },
    "bins-above": { type: "string" },
    "amount-x": { type: "string" },
    "amount-y": { type: "string" },
    bps: { type: "string" },
    "no-claim": { type: "boolean" },
    "skip-swap": { type: "boolean" },
    "dry-run": { type: "boolean" },
    silent: { type: "boolean" },
    limit: { type: "string" },
  },
  allowPositionals: true,
  strict: false,
});

// ─── Commands ─────────────────────────────────────────────────────

switch (subcommand) {
  // ── init ─────────────────────────────────────────────────────────
  case "init": {
    await import("@/cli/init");
    out({ ok: true, created: [".env"], next: "Download rover.config.ts from https://app.gorover.xyz/rovers" });
    break;
  }

  // ── status <rover.config.ts> ─────────────────────────────────────
  case "status": {
    const cfgPath = argv.filter((a) => !a.startsWith("-"))[1];
    if (!cfgPath) die("Usage: gorover-agent status <rover.config.ts>");

    const { applyRoverConfig, loadRoverConfig } = await import("@/core/rover-config");
    const { roverConfig } = await loadRoverConfig(cfgPath);
    applyRoverConfig({ roverConfig });

    const { getMyPositions } = await import("@/tools/pool");
    const { getWalletBalances } = await import("@/tools/treasury");
    const { getPerformanceSummary } = await import("@/core/memory");
    const { ensureAgentId, isSwarmEnabled } = await import("@/core/swarm");
    const { getLastBeaconSentAt } = await import("@/core/beacon-guard");
    const roverId = ensureAgentId();

    const [balances, positions] = await Promise.all([
      getWalletBalances({}).catch((e) => ({ error: e?.message || String(e) })),
      getMyPositions({ force: true, silent: true }).catch((e) => ({
        error: e?.message || String(e),
      })),
    ]);

    const stakes =
      positions?.error
        ? positions
        : {
            total_stakes: positions?.total_positions ?? positions?.positions?.length ?? 0,
            stakes: positions?.positions ?? [],
          };

    out({
      ok: true,
      running: true,
      mode: process.env.DRY_RUN === "true" ? "dry_run" : "live",
      swarm: {
        enabled: isSwarmEnabled(),
        url: process.env.GOROVER_SWARM_API_BASE || roverConfig.vavSwarmUrl || roverConfig.swarmUrl || null,
        roverId,
        lastBeaconSentAt: getLastBeaconSentAt(),
      },
      balances,
      stakes,
      performance: getPerformanceSummary(),
    });
    break;
  }

  // ── balance ──────────────────────────────────────────────────────
  case "balance": {
    const { getWalletBalances } = await import("@/tools/treasury");
    out(await getWalletBalances({}));
    break;
  }

  // ── positions ────────────────────────────────────────────────────
  case "positions": {
    const { getMyPositions } = await import("@/tools/pool");
    const res = await getMyPositions({ force: true });
    out({
      total_stakes: res?.total_positions ?? res?.positions?.length ?? 0,
      stakes: res?.positions ?? [],
    });
    break;
  }

  // ── pnl <position_address> ───────────────────────────────────────
  case "pnl": {
    const posAddr = argv.find(
      (a, i) => !a.startsWith("-") && i > 0 && argv[i - 1] !== "--position" && a !== "pnl"
    );
    const positionAddress = flags.position || posAddr;
    if (!positionAddress) die("Usage: gorover-agent pnl <position_address>");

    const { getTrackedPosition } = await import("@/core/registry");
    const { getPositionPnl, getMyPositions } = await import("@/tools/pool");

    let poolAddress;
    const tracked = getTrackedPosition(positionAddress);
    if (tracked?.pool) {
      poolAddress = tracked.pool;
    } else {
      // Fall back: scan positions to find pool
      const pos = await getMyPositions({ force: true });
      const found = pos.positions?.find((p) => p.position === positionAddress);
      if (!found) die("Position not found", { position: positionAddress });
      poolAddress = found.pool;
    }

    const pnl = await getPositionPnl({
      pool_address: poolAddress,
      position_address: positionAddress,
    });
    if (tracked?.strategy) pnl.strategy = tracked.strategy;
    if (tracked?.instruction) pnl.instruction = tracked.instruction;
    out(pnl);
    break;
  }

  // ── candidates ───────────────────────────────────────────────────
  case "candidates": {
    const { getTopCandidates } = await import("@/tools/scan");
    const { getActiveBin } = await import("@/tools/pool");
    const { getTokenInfo, getTokenHolders, getTokenNarrative } = await import("@/tools/asset");
    const { checkSmartWalletsOnPool } = await import("@/core/tracker");
    const { recallForPool } = await import("@/core/poollog");

    const limit = parseInt(flags.limit || "5", 10);
    const raw = await getTopCandidates({ limit });
    const pools = raw.candidates || raw.pools || [];

    const enriched = [];
    for (const pool of pools) {
      const mint = pool.base?.mint;
      const [activeBin, smartWallets, tokenInfo, holders, narrative] = await Promise.allSettled([
        getActiveBin({ pool_address: pool.pool }),
        checkSmartWalletsOnPool({ pool_address: pool.pool }),
        mint ? getTokenInfo({ query: mint }) : Promise.resolve(null),
        mint ? getTokenHolders({ mint }) : Promise.resolve(null),
        mint ? getTokenNarrative({ mint }) : Promise.resolve(null),
      ]);
      const ti = tokenInfo.status === "fulfilled" ? tokenInfo.value?.results?.[0] : null;
      enriched.push({
        pool: pool.pool,
        name: pool.name,
        bin_step: pool.bin_step,
        fee_pct: pool.fee_pct,
        fee_active_tvl_ratio: pool.fee_active_tvl_ratio,
        volume: pool.volume_window,
        tvl: pool.active_tvl,
        volatility: pool.volatility,
        mcap: pool.mcap,
        organic_score: pool.organic_score,
        active_pct: pool.active_pct,
        price_change_pct: pool.price_change_pct,
        active_bin: activeBin.status === "fulfilled" ? activeBin.value?.binId : null,
        smart_wallets:
          smartWallets.status === "fulfilled"
            ? (smartWallets.value?.in_pool || []).map((w) => w.name)
            : [],
        token: {
          mint,
          symbol: pool.base?.symbol,
          holders: pool.holders,
          mcap: ti?.mcap,
          launchpad: ti?.launchpad,
          global_fees_sol: ti?.global_fees_sol,
          price_change_1h: ti?.stats_1h?.price_change,
          net_buyers_1h: ti?.stats_1h?.net_buyers,
          audit: {
            top10_pct: ti?.audit?.top_holders_pct,
            bots_pct: ti?.audit?.bot_holders_pct,
          },
        },
        holders: holders.status === "fulfilled" ? holders.value : null,
        narrative: narrative.status === "fulfilled" ? narrative.value?.narrative : null,
        pool_memory: recallForPool(pool.pool) || null,
      });
      await new Promise((r) => setTimeout(r, 150)); // avoid 429s
    }

    out({ candidates: enriched, total_screened: raw.total_screened });
    break;
  }

  // ── token-info ──────────────────────────────────────────────────
  case "token-info": {
    const query =
      flags.query ||
      flags.mint ||
      argv.find((a, i) => !a.startsWith("-") && i > 0 && a !== "token-info");
    if (!query) die("Usage: gorover-agent token-info --query <mint_or_symbol>");
    const { getTokenInfo } = await import("@/tools/asset");
    out(await getTokenInfo({ query }));
    break;
  }

  // ── token-holders ─────────────────────────────────────────────
  case "token-holders": {
    const mint =
      flags.mint || argv.find((a, i) => !a.startsWith("-") && i > 0 && a !== "token-holders");
    if (!mint) die("Usage: gorover-agent token-holders --mint <addr>");
    const { getTokenHolders } = await import("@/tools/asset");
    const limit = flags.limit ? parseInt(flags.limit, 10) : 20;
    out(await getTokenHolders({ mint, limit }));
    break;
  }

  // ── token-narrative ───────────────────────────────────────────
  case "token-narrative": {
    const mint =
      flags.mint || argv.find((a, i) => !a.startsWith("-") && i > 0 && a !== "token-narrative");
    if (!mint) die("Usage: gorover-agent token-narrative --mint <addr>");
    const { getTokenNarrative } = await import("@/tools/asset");
    out(await getTokenNarrative({ mint }));
    break;
  }

  // ── pool-detail ───────────────────────────────────────────────
  case "pool-detail": {
    if (!flags.pool) die("Usage: gorover-agent pool-detail --pool <addr> [--timeframe 5m]");
    const { getPoolDetail } = await import("@/tools/scan");
    out(await getPoolDetail({ pool_address: flags.pool, timeframe: flags.timeframe || "5m" }));
    break;
  }

  // ── search-pools ──────────────────────────────────────────────
  case "search-pools": {
    const query =
      flags.query || argv.find((a, i) => !a.startsWith("-") && i > 0 && a !== "search-pools");
    if (!query) die("Usage: gorover-agent search-pools --query <name_or_symbol>");
    const { searchPools } = await import("@/tools/pool");
    const limit = flags.limit ? parseInt(flags.limit, 10) : 10;
    out(await searchPools({ query, limit }));
    break;
  }

  // ── active-bin ────────────────────────────────────────────────
  case "active-bin": {
    if (!flags.pool) die("Usage: gorover-agent active-bin --pool <addr>");
    const { getActiveBin } = await import("@/tools/pool");
    out(await getActiveBin({ pool_address: flags.pool }));
    break;
  }

  // ── wallet-positions ──────────────────────────────────────────
  case "wallet-positions": {
    const wallet =
      flags.wallet || argv.find((a, i) => !a.startsWith("-") && i > 0 && a !== "wallet-positions");
    if (!wallet) die("Usage: gorover-agent wallet-positions --wallet <addr>");
    const { getWalletPositions } = await import("@/tools/pool");
    out(await getWalletPositions({ wallet_address: wallet }));
    break;
  }

  // ── deploy ───────────────────────────────────────────────────────
  case "deploy": {
    if (!flags.pool) die("Usage: gorover-agent deploy --pool <addr> --amount <sol>");
    const amountX = flags["amount-x"] ? parseFloat(flags["amount-x"]) : undefined;
    if (!flags.amount && !amountX) die("--amount or --amount-x is required");

    const { executeTool } = await import("@/tools/deploy");
    out(
      await executeTool("deploy_position", {
        pool_address: flags.pool,
        amount_y: flags.amount ? parseFloat(flags.amount) : undefined,
        amount_x: amountX,
        strategy: flags.strategy,
        single_sided_x: argv.includes("--single-sided-x"),
        bins_below: flags["bins-below"] ? parseInt(flags["bins-below"], 10) : undefined,
        bins_above: flags["bins-above"] ? parseInt(flags["bins-above"], 10) : undefined,
        allow_duplicate_pool: argv.includes("--allow-duplicate-pool"),
      })
    );
    break;
  }

  // ── claim ────────────────────────────────────────────────────────
  case "claim": {
    if (!flags.position) die("Usage: gorover-agent claim --position <addr>");
    const { executeTool } = await import("@/tools/deploy");
    out(await executeTool("claim_fees", { position_address: flags.position }));
    break;
  }

  // ── close ────────────────────────────────────────────────────────
  case "close": {
    if (!flags.position) die("Usage: gorover-agent close --position <addr>");
    const { executeTool } = await import("@/tools/deploy");
    out(
      await executeTool("close_position", {
        position_address: flags.position,
        skip_swap: flags["skip-swap"] ?? false,
      })
    );
    break;
  }

  // ── swap ─────────────────────────────────────────────────────────
  case "swap": {
    if (!flags.from || !flags.to || !flags.amount)
      die("Usage: gorover-agent swap --from <mint> --to <mint> --amount <n>");
    const { executeTool } = await import("@/tools/deploy");
    out(
      await executeTool("swap_token", {
        input_mint: flags.from,
        output_mint: flags.to,
        amount: parseFloat(flags.amount),
      })
    );
    break;
  }

  // ── screen ───────────────────────────────────────────────────────
  case "screen": {
    const { runScreeningCycle } = await import("@/runtime/rover");
    const report = await runScreeningCycle({ silent });
    out({ done: true, report: report || "No action taken" });
    break;
  }

  // ── manage ───────────────────────────────────────────────────────
  case "manage": {
    const { runManagementCycle } = await import("@/runtime/rover");
    const report = await runManagementCycle({ silent });
    out({ done: true, report: report || "No action taken" });
    break;
  }

  // ── config ───────────────────────────────────────────────────────
  case "config": {
    if (sub2 === "get" || !sub2) {
      const { config } = await import("@/core/config");
      out(config);
    } else if (sub2 === "set") {
      const key = argv.filter((a) => !a.startsWith("-"))[2];
      const rawVal = argv.filter((a) => !a.startsWith("-"))[3];
      if (!key || rawVal === undefined) die("Usage: gorover-agent config set <key> <value>");
      let value = rawVal;
      try {
        value = JSON.parse(rawVal);
      } catch {
        /* keep as string */
      }
      const { executeTool } = await import("@/tools/deploy");
      out(
        await executeTool("update_config", { changes: { [key]: value }, reason: "CLI config set" })
      );
    } else {
      die(`Unknown config subcommand: ${sub2}. Use: get, set`);
    }
    break;
  }

  // ── study ────────────────────────────────────────────────────────
  case "study": {
    if (!flags.pool) die("Usage: gorover-agent study --pool <addr> [--limit 4]");
    const { studyTopLPers } = await import("@/tools/radar");
    const limit = flags.limit ? parseInt(flags.limit, 10) : 4;
    out(await studyTopLPers({ pool_address: flags.pool, limit }));
    break;
  }

  // ── start ────────────────────────────────────────────────────────
  case "start": {
    const cfgPath = argv.filter((a) => !a.startsWith("-"))[1];
    if (!cfgPath) die("Usage: gorover-agent start <rover.config.ts>");

    const LOCK_FILE = path.join(process.cwd(), ".rover.lock");
    const REGISTRY_FILE = path.join(process.cwd(), "registry.json");

    // ── .rover.lock guard ──────────────────────────────────────────
    if (fs.existsSync(LOCK_FILE)) {
      try {
        const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
        // Check if PID is still alive
        process.kill(lock.pid, 0);
        die(`Rover already running (PID ${lock.pid}). Run: gorover-agent stop`);
      } catch (e: any) {
        if (e.code === "EPERM") {
          die(`Rover already running. Run: gorover-agent stop`);
        }
        // Process not found — stale lock, clean it up
        fs.rmSync(LOCK_FILE, { force: true });
        process.stderr.write("[gorover-agent] Stale lock file removed.\n");
      }
    }

    // ── Crash recovery check ───────────────────────────────────────
    if (fs.existsSync(REGISTRY_FILE)) {
      try {
        const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
        const open = Object.values(registry.positions || {}).filter((p: any) => !p.closed);
        if (open.length > 0) {
          process.stderr.write(`[gorover-agent] ⚠ Crash recovery: ${open.length} open Stake(s) found. Keeper will check immediately.\n`);
        }
      } catch { /* registry.json unreadable — will be handled at runtime */ }
    }

    // ── Version check ──────────────────────────────────────────────
    try {
      const pkgJson = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
      const current = pkgJson.version;
      const res = await fetch("https://registry.npmjs.org/@gorover/agent/latest", {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const latest = ((await res.json()) as any).version;
        if (latest && latest !== current) {
          process.stderr.write(`[gorover-agent] ⚠ New version available: ${latest} (you have ${current}). Run: bun update @gorover/agent\n`);
        }
      }
    } catch { /* non-blocking — skip if offline or npm down */ }

    const { applyRoverConfig, loadRoverConfig } = await import("@/core/rover-config");
    const { roverConfig } = await loadRoverConfig(cfgPath);
    applyRoverConfig({ roverConfig });

    // Write lock file
    fs.writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    process.on("exit", () => fs.rmSync(LOCK_FILE, { force: true }));
    process.on("SIGINT", () => process.exit(0));
    process.on("SIGTERM", () => process.exit(0));

    process.stderr.write(`[gorover-agent] Rover started (PID ${process.pid})\n`);
    const { startCronJobs } = await import("@/runtime/rover");
    startCronJobs();
    break;
  }

  // ── stop ─────────────────────────────────────────────────────────
  case "stop": {
    const LOCK_FILE = path.join(process.cwd(), ".rover.lock");
    if (!fs.existsSync(LOCK_FILE)) {
      die("No Rover running (no .rover.lock found).");
    }
    try {
      const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
      process.kill(lock.pid, "SIGTERM");
      fs.rmSync(LOCK_FILE, { force: true });
      out({ ok: true, stopped: true, pid: lock.pid });
    } catch (e: any) {
      if (e.code === "ESRCH") {
        // Process already gone
        fs.rmSync(LOCK_FILE, { force: true });
        out({ ok: true, stopped: true, note: "Process was already stopped. Lock file removed." });
      } else {
        die(`Failed to stop Rover: ${e.message}`);
      }
    }
    break;
  }

  // ── lessons ──────────────────────────────────────────────────────
  case "lessons": {
    if (sub2 === "add") {
      const text = argv
        .filter((a) => !a.startsWith("-"))
        .slice(2)
        .join(" ");
      if (!text) die("Usage: gorover-agent lessons add <text>");
      const { addLesson } = await import("@/core/memory");
      addLesson(text, [], { pinned: false, role: null });
      out({ saved: true, rule: text, outcome: "manual", role: null });
    } else {
      const { listLessons } = await import("@/core/memory");
      const limit = flags.limit ? parseInt(flags.limit, 10) : 50;
      out(listLessons({ limit }));
    }
    break;
  }

  // ── pool-memory ──────────────────────────────────────────────────
  case "pool-memory": {
    if (!flags.pool) die("Usage: gorover-agent pool-memory --pool <addr>");
    const { getPoolMemory } = await import("@/core/poollog");
    out(getPoolMemory({ pool_address: flags.pool }));
    break;
  }

  // ── evolve ───────────────────────────────────────────────────────
  case "evolve": {
    const { config } = await import("@/core/config");
    const { evolveThresholds } = await import("@/core/memory");
    const fs2 = await import("node:fs");
    const lessonsFile = "./lessons.json";
    let perfData = [];
    if (fs2.existsSync(lessonsFile)) {
      try {
        perfData = JSON.parse(fs2.readFileSync(lessonsFile, "utf8")).performance || [];
      } catch {
        /* no data */
      }
    }
    const result = evolveThresholds(perfData, config);
    if (!result) {
      out({ evolved: false, reason: `Need at least 5 closed positions (have ${perfData.length})` });
    } else {
      out({
        evolved: Object.keys(result.changes).length > 0,
        changes: result.changes,
        rationale: result.rationale,
      });
    }
    break;
  }

  // ── blacklist ────────────────────────────────────────────────────
  case "blacklist": {
    if (sub2 === "add") {
      if (!flags.mint) die("Usage: gorover-agent blacklist add --mint <addr> --reason <text>");
      if (!flags.reason) die("--reason is required");
      const { addToBlacklist } = await import("@/core/blocklist");
      out(addToBlacklist({ mint: flags.mint, reason: flags.reason }));
    } else if (sub2 === "list" || !sub2) {
      const { listBlacklist } = await import("@/core/blocklist");
      out(listBlacklist());
    } else {
      die(`Unknown blacklist subcommand: ${sub2}. Use: add, list`);
    }
    break;
  }

  // ── performance ──────────────────────────────────────────────────
  case "performance": {
    const { getPerformanceHistory, getPerformanceSummary } = await import("@/core/memory");
    const limit = flags.limit ? parseInt(flags.limit, 10) : 200;
    const history = getPerformanceHistory({ hours: 999999, limit });
    const summary = getPerformanceSummary();
    out({ summary, ...history });
    break;
  }

  // ── discord-signals ──────────────────────────────────────────────
  case "discord-signals": {
    const sigFile = path.join(process.cwd(), "discord-signals.json");
    if (!fs.existsSync(sigFile)) {
      out({
        count: 0,
        pending: 0,
        signals: [],
        message:
          "No signal queue found. Start the listener (`bun src/signal/index.ts`) or ensure `discord-signals.json` exists at the repo root.",
      });
      break;
    }
    let signals = [];
    try {
      signals = JSON.parse(fs.readFileSync(sigFile, "utf8"));
    } catch {
      die("Failed to parse discord-signals.json");
    }

    if (sub2 === "clear") {
      // Remove processed/old signals (keep pending ones)
      const pending = signals.filter((s) => s.status === "pending");
      fs.writeFileSync(sigFile, JSON.stringify(pending, null, 2));
      out({ cleared: signals.length - pending.length, remaining: pending.length });
      break;
    }

    const pending = signals.filter((s) => s.status === "pending");
    const processed = signals.filter((s) => s.status !== "pending");
    out({
      count: signals.length,
      pending: pending.length,
      processed: processed.length,
      signals: signals.map((s) => ({
        id: s.id,
        symbol: s.base_symbol,
        pool: s.pool_address,
        author: s.discord_author,
        channel: s.discord_channel,
        queued_at: s.queued_at,
        rug_score: s.rug_score,
        status: s.status,
        snippet: s.discord_message_snippet?.slice(0, 60),
      })),
    });
    break;
  }

  // ── withdraw-liquidity ─────────────────────────────────────────
  case "withdraw-liquidity": {
    if (!flags.position)
      die("Usage: gorover-agent withdraw-liquidity --position <addr> --pool <addr> [--bps 10000]");
    if (!flags.pool) die("--pool is required");
    const { withdrawLiquidity } = await import("@/tools/pool");
    out(
      await withdrawLiquidity({
        position_address: flags.position,
        pool_address: flags.pool,
        bps: flags.bps ? parseInt(flags.bps, 10) : 10000,
        claim_fees: !argv.includes("--no-claim"),
      })
    );
    break;
  }

  // ── add-liquidity ──────────────────────────────────────────────
  case "add-liquidity": {
    if (!flags.position)
      die(
        "Usage: gorover-agent add-liquidity --position <addr> --pool <addr> [--amount-x <n>] [--amount-y <n>]"
      );
    if (!flags.pool) die("--pool is required");
    const { addLiquidity } = await import("@/tools/pool");
    out(
      await addLiquidity({
        position_address: flags.position,
        pool_address: flags.pool,
        amount_x: flags["amount-x"] ? parseFloat(flags["amount-x"]) : 0,
        amount_y: flags["amount-y"] ? parseFloat(flags["amount-y"]) : 0,
        strategy: flags.strategy || "spot",
        single_sided_x: argv.includes("--single-sided-x"),
      })
    );
    break;
  }

  default:
    die(`Unknown command: ${subcommand}. Run 'gorover-agent help' for usage.`);
}
