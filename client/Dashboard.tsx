import { useEffect, useRef, useState, type FormEvent } from "react";
import { Arena } from "./Arena";
import { overlayURL, request, type SessionInfo } from "./state";
import { useArena } from "./useArena";
interface Bootstrap extends SessionInfo {
  twitchConfigured: boolean;
  requiresOwnerToken: boolean;
}
export function Dashboard() {
  const [session, setSession] = useState<Bootstrap | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("Your audience is the main character."),
    [error, setError] = useState(false),
    [name, setName] = useState("Luna"),
    [command, setCommand] = useState("!join"),
    [seed, setSeed] = useState("42"),
    [difficulty, setDifficulty] = useState("2"),
    [ownerToken, setOwnerToken] = useState(""),
    [tab, setTab] = useState("Simulator"),
    [showSimulator, setShowSimulator] = useState(true);
  const { state, status } = useArena(!!session);
  const dialog = useRef<HTMLDialogElement>(null),
    cancel = useRef<HTMLButtonElement>(null),
    reset = useRef<HTMLButtonElement>(null),
    started = useRef(false);
  const [now, setNow] = useState(Date.now()),
    pausedAt = useRef(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (state?.paused && !pausedAt.current) pausedAt.current = Date.now();
    if (!state?.paused) pausedAt.current = 0;
  }, [state?.paused]);
  useEffect(() => {
    if (state?.mode === "Live") setTab("Insights");
  }, [state?.mode]);
  async function action(job: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(false);
    try {
      await job();
      setNotice(message);
    } catch (e) {
      setError(true);
      setNotice(
        e instanceof Error
          ? friendly(e.message)
          : "Could not complete this action. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    await action(async () => {
      const data = await request<Bootstrap>("/api/demo", {});
      setSession(data);
      sessionStorage.setItem("hive-started", "yes");
    }, "Demo ready. Send !join to meet your first agent.");
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (sessionStorage.getItem("hive-started")) void start();
  }, []);
  const post = (path: string, body: unknown = {}) =>
    request(path, body, session ?? undefined);
  const control = (path: string, body: unknown, message: string) =>
    action(() => post("/api/control/" + path, body), message);
  const online = !!session && status === "Connected";
  const disabled = busy || !online;
  const demo = state?.mode !== "Live";
  const send = (e: FormEvent) => {
    e.preventDefault();
    void action(
      () =>
        post("/api/simulator/events", {
          kind: "chat",
          viewerId: name.trim().toLowerCase(),
          displayName: name.trim(),
          text: command,
        }),
      `${name}: ${command} accepted`,
    );
  };
  const effect = (kind: string) =>
    action(
      () =>
        post("/api/simulator/events", {
          kind,
          viewerId: name.trim().toLowerCase(),
          displayName: name.trim(),
          count: kind === "cheer" ? 100 : kind === "raid" ? 25 : 1,
        }),
      `Demo ${kind} event sent. No real purchase or Twitch event.`,
    );
  const openReset = () => {
    dialog.current?.showModal();
    requestAnimationFrame(() => cancel.current?.focus());
  };
  const connect = () => {
    if (!session?.twitchConfigured) {
      setError(true);
      setNotice(
        "Twitch is not configured. Add the broadcaster app settings on the server, then restart. Demo is ready without credentials.",
      );
      return;
    }
    void action(async () => {
      const result = await request<{ url: string }>(
        "/auth/twitch/start",
        {},
        session,
        ownerToken,
      );
      setOwnerToken("");
      location.assign(result.url);
    }, "Opening Twitch authorization…");
  };
  const obsURL = session ? overlayURL(session.overlayToken) : "";
  const seconds =
    state?.round.status === "open"
      ? Math.max(
          0,
          Math.ceil(
            (state.round.closesAt -
              (state.paused ? pausedAt.current || now : now)) /
              1000,
          ),
        )
      : 0;
  return (
    <div className="dashboard">
      <a className="skip-link" href="#main">
        Skip to command deck
      </a>
      <header className="app-header">
        <a className="brand" href="/dashboard">
          <img src="/hive.svg" width="36" height="36" alt="" />
          <span>
            TwitchHive<small>ONE VIEWER. ONE AGENT.</small>
          </span>
        </a>
        <nav aria-label="Workspace">
          <a href="#main" aria-current="page">
            Command deck
          </a>
          <a href="#simulator">Live simulator</a>
        </nav>
        <div className="header-state">
          <span className="mode-badge">{state?.mode ?? "Demo"} mode</span>
          <span
            className={online ? "connection online" : "connection"}
            data-testid="connection-status"
          >
            {status}
          </span>
        </div>
      </header>
      <main id="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR STREAM, COLLECTIVELY</p>
            <h1>Let the hive take over.</h1>
            <p>Every viewer has a role. Every move shapes the arena.</p>
          </div>
          <div className="heading-actions">
            <span className="round-chip">
              <span data-testid="round-status">
                {state?.round.status ?? "idle"}
              </span>{" "}
              {seconds > 0 && <strong>{Math.min(30, seconds)}s</strong>}
            </span>
            <button
              type="button"
              className="secondary"
              aria-pressed={!showSimulator}
              onClick={() => setShowSimulator((prev) => !prev)}
            >
              {showSimulator ? "Hide simulator" : "Show simulator"}
            </button>
            <button
              className="primary"
              disabled={disabled}
              onClick={() =>
                void control(
                  state?.paused ? "resume" : "pause",
                  {},
                  state?.paused ? "Arena resumed" : "Arena paused",
                )
              }
            >
              {state?.paused ? "Resume arena" : "Pause arena"}
            </button>
          </div>
        </div>
        <div
          className={`notice ${error ? "notice-error" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span aria-hidden="true">{error ? "!" : "↗"}</span>
          {notice}
        </div>
        <div className={`deck-grid${showSimulator ? "" : " broadcast-view"}`}>
          <aside className="connection-panel">
            <div className="section-heading">
              <span className="eyebrow">01 / CONNECTION</span>
              <h2>Broadcast setup</h2>
            </div>
            <p className="muted">
              Start with a demo, then bring your own community.
            </p>
            <button
              className="primary full"
              onClick={() => void start()}
              disabled={busy || !!session}
            >
              Start Demo
            </button>
            <button
              className="secondary full"
              disabled={busy || !session || !demo}
              onClick={connect}
            >
              Connect Twitch <span aria-hidden="true">↗</span>
            </button>
            {session?.requiresOwnerToken && (
              <label>
                Streamer access token
                <input
                  type="password"
                  autoComplete="off"
                  value={ownerToken}
                  onChange={(e) => setOwnerToken(e.target.value)}
                  placeholder="Owner access only"
                />
              </label>
            )}
            <dl className="adapter-list">
              {(["irc", "eventsub", "helix"] as const).map((key) => (
                <div key={key}>
                  <dt>
                    {key === "irc"
                      ? "Chat IRC"
                      : key === "eventsub"
                        ? "EventSub"
                        : "Helix API"}
                  </dt>
                  <dd>
                    <span
                      className={
                        state?.health[key] === "connected"
                          ? "live-dot"
                          : "status-dot"
                      }
                    />
                    {state?.health[key] ?? "disconnected"}
                  </dd>
                </div>
              ))}
            </dl>
            {!demo && (
              <button
                disabled={disabled}
                className="secondary full"
                onClick={() =>
                  void control(
                    "disconnect",
                    {},
                    "Twitch disconnected. Clean Demo session ready.",
                  )
                }
              >
                Disconnect Twitch
              </button>
            )}
            <div className="obs-setup">
              <span className="eyebrow">ON YOUR BROADCAST</span>
              <h3>A window into the hive.</h3>
              <p>
                Add a Browser Source in OBS. Set it to 1920 × 1080 with a
                transparent background.
              </p>
              <button
                className="secondary full"
                disabled={!session}
                onClick={() =>
                  void action(async () => {
                    await navigator.clipboard.writeText(obsURL);
                  }, "OBS URL copied. Paste it into a Browser Source.")
                }
              >
                Copy OBS URL
              </button>
              {session && (
                <a
                  className="text-link"
                  href={obsURL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open overlay <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
            <div className="fair-play">
              <span aria-hidden="true">⬡</span>
              <strong>One viewer. Equal voice.</strong>
              <p>
                Bits and subs light up the arena. They never buy extra votes.
              </p>
            </div>
          </aside>
          <section className="arena-column" aria-label="Arena overview">
            <div className="preview-header">
              <span>
                <i className="live-dot" /> LIVE ARENA PREVIEW
              </span>
              <span>16:9 / OBS READY</span>
            </div>
            <div className="preview-wrap">
              <Arena state={state} status={status} preview />
              {!session && (
                <div className="preview-start">
                  <p>The stage is yours.</p>
                  <span>Start Demo to invite your first agent.</span>
                </div>
              )}
            </div>
            <div className="preview-footer">
              <span>△ Attack</span>
              <span>⬡ Shield</span>
              <span>+ Heal</span>
              <span>{state?.director.source ?? "Rules"} director</span>
            </div>
            <div className="metric-strip">
              <div>
                <span>VIEWER AGENTS</span>
                <strong data-testid="agent-count">
                  {state?.agents.length ?? 0}
                </strong>
                <small>Individual players, one hive</small>
              </div>
              <div>
                <span>COLLECTIVE MOVES</span>
                <strong>{state?.metrics.actions ?? 0}</strong>
                <small>Accepted agent contributions</small>
              </div>
              <div>
                <span>ROUNDS SHAPED</span>
                <strong>{state?.metrics.resolved ?? 0}</strong>
                <small>Community decisions resolved</small>
              </div>
            </div>
            <section className="director-panel">
              <div className="section-heading horizontal">
                <div>
                  <span className="eyebrow">THE NEXT CHAPTER</span>
                  <h2>Direct the energy.</h2>
                </div>
                <span className="subtle-tag">
                  {state?.director.source ?? "Rules"}
                  {state?.director.source !== "Model" ? " fallback" : ""}
                </span>
              </div>
              <p className="muted">
                Open a 30-second challenge. The hive chooses Boss or Chaos.
              </p>
              <div className="director-controls">
                <label>
                  Difficulty
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n} ·{" "}
                        {
                          ["Relaxed", "Balanced", "Lively", "Intense", "Wild"][
                            n - 1
                          ]
                        }
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary"
                  disabled={disabled}
                  onClick={() =>
                    void control(
                      "rules",
                      { difficulty: Number(difficulty) },
                      "Rules updated",
                    )
                  }
                >
                  Apply rules
                </button>
              </div>
              <div className="challenge-buttons">
                <button
                  className="primary"
                  disabled={
                    disabled ||
                    state?.paused ||
                    ["open", "resolving"].includes(state?.round.status ?? "")
                  }
                  onClick={() =>
                    void control(
                      "challenge",
                      { action: "open" },
                      "Challenge open. Ask chat to vote Boss or Chaos.",
                    )
                  }
                >
                  Open challenge
                </button>
                <button
                  className="secondary"
                  disabled={
                    disabled || state?.paused || state?.round.status !== "open"
                  }
                  onClick={() =>
                    void control(
                      "challenge",
                      { action: "close" },
                      "Round resolved. The hive has spoken.",
                    )
                  }
                >
                  Resolve round
                </button>
              </div>
              {!showSimulator && (
                <div className="session-footer">
                  <span>SESSION CONTROLS</span>
                  <button
                    className="danger-link"
                    disabled={disabled}
                    ref={reset}
                    onClick={openReset}
                  >
                    Reset arena
                  </button>
                </div>
              )}
            </section>
          </section>
          {showSimulator && (
            <section className="simulator-panel" id="simulator">
              <div className="section-heading">
                <span className="eyebrow">02 / PLAY WITH POSSIBILITIES</span>
                <h2>{demo ? "Live Twitch simulator" : "Live telemetry"}</h2>
              </div>
            <div className="tabs" role="tablist" aria-label="Simulator view">
              {["Simulator", "Insights"].map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  tabIndex={tab === t ? 0 : -1}
                  onKeyDown={(event) => {
                    if (
                      ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                        event.key,
                      )
                    ) {
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? "Simulator"
                          : event.key === "End"
                            ? "Insights"
                            : tab === "Simulator"
                              ? "Insights"
                              : "Simulator";
                      setTab(next);
                      requestAnimationFrame(() =>
                        document.getElementById(`tab-${next}`)?.focus(),
                      );
                    }
                  }}
                  aria-controls={`panel-${t}`}
                  id={`tab-${t}`}
                  onClick={() => setTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div
              id={`panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
            >
              {tab === "Simulator" ? (
                <>
                  <p className="muted">
                    Real pipeline. Simulated audience. No Twitch account needed.
                  </p>
                  <fieldset
                    disabled={disabled || !demo || state?.paused}
                    className="sim-fields"
                  >
                    <legend className="sr-only">Demo event controls</legend>
                    <form onSubmit={send}>
                      <label>
                        Viewer name
                        <input
                          maxLength={64}
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Viewer name"
                        />
                      </label>
                      <label>
                        Chat command
                        <select
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                        >
                          {[
                            "!join",
                            "!hive",
                            "!action attack",
                            "!action shield",
                            "!action heal",
                            "!vote boss",
                            "!vote chaos",
                          ].map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="primary full"
                        disabled={!name.trim()}
                        type="submit"
                      >
                        Send chat command <span aria-hidden="true">↗</span>
                      </button>
                    </form>
                    <div className="event-buttons">
                      {["sub", "raid", "cheer"].map((kind) => (
                        <button
                          key={kind}
                          className="event-button"
                          aria-label={`Trigger ${kind[0].toUpperCase() + kind.slice(1)}`}
                          onClick={() => void effect(kind)}
                        >
                          <span aria-hidden="true">
                            {kind === "sub" ? "+" : kind === "raid" ? "↗" : "✦"}
                          </span>
                          <span>
                            {kind === "sub"
                              ? "Sub"
                              : kind === "raid"
                                ? "Raid"
                                : "Cheer"}
                            <small>
                              {kind === "sub"
                                ? "Welcome spark"
                                : kind === "raid"
                                  ? "25 viewers"
                                  : "100 Bits"}
                            </small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <div className="replay-block">
                    <label>
                      Replay seed
                      <input
                        type="number"
                        min="0"
                        max="4294967295"
                        step="1"
                        value={seed}
                        onChange={(e) => setSeed(e.target.value)}
                      />
                    </label>
                    <button
                      className="secondary full"
                      disabled={
                        disabled ||
                        !demo ||
                        state?.paused ||
                        !seed ||
                        !Number.isInteger(Number(seed)) ||
                        Number(seed) < 0 ||
                        Number(seed) > 4294967295
                      }
                      onClick={() =>
                        void action(
                          () =>
                            post("/api/simulator/replay", {
                              seed: Number(seed),
                            }),
                          "Scenario replayed: 20 viewer agents, one shared challenge.",
                        )
                      }
                    >
                      Replay scenario
                    </button>
                    <p>Same seed, same roles and votes.</p>
                  </div>
                  <details className="load-tools">
                    <summary>Audience load test</summary>
                    <p>
                      Spawn 500 agents and 50 events/s for five minutes. Demo
                      only.
                    </p>
                    <button
                      className="secondary full"
                      disabled={disabled || !demo}
                      onClick={() =>
                        void action(
                          () =>
                            post("/api/simulator/load", {
                              agents: 500,
                              eventsPerSecond: 50,
                              durationSec: 300,
                            }),
                          "Audience load running: 500 agents / 50 events per second.",
                        )
                      }
                    >
                      Start audience load
                    </button>
                  </details>
                </>
              ) : (
                <div className="insights">
                  <h3>Participation, honestly.</h3>
                  <dl>
                    {[
                      ["Demo cheers", state?.metrics.cheers],
                      ["Demo subscriptions", state?.metrics.subs],
                      ["Raid events", state?.metrics.raids],
                      ["Rejected events", state?.metrics.invalid],
                      ["Duplicate deliveries", state?.metrics.duplicates],
                      ["Dropped events", state?.metrics.dropped],
                    ].map(([label, count]) => (
                      <div key={String(label)}>
                        <dt>
                          {String(label).replace("Demo", state?.mode ?? "Demo")}
                        </dt>
                        <dd>{count ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="muted">
                    These are session event counts, not measured watch-time or
                    revenue uplift.
                  </p>
                </div>
              )}
            </div>
            <div className="session-footer">
              <span>SESSION CONTROLS</span>
              <button
                className="danger-link"
                disabled={disabled}
                ref={reset}
                onClick={openReset}
              >
                Reset arena
              </button>
            </div>
          </section>
          )}
        </div>
      </main>
      <footer className="app-footer">
        <span>Built for the people behind the chat.</span>
        <span>TwitchHive / A collective kind of play</span>
      </footer>
      <dialog
        ref={dialog}
        onClose={() => reset.current?.focus()}
        aria-labelledby="reset-title"
      >
        <h2 id="reset-title">Reset this arena?</h2>
        <p>
          All agents, votes and effects in this session will be cleared. Your
          OBS URL stays connected.
        </p>
        <div className="dialog-actions">
          <button
            ref={cancel}
            className="secondary"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            className="primary"
            onClick={() => {
              dialog.current?.close();
              void control(
                "reset",
                {},
                "Arena reset. A fresh start for the hive.",
              );
            }}
          >
            Reset session
          </button>
        </div>
      </dialog>
    </div>
  );
}
function friendly(message: string) {
  const messages: Record<string, string> = {
    "round-closed": "Open a challenge before sending actions or votes.",
    "join-first": "Send !join for this viewer first.",
    cooldown: "This agent is catching its breath. Try again in two seconds.",
    "rate-limit":
      "Too many controls in one minute. Wait a moment, then try again.",
    "session-required":
      "Session expired. Reload the page and start a fresh Demo.",
    paused: "Resume the arena before sending another event.",
    "streamer-authorization":
      "Streamer access was denied. Check your owner token.",
    "twitch-not-configured":
      "Twitch settings are missing on the server. Demo still works.",
  };
  return (
    messages[message] ??
    `Action could not finish: ${message.replaceAll("-", " ")}.`
  );
}
