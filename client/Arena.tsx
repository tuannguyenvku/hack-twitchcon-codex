import { useEffect, useRef, useState } from "react";
import type { PublicState } from "./state";
const colors = {
  background: "#0F172A",
  surface: "#1E293B",
  text: "#F8FAFC",
  secondary: "#CBD5E1",
  amber: "#FBBF24",
  green: "#86EFAC",
  purple: "#C4B5FD",
  red: "#FDA4AF",
  neutral: "#64748B",
};
interface Metrics {
  frames: number;
  intervals: number[];
  draws: number[];
  latencies: number[];
  agents: number;
  lastPaintSeq: number;
}
declare global {
  interface Window {
    __hiveMetrics?: Metrics;
  }
}
export function Arena({
  state,
  status,
  preview = false,
}: {
  state: PublicState | null;
  status: string;
  preview?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    latest = useRef(state),
    paused = useRef(false),
    reduced = useRef(false),
    statusRef = useRef(status),
    receivedAt = useRef(performance.now());
  const [clock, setClock] = useState(Date.now());
  const pauseClock = useRef(0);
  useEffect(() => {
    if (state?.paused && !pauseClock.current) pauseClock.current = Date.now();
    if (!state?.paused) pauseClock.current = 0;
  }, [state?.paused]);
  useEffect(() => {
    latest.current = state;
    receivedAt.current = performance.now();
    paused.current = state?.paused ?? false;
  }, [state]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas?.getContext("2d", { alpha: true });
    if (!canvas || !ctx) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => {
      reduced.current = media.matches;
    };
    updateMotion();
    media.addEventListener("change", updateMotion);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * scale);
      canvas.height = Math.round(rect.height * scale);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    let frame = 0,
      last = 0,
      phase = 0,
      lastClock = 0;
    const positions = new Map<string, { x: number; y: number }>();
    const instrument =
      new URLSearchParams(location.search).get("metrics") === "1";
    const metrics: Metrics = {
      frames: 0,
      intervals: [],
      draws: [],
      latencies: [],
      agents: 0,
      lastPaintSeq: -1,
    };
    if (instrument) window.__hiveMetrics = metrics;
    const draw = (time: number) => {
      const start = performance.now(),
        s = latest.current,
        stale = statusRef.current !== "Connected";
      const dt = lastClock ? Math.min(50, time - lastClock) : 0;
      lastClock = time;
      if (!paused.current && !reduced.current && !stale) phase += dt;
      ctx.setTransform(canvas.width / 1920, 0, 0, canvas.height / 1080, 0, 0);
      ctx.clearRect(0, 0, 1920, 1080);
      // A sparse hexagonal field; transparent cells keep the underlying stream visible.
      ctx.strokeStyle = colors.neutral;
      ctx.globalAlpha = 0.12;
      ctx.lineWidth = 1;
      for (let row = 0; row < 9; row++)
        for (let col = 0; col < 19; col++) {
          const x = 80 + col * 76 + (row % 2) * 38,
            y = 270 + row * 76;
          hex(ctx, x, y, 37);
          ctx.stroke();
        }
      ctx.globalAlpha = 1;
      const chaos =
          s?.round.winner === "chaos" && s.round.status === "resolved",
        count = s?.agents.length ?? 0;
      if (s && s.round.status !== "idle") {
        const x = 860,
          y = 470 + Math.sin(phase / 1300) * 8;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(phase / 14000);
        ctx.fillStyle = colors.surface;
        ctx.strokeStyle = chaos ? colors.purple : colors.amber;
        ctx.lineWidth = 4;
        hex(ctx, 0, 0, 116);
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-phase / 14000);
        ctx.fillStyle = colors.text;
        ctx.font = "700 36px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(chaos ? "CHAOS" : "HIVE BOSS", 0, 6);
        ctx.font = "24px Inter, sans-serif";
        ctx.fillStyle = colors.secondary;
        ctx.fillText(`${s.bossHp.toLocaleString()} HP`, 0, 48);
        ctx.restore();
        const fill = Math.max(0, Math.min(1, s.bossHp / 10000));
        ctx.fillStyle = colors.surface;
        ctx.fillRect(690, 620, 340, 8);
        ctx.fillStyle = chaos ? colors.purple : colors.amber;
        ctx.fillRect(690, 620, 340 * fill, 8);
      }
      const ids = new Set<string>();
      for (let i = 0; i < count; i++) {
        const a = s!.agents[i];
        ids.add(a.id);
        const angle = i * 2.39996323 + phase / 80000,
          radius = 170 + Math.sqrt(i / Math.max(count, 1)) * 240;
        const x = 860 + Math.cos(angle) * radius * 1.4,
          y = 490 + Math.sin(angle) * radius * 0.75;
        let pos = positions.get(a.id);
        if (!pos) {
          pos = { x, y };
          positions.set(a.id, pos);
        }
        const smooth =
          reduced.current || stale || paused.current
            ? 1
            : Math.min(1, dt / 110);
        if (!paused.current && !stale) {
          pos.x += (x - pos.x) * smooth;
          pos.y += (y - pos.y) * smooth;
        }
        const size = count > 100 ? 8 : 15;
        const color =
          a.role === "attack"
            ? colors.red
            : a.role === "shield"
              ? colors.purple
              : colors.green;
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (a.role === "shield") {
          hex(ctx, pos.x, pos.y, size);
        } else if (a.role === "heal") {
          ctx.rect(pos.x - size, pos.y - 3, size * 2, 6);
          ctx.rect(pos.x - 3, pos.y - size, 6, size * 2);
        } else {
          ctx.moveTo(pos.x, pos.y - size);
          ctx.lineTo(pos.x + size, pos.y + size);
          ctx.lineTo(pos.x - size, pos.y + size);
          ctx.closePath();
        }
        ctx.fill();
        if (count < 30 && i < 5) {
          ctx.font = "20px Inter,sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = colors.text;
          ctx.fillText(a.displayName.slice(0, 16), pos.x, pos.y + size + 27);
        }
        if (
          !reduced.current &&
          !paused.current &&
          !stale &&
          a.lastActionAt > 0 &&
          Date.now() - a.lastActionAt < 600
        ) {
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
          ctx.lineTo(860, 490);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      for (const id of positions.keys()) if (!ids.has(id)) positions.delete(id);
      const effects = s?.effects ?? [];
      for (let i = 0; i < Math.min(effects.length, 12); i++) {
        const effect = effects[i];
        const cosmetic = ["cheer", "sub", "raid"].includes(effect.kind);
        ctx.strokeStyle = effect.kind.includes("chaos")
          ? colors.purple
          : colors.amber;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(860, 490, 300 + i * 10, 180 + i * 7, 0, 0, Math.PI * 2);
        if (!cosmetic || !reduced.current) ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (instrument) {
        metrics.frames++;
        metrics.agents = count;
        if (last && metrics.intervals.length < 40000)
          metrics.intervals.push(time - last);
        last = time;
        if (metrics.draws.length < 40000)
          metrics.draws.push(performance.now() - start);
        if (s && s.seq !== metrics.lastPaintSeq) {
          metrics.lastPaintSeq = s.seq;
          metrics.latencies.push(
            s.lastEventAt
              ? Date.now() - s.lastEventAt
              : performance.now() - receivedAt.current,
          );
          if (metrics.latencies.length > 40000) metrics.latencies.shift();
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      media.removeEventListener("change", updateMotion);
    };
  }, []);
  const seconds =
    state?.round.status === "open"
      ? Math.max(
          0,
          Math.ceil(
            (state.round.closesAt -
              (state.paused ? pauseClock.current || clock : clock)) /
              1000,
          ),
        )
      : 0;
  const total = (state?.consensus.boss ?? 0) + (state?.consensus.chaos ?? 0);
  const eventTitle =
    state?.round.status === "resolved"
      ? state.round.winner === "chaos"
        ? "CHAOS EVENT"
        : "BOSS EVENT"
      : state?.round.status === "open"
        ? "THE HIVE IS MOVING"
        : "YOUR CHAT. ONE SWARM.";
  return (
    <section
      className={`arena ${preview ? "arena-preview" : ""}`}
      aria-label={preview ? "Live arena preview" : "TwitchHive OBS arena"}
    >
      <canvas
        ref={ref}
        aria-label={`${state?.agents.length ?? 0} viewer agents in the arena`}
        role="img"
      />
      <div className="arena-hud">
        <div className="arena-top">
          <div>
            <span className="hud-brand">TWITCHHIVE</span>
            <h2>{eventTitle}</h2>
            <span data-testid="overlay-agent-count">
              {state?.agents.length ?? 0} agents
            </span>
            <span className="hud-divider"> / </span>
            <span data-testid="mode-label">{state?.mode ?? "Demo"}</span>
            <span className="hud-divider"> / </span>
            <span>
              {state?.director.source ?? "Rules"}
              {state?.director.source !== "Model" ? " fallback" : ""}
            </span>
          </div>
          <div className="hud-round">
            {state?.paused
              ? "PAUSED"
              : seconds
                ? `${Math.min(30, seconds)}s`
                : "READY"}
          </div>
        </div>
        <div className="consensus-hud">
          <span>SWARM CONSENSUS</span>
          <div className="consensus-track">
            <i
              style={{
                width: `${total ? (state!.consensus.boss / total) * 100 : 50}%`,
              }}
            />
          </div>
          <div className="consensus-labels">
            <span>Boss {state?.consensus.boss ?? 0}</span>
            <span>Chaos {state?.consensus.chaos ?? 0}</span>
          </div>
        </div>
        <div className="arena-leaders">
          <h3>THE COLLECTIVE</h3>
          {state?.leaderboard.length ? (
            <ol>
              {state.leaderboard.map((a) => (
                <li key={a.viewerId}>
                  <span>{a.displayName}</span>
                  <strong>{a.contribution}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p>Every contribution counts.</p>
          )}
        </div>
        {!state?.agents.length && (
          <div className="arena-empty">
            <strong>A place for every viewer.</strong>
            <span>Type !join in chat</span>
          </div>
        )}
        <div className="arena-caption">
          <span className="live-dot" />
          {state?.effects.length
            ? state.effects.slice(-1)[0].kind.replace(":", " · ")
            : "Attack together. Shield your allies. Shape the next event."}
        </div>
        {(state?.paused || status !== "Connected") && (
          <div className="arena-status">
            {state?.paused
              ? "Arena paused"
              : status === "Disconnected"
                ? "Waiting for a session"
                : status}
          </div>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {state?.round.status ?? "idle"} round. Boss votes{" "}
        {state?.consensus.boss ?? 0}, Chaos votes {state?.consensus.chaos ?? 0}.{" "}
        {state?.leaderboard
          .map((a) => `${a.displayName}: ${a.contribution}`)
          .join(", ")}
      </p>
    </section>
  );
}
function hex(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 - Math.PI / 6;
    const px = x + Math.cos(a) * r,
      py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
