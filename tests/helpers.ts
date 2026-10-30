import type { Arena } from "../server/arena/arena.js";
export function event(
  a: Arena,
  text: string,
  id: string,
  kind = "chat",
  viewerId = "demo:viewer",
) {
  const s = a.snapshot();
  return {
    id,
    sessionId: s.sessionId,
    channelId: s.channelId,
    source: "simulator",
    kind,
    viewerId,
    displayName: "Viewer",
    occurredAt: 10000,
    receivedAt: 10000,
    payload: kind === "chat" ? { text } : { count: 1 },
  };
}
