import type { ArenaState, Frame } from "../shared/protocol.js";
export type PublicState = ArenaState & {
  health: Record<"irc" | "eventsub" | "helix", string>;
};
export interface SessionInfo {
  csrf: string;
  overlayToken: string;
  expiresAt: number;
}
export function acceptFrame(
  current: PublicState | null,
  frame: Frame,
): { state: PublicState | null; resync: boolean } {
  if (frame.v !== 1 || !["snapshot", "delta"].includes(frame.type))
    return { state: current, resync: false };
  const next = frame.payload as PublicState;
  if (
    !next ||
    !Array.isArray(next.agents) ||
    next.sessionId !== frame.sessionId ||
    next.epoch !== frame.epoch ||
    next.seq !== frame.seq
  )
    return { state: current, resync: true };
  if (frame.type === "snapshot") {
    if (
      current &&
      current.sessionId === frame.sessionId &&
      frame.seq < current.seq
    )
      return { state: current, resync: false };
    return { state: next, resync: false };
  }
  if (
    !current ||
    current.sessionId !== frame.sessionId ||
    current.epoch !== frame.epoch ||
    frame.seq > current.seq + 1
  )
    return { state: current, resync: true };
  return { state: frame.seq > current.seq ? next : current, resync: false };
}
export function overlayURL(token: string) {
  return `${location.origin}/overlay#token=${encodeURIComponent(token)}`;
}
export async function request<T>(
  path: string,
  body?: unknown,
  session?: SessionInfo,
  ownerToken?: string,
): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(session ? { "X-CSRF-Token": session.csrf } : {}),
      ...(ownerToken ? { Authorization: `Bearer ${ownerToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(
      data.reason ?? data.error ?? `Request failed (${res.status})`,
    );
  return data as T;
}
