# TwitchHive

One micro-agent per Twitch viewer, coordinated into an interactive stream arena. Backend for the approved Codex x TwitchCon project; the React dashboard and OBS Canvas routes are Issue #3.

## Run and verify

Requires Node.js 22+ and npm. No credentials required for Demo.

```sh
npm ci
npm run check
npm run dev
```

Backend listens on `127.0.0.1:3001`. Issue #3's Vite server runs at port 3000 and must proxy `/api`, `/auth` and `/ws` to 3001, preserving Cookie/Origin and WebSocket upgrades. `APP_ORIGIN` defaults to `http://127.0.0.1:3000`; use that exact origin (not localhost) for browser requests. For direct API development set `APP_ORIGIN=http://127.0.0.1:3001`.

For configuration copy `.env.example` to `.env`, then run `node --env-file=.env --import tsx server/index.ts`. `npm run build` compiles TypeScript; `npm start` runs the compiled backend. Production defaults to port 3000, requires HTTPS public APP_ORIGIN, STREAMER_CONTROL_TOKEN and TWITCH_CHANNEL. Terminate TLS at a reverse proxy, preserve Origin, and disable access-log query strings for `/auth/twitch/callback` and `/ws/overlay` (OAuth codes and scoped overlay capabilities). Production asset serving is deferred to Issue #3; only backend APIs exist now.

## API contract for the frontend

1. `POST /api/demo` with `Origin: APP_ORIGIN` creates an isolated one-hour session. Store the HttpOnly session cookie; response contains `csrf`, `overlayToken`, mode and expiry. Each browser session owns an arena; no global Demo state.
2. `GET /api/session` with cookie returns authoritative state and per-adapter health. This endpoint never returns Twitch/AI credentials. Agent arrays and leaderboard are detached snapshots.
3. Control/simulator POSTs require cookie, matching `Origin` and `X-CSRF-Token`, JSON body, <=16KiB. Limit 30 mutations/minute/session. Dashboard must show status codes and reason, rather than assuming a request succeeded.

| Endpoint | JSON body | Result |
|---|---|---|
| `/api/control/challenge` | `{"action":"open"}` or `{"action":"close"}` | Start a 30-second round / resolve early |
| `/api/control/pause`, `/resume`, `/reset` | `{}` | Pause, resume, reset session epoch |
| `/api/control/rules` | `{"difficulty":2}` | Integer 1..5 |
| `/api/control/disconnect` | `{}` | Live owner disconnects, switches to clean Demo |
| `/api/simulator/events` | `{"kind":"chat","viewerId":"alice","text":"!join"}` | Normalized event through same reducer as Live |
| `/api/simulator/events` | `{"kind":"cheer","viewerId":"alice","count":100}` | `sub`, `raid`, `cheer`; cosmetic effects only |
| `/api/simulator/replay` | `{"seed":42}` | Deterministic 20-viewer scenario with all command/event kinds |
| `/auth/twitch/start` | `{}` | Owner-gated OAuth URL; navigate browser to URL |

Valid commands: `!join` / `!hive`, `!action attack|shield|heal`, `!vote boss|chaos`. Actions cost 10 energy and have 2-second cooldown. Voting is one replaceable equal-weight vote per joined viewer per round; Bits/subs do not affect votes. Unjoined/invalid/stale/paused events return reasons without applying actions. Chat ordinary text is not persisted. Raid counts never manufacture viewer identities. One agent per channel/user ID; 500 active cap; 15-minute dormant entries may be evicted. All memory disappears on restart.

`GET /healthz` is a liveness probe, **not** proof of live Twitch connectivity. Errors: 400 malformed input; 401 session; 403 origin/CSRF/owner; 409 state/mode; 413 body size; 429 throttle; 503 unconfigured/unavailable service. Unknown routes return 404. `/api/control/connect` directs callers to the OAuth workflow.

### WebSocket

- `/ws/dashboard`: cookie and exact browser Origin required.
- `/ws/overlay?token=<overlayToken>`: scoped read-only session capability; works as OBS Browser Source backend. Twitch credentials never appear here. Treat the overlay token as a secret link; expires with session.
- Frames: `{v:1,type,sessionId,epoch,seq,payload}`. `snapshot` initially/every five seconds/on epoch change; `delta` at most 10Hz carries **absolute full current public state** in v1 (a valid replacement update, not numeric increments). Frontend can replace its state with payload. Discard older seq; session/epoch change or seq gaps require `{"type":"snapshot"}`.
- Both sockets are read-only: mutations go through HTTP control auth. Heartbeat every 15s; disconnect after 45s without pong. Buffered output >1MiB closes slow client, which must reconnect and consume a snapshot. Reconnect client backoff 1–30s with jitter is Issue #3.

Pause freezes deadlines, energy and effects; Director results arriving during pause wait for resume. Reset invalidates queued events and in-flight Director results. Consensus resolves once; boss wins ties/no-vote, independent of model's suggested scenario. Arena-only haste/slow modifies attack damage, shield prevents periodic enemy damage; effects expire within 15 seconds. No external game/OS tools exist.

## Real Twitch integration

Register a Twitch application and configure its redirect URL to match TWITCH_REDIRECT_URI exactly. Configure the client ID, secret and broadcaster login in ignored `.env`. The app uses server-side authorization code flow, anti-CSRF OAuth state (5-minute, single use), an HttpOnly SameSite=Lax cookie for the cross-site GET callback, owner identity validation, in-memory access/refresh tokens, refresh before expiry, and hourly validation. Hosted owner authorization also requires `Authorization: Bearer <STREAMER_CONTROL_TOKEN>` on `/auth/twitch/start`; do not expose that token to public Demo clients. Only one Live owner session is permitted per deployment.

OAuth scopes (checked against [official subscription types](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/) and [Twitch OAuth](https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/)):

| Consumer | Scope | Version / condition |
|---|---|---|
| tmi.js IRC read-only chat | `chat:read` | Stable IRC user/message IDs; no chat:edit |
| EventSub `channel.subscribe` | `channel:read:subscriptions` | v1, broadcaster_user_id |
| EventSub `channel.cheer` | `bits:read` | v1, broadcaster_user_id |
| EventSub `channel.raid` | No additional scope | v1, to_broadcaster_user_id |
| Helix `/users` | Valid user token | Resolves authenticated broadcaster identity |

EventSub is a **WebSocket user-token** transport. Subscriptions are created after welcome, reused during reconnect handoff, recreated after a fresh connection; keepalive expiry reconnects with backoff. Reconnect URLs are restricted to Twitch's EventSub host. Revocations clear credentials and disconnect adapters; health never silently switches to Demo. Helix retries 429 at most twice, honors reset headers, and refuses >30-second waits. No webhook signature path is needed.

Real smoke checklist (requires an authorized broadcaster, not run by fixture tests): connect; verify all three health states; send `!join` then `!action`/`!vote` during an open round from real chat; inspect agent and ordered WS output; receive a real supported sub/cheer/raid; disconnect/revoke and verify degraded health. Record revision, redacted timestamps and event IDs in VALIDATION.md. Tests never create real donations, subscriptions or raids. Fixture integration is not evidence of live access.

## AI Director and cost

Per Studio Harness CONVENTIONS-AI, inference uses [OpenRouter's OpenAI-compatible API](https://openrouter.ai/docs/api_reference/overview), configured only by OPENROUTER_API_KEY and OPENROUTER_MODEL. No hardcoded paid model, no automatic live calls in tests. Missing config, budget exhaustion, malformed response, HTTP error or 2-second timeout falls back to deterministic Rules with an explicit reason. One call per round, max 30 calls per Director/session, 512 output tokens, no retries. Only aggregate arena context goes to the provider; raw chat, identities and OAuth tokens are excluded. Schema-limited proposals never override consensus, pause or authorization. `BUSINESS_MODEL.md` documents the token cost envelope and benchmark approach.

## Testing and delivery status

Tests use fake clocks/seeded replay, real ephemeral HTTP/ws servers, actual tmi.js talking to a local IRC WebSocket fixture, Helix/OAuth fixtures and model HTTP fixtures. `npm run check` runs format lint, strict typecheck, all tests and build. AC IDs appear in test names. CI runs the same checks. `docs/ISSUE_2_BACKEND.md` records scope and limitations. Full browser/OBS verification, independent VALIDATION.md and Devpost packaging remain Issues #3–4.
