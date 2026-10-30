# TwitchHive: One-Agent-Per-Viewer Interactive Stream Arena & OBS Overlay

**Tagline:** One viewer. One agent. A whole new way to play together.

**Repository:** https://github.com/AgentAppStudio/twitchhive

**Codex Session ID:** `01a18b93-7177-7f81-8565-55d276f45250` — read verbatim from the repository's `CODEX_SESSION_ID.txt`. This document records the supplied session ID; it does not invent a new `/status` result.

**License:** [MIT](LICENSE), copyright 2026 AgentAppStudio. Official source: https://github.com/AgentAppStudio/twitchhive.

**Follow-up Codex Session ID:** `01a18eff-18fe-7b41-8b46-4eb6b1728eb7`, read from the active Codex CLI workspace's `CODEX_SESSION_ID` environment. The primary submission session above is unchanged. Codex refined Broadcast View accessibility and focus behavior in source commit `8fb7edd`, then ran `npm run build`, `npm test` (24/24), and `npx playwright test e2e/ui.spec.ts` (5/5). [Fresh logs and source hashes](docs/evidence/broadcast/verification.json) distinguish this work from earlier release evidence.

**Try it locally:** `npm ci`, `npx playwright install chromium`, `npm run build`, `npm start`, then open http://127.0.0.1:3000/dashboard. Demo requires no Twitch account or model credentials. For development, `npm run dev` serves the React app on 3000 and proxies the backend on 3001.

## Inspiration

A Twitch chat can have thousands of people and still give each viewer very little agency. A poll captures a choice, but loses the personality and continuity of the person behind it. We wanted participation to feel like joining a team: a viewer arrives, meets their agent, makes a move, and sees that move become part of something bigger on stream.

TwitchHive explores the one-agent-per-user idea in a setting where cooperation is visible immediately. Its “2035 test” is an aspiration: what would watching a stream feel like if personal agents were a normal part of being there? The prototype makes that question playable through a swarm arena instead of adding a chatbot beside the broadcast.

## What it does

Each participating viewer gets exactly one micro-agent, keyed by their stable Twitch user ID and channel. Viewers join with `!join` or `!hive`, choose an action with `!action attack|shield|heal`, and influence the next round with `!vote boss|chaos`. Agents retain role preferences, energy, health and contribution within the stream session, and make bounded autonomous decisions between commands.

A swarm consensus closes each round exactly once. Boss or Chaos events and temporary buffs/debuffs appear in an animated Canvas arena, alongside individual agents and a community leaderboard. Payments do not buy influence: every participant has one replaceable, equal-weight vote. Sub, Cheer and Raid notifications add visible celebration; a raid count does not fabricate individual viewer identities.

The streamer controls difficulty, challenges, pause/resume and reset from `/dashboard`. A read-only `/overlay` is designed for an OBS Browser Source at 1920×1080, with transparency and a legible HUD. The dashboard previews the same authoritative server state that the overlay receives. **Hide simulator** switches to a two-column desktop Broadcast View; **Show simulator** restores the panel. Both support keyboard activation and announce expanded state. Reset remains available while hidden with a confirmation dialog and restored focus. Live mode selects Insights / Live telemetry automatically. Fresh E2E covers real-backend reset while hidden and a fixture-based Live transition; this does not replace real Twitch or OBS verification.

Judges can use a clearly labeled Demo immediately. The simulator sends joins, actions, votes, subs, raids and cheers through the same normalized-event/reducer pipeline as live adapters. Seeded replay makes the story repeatable. A bounded 500-agent audience load lets the renderer and transport be inspected under pressure. None of those simulated events causes a real donation, subscription, raid or Twitch chat write.

## How we built it

The backend uses Node.js, TypeScript, `tmi.js` for IRC, Twitch Helix and EventSub WebSockets, and `ws` for browser fanout. Server-side OAuth validates the broadcaster identity and required scopes, refreshes tokens and responds to revocation. The event pipeline validates inputs, bounds queues and deduplication memory, isolates Demo/Live sessions, and rejects stale or duplicate delivery.

A single authoritative reducer owns the arena. Per-viewer agents are lightweight independent state/policy objects; they do not require one paid model request per viewer. The optional AI Director sees aggregate round context only, proposes a schema-limited scenario through OpenRouter's OpenAI-compatible API, and has a two-second deadline, a session budget and a deterministic Rules fallback. It cannot override consensus, execute arbitrary tools or control an external game. `OPENROUTER_MODEL` selects the model; no real paid inference or model-quality benchmark is claimed by the fixture tests.

The frontend uses React, Vite, local Inter fonts and native HTML5 Canvas. Canvas renders independently from React state updates, interpolating server updates through `requestAnimationFrame`. The DOM HUD provides readable round/consensus/leaderboard information, while shapes distinguish attack, shield and heal. Controls support keyboard navigation and a focused reset dialog. Reduced-motion preferences disable decorative animation. WebSocket snapshots recover sequence gaps, reconnects and session epochs.

The architecture diagram and setup/API details are in README.md. All state and credentials are intentionally in memory for the single-process hackathon MVP; restart ends the session. We use Chat/Helix/EventSub and an OBS overlay rather than relying on a Twitch Extension review.

## How OpenAI Codex CLI helped build the project

Codex was the engineering collaborator across specification, implementation, verification and review. The local Studio Harness commands supplied the workflow; they are Markdown instructions consumed in the Codex session, not additional OpenAI API endpoints.

1. **Context and architecture.** Codex read `HACKATHON_BRIEF.md` and the approved `.antigravity/IDEA_APPROVAL.json`, then used `design-init.md`, `spec.md` and the harness SPEC template to produce DESIGN.md, SPEC.md and AC-1 through AC-8. It corrected the older Extension description to match the approved Chat/EventSub/OBS direction. Commit `b98714e` captures that specification work.
2. **Backend implementation.** Following `build.md`, Codex wrote failing unit/integration checks, implemented the authoritative arena and independent viewer agents, and integrated actual tmi.js, Helix, EventSub, HTTP/ws and constrained Director behavior. Tests use local HTTP and WebSocket fixtures instead of spending Bits, creating real subscriptions or making paid model calls. Backend commits `6061ae4`, `54206b8` and `e5eb624` separate the core, Twitch integration and transport/simulator work.
3. **Frontend and browser verification.** Codex implemented the React command deck and transparent Canvas overlay against the real backend, wrote reusable Playwright E2E files, inspected screenshots and browser console/page errors, and exercised keyboard/mobile and reconnect behavior. A five-minute browser benchmark records actual wall-clock frame/paint timings rather than treating the earlier fake-clock reducer test as rendering evidence.
4. **Review and handoff.** Codex used `validate.md`, `cto.md`, the VALIDATION template and command-report schema to map criteria to real logs, review architecture/security/scale/scope/business tradeoffs, update AGENTS.md and assemble this submission narrative. Missing external evidence is left blocked rather than fabricated.

The work was performed in a local Codex workspace with shell, Git and browser-test tooling. To reproduce the approach with Codex CLI, start `codex` in this repository, ask it to read AGENTS.md and the approved brief, specify the AC IDs to implement, and require Red–Green–Verify plus `npm run check`. The official [Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli) describes the terminal workflow, and the [developer commands reference](https://learn.chatgpt.com/docs/developer-commands?surface=cli) documents `/status`. Use `/status` in the actual Codex session to obtain the session identifier for the Devpost form; this project uses the supplied file above. The Git diff, tests and validation artifacts are the reviewable record of generated work. Codex helped develop the product; it is not impersonated as a runtime SDK or an always-on agent service.

## Challenges we ran into

Twitch events can be duplicated, late or replayed during reconnect, while a director request can finish after pause or reset. We made epochs and delivery deduplication explicit, including retaining Live deduplication across a same-channel reset, and prevented stale model results from publishing effects.

Browser recovery also needed more than reopening a socket. We implemented versioned absolute state, snapshot resynchronization and session bootstrap reuse so a dashboard reload keeps its agents and OBS capability. OAuth control credentials remain server-side, and the overlay token is read-only.

Performance evidence needed careful separation. A fake clock is useful for testing thousands of reducer events, but cannot prove 60fps rendering. Browser timing precision also matters: an early preflight quantized frame intervals to roughly 16.8ms. Self-hosted assets and cross-origin isolation permit higher-resolution measurement; the strict 16.7ms target remains in the benchmark rather than being relaxed to make it pass. See VALIDATION.md for final measured results and remaining OBS verification.

## Accomplishments we're proud of

The prototype makes per-viewer ownership visible, demonstrates autonomous actions without a paid call per viewer, and gives judges a complete credential-free interaction loop. The same server state drives the command deck and overlay. The validation suite checks real local HTTP/WebSocket traffic, not just snapshots of static screens.

We also preserved the distinction between demonstrated behavior and hoped-for impact. Greater retention, stronger community participation and voluntary support are product hypotheses. Simulator activity does not establish watch-time retention, revenue growth or production-scale reliability.

## What we learned

The strongest agent experience here is not a bigger prompt: it is a clear relationship between one person, one stable agent identity, bounded decisions and visible collective consequences. Deterministic simulation makes those consequences testable; a constrained model can add variety without owning the rules or votes. Replay, honest mode labels and failure recovery make the idea easier for a streamer or judge to trust.

## What's next for TwitchHive

Complete the authorized real-channel smoke, verify compositing in an actual OBS Browser Source, record the demo video, and test optional Director models for useful variety, deadline success and cost. After the MVP, evaluate opt-in durable agent memory and multi-stream scaling against measured viewer outcomes. Those features are not claimed in this submission build.

## Built with

OpenAI Codex CLI; Studio Harness SDD → VSDD → CoDD; TypeScript; Node.js; React; Vite; HTML5 Canvas; Twitch Chat IRC / tmi.js; Twitch Helix; Twitch EventSub WebSockets; ws; Zod; optional OpenRouter-compatible model API; Playwright; GitHub Actions.

## Demo video handoff — under three minutes

Video status: **not recorded/uploaded in this workspace; add the real public video URL before submitting to Devpost.** No placeholder URL is represented as a working recording.

| Time | Show | Narration point |
|---|---|---|
| 0:00–0:20 | Dashboard + transparent overlay | Each viewer gets an agent; the audience becomes a team |
| 0:20–0:55 | Start Demo; join, act and vote | Immediate judge access; independent agent state and equal votes |
| 0:55–1:25 | Replay, Sub/Raid/Cheer, Boss/Chaos resolution | One real pipeline, visible collaboration, honest Demo labels |
| 1:25–1:55 | Authorized Twitch channel + OBS Browser Source | Record only after real Live/OBS verification; do not substitute Demo and call it Live |
| 1:55–2:25 | Codex session, SPEC ACs, tests, source diff | Show the actual development workflow and the session ID from /status |
| 2:25–2:45 | Swarm load, pause/reconnect, final view | State measured performance and known MVP limits |

Final submitter checklist: public repository accessible; fresh-clone instructions work; real video <3 minutes uploaded; authentic Codex Session ID entered; project description copied; live/OBS evidence reviewed against VALIDATION.md. This file is prepared content, not proof that the Devpost form has been submitted.
