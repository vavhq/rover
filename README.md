# Rover

**Autonomous Meteora DLMM liquidity management agent for Solana, powered by LLMs.**

Rover runs continuous screening and management cycles, deploying capital into high-quality Meteora DLMM pools and closing positions based on live PnL, yield, and range data. It learns from every Stake it closes.

---

## What it does

- **Screens pools** — scans Meteora DLMM pools against configurable thresholds (fee/TVL ratio, organic score, holder count, mcap, bin step) and surfaces high-quality opportunities
- **Manages positions** — monitors, claims fees, and closes LP positions autonomously; decides to STAY, CLOSE, or REDEPLOY based on live data
- **Learns from performance** — studies top LPers in target pools, saves structured lessons, and evolves screening thresholds based on closed position history
- **Discord signals** — optional Discord listener watches LP Army channels for Solana token calls and queues them for screening
- **Telegram chat** — full agent chat via Telegram, plus cycle reports and OOR alerts
- **Claude Code integration** — run AI-powered screening and management directly from your terminal using Claude Code slash commands

---

## How it works

Rover runs a **ReAct agent loop** — each cycle the LLM reasons over live data, calls tools, and acts. Two specialized agents run on independent cron schedules:

| Agent | Default interval | Role |
|---|---|---|
| **Screening Agent** | Every 30 min | Pool screening — finds and deploys into the best candidate |
| **Management Agent** | Every 10 min | Position management — evaluates each open position and acts |

**Data sources:**
- `@meteora-ag/dlmm` SDK — on-chain position data, active bin, deploy/close transactions
- Meteora DLMM PnL API — position yield, fee accrual, PnL
- OKX OnchainOS — smart money signals, token risk scoring
- Pool screening API — fee/TVL ratios, volume, organic scores, holder counts
- Jupiter API — token audit, mcap, launchpad, price stats

Agents are powered via **OpenRouter** and can be swapped for any compatible model.

---

## Requirements

- Node.js 20+ (or Bun)
- [OpenRouter](https://openrouter.ai) API key
- Solana wallet (base58 private key)
- Solana RPC endpoint ([Helius](https://helius.xyz) recommended)
- Telegram bot token (optional)
- [Claude Code](https://claude.ai/code) CLI (optional, for terminal slash commands)

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/go-rover/rover
cd rover
bun install
```

### 2. Run the setup wizard

```bash
gorover-agent init
```

The wizard walks you through creating `.env` (API keys, wallet, RPC, Telegram) and local config (risk preset, deploy size, thresholds, models). Takes about 2 minutes.

**Or set up manually:**

Create `.env`:

```env
WALLET_PRIVATE_KEY=your_base58_private_key
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
OPENROUTER_API_KEY=sk-or-...
HELIUS_API_KEY=your_helius_key          # for wallet balance lookups
TELEGRAM_BOT_TOKEN=123456:ABC...        # optional — for notifications + chat
TELEGRAM_CHAT_ID=                       # auto-filled on first message
DRY_RUN=true                            # set false for live trading
```

> Never put your private key or API keys in `user-config.json` — use `.env` only. Both files are gitignored.

Copy config and edit as needed:

```bash
cp user-config.example.json user-config.json
```

See [Config reference](#config-reference) below.

### 3. Run

```bash
gorover-agent start rover.config.ts  # dry run by default (no on-chain transactions)
```

On startup Rover fetches your wallet balance, open Stakes, and top pool candidates, then begins autonomous cycles immediately.

---

## Deploy on Railway (beginner-friendly)

This is the simplest way to run Rover as a single always-on instance.

### 1) Create a Railway project

- Create a Railway account
- **New Project** → **Deploy from GitHub Repo**
- Select your `rover` repository

**Build:** this repo includes a root **`Dockerfile`** (Bun + `bun run build` + `dist/cmd.js` start). On Railway, use the **Docker** builder with `dockerfilePath` = `Dockerfile` (default if `railway.toml` is used). The monorepo **gorover-app** uses different names (e.g. `Dockerfile.rover`) — do not point this service at those paths.

### 2) Start command

**Docker (default when using `railway.toml`):** the image already sets `bun dist/cmd.js start rover.config.example.ts`. Keep Railway’s **Start Command** in sync with `railway.toml`, or leave it to the Dockerfile if your service uses config-as-code only.

**Local / development** (Bun, no global npm install required):

```bash
bun run start:agent
```

That runs `bun src/cli/cmd.ts start rover.config.example.ts`. For production, use the built CLI after `bun run build` / `npm i -g @gorover/agent`:

```bash
gorover-agent start rover.config.ts
```

Set real secrets in Railway **Variables** (they override the example file).

For safe dogfood (recommended first) set in Railway: `DRY_RUN=true` plus the variables below.

### 3) Add environment variables (required)

In Railway → **Variables**, set:

- `WALLET_PRIVATE_KEY`: base58 private key
- `RPC_URL`: Solana RPC URL
- `OPENROUTER_API_KEY` (or `OPENAI_API_KEY` or `LLM_API_KEY`): one LLM key
- `DRY_RUN`: `true` (start here)

Recommended for server/client dogfood:

- `GOROVER_SWARM_API_BASE`: `https://swarm.gorover.xyz`
- `GOROVER_SCOUT_KEY`: your Scout key (`sc_...`)

Optional:

- `HELIUS_API_KEY`: better balance reporting
- Telegram control/notifications: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_ALLOWED_USER_IDS`
- Relay/discovery: `GOROVER_DISCOVERY_API_URL`

### 4) Dogfood checks (recommended)

Run these once before switching to live mode:

```bash
bun run dogfood
```

If `GOROVER_SCOUT_KEY` is set, this also runs a Swarm smoke test (GET `/thresholds`, POST `/beacon`).

### 5) Go live

When you're confident:

- Set `DRY_RUN=false`
- Redeploy

### Persistence note

Rover writes local runtime state files (e.g. `registry.json`, `memory.json`). If your Railway service restarts and you need continuity, attach a persistent volume and mount it as the working directory.

---

## Learning (Adaptation)

Rover becomes more selective over time using **bounded, conservative learning**:

- **Local learning**: closed Stake outcomes are recorded and used to tune screening thresholds (`evolveThresholds()`).
- **Gating**: adaptations only apply after enough closed Stakes exist (to avoid overfitting).
- **Bounds**: changes are capped so the agent can't drift wildly from baseline presets.

Swarm aggregation and PnL analytics are populated from `Beacon.stakes` in the platform roadmap (W4).

---

## Running modes

### Autonomous agent

```bash
bun run start
```

Starts the full autonomous agent with cron-based screening + management cycles and an interactive REPL. The prompt shows a live countdown to the next cycle:

```
[manage: 8m 12s | screen: 24m 3s]
>
```

REPL commands:

| Command | Description |
|---|---|
| `/status` | Wallet balance and open positions |
| `/candidates` | Re-screen and display top pool candidates |
| `/learn` | Study top LPers across all current candidate pools |
| `/learn <pool_address>` | Study top LPers for a specific pool |
| `/thresholds` | Current screening thresholds and performance stats |
| `/evolve` | Trigger threshold evolution from performance data (needs 5+ closed positions) |
| `/stop` | Graceful shutdown |
| `<anything>` | Free-form chat — ask the agent anything, request actions, analyze pools |

---

### Claude Code terminal (recommended)

Install [Claude Code](https://claude.ai/code) and use it from inside the rover directory. Claude Code has built-in agents and slash commands that can call the `gorover-agent` CLI.

```bash
cd rover
claude
```

#### Slash commands

| Command | What it does |
|---|---|
| `/screen` | Full AI screening cycle — checks Discord queue, reads config, fetches candidates, runs deep research, and deploys if a winner is found |
| `/manage` | Full AI management cycle — checks all positions, evaluates PnL, claims fees, closes OOR/losing positions |
| `/balance` | Check wallet SOL and token balances |
| `/positions` | List all open DLMM positions with range status |
| `/candidates` | Fetch and enrich top pool candidates (pool metrics + token audit + smart money) |
| `/study-pool` | Study top LPers on a specific pool |
| `/pool-ohlcv` | Fetch price/volume history for a pool |
| `/pool-compare` | Compare all Meteora DLMM pools for a token pair by APR, fee/TVL ratio, and volume |

#### Claude Code agents

Two specialized sub-agents run inside Claude Code:

**`screener`** — pool screening specialist. Invoke when you want to evaluate candidates, analyse token risk, or deploy a position. Has access to OKX smart money signals, full token audit pipeline, and all strategy logic.

**`manager`** — position management specialist. Invoke when reviewing open positions, assessing PnL, claiming fees, or closing positions.

To trigger an agent directly, just describe what you want:
```
> screen for new pools and deploy if you find something good
> review all my positions and close anything out of range
> what do you think of the SOL/BONK pool?
```

#### Loop mode

Run screening or management on a timer inside Claude Code:

```
/loop 30m /screen     # screen every 30 minutes
/loop 10m /manage     # manage every 10 minutes
```

---

### CLI (direct tool invocation)

The `gorover-agent` CLI gives you direct access to every tool with JSON output — useful for scripting, debugging, or piping into other tools.

```bash
bun install -g .   # install globally (once)
gorover-agent <command> [flags]
```

Or run without installing:

```bash
bun run cmd -- <command> [flags]
```

**Positions & PnL**

```bash
gorover-agent positions
gorover-agent pnl <position_address>
gorover-agent wallet-positions --wallet <addr>
```

**Screening**

```bash
gorover-agent candidates --limit 5
gorover-agent pool-detail --pool <addr> [--timeframe 5m]
gorover-agent active-bin --pool <addr>
gorover-agent search-pools --query <name_or_symbol>
gorover-agent radar --pool <addr> [--limit 4]
```

**Token research**

```bash
gorover-agent asset-info --query <mint_or_symbol>
gorover-agent asset-holders --mint <addr> [--limit 20]
gorover-agent asset-narrative --mint <addr>
```

**Deploy & manage**

```bash
gorover-agent deploy --pool <addr> --amount <sol> [--bins-below 69] [--bins-above 0] [--strategy bid_ask|spot|curve] [--dry-run]
gorover-agent claim --position <addr>
gorover-agent close --position <addr> [--skip-swap] [--dry-run]
gorover-agent swap --from <mint> --to <mint> --amount <n> [--dry-run]
```

**Agent cycles**

```bash
gorover-agent screen [--dry-run] [--silent]   # one AI screening cycle
gorover-agent manage [--dry-run] [--silent]   # one AI management cycle
gorover-agent start [--dry-run]               # start autonomous agent with cron jobs
```

**Config**

```bash
gorover-agent config get
gorover-agent config set <key> <value>
```

**Learning & memory**

```bash
gorover-agent memory
gorover-agent memory add "your lesson text"
gorover-agent performance [--limit 200]
gorover-agent evolve
gorover-agent poollog --pool <addr>
```

**Blacklist**

```bash
gorover-agent blocklist list
gorover-agent blocklist add --mint <addr> --reason "reason"
```

**Discord signals**

```bash
gorover-agent discord-signals
gorover-agent discord-signals clear
```

**Balance**

```bash
gorover-agent balance
```

**Flags**

| Flag | Effect |
|---|---|
| `--dry-run` | Skip all on-chain transactions |
| `--silent` | Suppress Telegram notifications for this run |

---

## Discord listener

The Discord listener watches configured channels (e.g. LP Army) for Solana token calls and queues them as signals for the screener agent.

### Setup

```bash
bun run signal
```

Add to your root `.env`:

```env
DISCORD_USER_TOKEN=your_discord_account_token   # from browser DevTools → Network
DISCORD_GUILD_ID=the_server_id
DISCORD_CHANNEL_IDS=channel1,channel2            # comma-separated
DISCORD_MIN_FEES_SOL=5                           # minimum pool fees to pass pre-check
```

> This uses a selfbot (personal account automation, not a bot token). Use responsibly.

### Run

```bash
bun run signal
```

Or run it in a separate terminal alongside the main agent. Signals are written to `discord-signals.json` and picked up automatically by `/screen` and `gorover-agent screen`.

### Signal pipeline

Each incoming token address passes through a pre-check pipeline before being queued:
1. **Dedup** — ignores addresses seen in the last 10 minutes
2. **Blacklist** — rejects blacklisted token mints
3. **Pool resolution** — resolves the address to a Meteora DLMM pool
4. **Rug check** — checks deployer against `deployer-blacklist.json`
5. **Fees check** — rejects pools below `DISCORD_MIN_FEES_SOL`

Signals that pass all checks are queued with status `pending`. The screener picks up pending signals and processes them as priority candidates before running the normal screening cycle.

### Deployer blacklist

Add known rug/farm deployer wallet addresses to `deployer-blacklist.json`:

```json
{
  "_note": "Known farm/rug deployers — add addresses to auto-reject their pools",
  "addresses": [
    "WaLLeTaDDressHere"
  ]
}
```

---

## Telegram

### Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) and copy the token
2. Add `TELEGRAM_BOT_TOKEN=<token>` to your `.env`
3. Start the agent, then send any message to your bot — it auto-registers your chat ID

### Notifications

Rover sends notifications automatically for:
- Management cycle reports (reasoning + decisions)
- Screening cycle reports (what it found, whether it deployed)
- OOR alerts when a position leaves range past `outOfRangeWaitMinutes`
- Deploy: pair, amount, position address, tx hash
- Close: pair and PnL

### Telegram commands

| Command | Action |
|---|---|
| `/positions` | List open positions with progress bar |
| `/close <n>` | Close position by list index |
| `/set <n> <note>` | Set a note on a position |

You can also chat freely via Telegram using the same interface as the REPL.

---

## Config reference

All fields are optional — defaults shown. Edit `user-config.json`.

### Screening

| Field | Default | Description |
|---|---|---|
| `minFeeActiveTvlRatio` | `0.05` | Minimum fee/active-TVL ratio |
| `minTvl` | `10000` | Minimum pool TVL (USD) |
| `maxTvl` | `150000` | Maximum pool TVL (USD) |
| `minVolume` | `500` | Minimum pool volume |
| `minOrganic` | `60` | Minimum organic score (0–100) |
| `minHolders` | `500` | Minimum token holder count |
| `minMcap` | `150000` | Minimum market cap (USD) |
| `maxMcap` | `10000000` | Maximum market cap (USD) |
| `minBinStep` | `80` | Minimum bin step |
| `maxBinStep` | `125` | Maximum bin step |
| `timeframe` | `5m` | Candle timeframe for screening |
| `category` | `trending` | Pool category filter |
| `minTokenFeesSol` | `30` | Minimum all-time fees in SOL |
| `maxBundlersPct` | `30` | Maximum bundler % in top 100 holders |
| `maxTop10Pct` | `60` | Maximum top-10 holder concentration |
| `blockedLaunchpads` | `[]` | Launchpad names to never deploy into |

### Management

| Field | Default | Description |
|---|---|---|
| `deployAmountSol` | `0.5` | Base SOL per new position |
| `positionSizePct` | `0.35` | Fraction of deployable balance to use |
| `maxDeployAmount` | `50` | Maximum SOL cap per position |
| `gasReserve` | `0.2` | Minimum SOL to keep for gas |
| `minSolToOpen` | `0.55` | Minimum wallet SOL before opening |
| `outOfRangeWaitMinutes` | `30` | Minutes OOR before acting |
| `stopLossPct` | `-15` | Close position if price drops by this % |

### Schedule

| Field | Default | Description |
|---|---|---|
| `managementIntervalMin` | `10` | Management cycle frequency (minutes) |
| `screeningIntervalMin` | `30` | Screening cycle frequency (minutes) |

### Models

| Field | Default | Description |
|---|---|---|
| `managementModel` | `openai/gpt-oss-20b:free` | LLM for management cycles |
| `screeningModel` | `openai/gpt-oss-20b:free` | LLM for screening cycles |
| `generalModel` | `openai/gpt-oss-20b:free` | LLM for REPL / chat |

> Override a model at runtime: `gorover-agent config set screeningModel openai/gpt-oss-20b:free`

---

## Telegram (optional)

Rover only accepts control commands when you explicitly configure the target chat and allowed user IDs:

```env
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_ID=<target chat id>
TELEGRAM_ALLOWED_USER_IDS=<comma-separated Telegram user ids allowed to control the bot>
```

---

## Swarm (optional)

Swarm is Rover’s shared intelligence service (`swarm.gorover.xyz`). Public Rover uses **Beacon-only** sync:
- HMAC-signed Beacon payloads (`signBeacon()` in `src/core/swarm.ts`)
- optional thresholds pull (`/thresholds`)

---

## Using a local model (LM Studio)

```env
LLM_BASE_URL=http://localhost:1234/v1
LLM_API_KEY=lm-studio
LLM_MODEL=your-local-model-name
```

---

## Disclaimer

This software is provided as-is, with no warranty. Running an autonomous trading agent carries real financial risk — you can lose funds. Always start with `DRY_RUN=true` to verify behavior before going live. Never deploy more capital than you can afford to lose. This is not financial advice.

The authors are not responsible for any losses incurred through use of this software.
