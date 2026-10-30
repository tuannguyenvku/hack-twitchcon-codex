import { test, expect, type Page } from "@playwright/test";
function audit(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
test("AC-4 AC-5 AC-6 real dashboard + overlay round-trip, all simulator triggers, controls and no console errors", async ({
  page,
  context,
}) => {
  const errors = audit(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Start Demo", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Connected");
  await page.getByLabel("Viewer name").fill("Luna");
  await page.getByRole("button", { name: "Send chat command" }).click();
  await expect(page.getByTestId("agent-count")).toHaveText("1");
  await page
    .getByRole("button", { name: "Open challenge", exact: true })
    .click();
  await page.getByLabel("Chat command").selectOption("!action shield");
  await page.getByRole("button", { name: "Send chat command" }).click();
  await page.getByLabel("Chat command").selectOption("!vote chaos");
  await page.getByRole("button", { name: "Send chat command" }).click();
  for (const name of ["Trigger Sub", "Trigger Raid", "Trigger Cheer"])
    await page.getByRole("button", { name, exact: true }).click();
  const href = await page
    .getByRole("link", { name: "Open overlay" })
    .getAttribute("href");
  const overlay = await context.newPage();
  const overlayErrors = audit(overlay);
  await overlay.goto(href!);
  await expect(overlay.getByTestId("overlay-agent-count")).toHaveText(
    "1 agents",
  );
  await expect(overlay.getByTestId("mode-label")).toHaveText("Demo");
  await page.getByRole("button", { name: "Pause arena", exact: true }).click();
  await expect(
    overlay.getByText("Arena paused", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume arena", exact: true }).click();
  await page.getByLabel("Difficulty").selectOption("4");
  await page.getByRole("button", { name: "Apply rules" }).click();
  await expect(page.getByRole("status")).toContainText("Rules updated");
  await page
    .getByRole("button", { name: "Resolve round", exact: true })
    .click();
  await expect(overlay.getByText("CHAOS EVENT", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Replay scenario" }).click();
  await expect(page.getByTestId("agent-count")).toHaveText("20");
  await expect(overlay.getByTestId("overlay-agent-count")).toHaveText(
    "20 agents",
  );
  await page.screenshot({
    path: "/tmp/twitchhive-issue3/dashboard.png",
    fullPage: true,
  });
  await overlay.screenshot({
    path: "/tmp/twitchhive-issue3/overlay.png",
    omitBackground: true,
  });
  const alpha = await overlay
    .locator("canvas")
    .evaluate(
      (canvas: HTMLCanvasElement) =>
        canvas.getContext("2d")!.getImageData(0, 0, 1, 1).data[3],
    );
  expect(alpha).toBe(0);
  await page
    .getByRole("button", { name: "Hide simulator", exact: true })
    .click();
  await expect(page.locator("#simulator")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show simulator", exact: true })
    .click();
  await expect(page.locator("#simulator")).toBeVisible();
  await page.getByRole("button", { name: "Reset arena", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Reset session", exact: true })
    .click();
  await expect(page.getByTestId("agent-count")).toHaveText("0");
  expect(errors).toEqual([]);
  expect(overlayErrors).toEqual([]);
});
test("AC-6 responsive keyboard flow and accessible reduced-motion overlay", async ({
  page,
}) => {
  const errors = audit(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Start Demo", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("connection-status")).toHaveText("Connected");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Open challenge", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("round-status")).toHaveText("open");
  await page
    .getByRole("button", { name: "Hide simulator", exact: true })
    .click();
  await expect(page.locator("#simulator")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show simulator", exact: true })
    .click();
  await expect(page.locator("#simulator")).toBeVisible();
  await page.getByRole("button", { name: "Reset arena", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset arena", exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Replay scenario" }).click();
  await expect(page.getByTestId("agent-count")).toHaveText("20");
  expect(errors).toEqual([]);
});

test("AC-7 socket reconnect restores authoritative snapshot; session survives dashboard reload", async ({
  page,
}) => {
  const errors = audit(page);
  let serverSocket: import("@playwright/test").WebSocketRoute | undefined;
  await page.routeWebSocket("**/ws/dashboard", (ws) => {
    const server = ws.connectToServer();
    serverSocket = ws;
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Start Demo", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Connected");
  await page.getByRole("button", { name: "Replay scenario" }).click();
  await expect(page.getByTestId("agent-count")).toHaveText("20");
  serverSocket!.close({ code: 1001, reason: "test reconnect" });
  await expect(page.getByTestId("connection-status")).toHaveText(
    "Reconnecting",
  );
  await expect(page.getByTestId("connection-status")).toHaveText("Connected", {
    timeout: 10000,
  });
  await expect(page.getByTestId("agent-count")).toHaveText("20");
  await page.reload();
  await expect(page.getByTestId("connection-status")).toHaveText("Connected");
  await expect(page.getByTestId("agent-count")).toHaveText("20");
  expect(errors).toEqual([]);
});
test("AC-4 localhost alias and overlay without token show useful states without console errors", async ({
  page,
}) => {
  const errors = audit(page);
  await page.goto("http://localhost:3000/dashboard");
  await page.getByRole("button", { name: "Start Demo", exact: true }).click();
  await expect(page.getByTestId("connection-status")).toHaveText("Connected");
  await page.goto("/overlay");
  await expect(
    page.getByText("Paste an OBS URL from your dashboard"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
