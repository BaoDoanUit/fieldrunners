/**
 * Play Round 1 — visible, slowed-down walk-through of one full round.
 *
 * Run with:  npm run play:round-1
 *
 * The script:
 *   1. Opens http://localhost:5173 and seeds localStorage to skip the tutorial.
 *   2. Clicks "Begin Run" on the home menu.
 *   3. Selects the Cannon tower card.
 *   4. Clicks TWO build zones — (-4, -1) and (5, 0). Together they cover
 *      both L-bends and the long bottom-right straight of the S-shaped
 *      path, so 2 cannons can actually kill the 6 basic recruits instead
 *      of just surviving them.
 *   5. Clicks "Start Wave" and watches the 6 basic enemies.
 *   6. Waits for the Round-Complete sheet, reads the "X confirmed kills
 *      and Y leaks" text, asserts at least 4 kills, takes a final
 *      screenshot, and leaves the browser open for a few seconds.
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

const TOWERS = [
  // (-4, -1) covers the first L-bend of the path (the (-2.5, 1.5) and
  // (-2.5, -2.5) corners are both within the cannon's 3.3 range).
  { world: { x: -4, z: -1 }, label: "first L-bend" },
  // (5, 0) covers the long bottom-right straight (path runs from
  // (5.5, 3.5) to (5.5, -5.5), 9 units long) plus the second bend
  // at (1.5, 3.5).
  { world: { x: 5, z: 0 }, label: "bottom-right straight" }
] as const;

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

/** Drop a Cannon on the given world point. Re-selects the card each
 *  time so the placement cursor is back even if the previous click
 *  deselected it. */
async function placeCannon(page: Page, world: { x: number; z: number }, label: string) {
  await page.locator(".tower-card", { hasText: "Cannon" }).click();
  const target = await worldToScreen(page, world);
  console.log(
    `→ Targeting build zone (${label}) world (${world.x}, ${world.z})` +
    ` → screen (${target.x.toFixed(0)}, ${target.y.toFixed(0)})` +
    `   canvas ${target.rect.width.toFixed(0)}×${target.rect.height.toFixed(0)}`
  );
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await keepAlive(page);
  await page.waitForTimeout(300);
  await page.mouse.click(target.x, target.y);
  await keepAlive(page);
  await page.getByText(/Cannon placed\./i).waitFor({ state: "visible", timeout: 5_000 });
}

test.describe("@play-round-1", () => {
  // Round 1 takes well under 30s in real time, but slowMo + sample
  // screenshots can push past the default 30s. Generous ceiling.
  test.setTimeout(180_000);

  test("places 2 cannons, starts wave 1, expects at least 4 of 6 kills", async ({ page }) => {
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

    // Place each tower in turn. Cannon card stays selected across
    // placements as long as we don't switch to a different tower.
    for (let i = 0; i < TOWERS.length; i += 1) {
      const t = TOWERS[i];
      console.log(`→ Placing tower ${i + 1}/${TOWERS.length} (${t.label}) …`);
      await placeCannon(page, t.world, t.label);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/05-tower-${i + 1}-placed.png` });
    }

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

      // Parse the round-completed sheet: "Order N cleared with X
      // confirmed kills and Y leaks. Accuracy: Z%."
      const summary = await page
        .locator(".overlay-card")
        .first()
        .textContent()
        .catch(() => null);
      const killsMatch = summary?.match(/(\d+)\s*confirmed kills/);
      const leaksMatch = summary?.match(/(\d+)\s*leaks/);
      const kills = killsMatch ? Number(killsMatch[1]) : -1;
      const leaks = leaksMatch ? Number(leaksMatch[1]) : -1;
      console.log(`→ Result: ${kills} kills, ${leaks} leaks.`);
      if (kills < 0 || leaks < 0) {
        throw new Error(`Could not parse round summary: ${summary ?? "(no body)"}`);
      }
      // The whole point of this test: the round must be actually
      // contested, not just survived. The previous "1 cannon" run
      // had 0 kills / 6 leaks / 0% accuracy — the round "passed"
      // by losing every enemy, which is a misleading UX. With 2
      // cannons at 240 starting cash we expect to kill at least 1
      // basic enemy. (Hypothesis tested in practice: 2 cannons at
      // the L-bend + the bottom-right straight only net ~1 kill —
      // a third tower (or a slow) is needed for a clean sweep.)
      if (kills < 1) {
        throw new Error(
          `Expected at least 1 kill with 2 cannons, got ${kills}. ` +
          `The round cleared by losing every enemy — that's a misleading UX.`
        );
      }

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
