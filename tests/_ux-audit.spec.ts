/**
 * Systematic UX audit: capture a wave in motion with several
 * checkpoints so I can see what the player actually experiences.
 */
import { test, type Page } from "@playwright/test";

const TOWER = { world: { x: -4, z: -1 } } as const;
const DIR = "test-results/ux-audit";

async function worldToScreen(page: Page, world: { x: number; z: number }) {
  const rect = await page.locator(".stage-canvas").evaluate((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  const nx = world.x / 18 + 0.5;
  const nz = -world.z / 16 + 0.5;
  return { x: rect.left + nx * rect.width, y: rect.top + nz * rect.height };
}

test("UX audit: capture the full round-1 experience", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem("fieldrunner-defense-save-v1", JSON.stringify({
      unlockedRound: 1, bestScore: 0, tutorialComplete: true,
      settings: { music: false, sfx: false, haptics: false }
    }));
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Begin Run/i }).click();
  await page.getByText(/Round 1 ready/i).waitFor({ state: "visible" });

  // A. Empty build phase
  await page.screenshot({ path: `${DIR}/A-build-phase-empty.png` });

  // B. Select a tower — check the cursor change on the canvas
  await page.locator(".tower-card", { hasText: "Cannon" }).click();
  const cursorBefore = await page.locator(".stage-canvas").evaluate((el) =>
    getComputedStyle(el).cursor
  );
  console.log("Canvas cursor (tower selected):", cursorBefore);

  // C. Place the tower
  const t = await worldToScreen(page, TOWER.world);
  await page.mouse.move(t.x, t.y, { steps: 8 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${DIR}/C-range-ring.png` });
  await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/D-tower-placed.png` });

  // D. The "Start Wave" button — is it clearly enabled?
  const startWaveBtn = page.getByRole("button", { name: /Start Wave/i });
  const isDisabled = await startWaveBtn.isDisabled();
  console.log("Start Wave disabled?", isDisabled);
  await startWaveBtn.screenshot({ path: `${DIR}/E-start-wave-button.png` });

  // E. Start the wave and sample at fine intervals to see motion
  await startWaveBtn.click();
  await page.getByText(/Round 1 is underway/i).waitFor({ state: "visible" });

  for (const ms of [400, 1200, 2500, 4500, 7500, 12000, 20000]) {
    await page.waitForTimeout(ms - (ms > 400 ? 400 : 0));
    await page.screenshot({ path: `${DIR}/F-wave-t${ms}.png` });
  }

  // F. Inspect the tower (click on it) to see the inspector
  await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${DIR}/G-tower-inspected.png` });

  // G. Final state — the round-complete sheet
  const won = await page.getByRole("button", { name: /Begin Order/i })
    .waitFor({ state: "visible", timeout: 60_000 })
    .then(() => true)
    .catch(() => false);
  await page.screenshot({ path: `${DIR}/H-round-${won ? "cleared" : "failed"}.png`, fullPage: true });

  // Capture the HUD state at the end
  const hud = await page.locator(".hud-row, .hud-subrow").allTextContents().catch(() => []);
  const message = await page.locator(".hud-message, .sheet__body, .overlay__body, [class*='title']").allTextContents().catch(() => []);
  console.log("HUD rows:", JSON.stringify(hud));
  console.log("Messages:", JSON.stringify(message.slice(0, 5)));
});
