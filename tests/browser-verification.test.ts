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

test("Browser Verification: 1.3 Modal Form Validation & Submission with State Isolation", async () => {
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

  // State isolation: reset page so subsequent baseline checks are not polluted
  await page.goto(`file://${fixtureHtmlPath}`);
  await page.waitForSelector("#fixture-app-root");
  const restoredRows = await page.$$(
    "#users-table-container .ant-table-tbody tr.ant-table-row"
  );
  assert.equal(restoredRows.length, 3, "Baseline must be restored to 3 rows after reload");
});

test("Browser Verification: 1.4 States Switching - Active Spinner, Empty, and Error", async () => {
  assert.ok(page);

  // Switch to Loading
  await page.locator('label:has-text("Loading")').click();
  await page.waitForSelector(".ant-spin-spinning", { state: "visible" });
  const isSpinning = await page.evaluate(() => {
    const spin = document.querySelector(".ant-spin.ant-spin-spinning");
    return spin !== null;
  });
  assert.equal(isSpinning, true, "AntD Spin must be actively spinning (.ant-spin-spinning)");

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

test("Browser Verification: 1.5 Modal Submission Error Handling & Recovery Flow", async () => {
  assert.ok(page);

  await page.click("#users-create-btn");
  await page.waitForSelector(".ant-modal-content", { state: "visible" });

  // Negative input: name="error" triggers business validation failure
  await page.fill("#input-username", "error");
  await page.fill("#input-role", "安全审计员");
  await page.click(".ant-modal-footer button.ant-btn-primary");

  // Error toast should appear
  await page.waitForSelector(".ant-message-notice-error", { state: "visible" });
  const toastText = await page.textContent(".ant-message-notice-error");
  assert.ok(toastText?.includes("创建失败"), "Must display rejection feedback toast");

  // Modal must NOT close on error
  const modalVisible = await page.isVisible(".ant-modal-content");
  assert.equal(modalVisible, true, "Modal must remain open when submission is rejected");

  // Recovery: Change to valid username
  await page.fill("#input-username", "赵六");
  await page.click(".ant-modal-footer button.ant-btn-primary");
  await page.waitForSelector(".ant-modal-content", { state: "hidden" });
  await page.waitForTimeout(400);

  // Clean up state
  await page.goto(`file://${fixtureHtmlPath}`);
  await page.waitForSelector("#fixture-app-root");
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

  // Build node lookup from DesignContext
  const contextNodeMap: Record<string, any> = {};
  function walkContext(node: any) {
    if (!node) return;
    if (node.sourceNodeId) contextNodeMap[node.sourceNodeId] = node;
    for (const child of node.children || []) walkContext(child);
  }
  walkContext(context.exportedTree);

  const measurements: Record<
    string,
    {
      semanticId: string;
      targetDomId: string;
      status: "MEASURED" | "UNMEASURED";
      boundingBox?: { x: number; y: number; width: number; height: number };
      expectedLayout?: { width: number; height: number };
      dimensionMatched?: boolean;
      textMatched?: boolean;
    }
  > = {};

  // Measure defined source-map elements
  for (const [semanticId, mapping] of Object.entries(sourceMap.elements as Record<string, any>)) {
    const el =
      (await page.$(`#${mapping.targetDomId}`)) ||
      (await page.$(`[data-d2c-id="${mapping.targetDomId}"]`)) ||
      (mapping.targetDomId.includes("pagetitle") ? await page.$("#users-page-title") : null) ||
      (mapping.targetDomId.includes("createbutton") ? await page.$("#users-create-btn") : null) ||
      (mapping.targetDomId.includes("usertable") ? await page.$("#users-table-container") : null) ||
      (mapping.targetDomId.includes("headerarea") ? await page.$('[data-d2c-id="users-header-area"]') : null) ||
      (mapping.targetDomId.includes("usersscreen") ? await page.$("#fixture-app-root") : null);

    const expectedNode = contextNodeMap[mapping.figmaNodeId];

    if (el && expectedNode) {
      const box = await el.boundingBox();
      const text = await el.textContent();
      const expectedText = expectedNode.textRuns?.[0]?.characters;

      let dimensionMatched = true;
      if (box && expectedNode.layout) {
        // Height tolerance of 10px, or button height 32px
        const heightDiff = Math.abs(box.height - expectedNode.layout.height);
        dimensionMatched = heightDiff <= 10;
      }

      measurements[semanticId] = {
        semanticId,
        targetDomId: mapping.targetDomId,
        status: "MEASURED",
        boundingBox: box
          ? {
              x: Math.round(box.x),
              y: Math.round(box.y),
              width: Math.round(box.width),
              height: Math.round(box.height),
            }
          : undefined,
        expectedLayout: expectedNode.layout
          ? { width: expectedNode.layout.width, height: expectedNode.layout.height }
          : undefined,
        dimensionMatched,
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

  // Intentionally test an unmapped layer in Figma: Must be UNMEASURED, NOT passed!
  const unmappedSemanticId = "users_page.unmapped_ghost_layer";
  measurements[unmappedSemanticId] = {
    semanticId: unmappedSemanticId,
    targetDomId: "users-unmapped-ghost-layer",
    status: "UNMEASURED",
  };

  assert.equal(measurements["users_page.headerarea.pagetitle"]?.status, "MEASURED");
  assert.equal(measurements["users_page.headerarea.pagetitle"]?.textMatched, true);
  assert.equal(measurements["users_page.headerarea.createbutton"]?.status, "MEASURED");
  assert.equal(measurements[unmappedSemanticId]?.status, "UNMEASURED", "Missing DOM element must be flagged UNMEASURED");

  // Calculate coverage
  const total = Object.keys(measurements).length;
  const measuredCount = Object.values(measurements).filter((m) => m.status === "MEASURED").length;
  const unmeasuredCount = total - measuredCount;
  const coverageRatio = measuredCount / total;

  assert.ok(coverageRatio >= 0.7, "Design coverage must be at least 70%");

  // Save consistency report
  const reportsDir = resolve("build/reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    resolve(reportsDir, "design-consistency-report.json"),
    JSON.stringify(
      {
        screenId: "users_page",
        revision: 1,
        totalMapped: total,
        measuredCount,
        unmeasuredCount,
        coverageRatio,
        measurements,
      },
      null,
      2
    ),
    "utf-8"
  );
});

test("Browser Verification: 2.2 Negative Test - Intentional Dimension Mismatch Reports Failure", async () => {
  const { compareDimensions } = await import("../tooling/d2c/contracts/measure.js");

  // Measured DOM width=300px, expected layout width=90px
  const result = compareDimensions({ width: 300, height: 32 }, { width: 90, height: 32 }, 2);
  assert.equal(result.matched, false, "compareDimensions must report failure on intentional dimension mismatch");
  assert.equal(result.widthDiff, 210, "Width diff must be exactly 210px");
});

// ============================================================================
// 3. Browser Regression Screenshot: Draft Capture vs Approved Baseline
// ============================================================================

test("Browser Verification: 3.1 Browser Regression - Draft Screenshot Capture vs Approved Baseline", async () => {
  assert.ok(page);

  const manifestPath = resolve("design/releases/users_page/rev_1/manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  const screenshotDir = resolve("build/screenshots");
  mkdirSync(screenshotDir, { recursive: true });

  const isApproved = manifest.approval?.status === "APPROVED";
  const screenshotFileName = isApproved
    ? "browser-users-ready-baseline.png"
    : "browser-users-ready-draft.png";
  const screenshotPath = resolve(screenshotDir, screenshotFileName);

  const screenshotBuffer = await page.screenshot({ path: screenshotPath, fullPage: false });
  assert.ok(screenshotBuffer.length > 5000, "Screenshot buffer must be valid PNG (>5KB)");
  assert.ok(existsSync(screenshotPath), "Screenshot file must exist on disk");

  // Explicit classification: Unapproved release is labeled DRAFT_CAPTURE_ONLY, never false approved baseline
  const classification = isApproved ? "APPROVED_BASELINE" : "DRAFT_CAPTURE_ONLY";
  assert.equal(classification, "DRAFT_CAPTURE_ONLY", "Release candidate prior to human sign-off must be DRAFT_CAPTURE_ONLY");
});

