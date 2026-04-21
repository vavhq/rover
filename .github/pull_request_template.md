## Summary

<!-- 1–3 sentences: what changes and why. -->

## Changes

- …
- …

## Roadmap link

<!-- If this closes a ROADMAP task, link it. e.g. ROADMAP W4 D17 -->

## Test plan

- [ ] `bun run lint`
- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] Smoke test: `bun dev` connects to Swarm, sends 1 Beacon
- [ ] `bun run vocab` → OK

## Security

- [ ] No secrets in code or commits (wallet key, scoutKey, API keys)
- [ ] `DRY_RUN=true` default preserved
- [ ] No new RPC endpoints without timeout + error handling
- [ ] AbuseLog / ratelimit preserved

## Checklist

- [ ] CHANGELOG updated under `[Unreleased]`
- [ ] README or docs updated if user-facing behavior changed
