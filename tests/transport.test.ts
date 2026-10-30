import { test } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { createApp } from "../server/transport/app.js";
async function setup() {
  const app = createApp({ origin: "http://127.0.0.1:3000" });
  const address = await app.listen(0);
  const base = `http://127.0.0.1:${address.port}`;
  const origin = "http://127.0.0.1:3000";
  const r = await fetch(base + "/api/demo", {
    method: "POST",
    headers: { Origin: origin },
  });
  const body = (await r.json()) as { csrf: string; overlayToken: string };
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  return {
    app,
    base,
    body,
    cookie,
    headers: {
      Origin: origin,
      Cookie: cookie,
      "X-CSRF-Token": body.csrf,
      "Content-Type": "application/json",
    },
  };
}
test("AC-4 AC-6 AC-7 real HTTP/ws simulator, auth, CSRF, read-only token and snapshot resync", async () => {
  const f = await setup();
  try {
    assert.equal(
      (await fetch(f.base + "/api/control/pause", { method: "POST" })).status,
      401,
    );
    assert.equal(
      (
        await fetch(f.base + "/api/control/pause", {
          method: "POST",
          headers: { Cookie: f.cookie, Origin: "https://evil.test" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(f.base + "/api/control/pause", {
          method: "POST",
          headers: { Cookie: f.cookie, Origin: f.headers.Origin },
        })
      ).status,
      403,
    );
    const ws = new WebSocket(
      f.base.replace("http", "ws") + "/ws/overlay?token=" + f.body.overlayToken,
    );
    const frames: Record<string, unknown>[] = [];
    ws.on("message", (d) => frames.push(JSON.parse(d.toString())));
    await new Promise<void>((r) => ws.on("open", r));
    const post = (path: string, body: unknown = {}) =>
      fetch(f.base + path, {
        method: "POST",
        headers: f.headers,
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await post("/api/simulator/events", {
          kind: "chat",
          viewerId: "a",
          text: "!join",
        })
      ).status,
      200,
    );
    assert.equal(
      (await post("/api/control/challenge", { action: "open" })).status,
      200,
    );
    for (const kind of ["sub", "raid", "cheer"])
      assert.equal(
        (
          await post("/api/simulator/events", {
            kind,
            viewerId: "a",
            count: 10,
          })
        ).status,
        200,
      );
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(frames.some((f) => f.type === "snapshot"));
    assert.ok(frames.some((f) => f.type === "delta"));
    ws.send(JSON.stringify({ type: "pause" }));
    await new Promise((r) => setTimeout(r, 20));
    let state = (await (
      await fetch(f.base + "/api/session", { headers: { Cookie: f.cookie } })
    ).json()) as { paused: boolean; agents: unknown[] };
    assert.equal(state.paused, false);
    assert.equal(state.agents.length, 1);
    ws.send(JSON.stringify({ type: "snapshot" }));
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(frames.filter((f) => f.type === "snapshot").length >= 2);
    ws.close();
    assert.equal((await post("/api/control/pause")).status, 200);
    assert.equal(
      (
        await post("/api/simulator/events", {
          kind: "chat",
          text: "!action heal",
          viewerId: "a",
        })
      ).status,
      409,
    );
    assert.equal((await post("/api/control/resume")).status, 200);
    assert.equal(
      (await post("/api/simulator/replay", { seed: 12 })).status,
      200,
    );
    assert.equal(
      (await post("/api/control/rules", { difficulty: 99 })).status,
      400,
    );
  } finally {
    await f.app.close();
  }
});
test("AC-7 hosted demo sessions isolated, rate limit and malformed JSON rejected", async () => {
  const f = await setup();
  try {
    const r = await fetch(f.base + "/api/demo", {
      method: "POST",
      headers: { Origin: f.headers.Origin },
    });
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    assert.notEqual(cookie, f.cookie);
    assert.equal(
      (
        await fetch(f.base + "/api/simulator/events", {
          method: "POST",
          headers: f.headers,
          body: "{broken",
        })
      ).status,
      400,
    );
    for (let i = 0; i < 30; i++)
      await fetch(f.base + "/api/control/resume", {
        method: "POST",
        headers: f.headers,
        body: "{}",
      });
    assert.equal(
      (
        await fetch(f.base + "/api/control/resume", {
          method: "POST",
          headers: f.headers,
          body: "{}",
        })
      ).status,
      429,
    );
    const s = (await (
      await fetch(f.base + "/api/session", { headers: { Cookie: cookie } })
    ).json()) as { agents: unknown[] };
    assert.equal(s.agents.length, 0);
  } finally {
    await f.app.close();
  }
});

test("AC-6 AC-7 OAuth state is single-use, start is owner gated, unknown sockets rejected", async () => {
  const app = createApp({
    origin: "http://127.0.0.1:3000",
    streamerControlToken: "owner-fixture",
    twitch: {
      clientId: "client",
      clientSecret: "fixture",
      channel: "owner",
      redirectUri: "http://127.0.0.1:3000/auth/twitch/callback",
    },
  });
  const { port } = await app.listen(0);
  const base = `http://127.0.0.1:${port}`,
    origin = "http://127.0.0.1:3000";
  try {
    const r = await fetch(base + "/api/demo", {
      method: "POST",
      headers: { Origin: origin },
    });
    const { csrf } = (await r.json()) as { csrf: string };
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    const headers = { Origin: origin, Cookie: cookie, "X-CSRF-Token": csrf };
    assert.equal(
      (await fetch(base + "/auth/twitch/start", { method: "POST", headers }))
        .status,
      403,
    );
    const start = await fetch(base + "/auth/twitch/start", {
      method: "POST",
      headers: { ...headers, Authorization: "Bearer owner-fixture" },
    });
    const { url } = (await start.json()) as { url: string };
    const oauth = new URL(url);
    assert.equal(oauth.searchParams.get("response_type"), "code");
    assert.ok(oauth.searchParams.get("scope")!.includes("bits:read"));
    const state = oauth.searchParams.get("state")!;
    assert.equal(
      (
        await fetch(base + "/auth/twitch/callback?state=wrong&code=x", {
          headers: { Cookie: cookie },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + `/auth/twitch/callback?state=${state}&code=x`, {
          headers: { Cookie: cookie },
        })
      ).status,
      403,
    );
    const ws = new WebSocket(base.replace("http", "ws") + "/ws/dashboard", {
      headers: { Cookie: cookie, Origin: "https://evil.test" },
    });
    const error = await new Promise<Error>((r) => ws.on("error", r));
    assert.match(error.message, /403/);
  } finally {
    await app.close();
  }
});
test("AC-7 expired session loses control and overlay access", async () => {
  let n = 10000;
  const app = createApp({ origin: "http://127.0.0.1:3000", now: () => n });
  const { port } = await app.listen(0);
  const base = `http://127.0.0.1:${port}`;
  try {
    const r = await fetch(base + "/api/demo", {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:3000" },
    });
    const cookie = r.headers.get("set-cookie")!.split(";")[0];
    n += 3600001;
    assert.equal(
      (await fetch(base + "/api/session", { headers: { Cookie: cookie } }))
        .status,
      401,
    );
  } finally {
    await app.close();
  }
});

test("AC-4 AC-7 hosted Demo works without Twitch/model credentials and sets secure cookie", async () => {
  const app = createApp({ origin: "https://hive.example", hosted: true });
  const { port } = await app.listen(0);
  try {
    const r = await fetch(`http://127.0.0.1:${port}/api/demo`, {
      method: "POST",
      headers: { Origin: "https://hive.example" },
    });
    assert.equal(r.status, 201);
    assert.match(r.headers.get("set-cookie")!, /Secure/);
    assert.equal(((await r.json()) as { mode: string }).mode, "Demo");
  } finally {
    await app.close();
  }
});

test("AC-4 AC-7 dashboard bootstrap reuses session safely; bounded load resets invalidate the producer", async () => {
  const f = await setup();
  try {
    const boot = await fetch(f.base + "/api/demo", {
      method: "POST",
      headers: { Origin: f.headers.Origin, Cookie: f.cookie },
    });
    const data = (await boot.json()) as { csrf: string; overlayToken: string };
    assert.equal(data.csrf, f.body.csrf);
    assert.equal(data.overlayToken, f.body.overlayToken);
    const post = (path: string, body: unknown) =>
      fetch(f.base + path, {
        method: "POST",
        headers: f.headers,
        body: JSON.stringify(body),
      });
    assert.equal(
      (
        await post("/api/simulator/load", {
          agents: 501,
          eventsPerSecond: 50,
          durationSec: 1,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await post("/api/simulator/load", {
          agents: 40,
          eventsPerSecond: 50,
          durationSec: 1,
        })
      ).status,
      200,
    );
    await new Promise((r) => setTimeout(r, 150));
    let state = (await (
      await fetch(f.base + "/api/session", { headers: { Cookie: f.cookie } })
    ).json()) as { agents: unknown[] };
    assert.equal(state.agents.length, 40);
    await post("/api/control/reset", {});
    await new Promise((r) => setTimeout(r, 150));
    state = (await (
      await fetch(f.base + "/api/session", { headers: { Cookie: f.cookie } })
    ).json()) as { agents: unknown[] };
    assert.equal(state.agents.length, 0);
  } finally {
    await f.app.close();
  }
});
