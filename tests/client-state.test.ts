import { test } from "node:test";
import assert from "node:assert/strict";
import { Arena } from "../server/arena/arena.js";
import { acceptFrame, type PublicState } from "../client/state.js";
test("AC-7 frontend discards stale frames and requests snapshot on seq/session/epoch gaps", () => {
  const arena = new Arena();
  const s = {
    ...arena.snapshot(),
    health: {
      irc: "disconnected",
      eventsub: "disconnected",
      helix: "disconnected",
    },
  } as PublicState;
  const frame = (
    seq: number,
    type: "snapshot" | "delta" = "delta",
    sessionId = s.sessionId,
    epoch = s.epoch,
  ) => ({
    v: 1 as const,
    type,
    sessionId,
    epoch,
    seq,
    payload: { ...s, sessionId, epoch, seq },
  });
  assert.equal(acceptFrame(null, frame(0, "snapshot")).state?.seq, 0);
  assert.equal(acceptFrame(s, frame(8)).resync, true);
  assert.equal(acceptFrame(s, frame(1)).state?.seq, 1);
  assert.equal(acceptFrame(s, frame(1, "delta", "other")).resync, true);
  assert.equal(acceptFrame(s, frame(1, "delta", s.sessionId, 2)).resync, true);
  const fresh = { ...s, seq: 10 };
  assert.equal(acceptFrame(fresh, frame(1)).state?.seq, 10);
  assert.equal(acceptFrame(fresh, frame(20, "snapshot")).state?.seq, 20);
});
