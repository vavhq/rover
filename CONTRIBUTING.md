# Contributing to Rover

Thanks for your interest in contributing. Rover is part of the
[vav.sh](https://vav.sh) ecosystem and follows strict conventions to stay
maintainable.

## Before You Start

1. Read [`README.md`](./README.md) and run Rover locally in `DRY_RUN=true`
   mode at least once.
2. Read [`docs/architecture.md`](./docs/architecture.md) to understand the
   Cycle loop and the role of each module.
3. Check [open issues](https://github.com/vavhq/rover/issues) and the
   [vav.sh ROADMAP](https://github.com/vavhq/vav/blob/main/ROADMAP.md) —
   large features should be discussed first.

## Development Setup

```bash
git clone git@github.com:vavhq/rover.git
cd rover
bun install
cp .env.example .env                # fill in values
cp rover.config.example.ts rover.config.ts  # fill in scoutKey + wallet
bun run dev                         # DRY_RUN=true
```

Required toolchain:

- **Bun** ≥ 1.1 (pinned in `.tool-versions`)
- **Node.js** ≥ 20
- A Solana RPC URL (Helius recommended for free tier)
- An OpenRouter API key for the LLM

## Project Layout

```
rover/
├── src/
│   ├── rover.ts         Main entry — REPL + cron orchestration
│   ├── engine.ts        ReAct Cycle loop (LLM → tool → repeat)
│   ├── cortex.ts        System prompt builder per role (Seeker/Keeper/General)
│   ├── swarm.ts         vav.sh Swarm client (Beacon / Radar / thresholds)
│   ├── memory.ts        Learning engine (Log derivation + Adapt evolution)
│   ├── registry.ts      Stake registry + crash recovery
│   ├── playbook.ts      Saved strategies
│   ├── poollog.ts       Per-pool deploy history
│   ├── tracker.ts       Smart wallet tracker
│   ├── blocklist.ts     Permanent token blocklist
│   ├── notify.ts        Telegram bot
│   ├── config.ts        Runtime config loader
│   ├── tools/           LLM-callable tools (deploy/pool/scan/radar/…)
│   ├── signal/          Discord signal listener
│   └── utils/           Pure helpers
├── tests/
├── docs/
├── examples/
└── .github/
```

Renames are listed in [`docs/glossary.md`](./docs/glossary.md).

## Branching & Commits

- Base branch: `main`. All work goes through a PR.
- Branch name: `feat/<slug>` | `fix/<slug>` | `docs/<slug>` | `chore/<slug>`.
- Commit style:

  ```
  feat: <subject>
  fix: <subject>
  security: <subject>
  docs: <subject>
  chore: <subject>
  ```

  Keep the subject < 72 chars. Body explains *why*, not *what*.

## Required Checks

Before opening a PR:

```bash
bun run lint         # biome check
bun run typecheck    # tsc --noEmit
bun run test         # unit + integration
bun run build        # tsup
```

CI (see `.github/workflows/ci.yml`) runs all four on every PR.

## Naming Discipline

Rover uses the vav.sh platform vocabulary. **Never** reintroduce legacy branding names from earlier forks.

Keep the public vocabulary consistent across:
- CLI commands
- user-facing logs
- docs and prompts

Vocabulary gate (runs in CI):

```bash
bun run vocab
```

## Security Rules

1. Never log `scoutKey`, `walletKey`, or raw `.env` contents.
2. Never commit `rover.config.ts`, `.env`, or any `*.json` listed in
   `.gitignore`.
3. New RPC calls must have a **timeout** and **error handling**.
4. New write-path tools must be added to `WRITE_TOOLS` in `src/tools/deploy.ts`.
5. `DRY_RUN=true` must remain the default in `src/config.ts` and
   `rover.config.example.ts`.

## Opening a PR

1. Fill out `.github/pull_request_template.md`.
2. Link the ROADMAP task being closed, if any.
3. Add a CHANGELOG entry under `[Unreleased]`.
4. Wait for CI green + review approval.

## Code of Conduct

See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## License

By contributing you agree your contribution will be licensed under the
[Business Source License 1.1](./LICENSE).
