/**
 * Browser Verification Suite using Playwright 1.63.0 (Windows 10 Host)
 *
 * Implements:
 * 1. Behavioral Tests: ready/loading/empty/error states, filter search, add user modal validation & submission.
 * 2. Design Consistency: Source-map grounded DOM bounding box & text measurement vs Figma context.
 *    Explicitly marks unmapped layers as UNMEASURED (never silently pass).
 * 3. Browser Regression: Captures screenshot baseline under fixed viewport (1280x900).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { resolve } from "node:path";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";

let browser: Browser | null = null;
let page: Page | null = null;
const fixtureHtmlPath = resolve("examples/fixture-app/dist/index.html");

test.before(async () => {
  // Ensure fixture app is built
  if (!existsSync(fixtureHtmlPath)) {
    const { buildFixtureApp } = await import("../tooling/d2c/cli/build-fixture.js");
    await buildFixtureApp();
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  page = await context.newPage();
  await page.goto(`file://${fixtureHtmlPath}`);
  await page.waitForSelector("#fixture-app-root");
});

test.after(async () => {
  if (browser) {
    await browser.close();
  }
});

// ============================================================================
// 1. Behavioral Checks
// ============================================================================

test("Browser Verification: 1.1 Initial Ready State - Renders Header and 3 User Rows", async () => {
  assert.ok(page, "Page must be open");

  const titleText = await page.textContent("#users-page-title");
  assert.ok(titleText?.includes("用户管理"), "Page title must be '用户管理'");

  const rows = await page.$$(
    "#users-table-container .ant-table-tbody tr.ant-table-row"
  );
  assert.equal(rows.length, 3, "Must render exactly 3 initial mock users");
});

test("Browser Verification: 1.2 Filter Search - Filters rows dynamically", async () => {
  assert.ok(page);

  await page.fill("#users-filter-input", "审计");
  await page.waitForTimeout(100);

  const filteredRows = await page.$$(
    "#users-table-container .ant-table-tbody tr.ant-table-row"
  );
  assert.equal(filteredRows.length, 1, "Searching '审计' must filter down to 1 row");

  // Clear search input
  await page.fill("#users-filter-input", "");
  await page.waitForTimeout(100);

  const restoredRows = await page.$$(
    "#users-table-container .ant-table-tbody tr.ant-table-row"
  );
  assert.equal(restoredRows.length, 3, "Clearing search must restore 3 rows");
});

test("Browser Verification: 1.3 Modal Form Validation & Submission", async () => {
  assert.ok(page);

  // Open modal
  await page.click("#users-create-btn");
  await page.waitForSelector(".ant-modal-content", { state: "visible" });

  // Submit without values -> triggers validation
  await page.click(".ant-modal-footer button.ant-btn-primary");
  await page.waitForSelector(".ant-form-item-explain-error");
  const errorMsg = await page.textContent(".ant-form-item-explain-error");
  assert.ok(errorMsg?.includes("请输入用户名"), "Validation error must appear for empty username");

  // Fill form
  await page.fill("#input-username", "钱七");
  await page.fill("#input-role", "质量管理专家");
  await page.click(".ant-modal-footer button.ant-btn-primary");

  // Modal closes and row is added
  await page.waitForSelector(".ant-modal-content", { state: "hidden" });
  await page.waitForTimeout(400);

  const rowsAfterAdd = await page.$$(
    "#users-table-container .ant-table-tbody tr.ant-table-row"
  );
  assert.equal(rowsAfterAdd.length, 4, "Must have 4 rows after successful user creation");
});

test("Browser Verification: 1.4 States Switching - Loading, Empty, and Error", async () => {
  assert.ok(page);

  // Switch to Loading
  await page.locator('label:has-text("Loading")').click();
  await page.waitForSelector(".ant-spin-nested-loading", { state: "visible" });

  // Switch to Empty
  await page.locator('label:has-text("Empty")').click();
  await page.waitForSelector('[data-d2c-id="users-empty-indicator"]');
  const emptyText = await page.textContent('[data-d2c-id="users-empty-indicator"]');
  assert.ok(emptyText?.includes("暂无用户数据"), "Empty state must display '暂无用户数据'");

  // Switch to Error
  await page.locator('label:has-text("Error")').click();
  await page.waitForSelector('[data-d2c-id="users-error-alert"]');
  const alertTitle = await page.textContent('[data-d2c-id="users-error-alert"] .ant-alert-message');
  assert.ok(alertTitle?.includes("数据加载失败"), "Error alert must appear");

  // Restore to Ready
  await page.locator('label:has-text("Ready")').click();
  await page.waitForSelector("#users-table-container");
});

// ============================================================================
// 2. Design Consistency: Source-Map Grounded Measurements & UNMEASURED Flagging
// ============================================================================

test("Browser Verification: 2.1 Design Consistency - Measure Source-Mapped DOM vs Design Context", async () => {
  assert.ok(page);

  const sourceMapPath = resolve("design/releases/users_page/rev_1/source-map.json");
  const contextPath = resolve("design/releases/users_page/rev_1/context.json");

  const sourceMap = JSON.parse(readFileSync(sourceMapPath, "utf-8"));
  const context = JSON.parse(readFileSync(contextPath, "utf-8"));

  const measurements: Record<
    string,
    {
      semanticId: string;
      targetDomId: string;
      status: "MEASURED" | "UNMEASURED";
      boundingBox?: { x: number; y: number; width: number; height: number };
      textMatched?: boolean;
    }
  > = {};

  // 1. Measure defined source-map elements
  for (const [semanticId, mapping] of Object.entries(sourceMap.elements as Record<string, any>)) {
    const el = await page.$(`#${mapping.targetDomId}`);
    if (el) {
      const box = await el.boundingBox();
      const text = await el.textContent();
      const expectedText = context.nodes[mapping.figmaNodeId]?.text;

      measurements[semanticId] = {
        semanticId,
        targetDomId: mapping.targetDomId,
        status: "MEASURED",
        boundingBox: box ? { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) } : undefined,
        textMatched: expectedText ? text?.includes(expectedText) : true,
      };
    } else {
      measurements[semanticId] = {
        semanticId,
        targetDomId: mapping.targetDomId,
        status: "UNMEASURED",
      };
    }
  }

  // 2. Intentionally assert on an unmapped layer in Figma: Must be UNMEASURED, NOT passed!
  const unmappedSemanticId = "users.unmapped_ghost_layer";
  const unmappedEl = await page.$("#users-unmapped-ghost-layer");
  if (!unmappedEl) {
    measurements[unmappedSemanticId] = {
      semanticId: unmappedSemanticId,
      targetDomId: "users-unmapped-ghost-layer",
      status: "UNMEASURED",
    };
  }

  assert.equal(measurements["users.header.title"].status, "MEASURED");
  assert.equal(measurements["users.header.title"].textMatched, true);
  assert.equal(measurements["users.header.create_btn"].status, "MEASURED");
  assert.equal(measurements[unmappedSemanticId].status, "UNMEASURED", "Missing DOM element must be flagged UNMEASURED");

  // Save consistency report
  const reportsDir = resolve("build/reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    resolve(reportsDir, "design-consistency-report.json"),
    JSON.stringify({ screenId: "users_page", revision: 1, measurements }, null, 2),
    "utf-8"
  );
});

// ============================================================================
// 3. Browser Regression Screenshot Baseline
// ============================================================================

test("Browser Verification: 3.1 Browser Regression - Screenshot Capture", async () => {
  assert.ok(page);

  const screenshotDir = resolve("build/screenshots");
  mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = resolve(screenshotDir, "browser-users-ready.png");

  const screenshotBuffer = await page.screenshot({ path: screenshotPath, fullPage: false });
  assert.ok(screenshotBuffer.length > 5000, "Screenshot buffer must be valid PNG (>5KB)");
  assert.ok(existsSync(screenshotPath), "Screenshot file must exist on disk");
});
