# Security Policy

Rover is an autonomous agent that can sign Solana transactions with a private
key you supply. Please treat it accordingly.

## Supported Versions

Only the **latest minor release** receives security patches.

| Version | Supported |
|--------:|:---------:|
|  0.4.x  | ✅        |
|  < 0.4  | ❌        |

## Reporting a Vulnerability

**Do not open a public GitHub issue.** Report privately by emailing:

```
security@vav.sh
```

Include:

1. A clear description of the issue
2. Steps to reproduce (or proof of concept)
3. Impact assessment
4. Affected versions
5. Any suggested mitigation

We aim to acknowledge within **48 hours** and issue a fix or public advisory
within **7 days** for high-severity issues.

## Scope

In scope:

- Agent code in `src/` (wallet handling, signing, state persistence)
- CLI (`vav-agent`) and CI build artifacts
- Swarm Beacon payload signing / HMAC verification
- Anything that could cause loss of funds or leak private material

Out of scope:

- Third-party dependencies (report upstream)
- Issues in `api.vav.sh` / `swarm.vav.sh` — those belong to the platform repo
- Social engineering of individual users
- Rate limiting / DoS against public endpoints

## Hardening Checklist for Operators

Before running Rover with real funds, verify:

- [ ] `DRY_RUN=true` for at least 24 hours to validate behavior
- [ ] Wallet used by Rover is a **dedicated wallet**, not your main wallet
- [ ] Wallet funded with only the capital you can afford to lose
- [ ] `rover.config.ts` is in `.gitignore` (it already is) and never committed
- [ ] `.env` is in `.gitignore` and never committed
- [ ] `scoutKey` is treated as a bearer secret (same as a password)
- [ ] Host running Rover is patched and firewalled
- [ ] Logs are redacted before sharing (no wallet key, no scoutKey)
- [ ] `outOfRangeWaitMinutes`, `stopLossPct`, `maxPositions`, `maxDeployAmount`
      match your risk tolerance

## Known Risks

Running an autonomous on-chain agent carries real financial risk, including
but not limited to:

- Liquidity pool impermanent loss
- Rug pulls on newly-listed tokens
- Solana network congestion causing failed transactions
- LLM hallucinations producing invalid trade decisions
- Compromise of the host machine exposing the wallet private key

Rover ships with multiple mitigations (screening thresholds, blocklists,
drift detection, stop-loss, rate limits, on-chain verify), but **no safeguard
is absolute**. Review the code, dry-run first, and size positions accordingly.
