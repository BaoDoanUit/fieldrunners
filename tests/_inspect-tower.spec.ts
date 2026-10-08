/**
 * Inspect the tower look at three levels:
 *   1. The 3D tower mesh on the playfield (closeup via canvas crop)
 *   2. The tower cards in the side panel
 *   3. The hover range ring around a placed tower
 */
import { test, type Page } from "@playwright/test";

const TOWER = { world: { x: -4, z: -1 } } as const;
const SCREENSHOT_DIR = "test-results/inspect";

async function worldToScreen(page: Page, world: { x: number; z: number }) {
  const rect = await page.locator(".stage-canvas").evaluate((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  });
  const nx = world.x / 18 + 0.5;
  const nz = -world.z / 16 + 0.5;
  return {
    x: rect.left + nx * rect.width,
    y: rect.top + nz * rect.height,
    rect
  };
}

test("inspect tower visuals", async ({ page }) => {
  await page.addInitScript(() => {
    const KEY = "fieldrunner-defense-save-v1";
    localStorage.setItem(
      KEY,
      JSON.stringify({
        unlockedRound: 1,
        bestScore: 0,
        tutorialComplete: true,
        settings: { music: true, sfx: true, haptics: false }
      })
    );
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Begin Run/i }).click();
  await page.getByText(/Round 1 ready/i).waitFor({ state: "visible" });

  // ---- 1. Tower cards in the side panel ----
  const towerList = page.locator(".tower-list");
  await towerList.screenshot({ path: `${SCREENSHOT_DIR}/01-tower-cards.png` });
  // Each card individually
  for (const kind of ["Cannon", "Rapid", "Splash", "Slow"]) {
    const card = page.locator(".tower-card", { hasText: kind });
    await card.screenshot({ path: `${SCREENSHOT_DIR}/02-card-${kind.toLowerCase()}.png` });
  }

  // ---- 2. Select a tower and capture the silhouette preview ----
  await page.locator(".tower-card", { hasText: "Cannon" }).click();
  await page.waitForTimeout(300);
  await towerList.screenshot({ path: `${SCREENSHOT_DIR}/03-cannon-active.png` });

  // ---- 3. Place the tower and capture the 3D closeup ----
  const target = await worldToScreen(page, TOWER.world);
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/04-range-ring.png` });
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/05-tower-placed.png` });

  // ---- 4. Closeup of the placed tower (canvas crop) ----
  // Crop a 220×220 region centered on the tower.
  const cropX = Math.max(0, target.x - 110);
  const cropY = Math.max(0, target.y - 110);
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/06-tower-closeup.png`,
    clip: { x: cropX, y: cropY, width: 220, height: 220 }
  });

  // ---- 5. Inspect the tower (click on it) and capture the range ring ----
  await page.locator(".tower-card", { hasText: "Cannon" }).click(); // deselect
  await page.waitForTimeout(200);
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/07-tower-inspected.png` });

  // ---- 6. Full playfield for context ----
  await page.screenshot({ path: `${SCREENSHOT_DIR}/08-full.png`, fullPage: true });
});
