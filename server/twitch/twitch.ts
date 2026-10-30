import tmi from "tmi.js";
import { z } from "zod";
import WebSocket from "ws";
import type { NormalizedEvent } from "../../shared/protocol.js";
export const TWITCH_SCOPES = [
  "chat:read",
  "channel:read:subscriptions",
  "bits:read",
];
type Base = { sessionId: string; channelId: string };
export function normalizeIRC(
  base: Base,
  tags: Record<string, unknown>,
  text: string,
  now = Date.now(),
): NormalizedEvent | null {
  if (typeof tags["user-id"] !== "string" || typeof tags.id !== "string")
    return null;
  const timestamp = Number(tags["tmi-sent-ts"]);
  return {
    ...base,
    id: tags.id,
    source: "irc",
    kind: "chat",
    viewerId: tags["user-id"],
    displayName: String(
      tags["display-name"] ?? tags.username ?? "Viewer",
    ).slice(0, 64),
    occurredAt: Number.isFinite(timestamp) ? timestamp : now,
    receivedAt: now,
    payload: { text },
  };
}
interface Notification {
  metadata?: {
    message_id?: string;
    message_timestamp?: string;
    message_type?: string;
  };
  payload?: {
    subscription?: { type?: string; status?: string };
    event?: Record<string, unknown>;
    session?: {
      id?: string;
      keepalive_timeout_seconds?: number;
      reconnect_url?: string;
    };
  };
}
export function normalizeEventSub(
  base: Base,
  n: Notification,
  now = Date.now(),
): NormalizedEvent | null {
  const e = n.payload?.event,
    type = n.payload?.subscription?.type,
    id = n.metadata?.message_id;
  if (!e || !id) return null;
  const kind =
    type === "channel.subscribe"
      ? "sub"
      : type === "channel.cheer"
        ? "cheer"
        : type === "channel.raid"
          ? "raid"
          : null;
  if (!kind) return null;
  return {
    ...base,
    id,
    source: "eventsub",
    kind,
    viewerId: String(
      e.user_id ?? e.from_broadcaster_user_id ?? `anonymous:${id}`,
    ),
    displayName: String(
      e.user_name ?? e.from_broadcaster_user_name ?? "Anonymous",
    ).slice(0, 64),
    occurredAt: Date.parse(n.metadata?.message_timestamp ?? "") || now,
    receivedAt: now,
    payload: {
      count: kind === "sub" ? 1 : Number(kind === "raid" ? e.viewers : e.bits),
    },
  };
}
interface HelixOptions {
  base?: string;
  fetcher?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}
export class Helix {
  constructor(
    private clientId: string,
    private token: string,
    private options: HelixOptions = {},
  ) {}
  async call(path: string, body?: unknown): Promise<unknown> {
    const request = this.options.fetcher ?? fetch;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await request(
        `${this.options.base ?? "https://api.twitch.tv/helix"}${path}`,
        {
          method: body ? "POST" : "GET",
          headers: {
            "Client-Id": this.clientId,
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(5000),
        },
      );
      if (r.status === 401 || r.status === 403) throw new Error("twitch-auth");
      if (r.status === 429 && attempt < 2) {
        const ms = Math.max(
          0,
          Number(r.headers.get("Ratelimit-Reset") ?? 0) * 1000 - Date.now(),
        );
        if (ms > 30000) throw new Error("twitch-rate-limit");
        await (
          this.options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
        )(ms);
        continue;
      }
      if (!r.ok) throw new Error(`twitch-http-${r.status}`);
      return r.json();
    }
    throw new Error("twitch-rate-limit");
  }
  async user() {
    const b = (await this.call("/users")) as {
      data: { id: string; login: string }[];
    };
    if (!b.data?.[0]?.id) throw new Error("twitch-user");
    return b.data[0];
  }
  async subscribe(type: string, channelId: string, sessionId: string) {
    return this.call("/eventsub/subscriptions", {
      type,
      version: "1",
      condition:
        type === "channel.raid"
          ? { to_broadcaster_user_id: channelId }
          : { broadcaster_user_id: channelId },
      transport: { method: "websocket", session_id: sessionId },
    });
  }
}
interface EventSubOptions {
  url?: string;
  allowLocal?: boolean;
  subscribe: (sessionId: string) => Promise<void>;
  onEvent: (n: Notification) => void;
  onHealth: (state: string) => void;
  onRevoked?: () => void;
  retryMs?: number;
}
export class EventSub {
  private sockets = new Set<WebSocket>();
  private current?: WebSocket;
  private watchdog?: ReturnType<typeof setTimeout>;
  private retry?: ReturnType<typeof setTimeout>;
  private stopped = true;
  private attempts = 0;
  constructor(private options: EventSubOptions) {}
  start() {
    this.stop();
    this.stopped = false;
    this.connect(this.options.url ?? "wss://eventsub.wss.twitch.tv/ws", false);
  }
  private validURL(url: string) {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return false;
    }
    return (
      (u.protocol === "wss:" && u.hostname === "eventsub.wss.twitch.tv") ||
      (this.options.allowLocal &&
        u.protocol === "ws:" &&
        u.hostname === "127.0.0.1")
    );
  }
  private connect(url: string, handoff: boolean) {
    if (this.stopped || !this.validURL(url)) {
      this.options.onHealth("invalid-reconnect");
      return;
    }
    const old = this.current,
      ws = new WebSocket(url, { maxPayload: 65536 });
    this.sockets.add(ws);
    this.options.onHealth(handoff ? "reconnecting" : "connecting");
    let welcomed = false;
    let keepalive = 10000;
    const arm = () => {
      if (this.current === ws) {
        clearTimeout(this.watchdog);
        this.watchdog = setTimeout(() => {
          this.options.onHealth("keepalive-expired");
          ws.terminate();
        }, keepalive + 1000);
      }
    };
    const welcomeTimer = setTimeout(() => ws.terminate(), 10000);
    ws.on("message", async (data) => {
      if (this.stopped) return;
      let n: Notification;
      try {
        n = JSON.parse(data.toString());
      } catch {
        this.options.onHealth("invalid-message");
        return;
      }
      const type = n.metadata?.message_type;
      if (type === "session_welcome" && !welcomed) {
        welcomed = true;
        clearTimeout(welcomeTimer);
        this.current = ws;
        keepalive =
          Math.min(
            600,
            Math.max(1, n.payload?.session?.keepalive_timeout_seconds ?? 10),
          ) * 1000;
        arm();
        try {
          if (!handoff) {
            const id = n.payload?.session?.id;
            if (!id) throw new Error("session");
            await this.options.subscribe(id);
          }
          if (this.stopped || this.current !== ws) return;
          this.attempts = 0;
          this.options.onHealth("connected");
          if (handoff && old && old !== ws) old.close();
        } catch {
          this.options.onHealth("subscription-failed");
          ws.close();
        }
        return;
      }
      if (this.current !== ws) return;
      arm();
      if (type === "session_reconnect") {
        const url = n.payload?.session?.reconnect_url;
        if (url) this.connect(url, true);
      }
      if (type === "notification") this.options.onEvent(n);
      if (type === "revocation") {
        this.options.onHealth("revoked");
        this.options.onRevoked?.();
        this.stop();
      }
    });
    ws.on("error", () => this.options.onHealth("socket-error"));
    ws.on("close", () => {
      clearTimeout(welcomeTimer);
      this.sockets.delete(ws);
      if (this.stopped || (this.current && this.current !== ws)) return;
      clearTimeout(this.watchdog);
      if (this.current === ws) this.current = undefined;
      this.options.onHealth("disconnected");
      this.retry = setTimeout(
        () =>
          this.connect(
            this.options.url ?? "wss://eventsub.wss.twitch.tv/ws",
            false,
          ),
        this.options.retryMs ??
          Math.min(30000, 1000 * 2 ** Math.min(5, this.attempts++)) +
            Math.random() * 250,
      );
    });
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.watchdog);
    clearTimeout(this.retry);
    for (const ws of this.sockets) ws.terminate();
    this.sockets.clear();
    this.current = undefined;
  }
}
export interface Credentials {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string[];
}
export interface TwitchConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  channel?: string;
  authBase?: string;
  helixBase?: string;
  eventSubUrl?: string;
  allowLocal?: boolean;
  ircOptions?: tmi.Options;
}
export class TwitchConnection {
  health = {
    irc: "disconnected",
    eventsub: "disconnected",
    helix: "disconnected",
  };
  private irc?: tmi.Client;
  private es?: EventSub;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private validationTimer?: ReturnType<typeof setInterval>;
  private credentials?: Credentials;
  private active = false;
  private generation = 0;
  constructor(
    private config: TwitchConfig,
    private base: () => Base,
    private emit: (event: NormalizedEvent) => void,
    private owner: (userId: string) => void,
  ) {}
  async exchange(code: string) {
    const c = await this.token({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
    });
    await this.connect(c);
  }
  private async token(params: Record<string, string>): Promise<Credentials> {
    const r = await fetch(
      `${this.config.authBase ?? "https://id.twitch.tv/oauth2"}/token`,
      {
        method: "POST",
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          ...params,
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!r.ok) throw new Error("twitch-auth");
    return z
      .object({
        access_token: z.string().min(1),
        refresh_token: z.string().min(1),
        expires_in: z.number().int().positive(),
        scope: z.array(z.string()),
      })
      .parse(await r.json());
  }
  private async validate(token: string) {
    const r = await fetch(
      `${this.config.authBase ?? "https://id.twitch.tv/oauth2"}/validate`,
      {
        headers: { Authorization: `OAuth ${token}` },
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!r.ok) throw new Error("twitch-auth");
    const b = (await r.json()) as {
      client_id: string;
      user_id: string;
      scopes: string[];
    };
    if (
      b.client_id !== this.config.clientId ||
      !TWITCH_SCOPES.every((s) => b.scopes.includes(s))
    )
      throw new Error("twitch-scopes");
    return b;
  }
  async connect(c: Credentials) {
    await this.disconnect();
    this.active = true;
    const generation = this.generation;
    try {
      const valid = await this.validate(c.access_token);
      const helix = new Helix(this.config.clientId, c.access_token, {
        base: this.config.helixBase,
      });
      const user = await helix.user();
      if (
        user.id !== valid.user_id ||
        (this.config.channel &&
          user.login.toLowerCase() !== this.config.channel.toLowerCase())
      )
        throw new Error("channel-owner-required");
      if (!this.active || generation !== this.generation)
        throw new Error("cancelled");
      this.credentials = c;
      this.owner(user.id);
      this.health.helix = "connected";
      this.irc = new tmi.Client({
        ...this.config.ircOptions,
        identity: { username: user.login, password: `oauth:${c.access_token}` },
        channels: [user.login],
        connection: {
          reconnect: true,
          secure: true,
          ...this.config.ircOptions?.connection,
        },
      });
      this.irc.on("connected", () => {
        if (generation !== this.generation) return;
        this.health.irc = "joining";
      });
      this.irc.on("join", (_channel, _username, self) => {
        if (self && generation === this.generation)
          this.health.irc = "connected";
      });
      this.irc.on("disconnected", () => {
        if (generation !== this.generation) return;
        this.health.irc = "disconnected";
      });
      this.irc.on("message", (_channel, tags, text, self) => {
        if (self || !this.active || generation !== this.generation) return;
        const e = normalizeIRC(
          this.base(),
          tags as Record<string, unknown>,
          text,
        );
        if (e) this.emit(e);
      });
      this.health.irc = "connecting";
      void this.irc.connect().catch(() => {
        if (generation !== this.generation) return;
        this.health.irc = "auth-or-connection-failed";
      });
      this.es = new EventSub({
        url: this.config.eventSubUrl,
        allowLocal: this.config.allowLocal,
        subscribe: async (id) => {
          for (const type of [
            "channel.subscribe",
            "channel.cheer",
            "channel.raid",
          ])
            await helix.subscribe(type, user.id, id);
        },
        onEvent: (n) => {
          const e = normalizeEventSub(this.base(), n);
          if (e && this.active && generation === this.generation) this.emit(e);
        },
        onHealth: (s) => {
          if (generation !== this.generation) return;
          this.health.eventsub = s;
        },
        onRevoked: () => {
          void this.disconnect("revoked");
        },
      });
      this.es.start();
      this.refreshTimer = setTimeout(
        () => {
          void this.refresh();
        },
        Math.max(1000, (c.expires_in - 60) * 1000),
      );
      this.validationTimer = setInterval(() => {
        void this.validate(c.access_token).catch(() =>
          this.disconnect("revoked"),
        );
      }, 3600000);
    } catch {
      if (generation === this.generation)
        await this.disconnect("auth-or-connection-failed");
      throw new Error("twitch-connect-failed");
    }
  }
  private async refresh() {
    if (!this.active || !this.credentials) return;
    const generation = this.generation;
    try {
      const c = await this.token({
        grant_type: "refresh_token",
        refresh_token: this.credentials.refresh_token,
      });
      if (this.active && generation === this.generation) await this.connect(c);
    } catch {
      if (generation === this.generation)
        await this.disconnect("refresh-failed");
    }
  }
  async disconnect(reason = "disconnected") {
    this.active = false;
    this.generation++;
    clearTimeout(this.refreshTimer);
    clearInterval(this.validationTimer);
    this.credentials = undefined;
    this.es?.stop();
    this.es = undefined;
    const irc = this.irc;
    this.irc = undefined;
    if (irc) await irc.disconnect().catch(() => {});
    this.health = { irc: reason, eventsub: reason, helix: reason };
  }
}
