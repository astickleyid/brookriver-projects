import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8082/?qa=1");
const output = resolve("screenshots/review/runtime");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage({
  // Nitro preview compresses every asset on demand; gzip avoids costly cold Brotli work.
  extraHTTPHeaders: { "Accept-Encoding": "gzip" },
  viewport: { width: 1280, height: 800 },
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const results = {};
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (ms) => page.evaluate((v) => window.advanceTime(v), ms);
const keys = (codes) => page.evaluate((v) => window.__controlsTest.setKeys(v), codes);
async function boot() {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      window.render_game_to_text &&
      Object.values(JSON.parse(window.render_game_to_text()).ready).every(Boolean),
    null,
    { timeout: 90000 },
  );
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await keys([]);
  await advance(20);
}
try {
  await boot();
  await keys(["KeyW"]);
  await advance(600);
  assert.ok((await state()).speed > 0.1);
  const y0 = (await state()).yaw;
  await keys(["KeyW", "KeyA"]);
  await advance(300);
  const left = (await state()).yaw - y0;
  const y1 = (await state()).yaw;
  await keys(["KeyW", "KeyD"]);
  await advance(300);
  const right = (await state()).yaw - y1;
  assert.ok(left > 0.05 && right < -0.05, "A left and D right from the chase camera");
  results.steering = { left, right };
  await keys([]);
  await page.evaluate(() => window.__brookriverReview.pose(0, 12));
  await keys(["ControlLeft", "KeyD"]);
  await advance(400);
  const strafe = (await state()).player;
  assert.ok(strafe.clip.includes("__legs") && strafe.legTurn < -1);
  await page.screenshot({ path: `${output}/strafe.png` });
  await keys(["ControlLeft", "KeyS"]);
  await advance(400);
  const back = (await state()).player;
  assert.ok(back.clip.includes("__legs") && Math.abs(back.legTurn) < 0.25);
  results.locomotion = { strafe: strafe.clip, back: back.clip };
  await keys(["Space"]);
  await advance(100);
  assert.ok((await state()).player.air !== "none");
  await keys([]);
  await advance(1000);
  assert.equal((await state()).player.air, "none");
  results.jump = "landed";

  await boot();
  await page.evaluate(() => {
    window.__brookriverReview.pose(0, 12);
    window.__brookriverReview.melee();
  });
  await keys(["KeyC"]);
  await advance(50);
  const before = (await state()).nearby[0].hp;
  await keys([]);
  await advance(150);
  const after = (await state()).nearby[0].hp;
  assert.equal(before, 100);
  assert.equal(after, 84);
  results.melee = { windupHp: before, contactHp: after };
  await page.screenshot({ path: `${output}/melee.png` });

  await boot();
  await page.evaluate(() => {
    window.__brookriverReview.pose(0, 12);
    // Exercise the touch fire path without requesting pointer lock in headless Chrome.
    window.__reviewMatchMedia = window.matchMedia;
    window.matchMedia = (q) =>
      q === "(pointer: coarse)" ? { matches: true } : window.__reviewMatchMedia(q);
    document
      .querySelector("canvas")
      .dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true }));
  });
  await advance(50);
  await page.evaluate(() => {
    window.dispatchEvent(new PointerEvent("pointerup", { button: 0, bubbles: true }));
    window.matchMedia = window.__reviewMatchMedia;
  });
  assert.equal((await state()).player.ammo, 11);
  await keys(["KeyW", "KeyR"]);
  await advance(100);
  assert.ok((await state()).player.clip.includes("Reload__arms"));
  await keys([]);
  await advance(1100);
  assert.equal((await state()).player.ammo, 12);
  results.reload = "moving legs, reload overlay, magazine refilled";

  await page.evaluate(() => window.__brookriverReview.pose(125, 10));
  await advance(20);
  assert.ok((await state()).x >= 124.9, "outer road is usable");
  await keys(["KeyD"]);
  await advance(2000);
  await keys([]);
  assert.ok((await state()).x < 134, "visible boundary blocks travel");
  results.outerRoad = (await state()).x;

  await page.evaluate(() => {
    window.__brookriverReview.pose(14, 14);
    window.__brookriverReview.crowd(10);
    window.__brookriverReview.camera(-5, 2, -3, -6, 1.1, -11);
  });
  await advance(100);
  await page.screenshot({ path: `${output}/wardrobe.png` });
  // Inspect identity UI next to a resident, away from shops.
  await page.evaluate(() => {
    window.__brookriverReview.pose(0, 12);
    window.__brookriverReview.melee();
  });
  await advance(20);
  assert.ok((await page.locator("body").innerText()).includes("Mara Mercer"));
  results.residentIdentity = "visible name, role and personality";
  const mobile = await browser.newPage({
    // Nitro preview compresses every asset on demand; gzip avoids costly cold Brotli work.
    extraHTTPHeaders: { "Accept-Encoding": "gzip" },
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(url, { waitUntil: "domcontentloaded" });
  await mobile.waitForFunction(() => window.render_game_to_text && Object.values(JSON.parse(window.render_game_to_text()).ready).every(Boolean), null, { timeout: 90000 });
  await mobile.getByRole("button", { name: "Start", exact: true }).click();
  await mobile.evaluate(() => window.advanceTime(1000));
  assert.equal(await mobile.getByLabel("Move", { exact: true }).count(), 1);
  assert.equal(await mobile.getByLabel("Look", { exact: true }).count(), 1);
  await mobile.screenshot({ path: `${output}/mobile-touch.png` });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  results.mobile = "touch controls visible; no horizontal overflow";
  await mobile.close();
  assert.deepEqual(errors, []);
  results.errors = errors;
  writeFileSync(`${output}/verdict.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
