# CTO review — TwitchHive

**Date:** 2026-10-30. **Scope:** architecture and frontend/release diff from e5eb624 to 19e943f, plus the documentation worktree. **Stage:** hackathon MVP. **Reviewer:** Codex self-review, not an independent human or separate-agent review.

All five lenses apply: this change adds UI, browser recovery, static hosting, a bounded simulator load and submission claims. No lens was omitted. Passing tests are referenced in VALIDATION.md; their results are not represented as new independent review evidence here.

## Architecture

**Note, nonblocking — `server/arena/arena.ts`, `client/state.ts`, `client/useArena.ts`:** reducer authority remains server-side. Viewer commands enter one validated event path; full absolute-state deltas avoid client increment drift. The browser requests a snapshot on sequence/session/epoch gaps. Overlay has no mutation channel. Preserve this boundary.

**Warning, nonblocking — `server/transport/app.ts`:** HTTP auth, OAuth lifecycle orchestration, static assets, simulator scheduling and WS fanout share one module. This is understandable at MVP scope, but split routing/static/simulator/transport ownership before adding multi-channel hosting; do not add durable state implicitly to this module.

## Security

**Note, nonblocking — `server/transport/app.ts` and `client/Dashboard.tsx`:** control requests require session, checked Origin and CSRF. Hosted Live additionally gates owner authorization; local localhost alias acceptance is limited to same scheme/port loopback. Overlay capabilities are read-only and expiring. Static paths are contained beneath the build directory; model/viewer text uses React text or Canvas text rather than HTML injection. Private Twitch/model values are not imported by client code.

**Warning, nonblocking for local Demo — `client/state.ts`, `client/useArena.ts`, README deployment section:** fragment URLs avoid leaking the overlay token in the HTML request, but the WS handshake still contains a scoped token in its query. Operators must redact those proxy access-log query strings. The one-hour session lifetime and server-side capability lookup limit scope, not disclosure risk. Add capability rotation if this moves beyond a demo.

## Scale

**Warning, nonblocking for tested MVP — `server/transport/app.ts`, `client/Arena.tsx`:** v1 fanout serializes full 500-agent snapshots/deltas. The measured benchmark is one 1920×1080 overlay and one process, not 100 simultaneous loaded Demo sessions or thousands of Twitch viewers. Reuse serialized state per arena and introduce sparse changed-agent batches before making a multi-stream capacity claim. Existing queue, agent, session and WS-buffer bounds are guardrails, not proof of that scale.

**Note — `server/director/director.ts`, BUSINESS_MODEL.md:** the per-user policy remains deterministic and cheap; only aggregate Director work may call a configured provider. Preserve schema, timeout, no-tools and budget constraints. Provider quality/cost benchmarks are pending because no paid live inference was performed.

## Scope

**Note, nonblocking — SPEC.md Modules and `client/main.tsx`:** the product remains two routes with one backend; no Extension installation, external game control, database, payment processing or native app was added. The audience-load control is bounded, authenticated and Demo-only, and uses the actual ingress path.

**One thing to defer:** durable cross-stream memory and multi-channel infrastructure. They add operational obligations before the current live/OBS evidence is complete.

## Business

**Note, nonblocking — README judge path, SUBMISSION.md:** a judge can reach visible agent ownership with Start Demo → join, or a seeded replay, without credentials. Sub/cheer effects do not purchase voting influence. Simulator counts are explicitly separated from measured retention or revenue, so the narrative does not claim causal impact that was not observed.

**Blocking release-evidence finding — SPEC AC-1, AC-5 and HACKATHON_BRIEF submission requirements:** authorized real-channel Twitch smoke, a manual actual OBS Browser Source capture and the real uploaded demo video are missing. Live/OBS checks cannot be replaced by fixture tests or Chromium screenshots; the required uploaded video cannot be replaced by a storyboard. AC-8 itself permits a video plan/link, so its documentation branch is assessed separately from actual Devpost submission readiness. Finish and record them before claiming complete hackathon acceptance.

## Verdict

**SHIP WITH CAVEATS for the local Demo and source handoff. Full competition acceptance remains BLOCKED by missing external evidence.** No confirmed critical code defect remained in the reviewed local flows. This recommendation is not independent certification, deployment permission or proof of submission.

Protect the per-viewer identity/equal-consensus contract and the separation between untrusted model suggestions and authoritative game rules. Prioritize the authorized Live + OBS recording over adding more features.
