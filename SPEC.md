# TwitchHive — Spec

**Version:** 0.1
**Last updated:** 2026-10-30
**Process:** SDD → VSDD → CoDD
**Tier:** Factory (8/8: four modules, frontend/backend/external API layers, new domain, independent units).
**Sources:** HACKATHON_BRIEF.md; .antigravity/IDEA_APPROVAL.json (approved option A); DESIGN.md; Studio Harness templates/SPEC.md.

## System Intent

TwitchHive: One-Agent-Per-Viewer Interactive Stream Arena & OBS Overlay turns Twitch viewers into co-creators: each participating viewer owns a personalized micro-agent that reacts to chat and stream events, proposes actions and joins a swarm to trigger visible arena events. Streamers control rules and safety from a command deck; judges can exercise the full pipeline without credentials through a clearly labeled simulator. Real Twitch uses IRC, EventSub WebSocket and Helix; no Extension review is required.

**Outcome metrics** (targets, not measured results):
- **Activation:** at least 80% of valid first-time `!join` participants see their agent and a contribution acknowledged within 2 seconds in a demo session.
- **Retention:** fraction of activated viewers who contribute in the next round, target 40%; distinguish round return from actual watch-time retention, which this MVP cannot measure.
- **Value / conversion:** streamer completes two rounds and elects to reuse the overlay; record voluntary cheer/sub events separately, never claim causal revenue uplift from simulator data.

**Authorized change scope:** Issue #1 writes design/specification, unit plans and AGENTS.md only. No app implementation, provisioning or API calls. Commit and push to origin main are explicitly authorized. Product acceptance below remains pending until Issues #2–4 supply evidence.

## Acceptance criteria

- AC-1: In Live mode, authenticated Twitch IRC, EventSub WebSocket and Helix adapters connect to one configured channel, normalize chat/sub/raid/cheer events, expose independent health states and suppress duplicate deliveries; verify adapter integration fixtures, revoked-auth/reconnect tests and a documented real-channel smoke test.
- AC-2: Each channel/viewer pair owns exactly one micro-agent; `!join` and `!hive` create or recover it, `!action attack|shield|heal` sets intent, and `!vote boss|chaos` casts one replaceable vote per round; verify identity, duplicate join, cooldown, invalid command and cross-channel isolation unit tests.
- AC-3: Agents autonomously select bounded actions from round context and preferences; the AI Director proposes schema-validated scenarios while authoritative consensus resolves one round once, with deterministic fallback on model failure; verify seeded replay, tie, duplicate close, timeout, malformed output and pause tests.
- AC-4: A judge opens /dashboard on port 3000 without Twitch or AI secrets, starts Demo, triggers all commands plus Sub/Raid/Cheer and replays a seeded scenario; /overlay receives the same pipeline results, with Demo labels and no outbound Twitch writes; verify credential-free E2E and replay integration tests.
- AC-5: /overlay renders viewer agents, consensus, boss/chaos effects, active buff/debuff and community leaderboard on a transparent OBS canvas; under the specified 500-agent benchmark it targets 60fps and p95 event-to-render latency <=500ms on localhost, resynchronizing after disconnection; verify browser E2E, performance trace and manual OBS capture.
- AC-6: /dashboard lets an authorized streamer connect/disconnect Live, configure bounded Director rules, open/close a challenge, pause/resume and reset the arena, and inspect engagement counts; unauthorized mutations fail and pause blocks effects; verify API authorization tests and keyboard-driven E2E flows.
- AC-7: The server validates inputs, rate-limits commands, bounds queues, redacts secrets, isolates Live/Demo state and recovers WS clients by snapshot; stale/duplicate events cannot apply rewards twice; verify security, overload, mode-switch, deduplication and reconnect integration tests.
- AC-8: The runnable delivery includes README setup, .env.example without secrets, automated AC-linked tests, DESIGN.md, SPEC.md, VALIDATION.md with actual evidence, SUBMISSION.md covering Codex use, a <3-minute demo video plan/link and an authentic Codex session ID from /status; verify fresh-clone startup on port 3000, test suite, browser console audit and release checklist in Issue #4.

## Architecture and boundaries

[ASSUMED: single Node process, single streamer channel per deployment; 500 concurrent active agents for MVP. These are implementation defaults, not measured capacity.]

Twitch adapters → normalized event queue → authoritative Arena reducer + agent registry → Director/consensus → ws snapshots/deltas → React dashboard and Canvas overlay. Simulator enters the same normalized queue through a separate session namespace. Only the server mutates game state. React + Vite serves port 3000; development proxy forwards /api and /ws to backend 3001. Production Node serves built assets and API/WS on 3000. Choose HTML5 Canvas, not Phaser, for the MVP.

Proposed code ownership:
- `server/twitch/`: tmi.js IRC, EventSub WebSocket lifecycle, Helix identity/subscription adapter.
- `server/arena/`: registry, normalized queue, deterministic reducer, rounds, metrics.
- `server/director/`: OpenAI-compatible model adapter, validation, timeouts, rule fallback.
- `server/transport/`: authenticated HTTP control API and ws fanout.
- `client/`: React routes, dashboard controls, simulator, Canvas renderer.
- `shared/`: runtime schemas and versioned wire types. `tests/`: unit/integration/E2E fixtures.

### Runtime contracts

`NormalizedEvent = {id, sessionId, channelId, source: irc|eventsub|simulator, kind: chat|sub|raid|cheer, viewerId, displayName, occurredAt, receivedAt, payload}`. IDs use EventSub message IDs or IRC message IDs; simulator supplies deterministic IDs. Validate positive bounded numeric counts, max 500 characters chat and 64 characters display names; render text as text, never HTML. Unknown event kinds are ignored with a diagnostic counter.

`Agent = {id: channelId+viewerId, viewerId, displayName, role: attack|shield|heal, preference, energy:0..100, contribution, lastSeenAt, lastActionAt}`. Twitch stable user IDs are authoritative; Demo IDs have `demo:` prefix. No identity inference from display names. Store no raw chat history by default. Registry is session-memory only, capped at 500 active agents; inactive for 15 minutes becomes dormant, LRU dormant entries may be evicted. Restart resets the session and UI explicitly reports that fact. No durable cross-stream memory claim.

`ArenaState = {sessionId, epoch, seq, mode, paused, round, agents, consensus, bossHp, effects, leaderboard, metrics}`. A round carries ID, open/close timestamps and status `idle|open|resolving|resolved`. Events are serialized through one reducer. Increment `seq` per committed mutation; namespace resets/mode changes increment epoch and invalidate queued old work.

WS server frames: `{v:1,type:snapshot|delta|health|error,sessionId,epoch,seq,payload}`. Send initial snapshot; deltas contain absolute changed values/removals, never client-side increments. Client detecting seq gap, epoch change or reconnect requests snapshot and discards pending deltas. Fanout batches at 10Hz, simulation at 10Hz, rendering uses requestAnimationFrame interpolation. Heartbeat 15s, dead peer after 45s, reconnect exponential backoff 1–30s with jitter. If buffered data exceeds 1MiB, disconnect slow client and recover by snapshot. Snapshot sent at least every 5 seconds.

HTTP `/api/session` returns mode and public health; `/api/control/*` accepts authenticated connect/disconnect, rules, challenge, pause/resume/reset; `/api/simulator/events` and `/api/simulator/replay` require control authorization and Demo mode. Validate schemas; return 400 invalid input, 401/403 unauthorized, 409 wrong mode/state, 429 throttled, 503 unavailable integration. `/ws/overlay` is read-only with scoped session token; dashboard WS requires control session. Never put Twitch/AI credentials in frontend bundles or overlay URLs.

### Gameplay, AI and reliability

One viewer has one vote and equal consensus weight regardless of payment. Commands are case-insensitive, whitespace-normalized; aliases join/hive are idempotent. Valid actions have a 2-second per-viewer cooldown; blocked actions return reason without mutation. Unjoined actions/votes return join guidance. Each 30-second round, autonomous agents choose a role action every 2 seconds: honor explicit preference, otherwise shield at low collective health, heal injured allies, else attack. Energy costs 10/action, regenerates 5/tick capped at 100; contributions count accepted actions only. Votes close at deadline: highest count wins; ties use fixed boss-before-chaos order; no votes defaults boss. One resolution ID prevents repeated effects.

Director gets aggregate counts, round state and configured difficulty, never raw chat or OAuth secrets. One model request per round, 2-second deadline, max 512 output tokens, no automatic retry in that round. Validate `{scenario:boss|chaos, difficulty:1..5, effect:shield|haste|slow, durationSec:5..15, headline:string<=80}`; treat text as untrusted and use fixed UI copy if invalid. Director recommendations cannot change votes or bypass pause. On absent credentials, timeout, budget cap (30 calls/session) or invalid output, use seeded deterministic scenario defaults and show `Rules fallback`. AI mode is explicitly `Model` or `Rules`, never misrepresented. Capture decision source and outcome for evals. Each micro-agent has independent state and decisions; batching Director calls avoids one paid inference per viewer.

Arena-only buffs/debuffs last 10 seconds by default and clamp to 15; no control of external games or streamer OS. Cheer adds a capped cosmetic flare; sub adds a welcome effect; raid creates an aggregate wave and only creates individual agents for identifiable participants who join. No fictional identities for raid counts. No purchase is required or increases voting power. Pause freezes round timer, energy and effects; resume shifts deadlines by paused duration. Reset cancels in-flight Director work and starts a new epoch.

Queue bounded at 2,000 events, per-viewer command allowance 1/2s, control API 30 requests/min/session; reject excess commands, coalesce ordinary non-command chat, preserve connection health. Queue saturation increments dropped counters visible on dashboard. Dedup cache holds IDs for 10 minutes, max 10,000 entries; events older than 60s cannot alter gameplay. Full restart begins new session, so old events cannot mutate it. Log aggregate latency, reconnect, queue, fallback and invalid-event counters, with no tokens/raw chat. Target p95 reducer ingress-to-fanout <=250ms under 50 normalized events/s for 5 minutes.

### Authentication and Twitch lifecycle

Live requires channel owner OAuth session and configured Twitch client credentials; use server-side OAuth authorization code flow with state validation, HttpOnly SameSite cookies, HTTPS for hosted deployment, origin validation on WS/control requests and CSRF protection on cookie-authenticated mutations. Store tokens server-side, redact logs, refresh when supported, clear on disconnect/revocation. Secrets come from environment; local Demo requires no secrets. Loopback Demo may create a local control session; hosted Demo uses isolated expiring sessions and cannot reach Live controls.

Implement IRC membership/commands through tmi.js, Helix channel identity lookup and EventSub subscription creation only after session welcome. Handle keepalive expiry, reconnect URL handoff without duplicate subscriptions and revocations with explicit degraded health. Request minimum scopes needed for selected chat/sub/cheer subscriptions; derive exact current scope names and subscription versions from official Twitch documentation during Issue #2, record in README and cover mocked authorization failures. Do not treat absent scopes or unsupported subscriptions as connected. Respect API rate-limit/reset headers and bounded retries; never fabricate events when Live fails. Simulator remains opt-in. Live smoke evidence requires actual channel access; fixtures alone are insufficient for AC-1.

## Modules

### Twitch ingress

**Intent:** Enable real audience participation.
**Input:** OAuth session, IRC messages, EventSub notifications, Helix responses.
**Output:**
- Success: NormalizedEvent and per-adapter health.
- Error: Expired credentials disconnect affected adapter; other adapters retain truthful health.
**Edge cases:** Reconnect duplicate → dedup; missing scope → degraded.
**Out of scope:** Extension approval, video/audio analysis.
**Depends on:** none.
**Metrics:**
- Success signal: Real event becomes accepted arena contribution.
- False positive: Socket connected with no authorized events.
- Failure signal: Auth failures or repeated reconnects.
**constrained_by:** Schemas and OAuth policy.
**constrains:** Arena.
**invariants:** One server source of truth; bounded work; no cross-session mutation; pause prevents gameplay effects.

### Arena and per-viewer agents

**Intent:** Give each participant ownership and collective agency.
**Input:** NormalizedEvent, validated control commands, clock, seeded context.
**Output:**
- Success: Authoritative state, equal-weight consensus and action decisions.
- Error: Reject invalid commands with reason; no partial state mutation.
**Edge cases:** Duplicate join → same identity; late vote → reject; reset → invalidate old epoch.
**Out of scope:** Durable lifetime memory, external-game control.
**Depends on:** Twitch ingress or simulator.
**Metrics:**
- Success signal: Joined viewer contributes and returns next round.
- False positive: Agent count without any accepted actions.
- Failure signal: Duplicate effects or missing participant state.
**constrained_by:** Identity, session namespace, bounded queue.
**constrains:** Director and transport.
**invariants:** One server source of truth; bounded work; no cross-session mutation; pause prevents gameplay effects.

### Director and transport

**Intent:** Turn collective intent into visible coordinated scenarios.
**Input:** Aggregate arena context, rule limits, optional model response.
**Output:**
- Success: Validated scenario and ordered snapshots/deltas.
- Error: Rules fallback on model failure; slow clients reconnect to snapshot.
**Edge cases:** Model finishes after reset → discard; sequence gap → snapshot.
**Out of scope:** Unrestricted model tools, arbitrary code execution.
**Depends on:** Arena.
**Metrics:**
- Success signal: Resolved round appears consistently in both clients.
- False positive: Model text generated without arena effect.
- Failure signal: Fanout lag or invalid scenario rate.
**constrained_by:** Arena authority and model schema.
**constrains:** Dashboard and overlay.
**invariants:** One server source of truth; bounded work; no cross-session mutation; pause prevents gameplay effects.

### Experience and simulator

**Intent:** Let streamers and judges operate and watch the swarm.
**Input:** Public snapshots, authorized control input, seeded fixtures.
**Output:**
- Success: Dashboard, transparent overlay, labeled replay and engagement metrics.
- Error: Show stale/reconnecting state and disable unavailable controls.
**Edge cases:** No agents → join instructions; Live/Demo switch → new empty namespace.
**Out of scope:** Twitch Extension, native mobile app, payment processing.
**Depends on:** Director and transport.
**Metrics:**
- Success signal: Streamer completes two rounds and reuses overlay.
- False positive: Synthetic engagement presented as Live growth.
- Failure signal: Console errors, unreadable overlay or control abandonment.
**constrained_by:** DESIGN.md and transport protocol.
**constrains:** Release evidence.
**invariants:** One server source of truth; bounded work; no cross-session mutation; pause prevents gameplay effects.

## Verification and delivery

All ACs are **pending implementation**. Tests must cite AC IDs in names and VALIDATION.md maps every ID to real commands, logs and revisions. Unit tests use fake clock and seeded RNG; integration tests use local IRC/EventSub/Helix/model fixtures plus real ws clients. E2E uses two tabs (dashboard/overlay), credential-free Demo, all simulator triggers, keyboard navigation and reconnect; collect console/page errors. Benchmark at 1920×1080 in Chromium on a recorded machine/browser version, 500 agents, 50 events/s, 5 minutes after warm-up; record frame-time distribution (target p95 <=16.7ms) and timestamps for latency, not visual guesses. Manual OBS Browser Source verifies transparency and legibility at 1080p. Performance misses remain visible failures or documented scope revisions, never silently waived.

| Issue | Unit plan | Criteria | Evidence gate |
|---|---|---|---|
| #2 | 1-backend | AC-1, AC-2, AC-3, AC-7; backend part AC-6 | Unit/integration tests + real Twitch smoke |
| #3 | 2-experience | AC-4, AC-5, AC-6; UI part AC-7 | E2E, console audit, performance trace, OBS capture |
| #4 | 3-release | AC-1 through AC-8 | Independent validation, README, SUBMISSION and submission checklist |

Issue #1 gate: coverage:check parses exactly AC-1..AC-8 with exit 0. Without --report this checks criterion presence/format only; it proves neither application correctness nor test coverage. No VALIDATION.md with passing product results is generated at architecture time.

Submission checklist: public source and safe .env.example; fresh-clone setup instructions; <3-minute video showing real Twitch, Demo, OBS and Codex workflow; SUBMISSION.md addressing the four equally weighted judging dimensions; authentic Codex session ID obtained via /status (never invented). Deadline follows the supplied brief; release owner must verify organizer timezone before submission. Capture actual Codex prompts/diffs/tests for the narrative. Open risk: live OAuth/channel access and provider credentials are implementation prerequisites for live/model evidence, not prerequisites for Demo or this spec.
