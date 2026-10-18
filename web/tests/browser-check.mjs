import { chromium } from "playwright-core";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { createServer } from "../server/index.mjs";
const artifacts =
  process.env.ARCADEOT_QA_ARTIFACTS ??
  join(tmpdir(), "arcadeot-browser-artifacts");
const dir = await mkdtemp(join(tmpdir(), "arcade-browser-"));
const { server, gateway } = await createServer({
  dataDir: dir,
  collect: false,
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1060 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
try {
  await page.goto("http://127.0.0.1:" + server.address().port);
  await page
    .getByRole("heading", { name: "Your operation, in view." })
    .waitFor();
  await page.getByText("Gateway connected", { exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({
    path: join(artifacts, "overview.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: "Add controller" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Mitsubishi SLMP/ })
    .click();
  await page
    .getByLabel("Controller name", { exact: true })
    .fill("FX5U demo equipment");
  await page.getByLabel("Exact CPU model / order code").fill("FX5U-32MT/ES");
  await page.getByLabel("PLC IP address / hostname").fill("127.0.0.1");
  await page.getByLabel("TCP port", { exact: true }).fill("1");
  await page.getByLabel("Response timeout (ms)").fill("300");
  await page
    .locator(".form-footer")
    .getByRole("button", { name: "Save & apply" })
    .click();
  await page
    .getByText("Configuration saved. Gateway is applying this revision.")
    .waitFor();
  await page
    .locator(".tabs")
    .getByRole("button", { name: /Sensor mappings/ })
    .click();
  await page
    .locator(".panel-head")
    .getByRole("button", { name: "Add sensor" })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Sensor name", { exact: true })
    .fill("Reactor temperature");
  await page
    .getByRole("dialog")
    .getByLabel("Readable address / tag / NodeId")
    .fill("D100");
  await page
    .getByRole("dialog")
    .getByLabel("Scale", { exact: true })
    .fill("0.1");
  await page.getByRole("dialog").getByLabel("Engineering unit").fill("°C");
  await page.getByRole("button", { name: "Keep mapping in draft" }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: "Save & apply" })
    .click();
  await page
    .getByText("Unsaved changes", { exact: true })
    .waitFor({ state: "hidden" });
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Connection", exact: true })
    .click();
  await page.getByRole("button", { name: "Test first saved mapping" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "BadCommunication" })
    .waitFor();
  assert.equal(gateway.history().length, 1);
  assert.equal(gateway.history()[0].Measurement.Value, null);
  await page
    .locator("nav")
    .getByRole("button", { name: "Live monitor", exact: true })
    .click();
  await page.getByText("Reactor temperature", { exact: true }).waitFor();
  await page.locator("table").getByText("Disabled", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Pause display" }).click();
  await page.getByText("Display paused", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Resume display" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "History & exports" })
    .click();
  await page
    .locator("table")
    .getByText("Reactor temperature", { exact: true })
    .waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "ArcadeOT-readings.csv");
  await page
    .locator("nav")
    .getByRole("button", { name: /Controllers/ })
    .click();
  await page
    .locator(".tabs")
    .getByRole("button", { name: /Sensor mappings/ })
    .click();
  await page.getByRole("button", { name: "Repeated group" }).click();
  await page.getByRole("dialog").getByLabel("Starting address").fill("D200");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Validate & preview" })
    .click();
  await page.getByRole("heading", { name: "8 mappings ready" }).waitFor();
  await page.getByRole("button", { name: "Add 8 mappings" }).click();
  await page
    .locator("table")
    .getByText("Temperature 08", { exact: true })
    .waitFor();
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: "Save & apply" })
    .click();
  await page
    .getByText("Unsaved changes", { exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(gateway.config.Plcs[0].Sensors.length, 9);
  await page.getByRole("button", { name: "Import CSV", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByLabel("CSV content")
    .fill("Name,Address,Type\nPressure,D300,Int16");
  await page.getByRole("button", { name: "Validate & preview" }).click();
  await page.getByRole("heading", { name: "1 mappings ready" }).waitFor();
  await page.getByRole("button", { name: "Add 1 mappings" }).click();
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: "Save & apply" })
    .click();
  await page
    .getByText("Unsaved changes", { exact: true })
    .waitFor({ state: "hidden" });
  await page
    .locator("nav")
    .getByRole("button", { name: "Site settings", exact: true })
    .click();
  await page.getByLabel(/^Site ID/).fill("review-site");
  await page.getByRole("button", { name: "Save settings" }).click();
  await page
    .getByText("Unsaved changes", { exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(gateway.config.SiteId, "review-site");
  await page
    .locator("nav")
    .getByRole("button", { name: "Overview", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () => document.querySelector(".sidebar").getBoundingClientRect().right <= 0,
  );
  if (await page.getByRole("button", { name: "Dismiss notification" }).count())
    await page.getByRole("button", { name: "Dismiss notification" }).click();
  await page.screenshot({
    path: join(artifacts, "mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "mobile viewport should not overflow",
  );
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .locator("nav")
    .getByRole("button", { name: "Cloud delivery", exact: true })
    .click();
  await page.getByRole("heading", { name: "Cloud delivery." }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Browser QA passed: onboarding, config save, sensor creation, real failed read, live monitor, CSV export, repeated groups, CSV preview/import, site settings, mobile navigation. No browser errors.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await gateway.close();
  await rm(dir, { recursive: true, force: true });
}
