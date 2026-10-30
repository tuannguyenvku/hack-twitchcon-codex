import { z } from "zod";
export const EventSchema = z
  .object({
    id: z.string().min(1).max(200),
    sessionId: z.string().min(1).max(100),
    channelId: z.string().min(1).max(100),
    source: z.enum(["irc", "eventsub", "simulator"]),
    kind: z.enum(["chat", "sub", "raid", "cheer"]),
    viewerId: z.string().min(1).max(100),
    displayName: z.string().max(64),
    occurredAt: z.number().finite(),
    receivedAt: z.number().finite(),
    payload: z
      .object({
        text: z.string().max(500).optional(),
        count: z.number().int().min(1).max(1000000).optional(),
      })
      .strict(),
  })
  .strict();
export type NormalizedEvent = z.infer<typeof EventSchema>;
export const ScenarioSchema = z
  .object({
    scenario: z.enum(["boss", "chaos"]),
    difficulty: z.number().int().min(1).max(5),
    effect: z.enum(["shield", "haste", "slow"]),
    durationSec: z.number().int().min(5).max(15),
    headline: z.string().min(1).max(80),
  })
  .strict();
export type Scenario = z.infer<typeof ScenarioSchema>;
export type Decision = Scenario & { source: "Model" | "Rules"; reason: string };
export type Role = "attack" | "shield" | "heal";
export interface Agent {
  id: string;
  viewerId: string;
  displayName: string;
  role: Role;
  preference: Role | null;
  energy: number;
  health: number;
  contribution: number;
  lastSeenAt: number;
  lastActionAt: number;
  lastCommandAt: number;
}
export interface Round {
  id: string;
  status: "idle" | "open" | "resolving" | "resolved";
  openedAt: number;
  closesAt: number;
  winner?: "boss" | "chaos";
}
export interface ArenaState {
  sessionId: string;
  channelId: string;
  epoch: number;
  seq: number;
  mode: "Demo" | "Live";
  paused: boolean;
  round: Round;
  agents: Agent[];
  consensus: { boss: number; chaos: number };
  bossHp: number;
  effects: { id: string; kind: string; expiresAt: number }[];
  leaderboard: {
    viewerId: string;
    displayName: string;
    contribution: number;
  }[];
  director: { source: "Model" | "Rules"; reason: string };
  rules: { difficulty: number };
  metrics: {
    accepted: number;
    duplicates: number;
    invalid: number;
    dropped: number;
    cheers: number;
    subs: number;
    raids: number;
    actions: number;
    resolved: number;
    fallbacks: number;
  };
}
export interface Frame {
  v: 1;
  type: "snapshot" | "delta" | "health" | "error";
  sessionId: string;
  epoch: number;
  seq: number;
  payload: unknown;
}
