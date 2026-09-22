/**
 * Playwright Browser Verification Suite for Phase 5A: React Prototype
 *
 * Verifies:
 * 1. Component mapping is correct (AntD Button, Table, Input, Modal, Tags).
 * 2. Page structure conforms to Blueprint (Header, Toolbar, Content, Modal).
 * 3. Interactions conform to Contract (click -> open modal -> validation -> submit -> success).
 * 4. Token usage has zero hardcoding (computes semantic CSS variables).
 * 5. State completeness (ready, loading, empty, error).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

let browser: Browser | null = null;
let page: Page | null = null;
const prototypeHtmlPath = resolve("examples/prototype/users/dist/index.html");
const screenshotDir = resolve("examples/prototype/users/screenshots");

test.before(async () => {
  mkdirSync(screenshotDir, { recursive: true });

  // Ensure prototype app is generated and built
  if (!existsSync(prototypeHtmlPath)) {
    const { buildPrototypeApp } = await import("../tooling/d2c/prototype/builder.js");
    await buildPrototypeApp(resolve("examples/prototype/users"));
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
  });
  page = await context.newPage();
  await page.goto(`file://${prototypeHtmlPath}`);
  await page.waitForSelector("#users-prototype-root");
});

test.after(async () => {
  if (browser) {
    await browser.close();
  }
});

// ============================================================================
// 1. Component Mapping & Semantic ID Verification
// ============================================================================

test("Phase 5A Browser: 1. Component Mapping renders verified AntD primitives with semantic IDs", async () => {
  assert.ok(page, "Page must be open");

  // Primary action button
  const createBtn = await page.$('button[data-semantic-id="users.management.create_btn"]');
  assert.ok(createBtn, "Button with semanticId 'users.management.create_btn' must exist");
  const isPrimary = await createBtn.evaluate((el) => el.classList.contains("ant-btn-primary"));
  assert.equal(isPrimary, true, "Button must be AntD primary variant");

  // Data table
  const table = await page.$('[data-semantic-id="users.management.table"]');
  assert.ok(table, "Table element must be present in DOM");
  const hasAntdTable = await table.evaluate(
    (el) =>
      el.classList.contains("ant-table-wrapper") ||
      el.querySelector(".ant-table") !== null ||
      el.classList.contains("ant-table")
  );
  assert.equal(hasAntdTable, true, "Must be AntD Table wrapper");

  // Search input
  const searchInput = await page.$('[data-semantic-id="users.management.search_input"]');
  assert.ok(searchInput, "Search input with semanticId 'users.management.search_input' must exist");
});

// ============================================================================
// 2. Blueprint Page Structure Conformance
// ============================================================================

test("Phase 5A Browser: 2. Page structure conforms to Blueprint regions", async () => {
  assert.ok(page);

  // Region 1: Header
  const header = await page.$("#region-header");
  assert.ok(header, "Region Header must be present");
  const title = await page.textContent("#header-title");
  assert.ok(title?.includes("企业用户权限管理"), "Header title must match blueprint");

  // Region 2: Toolbar
  const toolbar = await page.$("#region-toolbar");
  assert.ok(toolbar, "Region Toolbar must be present");

  // Region 3: Content
  const content = await page.$("#region-content");
  assert.ok(content, "Region Content must be present");

  // Screenshot: Initial Ready View
  await page.screenshot({ path: resolve(screenshotDir, "01-initial-ready-view.png") });
});

// ============================================================================
// 3. Interactions Conformance to Contract (Click -> Validate -> Submit -> Success)
// ============================================================================

test("Phase 5A Browser: 3. Full Interaction Flow conforms to Contract", async () => {
  assert.ok(page);

  // 3.1 Initial Table State: 3 rows
  const initialRows = await page.$$("#users-table .ant-table-tbody tr.ant-table-row");
  assert.equal(initialRows.length, 3, "Initial table must have 3 rows");

  // 3.2 Click create button -> Modal opens
  await page.click("#btn-create-user");
  await page.waitForSelector(".ant-modal", { state: "visible" });
  const modalVisible = await page.isVisible(".ant-modal");
  assert.equal(modalVisible, true, "Modal must open after click");

  // Screenshot: Modal Open
  await page.screenshot({ path: resolve(screenshotDir, "02-modal-open.png") });

  // 3.3 Form Validation: Submit empty form -> displays required validation error
  await page.click("#btn-submit-user");
  await page.waitForSelector(".ant-form-item-explain-error");
  const validationError = await page.textContent(".ant-form-item-explain-error");
  assert.ok(validationError?.includes("请输入用户姓名"), "Must show validation error for username");

  // 3.4 Fill Form Fields
  await page.fill("#input-username", "赵六");
  await page.fill("#input-email", "zhaoliu@enterprise.com");
  await page.fill("#input-role", "业务运维");

  // 3.5 Submit valid form
  await page.click("#btn-submit-user");

  // 3.6 Success Feedback & Table Updated & Modal Closed
  await page.waitForFunction(
    () => document.querySelectorAll("#users-table .ant-table-tbody tr.ant-table-row").length === 4,
    { timeout: 3000 }
  );
  const updatedRows = await page.$$("#users-table .ant-table-tbody tr.ant-table-row");
  assert.equal(updatedRows.length, 4, "Table must now contain 4 rows");

  await page.waitForSelector(".ant-message-notice", { timeout: 3000 });
  const successNotice = await page.textContent(".ant-message-notice");
  assert.ok(successNotice?.includes("创建成功"), "Must show success message");

  // Screenshot: After user created
  await page.screenshot({ path: resolve(screenshotDir, "03-after-user-created.png") });

  // 3.7 Search filter test
  await page.fill("#input-search", "李四");
  await page.waitForTimeout(200);
  const filteredRows = await page.$$("#users-table .ant-table-tbody tr.ant-table-row");
  assert.equal(filteredRows.length, 1, "Search filter must narrow table to 1 row");

  // Clear search
  await page.fill("#input-search", "");
});

// ============================================================================
// 4. Token Usage: Zero Hardcoding Verification
// ============================================================================

test("Phase 5A Browser: 4. Token usage conforms to Semantic CSS Variables without hardcoding", async () => {
  assert.ok(page);

  // Check CSS Variable resolution on document root
  const primaryColorVar = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue("--d2c-color-primary").trim();
  });
  assert.equal(primaryColorVar, "#1677ff", "--d2c-color-primary must resolve from tokens.css");

  // Check that elements do NOT have inline style hardcoded "#1677ff" or "16px"
  const hasInlineHardcodedColor = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    return all.some((el) => {
      const styleAttr = el.getAttribute("style") || "";
      return styleAttr.includes("#1677ff") || styleAttr.includes("padding: 16px");
    });
  });
  assert.equal(hasInlineHardcodedColor, false, "Must contain ZERO inline hardcoded #1677ff or 16px");
});

// ============================================================================
// 5. State Completeness (ready, loading, empty, error)
// ============================================================================

test("Phase 5A Browser: 5. State Completeness verifies loading, empty, error, and ready", async () => {
  assert.ok(page);

  // 5.1 Switch to loading
  await page.click("#btn-state-loading");
  await page.waitForSelector("#state-loading-view");
  const hasSpin = await page.isVisible(".ant-spin-spinning");
  assert.equal(hasSpin, true, "Loading state must render AntD Spin indicator");
  await page.screenshot({ path: resolve(screenshotDir, "04-state-loading.png") });

  // 5.2 Switch to error
  await page.click("#btn-state-error");
  await page.waitForSelector("#state-error-view");
  const hasAlert = await page.isVisible(".ant-alert-error");
  assert.equal(hasAlert, true, "Error state must render AntD Alert notice");
  await page.screenshot({ path: resolve(screenshotDir, "05-state-error.png") });

  // 5.3 Switch to empty
  await page.click("#btn-state-empty");
  await page.waitForSelector("#state-empty-view");
  const hasEmpty = await page.isVisible(".ant-empty");
  assert.equal(hasEmpty, true, "Empty state must render AntD Empty placeholder");
  await page.screenshot({ path: resolve(screenshotDir, "06-state-empty.png") });

  // 5.4 Switch back to ready
  await page.click("#btn-state-ready");
  await page.waitForSelector("#state-ready-view");
  const hasTable = await page.isVisible("#users-table");
  assert.equal(hasTable, true, "Ready state must restore table view");
});
