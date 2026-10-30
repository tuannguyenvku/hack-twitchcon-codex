# Issue #2 — Backend handoff

Date: 2026-10-30. Base revision: b98714e19d8d1e36511e890b783a64451ca16469.

Implemented Node/TypeScript arena authority, one-agent-per-viewer policy, consensus, bounded queue/deduplication, clock-based rounds, pause/reset invalidation, actual arena buffs/debuffs; tmi.js IRC + Helix + EventSub WebSocket; server OAuth code exchange, scopes/identity checks, refresh/validation/revocation; OpenRouter Director with schema/timeout/budget and deterministic fallback; HTTP/WS session authorization; credential-free isolated Demo and seeded replay. Setup, wire contract and live smoke instructions are in README.md.

Red evidence: `/tmp/twitchhive-issue2/red.log`, `red-twitch.log`, `red-transport.log` show missing modules before implementation. `red-reset.log` captures cross-epoch duplicate delivery regression before the fix; `red-effects.log` shows the buff effect assertion failing before damage modifiers were implemented. The initial resolution test counted a cosmetic cheer alongside a round effect; its assertion was corrected to identify the round's resolution ID, retaining duplicate-resolution verification.

Verification: `npm run check` passes formatting lint, strict typecheck, 22/22 unit/integration tests (zero skipped) and TypeScript build. `npm audit --omit=dev` reports zero vulnerabilities at this run. `git diff --check` and Studio Harness scope:check pass. Local logs and schema-validated CommandReport are under `/tmp/twitchhive-issue2/`; they describe the tested revision/worktree rather than independent release acceptance. CI repeats check/audit on each push.

| Criterion | Backend evidence | Remaining product acceptance |
|---|---|---|
| AC-1 | Actual tmi.js communicates with local IRC websocket; HTTP Helix fixture; EventSub welcome/reconnect/revocation fixture; missing scopes/owner failures | Real authorized Twitch channel smoke remains blocked by absent configured broadcaster credentials/channel authorization |
| AC-2 | Identity/aliases/isolation; invalid commands/cooldown; cap/dormant eviction; replay | Backend acceptance passes locally |
| AC-3 | Autonomous actions, voting/ties/once-only close, late model/reset, pause, real HTTP model fixture, invalid/timeout/budget fallback, buff expiry | Backend acceptance passes locally; paid-model experience/quality not claimed |
| AC-4 | Real HTTP simulator + WS state; all event kinds; seeded replay; hosted credential-free Demo | `/dashboard` and `/overlay` browser E2E belong to Issue #3 |
| AC-6 | Auth/CSRF/origin/owner gate, rules/challenge/pause/resume/reset/disconnect API | Dashboard and keyboard E2E belong to Issue #3 |
| AC-7 | Duplicate/stale/wrong namespace, bounded queue, isolated expiring sessions, snapshot requests and socket read-only auth | Local backend acceptance passes; independent release review remains Issue #4 |

Core load regression: 500 agents, 50 normalized events per simulated second, 300 simulated seconds / 15,000 events; p95 reducer+snapshot approximately 2.7ms on this development host. This uses a fake clock and measures service time. It does **not** prove five minutes of real-time fanout, <=500ms event-to-render, browser 60fps, OBS transparency or production capacity. No such evidence is marked passed.

Deliberate integration choices: v1 delta frames carry absolute full-state replacements at max 10Hz; frontend can safely replace state and request snapshots on gaps. OAuth cookie uses SameSite=Lax for top-level Twitch callback; separate Origin/CSRF/state checks protect control mutations. All external provider failures expose sanitized reasons; no secrets are returned. Rules inference is the no-key default. Hosted Demo session count is capped at 100 with one-hour expiry. Production static frontend hosting is deferred to Issue #3.

No external Twitch events, payments, paid inference, deployment or fabricated session/video/validation evidence were used. Full independent VALIDATION.md and submission packaging remain Issue #4.
