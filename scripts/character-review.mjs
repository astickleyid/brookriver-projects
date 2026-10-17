import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { checkedUrl } from "./browser-guard.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8082/?qa=1");
const output = resolve(process.env.CHARACTER_REVIEW_OUTPUT || "screenshots/review/characters");
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
const watch = (p) => {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
};
watch(page);
page.on("framenavigated", (frame) => {
  if (frame === page.mainFrame()) console.log("Navigated", frame.url());
});
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (ms) => page.evaluate((v) => window.advanceTime(v), ms);
const keys = (codes) => page.evaluate((v) => window.__controlsTest.setKeys(v), codes);
const ready = (p) =>
  p.waitForFunction(
    () =>
      window.advanceTime &&
      window.render_game_to_text &&
      Object.values(JSON.parse(window.render_game_to_text()).ready).every(Boolean),
    null,
    { timeout: 90000 },
  );
const cast = [
  ["mara", "Mara Voss"],
  ["leon", "Leon Bell"],
  ["imani", "Imani Okafor"],
  ["rafa", "Rafa Solis"],
  ["jules", "Jules Park"],
  ["sana", "Sana Haddad"],
];
const report = { roster: [], errors };
try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await ready(page);
  for (const [id, name] of cast) {
    await page.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
    await advance(200);
    let s = await state();
    assert.equal(s.character.id, id);
    assert.equal(s.character.model, `player-${id}`);
    assert.equal(s.character.profile, id);
    assert.equal(await page.evaluate(() => localStorage.getItem("brookriver-character-v1")), id);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${output}/${id}.png` });
    await page.getByRole("button", { name: "Toggle walking preview", exact: true }).click();
    await advance(350);
    assert.ok((await state()).player.clip.includes("Walk"));
    await page.getByRole("button", { name: "Turn character", exact: true }).click();
    await page.getByRole("button", { name: "Turn character", exact: true }).click();
    await advance(100);
    await page.screenshot({ path: `${output}/${id}-walk-back.png` });
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await page.evaluate(() => {
      window.__brookriverReview.pose(0, 12);
      const s = JSON.parse(window.render_game_to_text());
      window.__brookriverReview.camera(0.8, s.player.y + 1.3, 8.4, 0, s.player.y + 1, 12);
    });
    await keys(["KeyW"]);
    await advance(220);
    assert.equal((await state()).phase, "play");
    assert.equal((await state()).character.model, `player-${id}`);
    assert.ok(
      (await state()).player.clip.includes("Walk") || (await state()).player.clip.includes("Jog"),
    );
    await keys([]);
    await advance(200);
    await page.screenshot({ path: `${output}/${id}-gameplay.png` });
    await keys(["KeyC"]);
    await advance(100);
    assert.ok(/^(Punch|Push)/.test((await state()).player.clip));
    await keys([]);
    await advance(350);
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Quit to title", exact: true }).click();
    await advance(20);
    assert.equal((await state()).character.id, id);
    report.roster.push({
      id,
      model: s.character.model,
      selection: true,
      walkPreview: true,
      gameplay: true,
      melee: true,
    });
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await ready(page);
  await advance(100);
  assert.equal((await state()).character.id, "sana");
  assert.equal((await state()).character.profile, "sana");
  report.persistence = "Sana restored after reload with matching actor";
  await page.keyboard.press("ArrowLeft");
  await advance(20);
  assert.equal((await state()).character.id, "jules");
  await page.keyboard.press("ArrowRight");
  await advance(20);
  assert.equal((await state()).character.id, "sana");
  report.keyboard = "Arrow keys choose the previous and next characters";
  // Exercise the real pad polling path, including wrapping and start confirmation.
  await page.evaluate(() => {
    window.__characterPadButtons = Array(17).fill(false);
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [
        {
          id: "Xbox 360 Controller (STANDARD GAMEPAD)",
          index: 0,
          connected: true,
          mapping: "standard",
          timestamp: performance.now(),
          axes: [0, 0, 0, 0],
          buttons: window.__characterPadButtons.map((pressed) => ({
            pressed,
            touched: pressed,
            value: pressed ? 1 : 0,
          })),
        },
      ],
    });
  });
  await advance(20);
  await page.evaluate(() => {
    window.__characterPadButtons[5] = true;
  });
  await advance(20);
  assert.equal((await state()).character.id, "mara");
  await page.evaluate(() => {
    window.__characterPadButtons[5] = false;
  });
  await advance(20);
  await page.evaluate(() => {
    window.__characterPadButtons[0] = true;
  });
  await advance(20);
  assert.equal((await state()).phase, "play");
  assert.equal((await state()).character.profile, "mara");
  report.controller = "RB wraps Sana to Mara; A starts chosen actor";

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  watch(mobile);
  await mobile.goto(url, { waitUntil: "domcontentloaded" });
  await ready(mobile);
  await mobile.getByRole("button", { name: "Choose Imani Okafor", exact: true }).click();
  await mobile.evaluate(() => window.advanceTime(200));
  await mobile.locator(".character-select").evaluate((el) => {
    el.scrollTop = 0;
  });
  assert.equal(
    await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await mobile.screenshot({ path: `${output}/mobile.png` });
  await mobile.getByText("Their story, personality & voice", { exact: true }).click();
  assert.ok(await mobile.locator("details[open]").count());
  await mobile.getByRole("button", { name: "Start", exact: true }).click();
  await mobile.evaluate(() => window.advanceTime(200));
  assert.equal(
    await mobile.evaluate(() => JSON.parse(window.render_game_to_text()).character.profile),
    "imani",
  );
  assert.equal(await mobile.getByLabel("Move", { exact: true }).count(), 1);
  report.mobile =
    "Imani selectable, biography expands, start stays accessible, touch controls appear; no horizontal overflow";
  await mobile.close();
  assert.deepEqual(errors, []);
  writeFileSync(`${output}/verification.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
  writeFileSync(
    `${output}/failure.json`,
    JSON.stringify({ error: String(error), errors, url: page.url() }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
