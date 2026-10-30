import { randomUUID } from "node:crypto";
import {
  EventSchema,
  type ArenaState,
  type Agent,
  type NormalizedEvent,
  type Role,
} from "../../shared/protocol.js";
import { Director } from "../director/director.js";
export class Arena {
  private state!: ArenaState;
  private agents = new Map<string, Agent>();
  private votes = new Map<string, "boss" | "chaos">();
  private seen = new Map<string, number>();
  private queue: NormalizedEvent[] = [];
  private pausedAt = 0;
  private lastTick = 0;
  readonly now: () => number;
  constructor(options: { now?: () => number; channelId?: string } = {}) {
    this.now = options.now ?? Date.now;
    this.reset("Demo", options.channelId ?? "demo");
  }
  reset(
    mode: "Demo" | "Live" = this.state?.mode ?? "Demo",
    channelId = this.state?.channelId ?? "demo",
  ) {
    const epoch = (this.state?.epoch ?? 0) + 1;
    this.pending = undefined;
    this.agents.clear();
    this.votes.clear();
    if (
      this.state?.mode !== "Live" ||
      mode !== "Live" ||
      this.state.channelId !== channelId
    )
      this.seen.clear();
    this.queue = [];
    this.lastTick = this.now();
    this.state = {
      sessionId: randomUUID(),
      channelId,
      epoch,
      seq: 0,
      mode,
      paused: false,
      round: { id: randomUUID(), status: "idle", openedAt: 0, closesAt: 0 },
      agents: [],
      consensus: { boss: 0, chaos: 0 },
      bossHp: 10000,
      effects: [],
      leaderboard: [],
      director: { source: "Rules", reason: "not-configured" },
      rules: { difficulty: 2 },
      metrics: {
        accepted: 0,
        duplicates: 0,
        invalid: 0,
        dropped: 0,
        cheers: 0,
        subs: 0,
        raids: 0,
        actions: 0,
        resolved: 0,
        fallbacks: 0,
      },
    };
  }
  get queueSize() {
    return this.queue.length;
  }
  snapshot(): ArenaState {
    return structuredClone({
      ...this.state,
      agents: [...this.agents.values()],
      leaderboard: [...this.agents.values()]
        .sort(
          (a, b) =>
            b.contribution - a.contribution ||
            a.viewerId.localeCompare(b.viewerId),
        )
        .slice(0, 5)
        .map(({ viewerId, displayName, contribution }) => ({
          viewerId,
          displayName,
          contribution,
        })),
    });
  }
  private changed() {
    this.state.seq++;
  }
  private reject(reason: string) {
    this.state.metrics.invalid++;
    this.changed();
    return { ok: false, reason };
  }
  enqueue(input: unknown) {
    const p = EventSchema.safeParse(input);
    if (!p.success) return this.reject("invalid");
    if (
      p.data.kind === "chat" &&
      !p.data.payload.text?.trim().startsWith("!")
    ) {
      const prior = this.queue.findIndex(
        (e) =>
          e.kind === "chat" &&
          e.viewerId === p.data.viewerId &&
          !e.payload.text?.trim().startsWith("!"),
      );
      if (prior >= 0) {
        this.queue[prior] = p.data;
        return { ok: true };
      }
    }
    if (this.queue.length >= 2000) {
      this.state.metrics.dropped++;
      this.changed();
      return { ok: false, reason: "queue-full" };
    }
    this.queue.push(p.data);
    return { ok: true };
  }
  drain() {
    const batch = this.queue.splice(0, 2000);
    for (const e of batch) this.ingest(e);
  }
  ingest(input: unknown): { ok: boolean; reason?: string } {
    const p = EventSchema.safeParse(input);
    if (!p.success) return this.reject("invalid");
    const e = p.data,
      n = this.now();
    if (
      e.sessionId !== this.state.sessionId ||
      e.channelId !== this.state.channelId
    )
      return this.reject("session");
    if ((this.state.mode === "Demo") !== (e.source === "simulator"))
      return this.reject("mode");
    if (this.state.mode === "Demo" && !e.viewerId.startsWith("demo:"))
      return this.reject("identity");
    if (e.occurredAt < n - 60000 || e.occurredAt > n + 10000)
      return this.reject("stale");
    for (const [id, t] of this.seen) {
      if (t < n - 600000) this.seen.delete(id);
      else break;
    }
    if (this.seen.has(e.id)) {
      this.state.metrics.duplicates++;
      this.changed();
      return { ok: false, reason: "duplicate" };
    }
    this.seen.set(e.id, n);
    if (this.seen.size > 10000)
      this.seen.delete(this.seen.keys().next().value!);
    if (this.state.paused) return this.reject("paused");
    if (e.kind !== "chat") {
      if (!e.payload.count) return this.reject("count");
      if (e.kind === "raid") this.state.metrics.raids++;
      if (e.kind === "sub") this.state.metrics.subs++;
      if (e.kind === "cheer") this.state.metrics.cheers++;
      this.state.effects.push({ id: e.id, kind: e.kind, expiresAt: n + 10000 });
      this.state.effects = this.state.effects.slice(-100);
      this.state.metrics.accepted++;
      this.changed();
      return { ok: true };
    }
    const text = (e.payload.text ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    const [command, arg, ...extra] = text.split(" ");
    const id = `${e.channelId}:${e.viewerId}`;
    let agent = this.agents.get(id);
    if (command === "!join" || command === "!hive") {
      if (arg) return this.reject("invalid-command");
      if (!agent) {
        if (this.agents.size >= 500) {
          const dormant = [...this.agents.values()]
            .filter((a) => a.lastSeenAt < n - 900000)
            .sort((a, b) => a.lastSeenAt - b.lastSeenAt)[0];
          if (!dormant) return this.reject("capacity");
          this.agents.delete(dormant.id);
          this.votes.delete(dormant.id);
          this.recount();
        }
        agent = {
          id,
          viewerId: e.viewerId,
          displayName: e.displayName,
          role: "attack",
          preference: null,
          energy: 100,
          health: 100,
          contribution: 0,
          lastSeenAt: n,
          lastActionAt: 0,
          lastCommandAt: -Number.MAX_SAFE_INTEGER,
        };
        this.agents.set(id, agent);
      }
      agent.lastSeenAt = n;
      this.state.metrics.accepted++;
      this.changed();
      return { ok: true };
    }
    if (!text.startsWith("!")) return { ok: true };
    if (!agent) return this.reject("join-first");
    if (extra.length || !["!action", "!vote"].includes(command))
      return this.reject("invalid-command");
    if (this.state.round.status !== "open" || n >= this.state.round.closesAt)
      return this.reject("round-closed");
    if (command === "!vote") {
      if (arg !== "boss" && arg !== "chaos") return this.reject("invalid-vote");
      this.votes.set(id, arg);
      this.recount();
    } else {
      if (!["attack", "shield", "heal"].includes(arg))
        return this.reject("invalid-action");
      if (n - agent.lastCommandAt < 2000) return this.reject("cooldown");
      if (agent.energy < 10) return this.reject("energy");
      agent.preference = arg as Role;
      agent.lastCommandAt = n;
      this.act(agent, arg as Role, n);
    }
    agent.lastSeenAt = n;
    this.state.metrics.accepted++;
    this.changed();
    return { ok: true };
  }
  private recount() {
    this.state.consensus = { boss: 0, chaos: 0 };
    for (const v of this.votes.values()) this.state.consensus[v]++;
  }
  private activeEffect(kind: string, n: number) {
    return this.state.effects.some(
      (e) => e.kind.endsWith(`:${kind}`) && e.expiresAt > n,
    );
  }
  private act(a: Agent, role: Role, n: number) {
    a.energy -= 10;
    a.role = role;
    a.lastActionAt = n;
    a.contribution++;
    this.state.metrics.actions++;
    if (role === "attack")
      this.state.bossHp = Math.max(
        0,
        this.state.bossHp -
          (this.activeEffect("haste", n)
            ? 15
            : this.activeEffect("slow", n)
              ? 5
              : 10),
      );
    else if (role === "heal") {
      const ally = [...this.agents.values()].find((x) => x.health < 100);
      if (ally) ally.health = Math.min(100, ally.health + 10);
    } else a.health = Math.min(100, a.health + 5);
  }
  openRound() {
    if (
      this.state.paused ||
      ["open", "resolving"].includes(this.state.round.status)
    )
      throw new Error("round-state");
    const n = this.now();
    this.votes.clear();
    this.recount();
    this.state.round = {
      id: randomUUID(),
      status: "open",
      openedAt: n,
      closesAt: n + 30000,
    };
    this.changed();
  }
  pause() {
    if (!this.state.paused) {
      this.pausedAt = this.now();
      this.state.paused = true;
      this.changed();
    }
  }
  resume() {
    if (this.state.paused) {
      const shift = this.now() - this.pausedAt;
      this.state.round.closesAt += shift;
      for (const e of this.state.effects) e.expiresAt += shift;
      for (const a of this.agents.values()) a.lastActionAt += shift;
      this.lastTick = this.now();
      this.state.paused = false;
      this.changed();
    }
  }
  rules(difficulty: number) {
    if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5)
      throw new Error("rules");
    this.state.rules = { difficulty };
    this.changed();
  }
  tick() {
    this.drain();
    if (this.state.paused) return;
    const n = this.now();
    if (n - this.lastTick >= 2000) {
      this.lastTick = n;
      if (
        this.state.round.status === "open" &&
        n < this.state.round.closesAt &&
        !this.activeEffect("shield", n)
      ) {
        for (const a of this.agents.values())
          a.health = Math.max(0, a.health - this.state.rules.difficulty);
      }
      for (const a of this.agents.values()) {
        a.energy = Math.min(100, a.energy + 5);
        if (
          this.state.round.status === "open" &&
          n < this.state.round.closesAt &&
          n - a.lastActionAt >= 2000 &&
          n - a.lastSeenAt <= 900000 &&
          a.energy >= 10
        ) {
          const all = [...this.agents.values()];
          const role =
            a.preference ??
            (all.reduce((s, x) => s + x.health, 0) / all.length < 40
              ? "shield"
              : all.some((x) => x.health < 100)
                ? "heal"
                : "attack");
          this.act(a, role, n);
        }
      }
      this.changed();
    }
    const effects = this.state.effects.filter((e) => e.expiresAt > n);
    if (effects.length !== this.state.effects.length) {
      this.state.effects = effects;
      this.changed();
    }
  }
  async closeRound(director: Director) {
    if (this.state.round.status !== "open" || this.state.paused) return;
    const { sessionId, epoch } = this.state,
      round = this.state.round;
    round.status = "resolving";
    this.changed();
    const decision = await director.decide({
      roundId: round.id,
      agents: this.agents.size,
      bossHp: this.state.bossHp,
      difficulty: this.state.rules.difficulty,
    });
    if (
      this.state.sessionId !== sessionId ||
      this.state.epoch !== epoch ||
      this.state.round.id !== round.id
    )
      return;
    // Resolution waits for resume; it may never publish an effect during pause.
    this.pending = { decision, roundId: round.id };
    this.finishResolution();
  }
  private pending?: {
    decision: Awaited<ReturnType<Director["decide"]>>;
    roundId: string;
  };
  finishResolution() {
    if (!this.pending || this.state.paused) return;
    const { decision, roundId } = this.pending;
    this.pending = undefined;
    if (this.state.round.id !== roundId) return;
    const winner =
      this.state.consensus.chaos > this.state.consensus.boss ? "chaos" : "boss";
    this.state.round.status = "resolved";
    this.state.round.winner = winner;
    this.state.director = { source: decision.source, reason: decision.reason };
    this.state.effects.push({
      id: roundId,
      kind: `${winner}:${decision.effect}`,
      expiresAt: this.now() + Math.min(15, decision.durationSec) * 1000,
    });
    this.state.metrics.resolved++;
    if (decision.source === "Rules") this.state.metrics.fallbacks++;
    this.changed();
  }
}
