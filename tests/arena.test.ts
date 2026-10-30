import { test } from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../server/arena/arena.js";
import { Director } from "../server/director/director.js";
import { event } from "./helpers.js";

test("AC-2 identity, aliases, command validation, cooldown and channel isolation", () => {
  let now = 10000;
  const a = new Arena({ now: () => now });
  assert.equal(a.ingest(event(a, "!join", "1")).ok, true);
  a.ingest(event(a, "!hive", "2"));
  assert.equal(a.snapshot().agents.length, 1);
  assert.equal(
    a.ingest({ ...event(a, "!join", "3"), channelId: "other" }).ok,
    false,
  );
  assert.equal(a.ingest(event(a, "!action fly", "4")).ok, false);
  a.openRound();
  assert.equal(a.ingest(event(a, "!action shield", "5")).ok, true);
  assert.equal(a.ingest(event(a, "!action heal", "6")).reason, "cooldown");
  now += 2000;
  assert.equal(a.ingest(event(a, "!action heal", "7")).ok, true);
  assert.equal(a.snapshot().agents[0].contribution, 2);
});
test("AC-3 votes replace, equal weight, tie order and one resolution; pause freezes effects", async () => {
  let now = 10000;
  const a = new Arena({ now: () => now });
  a.ingest(event(a, "!join", "1"));
  a.openRound();
  a.ingest(event(a, "!vote chaos", "2"));
  a.ingest(event(a, "!vote boss", "3"));
  a.ingest({ ...event(a, "", "4", "cheer"), payload: { count: 5000 } });
  assert.deepEqual(a.snapshot().consensus, { boss: 1, chaos: 0 });
  a.pause();
  now += 60000;
  a.tick();
  assert.equal(a.snapshot().round.status, "open");
  a.resume();
  now += 30000;
  await a.closeRound(new Director());
  const s = a.snapshot();
  assert.equal(s.round.winner, "boss");
  assert.equal(s.effects.filter((e) => e.id === s.round.id).length, 1);
  await a.closeRound(new Director());
  assert.equal(
    a.snapshot().effects.filter((e) => e.id === s.round.id).length,
    1,
  );
});
test("AC-3 autonomous agents act independently and stale Director completion cannot affect reset", async () => {
  let now = 10000;
  const a = new Arena({ now: () => now });
  a.ingest(event(a, "!join", "1"));
  a.openRound();
  now += 2000;
  a.tick();
  assert.equal(a.snapshot().agents[0].contribution, 1);
  let release!: (x: unknown) => void;
  const d = new Director({
    model: "fixture",
    key: "fixture",
    request: () => new Promise((r) => (release = r)),
  });
  const closing = a.closeRound(d);
  a.reset();
  release({
    scenario: "boss",
    difficulty: 1,
    effect: "haste",
    durationSec: 10,
    headline: "Go",
  });
  await closing;
  assert.equal(a.snapshot().effects.length, 0);
});
test("AC-7 duplicate, stale, malformed and wrong-mode events cannot mutate arena; bounded queue", () => {
  const a = new Arena({ now: () => 10000 });
  const e = event(a, "!join", "same");
  a.ingest(e);
  assert.equal(a.ingest(e).reason, "duplicate");
  assert.equal(
    a.ingest({ ...event(a, "!join", "old"), occurredAt: -60000 }).ok,
    false,
  );
  assert.equal(
    a.ingest({ ...event(a, "!join", "live"), source: "irc" }).ok,
    false,
  );
  assert.equal(
    a.ingest({ ...e, id: "bad", payload: { text: "x".repeat(501) } }).ok,
    false,
  );
  for (let i = 0; i < 2001; i++) a.enqueue(event(a, "!join", String(i)));
  assert.equal(a.queueSize, 2000);
  assert.equal(a.snapshot().metrics.dropped, 1);
});
test("AC-3 Director validates output, enforces timeout and budget, and records decision source", async () => {
  const ctx = { roundId: "r", agents: 1, bossHp: 100, difficulty: 2 };
  const d = new Director();
  assert.equal((await d.decide(ctx)).source, "Rules");
  const bad = new Director({
    key: "fixture",
    model: "fixture",
    request: async () => ({ effect: "execute" }),
  });
  assert.equal((await bad.decide(ctx)).source, "Rules");
  const good = new Director({
    key: "fixture",
    model: "fixture",
    budget: 1,
    request: async () => ({
      scenario: "chaos",
      difficulty: 2,
      effect: "haste",
      durationSec: 10,
      headline: "Go",
    }),
  });
  assert.equal((await good.decide(ctx)).source, "Model");
  assert.equal((await good.decide({ ...ctx, roundId: "r2" })).source, "Rules");
  const slow = new Director({
    key: "fixture",
    model: "fixture",
    timeoutMs: 5,
    request: () => new Promise(() => {}),
  });
  assert.equal((await slow.decide(ctx)).source, "Rules");
});

test("AC-3 in-flight Director waits while paused and resolves once after resume", async () => {
  const a = new Arena({ now: () => 10000 });
  a.openRound();
  let release!: (x: unknown) => void;
  const d = new Director({
    key: "fixture",
    model: "fixture",
    request: () => new Promise((r) => (release = r)),
  });
  const task = a.closeRound(d);
  a.pause();
  release({
    scenario: "chaos",
    difficulty: 3,
    effect: "slow",
    durationSec: 15,
    headline: "Chaos",
  });
  await task;
  assert.equal(a.snapshot().effects.length, 0);
  a.resume();
  a.finishResolution();
  assert.equal(a.snapshot().effects.length, 1);
  a.finishResolution();
  assert.equal(a.snapshot().metrics.resolved, 1);
});
test("AC-2 AC-7 500-agent cap, dormant eviction and equal vote replacement", () => {
  let n = 10000;
  const a = new Arena({ now: () => n });
  for (let i = 0; i < 500; i++)
    assert.equal(
      a.ingest(event(a, "!join", `join${i}`, "chat", `demo:${i}`)).ok,
      true,
    );
  assert.equal(
    a.ingest(event(a, "!join", "overflow", "chat", "demo:501")).reason,
    "capacity",
  );
  assert.equal(a.snapshot().agents.length, 500);
  n += 900001;
  assert.equal(
    a.ingest({ ...event(a, "!join", "new", "chat", "demo:501"), occurredAt: n })
      .ok,
    true,
  );
  assert.equal(a.snapshot().agents.length, 500);
});
test("AC-4 seeded simulator replay reproduces roles, consensus and contribution", async () => {
  const { replay } = await import("../server/arena/simulator.js");
  const a = new Arena({ now: () => 10000 }),
    b = new Arena({ now: () => 10000 });
  const x = replay(a, 42),
    y = replay(b, 42);
  assert.deepEqual(x.agents, y.agents);
  assert.deepEqual(x.consensus, y.consensus);
  assert.equal(x.metrics.actions, 20);
  assert.equal(x.metrics.raids, 1);
});

test("AC-3 arena buffs change gameplay and expire without external game control", async () => {
  let n = 10000;
  const a = new Arena({ now: () => n });
  a.ingest(event(a, "!join", "j"));
  a.openRound();
  await a.closeRound(new Director());
  a.openRound();
  const before = a.snapshot().bossHp;
  a.ingest(event(a, "!action attack", "a"));
  assert.equal(before - a.snapshot().bossHp, 15);
  n += 11000;
  a.tick();
  const old = a.snapshot().bossHp;
  a.ingest({ ...event(a, "!action attack", "b"), occurredAt: n });
  assert.equal(old - a.snapshot().bossHp, 10);
});

test("AC-7 backend load: 500 agents, 50 events/s over five simulated minutes, bounded reducer latency", async () => {
  const { performance } = await import("node:perf_hooks");
  let n = 10000;
  const a = new Arena({ now: () => n });
  for (let i = 0; i < 500; i++)
    a.ingest(event(a, "!join", `initial:${i}`, "chat", `demo:${i}`));
  a.openRound();
  const latencies: number[] = [];
  let index = 0;
  for (let batch = 0; batch < 3000; batch++) {
    n += 100;
    const start = performance.now();
    for (let i = 0; i < 5; i++) {
      const id = index++;
      a.enqueue({
        ...event(a, "!action attack", `load:${id}`, "chat", `demo:${id % 500}`),
        occurredAt: n,
        receivedAt: n,
      });
    }
    a.tick();
    const state = a.snapshot();
    latencies.push(performance.now() - start);
    if (state.round.status === "open" && n >= state.round.closesAt) {
      await a.closeRound(new Director());
      a.openRound();
    }
  }
  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  assert.equal(a.snapshot().agents.length, 500);
  assert.equal(a.queueSize, 0);
  assert.equal(a.snapshot().metrics.dropped, 0);
  assert.ok(p95 <= 250, `p95 ${p95}ms`);
  console.log(
    JSON.stringify({
      benchmark:
        "core reducer + snapshot (simulated clock, not five real minutes)",
      agents: 500,
      events: 15000,
      simulatedSeconds: 300,
      p95Ms: p95,
    }),
  );
});

test("AC-7 Live reset retains delivery deduplication across the new epoch", () => {
  const a = new Arena({ now: () => 10000 });
  a.reset("Live", "channel");
  const s = a.snapshot();
  const e = {
    ...event(a, "", "reward", "cheer", "viewer"),
    source: "eventsub",
    payload: { count: 10 },
  };
  assert.equal(a.ingest(e).ok, true);
  a.reset("Live", "channel");
  assert.equal(
    a.ingest({ ...e, sessionId: a.snapshot().sessionId }).reason,
    "duplicate",
  );
  assert.equal(a.snapshot().metrics.cheers, 0);
  assert.ok(a.snapshot().epoch > s.epoch);
});
