import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  Helix,
  normalizeIRC,
  normalizeEventSub,
  EventSub,
  TWITCH_SCOPES,
} from "../server/twitch/twitch.js";
import { WebSocketServer } from "ws";
test("AC-1 IRC/EventSub normalization preserves delivery IDs and anonymous raid does not invent viewers", () => {
  const base = { sessionId: "s", channelId: "1" };
  const irc = normalizeIRC(
    base,
    {
      "user-id": "u",
      id: "m",
      "display-name": "Viewer",
      "tmi-sent-ts": "10000",
    },
    "!join",
    10000,
  );
  assert.equal(irc?.id, "m");
  assert.equal(irc?.viewerId, "u");
  assert.equal(normalizeIRC(base, {}, "!join", 10000), null);
  const cheer = normalizeEventSub(
    base,
    {
      metadata: {
        message_id: "e",
        message_timestamp: new Date(10000).toISOString(),
      },
      payload: {
        subscription: { type: "channel.cheer" },
        event: { user_id: null, is_anonymous: true, bits: 50 },
      },
    },
    10000,
  );
  assert.equal(cheer?.payload.count, 50);
  const raid = normalizeEventSub(
    base,
    {
      metadata: {
        message_id: "r",
        message_timestamp: new Date(10000).toISOString(),
      },
      payload: {
        subscription: { type: "channel.raid" },
        event: {
          from_broadcaster_user_id: "b",
          from_broadcaster_user_name: "Raider",
          viewers: 40,
        },
      },
    },
    10000,
  );
  assert.equal(raid?.kind, "raid");
  assert.equal(raid?.viewerId, "b");
});
test("AC-1 Helix creates exact scoped subscriptions, handles rate limit and unauthorized errors without leaking token", async () => {
  let calls = 0;
  let body: unknown;
  const server = createServer(async (req, res) => {
    if (req.url?.startsWith("/users")) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ data: [{ id: "1", login: "owner" }] }));
      return;
    }
    let text = "";
    for await (const chunk of req) text += chunk;
    body = JSON.parse(text);
    calls++;
    if (calls === 1) {
      res.writeHead(429, { "Ratelimit-Reset": "0" });
      res.end();
    } else {
      res.writeHead(202);
      res.end('{"data":[]}');
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as import("node:net").AddressInfo).port}`;
  try {
    const h = new Helix("client", "secret", { base: url });
    assert.equal((await h.user()).id, "1");
    await h.subscribe("channel.raid", "1", "ws-session");
    assert.equal(calls, 2);
    assert.deepEqual(body, {
      type: "channel.raid",
      version: "1",
      condition: { to_broadcaster_user_id: "1" },
      transport: { method: "websocket", session_id: "ws-session" },
    });
    assert.ok(TWITCH_SCOPES.includes("bits:read"));
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
  const bad = new Helix("client", "sensitive", {
    fetcher: async () => new Response("{}", { status: 401 }),
  });
  await assert.rejects(() => bad.user(), /twitch-auth/);
});
test("AC-1 EventSub welcomes, deduplicates welcome subscriptions, hands off reconnect and exposes revocation", async () => {
  const wss = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await new Promise<void>((r) => wss.on("listening", r));
  const url = `ws://127.0.0.1:${wss.address() instanceof Object ? (wss.address() as import("node:net").AddressInfo).port : 0}`;
  const health: string[] = [];
  let subs = 0;
  let received = 0;
  let connections = 0;
  wss.on("connection", (socket) => {
    connections++;
    socket.send(
      JSON.stringify({
        metadata: { message_type: "session_welcome" },
        payload: { session: { id: "session", keepalive_timeout_seconds: 10 } },
      }),
    );
    if (connections === 1)
      setTimeout(
        () =>
          socket.send(
            JSON.stringify({
              metadata: { message_type: "session_reconnect" },
              payload: { session: { reconnect_url: url } },
            }),
          ),
        20,
      );
    else
      setTimeout(() => {
        socket.send(
          JSON.stringify({
            metadata: { message_type: "notification" },
            payload: {},
          }),
        );
        socket.send(
          JSON.stringify({
            metadata: { message_type: "revocation" },
            payload: { subscription: { status: "authorization_revoked" } },
          }),
        );
      }, 20);
  });
  const es = new EventSub({
    url,
    allowLocal: true,
    subscribe: async () => {
      subs++;
    },
    onEvent: () => received++,
    onHealth: (s) => health.push(s),
  });
  try {
    es.start();
    for (let i = 0; i < 150 && !health.includes("revoked"); i++)
      await new Promise((r) => setTimeout(r, 20));
    assert.equal(subs, 1);
    assert.equal(connections, 2);
    assert.equal(received, 1);
    assert.ok(health.includes("revoked"));
  } finally {
    es.stop();
    for (const c of wss.clients) c.terminate();
    await new Promise<void>((r) => wss.close(() => r()));
  }
});

test("AC-1 full Twitch connection uses actual tmi.js over local IRC websocket, Helix and EventSub fixtures", async () => {
  const { TwitchConnection } = await import("../server/twitch/twitch.js");
  const irc = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  const es = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await Promise.all(
    [irc, es].map((s) => new Promise<void>((r) => s.on("listening", r))),
  );
  const subscriptions: unknown[] = [];
  const grants: string[] = [];
  const http = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/validate")
      res.end(
        JSON.stringify({
          client_id: "client",
          user_id: "1",
          scopes: TWITCH_SCOPES,
        }),
      );
    else if (req.url === "/users")
      res.end('{"data":[{"id":"1","login":"owner"}]}');
    else if (req.url === "/eventsub/subscriptions") {
      let text = "";
      for await (const c of req) text += c;
      subscriptions.push(JSON.parse(text));
      res.writeHead(202);
      res.end('{"data":[]}');
    } else if (req.url === "/token") {
      let text = "";
      for await (const chunk of req) text += chunk;
      const params = new URLSearchParams(text);
      grants.push(params.get("grant_type")!);
      assert.equal(params.get("client_id"), "client");
      res.end(
        JSON.stringify({
          access_token: "fixture",
          refresh_token: "fixture",
          expires_in: grants.length === 1 ? 61 : 3600,
          scope: TWITCH_SCOPES,
        }),
      );
    } else {
      res.writeHead(404);
      res.end("{}");
    }
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const port = (s: { address: () => unknown }) =>
    (s.address() as import("node:net").AddressInfo).port;
  irc.on("connection", (ws) => {
    ws.on("message", (d) => {
      const line = d.toString();
      if (line.startsWith("NICK")) {
        ws.send(
          ":tmi.twitch.tv 001 owner :Welcome\r\n:tmi.twitch.tv 376 owner :End\r\n",
        );
      }
      if (line.startsWith("JOIN")) {
        ws.send(
          ":owner!owner@owner.tmi.twitch.tv JOIN #owner\r\n@user-id=1;display-name=Owner :tmi.twitch.tv USERSTATE #owner\r\n@room-id=1 :tmi.twitch.tv ROOMSTATE #owner\r\n",
        );
        ws.send(
          `@display-name=Viewer;user-id=u;id=chat-id;tmi-sent-ts=${Date.now()} :viewer!viewer@viewer.tmi.twitch.tv PRIVMSG #owner :!join\r\n`,
        );
      }
    });
  });
  es.on("connection", (ws) => {
    ws.send(
      JSON.stringify({
        metadata: { message_type: "session_welcome" },
        payload: { session: { id: "es", keepalive_timeout_seconds: 10 } },
      }),
    );
  });
  const events: unknown[] = [];
  let owner = "";
  const c = new TwitchConnection(
    {
      clientId: "client",
      clientSecret: "fixture",
      redirectUri: "http://localhost/callback",
      channel: "owner",
      authBase: `http://127.0.0.1:${port(http)}`,
      helixBase: `http://127.0.0.1:${port(http)}`,
      eventSubUrl: `ws://127.0.0.1:${port(es)}`,
      allowLocal: true,
      ircOptions: {
        connection: {
          server: "127.0.0.1",
          port: port(irc),
          secure: false,
          reconnect: false,
        },
        options: { skipUpdatingEmotesets: true },
      },
    },
    () => ({ sessionId: "s", channelId: "1" }),
    (e) => events.push(e),
    (id) => (owner = id),
  );
  try {
    await c.exchange("fixture-code");
    for (let i = 0; i < 50 && events.length === 0; i++)
      await new Promise((r) => setTimeout(r, 20));
    assert.equal(owner, "1");
    assert.equal(subscriptions.length, 3);
    assert.equal(events.length, 1);
    assert.equal(c.health.irc, "connected");
    assert.equal(c.health.eventsub, "connected");
    assert.equal((events[0] as { id: string }).id, "chat-id");
    for (let i = 0; i < 150 && subscriptions.length < 6; i++)
      await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(grants, ["authorization_code", "refresh_token"]);
    assert.equal(subscriptions.length, 6);
  } finally {
    await c.disconnect();
    for (const s of [irc, es]) {
      for (const ws of s.clients) ws.terminate();
      await new Promise<void>((r) => s.close(() => r()));
    }
    await new Promise<void>((r) => http.close(() => r()));
  }
});

test("AC-1 missing scopes and wrong owner fail closed and clear adapter state", async () => {
  const { TwitchConnection } = await import("../server/twitch/twitch.js");
  let scopes: string[] = [];
  const http = createServer((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      req.url === "/validate"
        ? JSON.stringify({ client_id: "client", user_id: "1", scopes })
        : '{"data":[{"id":"1","login":"other"}]}',
    );
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(http.address() as import("node:net").AddressInfo).port}`;
  const c = new TwitchConnection(
    {
      clientId: "client",
      clientSecret: "fixture",
      redirectUri: "http://localhost",
      channel: "owner",
      authBase: url,
      helixBase: url,
    },
    () => ({ sessionId: "s", channelId: "1" }),
    () => assert.fail("must not emit"),
    () => assert.fail("must not become owner"),
  );
  try {
    const credentials = {
      access_token: "fixture",
      refresh_token: "fixture",
      expires_in: 3600,
      scope: [],
    };
    await assert.rejects(() => c.connect(credentials), /twitch-connect-failed/);
    assert.equal(c.health.helix, "auth-or-connection-failed");
    scopes = TWITCH_SCOPES;
    await assert.rejects(() => c.connect(credentials), /twitch-connect-failed/);
    assert.equal(c.health.irc, "auth-or-connection-failed");
  } finally {
    await c.disconnect();
    await new Promise<void>((r) => http.close(() => r()));
  }
});
test("AC-3 model provider integration sends aggregate context, bounded output and validates actual HTTP response", async () => {
  const { Director } = await import("../server/director/director.js");
  let body: Record<string, unknown> = {};
  const http = createServer(async (req, res) => {
    let text = "";
    for await (const c of req) text += c;
    body = JSON.parse(text);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                scenario: "boss",
                difficulty: 2,
                effect: "shield",
                durationSec: 10,
                headline: "Together",
              }),
            },
          },
        ],
      }),
    );
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
  try {
    const d = new Director({
      key: "fixture",
      model: "test/model",
      endpoint: `http://127.0.0.1:${(http.address() as import("node:net").AddressInfo).port}`,
    });
    const decision = await d.decide({
      roundId: "r",
      agents: 4,
      bossHp: 100,
      difficulty: 2,
    });
    assert.equal(decision.source, "Model");
    assert.equal(body.max_tokens, 512);
    assert.equal(body.model, "test/model");
    assert.equal(JSON.stringify(body).includes("viewerId"), false);
  } finally {
    await new Promise<void>((r) => http.close(() => r()));
  }
});
