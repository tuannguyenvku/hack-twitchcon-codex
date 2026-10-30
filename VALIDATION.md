# VALIDATION — TwitchHive / Issues #3–4

**Date:** 2026-10-30T07:40:51.895758Z
**Result:** blocked for full product acceptance; all executed engineering checks passed.
**Spec / issue:** SPEC.md AC-1…AC-8; Issues #3 frontend/E2E and #4 documentation/release review.
**Repository / package:** TwitchHive, Node/TypeScript + React/Vite + Canvas.
**Base / tested source HEAD:** e5eb624754f495dd5887bea843c30afe9c1a673c / 19e943fcaab51f7f8a3ea7e20e485760fba4dbae.
**Working tree dirty:** true — README/SUBMISSION/validation/evidence and existing runtime files; application source is committed. Final release commit adds documentation/evidence only; existing check logs remain attributed to the tested source revision.
**Job / run:** manual (jobId null); local-twitchhive-issues3-4; backend Codex.
**Report JSON:** /tmp/twitchhive-issue4/validation.json (schema-validated CommandReport).
**Durable summary:** [docs/evidence/verification.json](docs/evidence/verification.json).

## Broadcast View follow-up — 2026-10-31 (local time)

Fresh Codex CLI verification covers source commit `8fb7edd80420971a80ebc3cf46d8ab17da726144`, following the original Broadcast View / MIT commit `f44afaf` and official repository URL commit `8d5c46a`. This section supersedes the earlier source attribution only for this follow-up; historical checks below retain their original revisions. The subsequent documentation/evidence commit does not change application source.

Official repository: https://github.com/AgentAppStudio/twitchhive. The root [MIT LICENSE](LICENSE) names AgentAppStudio, copyright 2026; reviewed and retained unchanged.

Primary Codex Session ID remains `01a18b93-7177-7f81-8565-55d276f45250`. Follow-up Codex Session ID: `01a18eff-18fe-7b41-8b46-4eb6b1728eb7`, read from `CODEX_SESSION_ID` in this active Codex CLI workspace (not a newly claimed `/status` result).

| Fresh check | Result | Evidence |
|---|---|---|
| `npm run build` | passed, exit 0 | [build log](docs/evidence/broadcast/build.log) |
| `npm test` | 24/24 passed, exit 0 | [unit/integration log](docs/evidence/broadcast/unit.log) |
| `npx playwright test e2e/ui.spec.ts` | 5/5 passed, exit 0; console/page error assertions passed | [E2E log](docs/evidence/broadcast/e2e.log) |
| `npm run lint`, `npm run typecheck`, `git diff --check` | passed, exit 0 | [verification record and source hashes](docs/evidence/broadcast/verification.json) |

AC-6 follow-up: Enter/Space operate Hide simulator / Show simulator with `aria-expanded` and a persistent `aria-controls` target. Hidden controls leave layout, accessibility tree and keyboard navigation; the workspace shortcut is removed while hidden. Desktop Broadcast View uses two columns; mobile remains stacked. Reset arena stays available with Simulator hidden: the real backend clears 20 agents to zero on both dashboard and overlay, Cancel receives initial dialog focus, and reset completion restores focus. Demo tabs support arrow/Home navigation; a Live state fixture automatically selects Insights / Live telemetry, transfers focus from Simulator, disables simulator activation and preserves Insights across hide/show. The existing mobile keyboard, reduced-motion, reconnect and authorization coverage remains applicable.

Codex visually inspected fresh [Broadcast View](docs/evidence/broadcast/broadcast.png) and [Live telemetry fixture](docs/evidence/broadcast/live-telemetry.png) captures. An initial E2E run exposed reset-completion and Live-tab focus loss; both were fixed before the successful run recorded above. Live telemetry is a WebSocket frame fixture, not real Twitch evidence. AC-1 real-channel smoke and AC-5 actual OBS capture remain blocked; the earlier performance result was not rerun. Public video upload and Devpost submission remain pending. Existing runtime/session artifacts and videos remain outside this commit.

## Checks

Commands run from repository root unless another cwd is shown. Timestamped final logs include real start/end UTC and exit codes. Earlier setup/fresh-export logs are retained separately. No tests were skipped or assertions relaxed.

| Check ID | Command / inspection | Required | Outcome | Exit code | Evidence |
|---|---|---|---|---|---|
| check | npm run check | yes | passed | 0 | /tmp/twitchhive-issue4/final-check.log |
| audit | npm audit --omit=dev | yes | passed | 0 | /tmp/twitchhive-issue4/final-audit.log |
| scope | npm --prefix /Volumes/AllySSD/Projects/AgentAppStudio/studio-harness run scope:check -- --project /Volumes/AllySSD/Projects/devpost-factory/hackathons/hack-twitchcon-codex --base e5eb624754f495dd5887bea843c30afe9c1a673c | yes | passed | 0 | /tmp/twitchhive-issue4/final-scope.log |
| diff | git diff e5eb624..HEAD --check | yes | passed | 0 | /tmp/twitchhive-issue4/final-diff.log |
| fresh | npm ci && npm run check | yes | passed | 0 | /tmp/twitchhive-issue4/fresh-check.log |
| performance | npm run test:performance | yes | passed | 0 | /tmp/twitchhive-issue3/performance.log |
| mermaid | PUPPETEER_SKIP_DOWNLOAD=true npm exec --yes --package @mermaid-js/mermaid-cli -- mmdc -i /tmp/twitchhive-issue4/architecture.mmd -o docs/evidence/architecture.svg -p /tmp/twitchhive-issue4/puppeteer.json | yes | passed | 0 | /tmp/twitchhive-issue4/mermaid-final.log |
| artifacts | Inspected README.md, SUBMISSION.md, DESIGN.md, SPEC.md, .env.example, CODEX_SESSION_ID.txt and generated VALIDATION.md. Session ID matches the supplied file verbatim; video-plan branch is explicit. | yes | passed | n/a | Listed artifacts inspected |

`npm run check`: format lint, strict backend + client typecheck, **24/24 unit/integration tests**, production build, **4/4 Playwright E2E tests**. Browser flows recorded zero console errors and page errors. Audit reports zero production dependency vulnerabilities. Fresh export means `git archive` of the tested source, `npm ci`, then the complete declared check from a new directory; it excludes untracked runtime files and secrets. Scope guard has no job-specific path policy and reports no violations, not a sandbox-enforcement claim.

## Acceptance coverage

Descriptions below preserve the supplied criteria. Status applies to the whole criterion; successful subchecks do not erase a missing external verification method.

| Criterion ID | Expected behavior | Outcome | Check IDs / evidence | Reason |
|---|---|---|---|---|
| AC-1 | In Live mode, authenticated Twitch IRC, EventSub WebSocket and Helix adapters connect to one configured channel, normalize chat/sub/raid/cheer events, expose independent health states and suppress duplicate deliveries; verify adapter integration fixtures, revoked-auth/reconnect tests and a documented real-channel smoke test. | **blocked** | check; docs/evidence/verification.json | Actual tmi.js/Helix/EventSub/OAuth refresh fixtures pass; a real authorized Twitch-channel smoke has not run. No configured broadcaster credentials/authorization. |
| AC-2 | Each channel/viewer pair owns exactly one micro-agent; `!join` and `!hive` create or recover it, `!action attack/shield/heal` sets intent, and `!vote boss/chaos` casts one replaceable vote per round; verify identity, duplicate join, cooldown, invalid command and cross-channel isolation unit tests. | **passed** | check; docs/evidence/verification.json | Identity/aliases, command/cooldown, channel isolation, vote replacement, capacity/eviction and Live reset dedup tests pass. |
| AC-3 | Agents autonomously select bounded actions from round context and preferences; the AI Director proposes schema-validated scenarios while authoritative consensus resolves one round once, with deterministic fallback on model failure; verify seeded replay, tie, duplicate close, timeout, malformed output and pause tests. | **passed** | check; docs/evidence/verification.json | Autonomous actions, aggregate model HTTP fixture, timeout/schema/budget fallback, deterministic replay, consensus/once-only resolution, pause/reset and buff expiry tests pass. |
| AC-4 | A judge opens /dashboard on port 3000 without Twitch or AI secrets, starts Demo, triggers all commands plus Sub/Raid/Cheer and replays a seeded scenario; /overlay receives the same pipeline results, with Demo labels and no outbound Twitch writes; verify credential-free E2E and replay integration tests. | **passed** | check; docs/evidence/verification.json | Real compiled app on port 3000; credential-free two-tab dashboard/overlay E2E exercises join/action/vote, Sub/Raid/Cheer and seeded replay; Demo labels persist, no external Twitch writes. |
| AC-5 | /overlay renders viewer agents, consensus, boss/chaos effects, active buff/debuff and community leaderboard on a transparent OBS canvas; under the specified 500-agent benchmark it targets 60fps and p95 event-to-render latency <=500ms on localhost, resynchronizing after disconnection; verify browser E2E, performance trace and manual OBS capture. | **blocked** | performance; docs/evidence/verification.json | Browser transparency pixel check, visual screenshots, realtime HUD/agents, reconnect and five-minute 500-agent performance all pass. Manual actual OBS Browser Source capture remains unverified because OBS is not installed. |
| AC-6 | /dashboard lets an authorized streamer connect/disconnect Live, configure bounded Director rules, open/close a challenge, pause/resume and reset the arena, and inspect engagement counts; unauthorized mutations fail and pause blocks effects; verify API authorization tests and keyboard-driven E2E flows. | **passed** | check; docs/evidence/verification.json | API owner/session/Origin/CSRF tests plus keyboard/mobile E2E cover challenge, difficulty, pause/resume/reset; Twitch adapters use scoped authorization fixtures. Actual live connectivity is not claimed and remains AC-1 blocked. |
| AC-7 | The server validates inputs, rate-limits commands, bounds queues, redacts secrets, isolates Live/Demo state and recovers WS clients by snapshot; stale/duplicate events cannot apply rewards twice; verify security, overload, mode-switch, deduplication and reconnect integration tests. | **passed** | check; docs/evidence/verification.json | Backend validation/rate-limit/queue/namespace/expiry/dedup tests plus frontend sequence unit test, actual socket reconnect and session reload E2E pass. |
| AC-8 | The runnable delivery includes README setup, .env.example without secrets, automated AC-linked tests, DESIGN.md, SPEC.md, VALIDATION.md with actual evidence, SUBMISSION.md covering Codex use, a <3-minute demo video plan/link and an authentic Codex session ID from /status; verify fresh-clone startup on port 3000, test suite, browser console audit and release checklist in Issue #4. | **passed** | artifacts; docs/evidence/verification.json | README setup/API/diagram, safe .env.example, AC-linked tests, DESIGN/SPEC, truthful VALIDATION, SUBMISSION with Codex usage and exact supplied session ID, and a 2:45 storyboard satisfy the explicit video plan/link alternative. Real public video/Devpost submission remains pending per brief, not claimed. |

## Performance and visual evidence

The **five-minute wall-clock** run used Chromium 141.0.7390.37, Apple M4 / darwin arm64, 1920×1080, 500 agents, a producer configured for 50 normalized events/s, three-second warm-up followed by a restarted sustained load. It ran one overlay on one local Node process, not hundreds of simultaneous streams. High-resolution timing used cross-origin isolation; thresholds stayed unchanged.

| Measurement | Actual | Target / interpretation |
|---|---|---|
| Wall time | 300.122 seconds | >=300 seconds |
| Painted frames | 18,000 | requestAnimationFrame loop |
| Average rate | 59.98 fps | 60fps target |
| p95 frame interval | 16.67 ms | <=16.7ms |
| p95 Canvas draw | 0.35 ms | <=16.7ms |
| p95 event-to-paint sample | 36 ms | <=500ms localhost |
| Console/page errors | 0 | zero |

Event-to-paint is sampled from the latest ingress timestamp carried by a painted state update, not a trace of every viewer event. The benchmark does not establish Twitch internet latency or exact delivered source-event rate. Full timing data: [performance.json](docs/evidence/performance.json).

Screenshots were actually inspected: [dashboard](docs/evidence/dashboard.png), [transparent overlay](docs/evidence/overlay.png), [500-agent overlay](docs/evidence/overlay-500.png). E2E verifies transparent Canvas corner alpha=0 and two-tab state synchronization. Design inspection checked dark/amber palette, role shapes, legible 1080p HUD, persistent Demo/Rules labels, focus/default Cancel in reset dialog, keyboard controls and no 360px horizontal scroll. No manual OBS capture is claimed.

Mermaid source in README rendered successfully to [architecture.svg](docs/evidence/architecture.svg). The root Codex Session ID matches SUBMISSION.md verbatim: `01a18b93-7177-7f81-8565-55d276f45250`. It came from the user-supplied CODEX_SESSION_ID.txt, not a fabricated /status execution.

## Findings and scope

- **Blocking acceptance evidence:** AC-1 lacks authorized real Twitch channel smoke; AC-5 lacks actual OBS Browser Source compositing. Credentials/channel authorization and an OBS installation are absent. Fixture and Chromium success are recorded as partial evidence, never full AC passes.
- **Submission handoff:** AC-8 explicitly allows a video **plan/link**; the 2:45 storyboard satisfies that branch. HACKATHON_BRIEF still requires the real uploaded video for Devpost. No upload, hosted public demo, real payment, paid model inference or Devpost submission occurred.
- **Self-review:** [CTO_REVIEW.md](docs/CTO_REVIEW.md) applies all five lenses; it is not independent certification. MVP caveats: one-process RAM state, full-state WS bandwidth and a read-only token in the WS query that operators must redact.
- **Reproducibility:** Playwright 1.64.1 initially produced a protocol error before UI interaction in this environment. The suite pins 1.56.1 with its Chromium, and the same flows pass. An early low-precision preflight reported 16.8ms; COOP/COEP enabled proper timing precision and the unmodified 16.7ms assertion passed the full run. Red/failing diagnostics remain in /tmp/twitchhive-issue3, not relabeled as successes.
- **Benchmark revision equivalence:** the full run used the same committed renderer/client/load implementation. The only subsequent application change before the tested source commit corrected the bootstrap mode field for an already-Live session; the measured Demo path is equivalent. Final npm ci/check and fresh-export check ran at the committed source HEAD above. Release documentation/evidence commits do not change application behavior.
- **Product outcomes:** activation/round-return/value targets remain hypotheses. Session event counters do not prove watch retention, revenue uplift, monetization conversion or paid model quality. No sensitive-domain escalation applies to this entertainment arena.

## Blockers and next actions

1. Broadcaster owner: configure Twitch app/channel OAuth and execute the real-channel checklist in README; attach redacted revision-linked evidence for AC-1.
2. Release owner: add the scoped overlay URL to actual OBS at 1920×1080, verify transparency/readability/reconnect and capture evidence for AC-5.
3. Release owner: record/upload the storyboard as a public <3-minute video and enter the supplied authentic session ID in Devpost; no submission authorization or deployment is implied by this validation.
4. Re-run only affected checks with new evidence and update blocked statuses. Do not infer live or OBS passes from the local suite.
