import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { Arena } from "../arena/arena.js";
import { Director } from "../director/director.js";
import { trigger, replay } from "../arena/simulator.js";
import {
  TwitchConnection,
  TWITCH_SCOPES,
  type TwitchConfig,
} from "../twitch/twitch.js";
import type { Frame } from "../../shared/protocol.js";
interface Config {
  origin: string;
  hosted?: boolean;
  streamerControlToken?: string;
  twitch?: TwitchConfig;
  director?: { key?: string; model?: string; endpoint?: string };
  now?: () => number;
}
interface Session {
  arena: Arena;
  csrf: string;
  overlay: string;
  expires: number;
  director: Director;
  liveOwner: boolean;
  requests: number[];
  oauth?: { state: string; expires: number };
  twitch?: TwitchConnection;
}
const token = () => randomBytes(32).toString("hex");
function equal(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
class HTTPError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function createApp(config: Config) {
  const now = config.now ?? Date.now,
    sessions = new Map<string, Session>();
  const clients = new Map<
    WebSocket,
    {
      session: Session;
      lastSeq: number;
      epoch: number;
      lastSnapshot: number;
      pongAt: number;
    }
  >();
  let live: Session | undefined;
  const origin = new URL(config.origin);
  if (config.hosted && origin.protocol !== "https:")
    throw new Error("hosted-requires-https");
  if (
    config.hosted &&
    config.twitch &&
    (!config.twitch.channel || !config.streamerControlToken)
  )
    throw new Error("hosted-live-requires-owner-and-control-token");
  const cookie = (req: IncomingMessage) => {
    const m = /(?:^|;\s*)hive=([a-f0-9]{64})(?:;|$)/.exec(
      req.headers.cookie ?? "",
    );
    return m?.[1];
  };
  const session = (req: IncomingMessage) => {
    const id = cookie(req),
      s = id ? sessions.get(id) : undefined;
    if (!s || s.expires < now()) throw new HTTPError(401, "session-required");
    return s;
  };
  const checkOrigin = (req: IncomingMessage) => {
    if (req.headers.origin !== config.origin)
      throw new HTTPError(403, "origin");
  };
  const ownerGate = (req: IncomingMessage) => {
    if (
      config.streamerControlToken &&
      !equal(
        req.headers.authorization ?? "",
        `Bearer ${config.streamerControlToken}`,
      )
    )
      throw new HTTPError(403, "streamer-authorization");
    if (!config.streamerControlToken && config.hosted)
      throw new HTTPError(403, "streamer-authorization");
  };
  const control = (req: IncomingMessage) => {
    const s = session(req);
    checkOrigin(req);
    if (!equal(String(req.headers["x-csrf-token"] ?? ""), s.csrf))
      throw new HTTPError(403, "csrf");
    s.requests = s.requests.filter((t) => t > now() - 60000);
    if (s.requests.length >= 30) throw new HTTPError(429, "rate-limit");
    s.requests.push(now());
    return s;
  };
  const json = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    res.end(JSON.stringify(data));
  };
  const read = async (req: IncomingMessage) => {
    let text = "";
    for await (const chunk of req) {
      text += chunk.toString();
      if (Buffer.byteLength(text) > 16384)
        throw new HTTPError(413, "body-too-large");
    }
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new HTTPError(400, "invalid-json");
    }
  };
  const server = createServer((req, res) => {
    void handle(req, res).catch((error) => {
      if (!res.headersSent)
        json(
          res,
          error instanceof HTTPError
            ? error.status
            : error instanceof z.ZodError
              ? 400
              : 503,
          {
            error:
              error instanceof HTTPError
                ? error.code
                : error instanceof z.ZodError
                  ? "invalid-input"
                  : "integration-unavailable",
          },
        );
      else res.end();
    });
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 10000;
  const publicState = (s: Session) => ({
    ...s.arena.snapshot(),
    health: s.twitch?.health ?? {
      irc: "disconnected",
      eventsub: "disconnected",
      helix: "disconnected",
    },
  });
  async function handle(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", config.origin),
      path = url.pathname;
    if (path === "/healthz") {
      json(res, 200, { ok: true });
      return;
    }
    if (path === "/api/demo" && req.method === "POST") {
      checkOrigin(req);
      if (sessions.size >= 100) throw new HTTPError(503, "session-capacity");
      const id = token(),
        s: Session = {
          arena: new Arena({ now }),
          csrf: token(),
          overlay: token(),
          expires: now() + 3600000,
          director: new Director(),
          liveOwner: false,
          requests: [],
        };
      sessions.set(id, s);
      res.setHeader(
        "Set-Cookie",
        `hive=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600${config.hosted ? "; Secure" : ""}`,
      );
      json(res, 201, {
        csrf: s.csrf,
        overlayToken: s.overlay,
        mode: "Demo",
        expiresAt: s.expires,
      });
      return;
    }
    if (path === "/api/session" && req.method === "GET") {
      json(res, 200, publicState(session(req)));
      return;
    }
    if (path === "/auth/twitch/start" && req.method === "POST") {
      const s = control(req);
      ownerGate(req);
      if (!config.twitch) throw new HTTPError(503, "twitch-not-configured");
      s.oauth = { state: token(), expires: now() + 300000 };
      const query = new URLSearchParams({
        client_id: config.twitch.clientId,
        redirect_uri: config.twitch.redirectUri,
        response_type: "code",
        scope: TWITCH_SCOPES.join(" "),
        state: s.oauth.state,
        force_verify: "true",
      });
      json(res, 200, { url: `https://id.twitch.tv/oauth2/authorize?${query}` });
      return;
    }
    if (path === "/auth/twitch/callback" && req.method === "GET") {
      const s = session(req),
        pending = s.oauth;
      s.oauth = undefined;
      if (
        !pending ||
        pending.expires < now() ||
        !equal(url.searchParams.get("state") ?? "", pending.state)
      )
        throw new HTTPError(403, "oauth-state");
      if (live && live !== s) throw new HTTPError(409, "channel-in-use");
      const code = url.searchParams.get("code");
      if (!code || !config.twitch) throw new HTTPError(400, "oauth-denied");
      const twitch = new TwitchConnection(
        config.twitch,
        () => {
          const a = s.arena.snapshot();
          return { sessionId: a.sessionId, channelId: a.channelId };
        },
        (e) => s.arena.enqueue(e),
        (id) => {
          if (
            s.arena.snapshot().mode !== "Live" ||
            s.arena.snapshot().channelId !== id
          ) {
            s.arena.reset("Live", id);
            s.director = new Director(config.director);
          }
          s.liveOwner = true;
        },
      );
      live = s;
      try {
        await twitch.exchange(code);
        s.twitch = twitch;
        live = s;
        json(res, 200, { connected: true, mode: "Live" });
      } catch {
        await twitch.disconnect();
        s.arena.reset("Demo", "demo");
        s.liveOwner = false;
        if (live === s) live = undefined;
        throw new HTTPError(503, "twitch-connect-failed");
      }
      return;
    }
    if (
      path.startsWith("/api/control/") ||
      path.startsWith("/api/simulator/")
    ) {
      if (req.method !== "POST") throw new HTTPError(405, "method");
      const s = control(req),
        body = await read(req),
        action = path.split("/").at(-1);
      if (path.startsWith("/api/simulator/")) {
        if (s.arena.snapshot().mode !== "Demo")
          throw new HTTPError(409, "demo-only");
        if (action === "events") {
          const result = trigger(s.arena, body);
          json(res, result.ok ? 200 : 409, result);
          return;
        }
        if (action === "replay") {
          const { seed } = z
            .object({ seed: z.number().int().min(0).max(4294967295) })
            .strict()
            .parse(body);
          replay(s.arena, seed);
          json(res, 200, { ok: true });
          return;
        }
      } else {
        if (action === "pause") s.arena.pause();
        else if (action === "resume") {
          s.arena.resume();
          s.arena.finishResolution();
        } else if (action === "reset") {
          const st = s.arena.snapshot();
          s.arena.reset(st.mode, st.channelId);
        } else if (action === "rules") {
          s.arena.rules(
            z
              .object({ difficulty: z.number().int().min(1).max(5) })
              .strict()
              .parse(body).difficulty,
          );
        } else if (action === "challenge") {
          const input = z
            .object({ action: z.enum(["open", "close"]) })
            .strict()
            .parse(body);
          try {
            if (input.action === "open") s.arena.openRound();
            else await s.arena.closeRound(s.director);
          } catch {
            throw new HTTPError(409, "round-state");
          }
        } else if (action === "disconnect") {
          if (!s.liveOwner) throw new HTTPError(403, "owner-required");
          await s.twitch?.disconnect();
          s.twitch = undefined;
          s.liveOwner = false;
          if (live === s) live = undefined;
          s.arena.reset("Demo", "demo");
          s.director = new Director();
        } else if (action === "connect")
          throw new HTTPError(409, "use-oauth-start");
        else throw new HTTPError(404, "route");
        json(res, 200, { ok: true });
        return;
      }
    }
    throw new HTTPError(404, "route");
  }
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
  const send = (ws: WebSocket, s: Session, type: Frame["type"]) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1048576) {
      ws.close(1013, "slow-client");
      return;
    }
    const st = s.arena.snapshot();
    ws.send(
      JSON.stringify({
        v: 1,
        type,
        sessionId: st.sessionId,
        epoch: st.epoch,
        seq: st.seq,
        payload: publicState(s),
      } satisfies Frame),
    );
  };
  server.on("upgrade", (req, socket, head) => {
    try {
      const u = new URL(req.url ?? "/", config.origin);
      let s: Session;
      if (u.pathname === "/ws/dashboard") {
        checkOrigin(req);
        s = session(req);
      } else if (u.pathname === "/ws/overlay") {
        const t = u.searchParams.get("token") ?? "";
        s = [...sessions.values()].find(
          (s) => equal(t, s.overlay) && s.expires >= now(),
        )!;
        if (!s) throw new HTTPError(401, "overlay-token");
        if (req.headers.origin && req.headers.origin !== config.origin)
          throw new HTTPError(403, "origin");
      } else throw new HTTPError(404, "route");
      wss.handleUpgrade(req, socket, head, (ws) => {
        const state = s.arena.snapshot();
        clients.set(ws, {
          session: s,
          lastSeq: state.seq,
          epoch: state.epoch,
          lastSnapshot: now(),
          pongAt: now(),
        });
        send(ws, s, "snapshot");
        ws.on("pong", () => {
          const c = clients.get(ws);
          if (c) c.pongAt = now();
        });
        let requested = 0;
        ws.on("message", (data) => {
          try {
            const b = JSON.parse(data.toString());
            if (b.type === "snapshot" && now() - requested >= 100) {
              requested = now();
              send(ws, s, "snapshot");
            } else if (b.type !== "snapshot")
              ws.send(
                JSON.stringify({
                  type: "error",
                  v: 1,
                  sessionId: state.sessionId,
                  epoch: state.epoch,
                  seq: state.seq,
                  payload: { error: "read-only" },
                }),
              );
          } catch {
            ws.close(1008, "invalid-frame");
          }
        });
        ws.on("error", () => {});
        ws.on("close", () => clients.delete(ws));
      });
    } catch (e) {
      socket.end(
        `HTTP/1.1 ${e instanceof HTTPError ? e.status : 400} Rejected\r\nConnection: close\r\n\r\n`,
      );
    }
  });
  let lastPing = now();
  const timer = setInterval(() => {
    for (const [id, s] of sessions) {
      if (s.expires < now()) {
        sessions.delete(id);
        if (live === s) live = undefined;
        void s.twitch?.disconnect();
        continue;
      }
      s.arena.tick();
      s.arena.finishResolution();
      const st = s.arena.snapshot();
      if (
        st.round.status === "open" &&
        !st.paused &&
        now() >= st.round.closesAt
      )
        void s.arena.closeRound(s.director);
    }
    const ping = now() - lastPing >= 15000;
    if (ping) lastPing = now();
    for (const [ws, c] of clients) {
      if (c.session.expires < now() || now() - c.pongAt > 45000) {
        ws.terminate();
        continue;
      }
      if (ping) ws.ping();
      const state = c.session.arena.snapshot();
      if (state.epoch !== c.epoch || now() - c.lastSnapshot >= 5000) {
        send(ws, c.session, "snapshot");
        c.lastSnapshot = now();
      } else if (state.seq !== c.lastSeq) send(ws, c.session, "delta");
      c.lastSeq = state.seq;
      c.epoch = state.epoch;
    }
  }, 100);
  return {
    server,
    listen: (port = 3001, host = "127.0.0.1") =>
      new Promise<AddressInfo>((r) =>
        server.listen(port, host, () => r(server.address() as AddressInfo)),
      ),
    close: async () => {
      clearInterval(timer);
      for (const s of sessions.values()) await s.twitch?.disconnect();
      for (const ws of clients.keys()) ws.terminate();
      await new Promise<void>((r) => wss.close(() => r()));
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}
