import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import os from "node:os";
test("AC-5 five-minute real-time 500-agent overlay benchmark and console audit", async ({
  page,
  browserName,
}) => {
  const seconds = Number(process.env.HIVE_BENCH_SECONDS ?? 300);
  test.setTimeout((seconds + 60) * 1000);
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Start Demo", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Connected");
  const href = await page
    .getByRole("link", { name: "Open overlay" })
    .getAttribute("href");
  const overlay = new URL(href!);
  overlay.searchParams.set("metrics", "1");
  await page.goto(overlay.toString());
  const boot = await page.evaluate(async () => {
    const res = await fetch("/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    return res.json();
  });
  await page.evaluate(
    async (args) => {
      const res = await fetch("/api/simulator/load", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": args.csrf,
        },
        body: JSON.stringify({
          agents: 500,
          eventsPerSecond: 50,
          durationSec: args.seconds,
        }),
      });
      if (!res.ok) throw new Error("load failed");
    },
    { csrf: boot.csrf, seconds },
  );
  await expect(page.getByTestId("overlay-agent-count")).toHaveText(
    "500 agents",
  );
  await page.waitForTimeout(3000);
  // Restart after warm-up so the complete measurement window has sustained load.
  await page.evaluate(
    async (args) => {
      const res = await fetch("/api/simulator/load", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": args.csrf,
        },
        body: JSON.stringify({
          agents: 500,
          eventsPerSecond: 50,
          durationSec: args.seconds,
        }),
      });
      if (!res.ok) throw new Error("load restart failed");
    },
    { csrf: boot.csrf, seconds },
  );
  await page.evaluate(() => {
    const m = window.__hiveMetrics!;
    m.intervals = [];
    m.draws = [];
    m.latencies = [];
    m.frames = 0;
  });
  const start = Date.now();
  while (Date.now() - start < seconds * 1000)
    await page.waitForTimeout(
      Math.min(10000, seconds * 1000 - (Date.now() - start)),
    );
  const raw = await page.evaluate(() => window.__hiveMetrics!);
  const percentile = (xs: number[], p: number) => {
    const sorted = [...xs].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * p)] ?? 0;
  };
  const result = {
    browser: browserName,
    browserVersion: page.context().browser()?.version(),
    crossOriginIsolated: await page.evaluate(() => crossOriginIsolated),
    host: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus()[0]?.model,
    },
    viewport: "1920x1080",
    wallSeconds: (Date.now() - start) / 1000,
    agents: raw.agents,
    frames: raw.frames,
    fps: raw.frames / ((Date.now() - start) / 1000),
    frameIntervalP95: percentile(raw.intervals, 0.95),
    drawP95: percentile(raw.draws, 0.95),
    eventToPaintP95: percentile(raw.latencies, 0.95),
    consoleErrors: errors,
  };
  await writeFile(
    "/tmp/twitchhive-issue3/performance.json",
    JSON.stringify(result, null, 2),
  );
  await page.screenshot({
    path: "/tmp/twitchhive-issue3/overlay-500.png",
    omitBackground: true,
  });
  expect(raw.agents).toBe(500);
  expect(raw.frames).toBeGreaterThan(seconds * 50);
  expect(result.eventToPaintP95).toBeLessThanOrEqual(500);
  expect(result.drawP95).toBeLessThanOrEqual(16.7);
  expect(result.frameIntervalP95).toBeLessThanOrEqual(16.7);
  expect(errors).toEqual([]);
});
