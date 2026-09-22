/**
 * Playwright Browser Verification Suite for Phase 5B-1: HTML Prototype
 *
 * Verifies:
 * 1. HTML can be opened independently via file://.
 * 2. Component structure conforms to UI Blueprint.
 * 3. Interactions conform to Interaction Contract (modal open, validation, submit, search).
 * 4. Token usage has zero hardcoding (resolves CSS variables, zero inline hardcoding).
 * 5. Visual screenshots generated in examples/html-prototype/screenshots/.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright";
import { resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

let browser: Browser | null = null;
let page: Page | null = null;
const prototypeHtmlPath = resolve("examples/html-prototype/index.html");
const screenshotDir = resolve("examples/html-prototype/screenshots");

test.before(async () => {
  mkdirSync(screenshotDir, { recursive: true });

  // Ensure HTML prototype is generated
  if (!existsSync(prototypeHtmlPath)) {
    const { generateHtmlPrototype } = await import("../tooling/d2c/html-prototype/generator.js");
    generateHtmlPrototype();
  }

  browser = await chromium.launch({
    headless: true,
    args: ["--allow-file-access-from-files"],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
  });
  page = await context.newPage();
  await page.goto(`file://${prototypeHtmlPath.replace(/\\/g, "/")}`);
  await page.waitForSelector("#html-prototype-root");
});

test.after(async () => {
  if (browser) {
    await browser.close();
  }
});

// ============================================================================
// 1. Independent Opening & Structure Conformance to Blueprint
// ============================================================================

test("Phase 5B-1 Browser: 1. HTML opens independently and structure conforms to Blueprint", async () => {
  assert.ok(page, "Page must be open");

  // Header Region
  const header = await page.$("#region-header");
  assert.ok(header, "Region Header must exist");
  const headerSemanticId = await header.getAttribute("data-semantic-id");
  const headerComponent = await header.getAttribute("data-component");
  assert.equal(headerSemanticId, "users.management.page_header");
  assert.equal(headerComponent, "page-header");

  const titleText = await page.textContent("#header-title");
  assert.ok(titleText?.includes("企业用户权限管理"), "Header title must match blueprint");

  // Toolbar Region
  const toolbar = await page.$("#region-toolbar");
  assert.ok(toolbar, "Region Toolbar must exist");

  const searchBox = await page.$('[data-semantic-id="users.management.search_input"]');
  assert.ok(searchBox, "Search input element must exist with semanticId");
  assert.equal(await searchBox.getAttribute("data-component"), "filter-search");

  const createBtn = await page.$('button[data-semantic-id="users.management.create_btn"]');
  assert.ok(createBtn, "Create button element must exist with semanticId");
  assert.equal(await createBtn.getAttribute("data-component"), "button");

  // Content Region & Table
  const tableContainer = await page.$('[data-semantic-id="users.management.table"]');
  assert.ok(tableContainer, "Table container element must exist with semanticId");
  assert.equal(await tableContainer.getAttribute("data-component"), "data-table");

  // Modal Dialog
  const modal = await page.$('[data-semantic-id="users.management.create_modal"]');
  assert.ok(modal, "Modal dialog element must exist with semanticId");
  assert.equal(await modal.getAttribute("data-component"), "modal-dialog");

  // Form Container
  const form = await page.$('[data-semantic-id="users.management.create_form"]');
  assert.ok(form, "Form container element must exist with semanticId");
  assert.equal(await form.getAttribute("data-component"), "form-container");

  // Screenshot 1: Initial Ready View
  await page.screenshot({ path: resolve(screenshotDir, "01-initial-ready-state.png") });
});

// ============================================================================
// 2. Interaction Conformance to Contract
// ============================================================================

test("Phase 5B-1 Browser: 2. Interactions conform to Contract (Modal, Validate, Submit, Filter)", async () => {
  assert.ok(page);

  // 2.1 Initial table data: 3 rows
  await page.waitForSelector("#users-table-tbody tr.d2c-table-row");
  const initialRows = await page.$$("#users-table-tbody tr.d2c-table-row");
  assert.equal(initialRows.length, 3, "Initial table must have 3 user rows");

  // 2.2 Click create button -> Dialog opens
  await page.click("#btn-create-user");
  const modal = await page.$("#modal-create-user");
  assert.ok(modal);
  const isOpen = await modal.evaluate((el: any) => el.open || el.hasAttribute("open"));
  assert.equal(isOpen, true, "Dialog must have open attribute after clicking create button");

  // Screenshot 2: Modal Dialog Open
  await page.screenshot({ path: resolve(screenshotDir, "02-modal-dialog-open.png") });

  // 2.3 Form validation: Submit empty form
  await page.click("#btn-submit-user");
  await page.waitForSelector("#error-username.visible");
  const usernameError = await page.textContent("#error-username");
  const roleError = await page.textContent("#error-role");
  assert.equal(usernameError?.trim(), "请输入用户姓名");
  assert.equal(roleError?.trim(), "请输入系统角色");

  // 2.4 Fill valid user form
  await page.fill("#input-username", "赵六");
  await page.fill("#input-email", "zhaoliu@enterprise.com");
  await page.fill("#input-role", "业务运维");

  // 2.5 Submit valid form
  await page.click("#btn-submit-user");

  // 2.6 Success feedback, dialog closed, and table updated to 4 rows
  await page.waitForSelector("#toast-notice", { timeout: 3000 });
  const toastText = await page.textContent("#toast-notice");
  assert.ok(toastText?.includes("用户创建成功"), "Toast notification must display success message");

  const isClosed = await modal.evaluate((el: any) => !el.open && !el.hasAttribute("open"));
  assert.equal(isClosed, true, "Dialog must be closed after successful submission");

  // Screenshot 3: After User Created
  await page.screenshot({ path: resolve(screenshotDir, "03-after-user-created.png") });

  const updatedRows = await page.$$("#users-table-tbody tr.d2c-table-row");
  assert.equal(updatedRows.length, 4, "Table must now contain 4 rows");

  // 2.7 Search filter test
  await page.fill("#input-search", "李四");
  await page.waitForTimeout(200);
  const filteredRows = await page.$$("#users-table-tbody tr.d2c-table-row");
  assert.equal(filteredRows.length, 1, "Search filter must narrow table to 1 row");

  // Clear search
  await page.fill("#input-search", "");
  await page.waitForTimeout(200);
  const restoredRows = await page.$$("#users-table-tbody tr.d2c-table-row");
  assert.equal(restoredRows.length, 4, "Table rows must restore to 4 when search is cleared");
});

// ============================================================================
// 3. Token Usage: Zero Hardcoding Verification
// ============================================================================

test("Phase 5B-1 Browser: 3. Token usage conforms to Semantic CSS Variables without hardcoding", async () => {
  assert.ok(page);

  // Check CSS Variable resolution on document root
  const primaryColorVar = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue("--d2c-color-primary").trim();
  });
  assert.equal(primaryColorVar, "#1677ff", "--d2c-color-primary must resolve from tokens.css");

  // Check that elements do NOT have inline style hardcoded "#1677ff" or "16px"
  const hasInlineHardcodedValue = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    return all.some((el) => {
      const styleAttr = el.getAttribute("style") || "";
      return styleAttr.includes("#1677ff") || styleAttr.includes("16px");
    });
  });
  assert.equal(hasInlineHardcodedValue, false, "DOM must contain ZERO inline hardcoded #1677ff or 16px");
});

// ============================================================================
// 4. State Completeness (loading, error, empty, ready)
// ============================================================================

test("Phase 5B-1 Browser: 4. State Completeness verifies loading, error, empty, and ready", async () => {
  assert.ok(page);

  // 4.1 Switch to loading
  await page.click("#btn-state-loading");
  await page.waitForSelector("#state-loading-view", { state: "visible" });
  const hasSpinner = await page.isVisible(".d2c-spinner");
  assert.equal(hasSpinner, true, "Loading state must render Spinner indicator");
  await page.screenshot({ path: resolve(screenshotDir, "04-state-loading.png") });

  // 4.2 Switch to error
  await page.click("#btn-state-error");
  await page.waitForSelector("#state-error-view", { state: "visible" });
  const hasAlert = await page.isVisible(".d2c-alert-error");
  assert.equal(hasAlert, true, "Error state must render Alert notice");
  await page.screenshot({ path: resolve(screenshotDir, "05-state-error.png") });

  // 4.3 Switch to empty
  await page.click("#btn-state-empty");
  await page.waitForSelector("#state-empty-view", { state: "visible" });
  const hasEmpty = await page.isVisible(".d2c-empty-placeholder");
  assert.equal(hasEmpty, true, "Empty state must render Empty placeholder");
  await page.screenshot({ path: resolve(screenshotDir, "06-state-empty.png") });

  // 4.4 Switch back to ready
  await page.click("#btn-state-ready");
  await page.waitForSelector("#state-ready-view", { state: "visible" });
  const hasTable = await page.isVisible("#users-table");
  assert.equal(hasTable, true, "Ready state must restore table view");
});

// ============================================================================
// 5. Phase 6 Incremental Evolution: Batch Import Verification
// ============================================================================

test("Phase 6 Evolution Browser: 5. Incremental Batch Import modal and old features coexist", async () => {
  assert.ok(page);

  // Check import button exists
  const importBtn = await page.$("#btn-import-user");
  assert.ok(importBtn, "Import button must exist");
  assert.equal(await importBtn.getAttribute("data-semantic-id"), "users.management.import_btn");

  // Open import modal
  await page.click("#btn-import-user");
  const modal = await page.$("#modal-import-user");
  assert.ok(modal);
  const isOpen = await modal.evaluate((el: any) => el.open || el.hasAttribute("open"));
  assert.equal(isOpen, true, "Import modal must be open");

  // Input batch users
  await page.fill("#textarea-import-data", "孙七,sunqi@enterprise.com,业务运维\n周八,zhouba@enterprise.com,安全审计员");
  await page.click("#btn-submit-import");

  // Success toast
  const toast = page.locator(".d2c-toast", { hasText: "批量导入成功" });
  await toast.waitFor({ timeout: 3000 });
  const toastText = await toast.textContent();
  assert.ok(toastText?.includes("批量导入成功"), "Batch import toast must appear");

  // Check table rows increased
  const currentRows = await page.$$("#users-table-tbody tr.d2c-table-row");
  assert.ok(currentRows.length >= 6, "Table rows must include newly imported users");
});
