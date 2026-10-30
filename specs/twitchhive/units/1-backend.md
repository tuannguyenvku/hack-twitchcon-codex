# Unit — Backend and arena

**Can start when:** SPEC.md and DESIGN.md available.
**Responsible for:** Twitch adapters, identity, reducer, Director, HTTP/ws security.

**Tasks:**
- [ ] Implement shared schemas first; fake-clock unit tests; fixture integrations; real Twitch smoke.

**Contract:**
- Input: NormalizedEvent + validated controls.
- Output: Versioned state snapshots/deltas.

**Done when:** AC-1, AC-2, AC-3, AC-7 and backend AC-6 have implementation evidence for owned scope. Shared schemas belong to backend; UI consumes them without duplicating authority. Release integrates evidence, not mutable runtime state.
