import { test, expect, type Page } from "@playwright/test";

/**
 * Canonical renderer states. Each screenshot guards a distinct feature:
 *  - overview: semantic-zoom LOD cards + section colors + minimap + edges
 *  - detail:   full wireframe fidelity past the zoom threshold
 *  - hover:    connectivity highlighting (neighbors lit, rest dimmed)
 *  - trace:    the journey path from START to the selected screen
 *  - section:  legend-chip filter + zoom-to-section
 */

async function settled(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  // Let React Flow lay out, fitView, and rough.js draw.
  await page.waitForSelector(".react-flow__node");
  await page.waitForTimeout(2500);
}

test("overview: LOD cards, section colors, minimap", async ({ page }) => {
  await settled(page);
  await expect(page).toHaveScreenshot("overview.png");
});

test("detail: full wireframes past the zoom threshold", async ({ page }) => {
  await settled(page);
  const node = page.locator(".react-flow__node", { hasText: "Checkout — Payment" }).first();
  const box = await node.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  for (let i = 0; i < 7; i++) {
    await page.mouse.wheel(0, -280);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(800);
  await expect(page).toHaveScreenshot("detail-zoom.png");
});

test("hover: connected flows light up, rest dims", async ({ page }) => {
  await settled(page);
  await page.locator(".react-flow__node", { hasText: "Cart" }).first().hover({ force: true });
  await page.waitForTimeout(500);
  await expect(page).toHaveScreenshot("hover-connectivity.png");
});

test("trace: journey path from START to selected screen", async ({ page }) => {
  await settled(page);
  await page.locator(".react-flow__node", { hasText: "Track Order" }).first().click({ force: true });
  await page.waitForTimeout(700);
  await expect(page).toHaveScreenshot("journey-trace.png");
});

test("section: chip filters and zooms to the group", async ({ page }) => {
  await settled(page);
  await page.locator(".ss-chip", { hasText: "Checkout" }).first().click();
  await page.waitForTimeout(900);
  await expect(page).toHaveScreenshot("section-filter.png");
});
