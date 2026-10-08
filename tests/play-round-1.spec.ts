/**
 * Play Round 1 — visible, slowed-down walk-through of one full round.
 *
 * Run with:  npm run play:round-1
 *
 * The script:
 *   1. Opens http://localhost:5173 and seeds localStorage to skip the tutorial.
 *   2. Clicks "Begin Run" on the home menu.
 *   3. Selects the Cannon tower card.
 *   4. Clicks the build zone at world coords (-4, -1) — covers the first
 *      L-bend and the segment below it (path corners at (-2.5, -2.5)
 *      and (-2.5, 1.5) are both within the 3.3 unit range).
 *   5. Clicks "Start Wave" and watches the 6 basic enemies.
 *   6. Waits for either the Round-Complete sheet (win) or the
 *      Defeat overlay (loss), takes a final screenshot, and leaves
 *      the browser open for a few seconds so the user can inspect.
 *
 * World → screen conversion is the exact inverse of `onPointerDown`
 * in src/ui/App.tsx:
 *     x  = (event.clientX - rect.left) / rect.width
 *     z  = (event.clientY - rect.top)  / rect.height
 *     worldX = clamp((x - 0.5) * 18, -9, 9)
 *     worldZ = clamp((0.5 - z) * 16, -8, 8)
 *
 * Visibility note: the game auto-pauses on `visibilitychange`. If the
 * Chromium window launches behind another window, `document.hidden`
 * goes true and the engine freezes. The script:
 *   - calls `page.bringToFront()` after every navigation, and
 *   - installs a safety net that runs every 500 ms during the wave
 *     to unpause the game if it gets stuck.
 */
import { test, type Page } from "@playwright/test";

const TOWER = {
  // World coordinates of the build zone we want to drop a Cannon on.
  // (-4, -1) is the strongest single-tower chokepoint for Round 1
  // (covers the L-bend and ~1 vertical segment of the path on each side).
  world: { x: -4, z: -1 }
} as const;

const SCREENSHOT_DIR = "test-results/round-1";

/** Convert a world position to a canvas-relative pixel position. */
async function worldToScreen(page: Page, world: { x: number; z: number }) {
  const rect = await page.locator(".stage-canvas").evaluate((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  // Inverse of App.tsx's pointer → world math.
  const nx = world.x / 18 + 0.5;
  const nz = -world.z / 16 + 0.5;
  return {
    x: rect.left + nx * rect.width,
    y: rect.top + nz * rect.height,
    rect
  };
}

/** Focus the browser tab and unstick any visibility-based pause. */
async function keepAlive(page: Page) {
  await page.bringToFront().catch(() => undefined);
  // If the page got marked hidden, the React app will have already
  // auto-paused. The PauseSheet has a "Resume" button — click it.
  const resumeBtn = page.getByRole("button", { name: /^Resume$/i });
  if (await resumeBtn.isVisible().catch(() => false)) {
    await resumeBtn.click().catch(() => undefined);
    console.log("→ detected PauseSheet, clicked Resume");
  }
  // Also force document.hidden → false going forward so the next
  // visibilitychange doesn't re-pause the game.
  await page.evaluate(() => {
    if (document.hidden) {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
      document.dispatchEvent(new Event("visibilitychange"));
    }
  });
}

test.describe("@play-round-1", () => {
  // Round 1 takes well under 30s in real time, but slowMo + sample
  // screenshots can push past the default 30s. Generous ceiling.
  test.setTimeout(180_000);

  test("opens the home menu, plays one tower, starts wave 1, observes outcome", async ({ page }) => {
    page.on("pageerror", (err) => console.error("[page-error]", err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error("[browser]", msg.text());
    });

    // Skip the tutorial so the HomeMenu shows up immediately. We seed
    // localStorage before any page script runs.
    await page.addInitScript(() => {
      const KEY = "fieldrunner-defense-save-v1";
      const existing = (() => {
        try {
          return JSON.parse(localStorage.getItem(KEY) ?? "{}");
        } catch {
          return {};
        }
      })();
      localStorage.setItem(
        KEY,
        JSON.stringify({
          unlockedRound: 1,
          bestScore: 0,
          tutorialComplete: true,
          settings: { music: true, sfx: true, haptics: false },
          ...existing
        })
      );
    });

    console.log("→ Loading http://localhost:5173 …");
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await keepAlive(page);

    // The HomeMenu's "Begin Run" button.
    await page.getByRole("button", { name: /Begin Run/i }).waitFor({ state: "visible" });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-home-menu.png` });

    console.log("→ Clicking Begin Run …");
    await page.getByRole("button", { name: /Begin Run/i }).click();
    await keepAlive(page);
    // The HUD message in build phase says "Round 1 ready."
    await page.getByText(/Round 1 ready/i).waitFor({ state: "visible" });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-build-phase.png` });

    console.log("→ Selecting Cannon tower card …");
    await page.locator(".tower-card", { hasText: "Cannon" }).click();
    // HUD message changes to "Cannon: …".
    await page.getByText(/Cannon: /i).waitFor({ state: "visible" });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-cannon-selected.png` });

    // Compute the canvas pixel for the world point we want to drop on.
    const target = await worldToScreen(page, TOWER.world);
    console.log(
      `→ Targeting build zone world (${TOWER.world.x}, ${TOWER.world.z})` +
      ` → screen (${target.x.toFixed(0)}, ${target.y.toFixed(0)})` +
      `   canvas ${target.rect.width.toFixed(0)}×${target.rect.height.toFixed(0)}`
    );

    // Hover first so the user can see the range ring appear.
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await keepAlive(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-range-ring.png` });

    // Click → places the tower.
    await page.mouse.click(target.x, target.y);
    await keepAlive(page);
    await page.getByText(/Cannon placed\./i).waitFor({ state: "visible" });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-tower-placed.png` });

    console.log("→ Starting the wave …");
    await page.getByRole("button", { name: /Start Wave/i }).click();
    await keepAlive(page);
    await page.getByText(/Round 1 is underway/i).waitFor({ state: "visible" });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-wave-start.png` });

    // Safety net: while the wave runs, re-focus the tab every 500 ms so
    // the visibility-based auto-pause can't freeze the engine. Stop as
    // soon as the round-complete sheet or defeat overlay appears.
    let observed = false;
    const heartbeat = setInterval(() => {
      void keepAlive(page).then(() => undefined);
    }, 500);
    try {
      // Sample the wave at a few points so the user can see motion.
      const samples = [600, 1500, 3000, 5000];
      for (const [i, ms] of samples.entries()) {
        await page.waitForTimeout(ms);
        await keepAlive(page);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/07-wave-t${i + 1}.png` });
      }

      console.log("→ Waiting for round outcome (up to 90 s) …");
      // The round-complete sheet's primary CTA is "Begin Order {N+1}"
      // (see src/ui/RoundCompleteSheet.tsx). Because nextRound() fires
      // before the sheet renders, the label is "Begin Order 3" for a
      // successful Round 1, not "Begin Order 2". We match the prefix.
      const won = await page
        .getByRole("button", { name: /Begin Order/i })
        .waitFor({ state: "visible", timeout: 90_000 })
        .then(() => true)
        .catch(() => false);
      const outcome = won ? "cleared" : "failed";
      observed = true;
      await page.screenshot({ path: `${SCREENSHOT_DIR}/08-${outcome}.png`, fullPage: true });
      console.log(`→ Round 1 ${outcome.toUpperCase()}.`);

      // Capture some useful state for the user to read.
      const hud = await page.locator(".hud-row").first().textContent().catch(() => null);
      const message = await page.locator(".hud-message").first().textContent().catch(() => null);
      if (hud) console.log("   HUD:", hud.replace(/\s+/g, " ").trim());
      if (message) console.log("   Msg:", message.trim());
    } finally {
      clearInterval(heartbeat);
    }

    // Leave the browser open for a few seconds so the user can inspect
    // the end state, then close.
    if (observed) {
      await page.waitForTimeout(4_000);
    }
  });
});
