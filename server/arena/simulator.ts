import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Arena } from "./arena.js";
export const TriggerSchema = z
  .object({
    kind: z.enum(["chat", "sub", "raid", "cheer"]),
    viewerId: z.string().min(1).max(80),
    displayName: z.string().max(64).default("Demo viewer"),
    text: z.string().max(500).optional(),
    count: z.number().int().min(1).max(1000000).default(1),
  })
  .strict();
export function trigger(
  arena: Arena,
  input: unknown,
  id: string = randomUUID(),
) {
  const t = TriggerSchema.parse(input);
  const s = arena.snapshot();
  if (s.mode !== "Demo") throw new Error("demo-only");
  const n = arena.now();
  return arena.ingest({
    id,
    sessionId: s.sessionId,
    channelId: s.channelId,
    source: "simulator",
    kind: t.kind,
    viewerId: `demo:${t.viewerId}`,
    displayName: t.displayName,
    occurredAt: n,
    receivedAt: n,
    payload: t.kind === "chat" ? { text: t.text ?? "" } : { count: t.count },
  });
}
export function replay(arena: Arena, seed: number, viewers = 20) {
  if (arena.snapshot().mode !== "Demo") throw new Error("demo-only");
  arena.reset("Demo", "demo");
  arena.openRound();
  let rng = seed >>> 0;
  for (let i = 0; i < Math.max(1, Math.min(500, viewers)); i++) {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    const viewerId = String(i),
      role = ["attack", "shield", "heal"][rng % 3];
    for (const [j, text] of [
      "!join",
      `!action ${role}`,
      `!vote ${rng % 2 ? "boss" : "chaos"}`,
    ].entries())
      trigger(
        arena,
        { kind: "chat", viewerId, displayName: `Viewer ${i + 1}`, text },
        `replay:${seed}:${i}:${j}`,
      );
  }
  for (const kind of ["sub", "raid", "cheer"])
    trigger(
      arena,
      { kind, viewerId: "0", count: 10 },
      `replay:${seed}:${kind}`,
    );
  return arena.snapshot();
}
