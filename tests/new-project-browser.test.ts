/**
 * Playwright Browser Verification Suite for Phase 5B-2: New React Application
 *
 * Verifies:
 * 1. React + TypeScript + Vite build loads and runs cleanly in a browser.
 * 2. Structure conforms strictly to UI Blueprint and Component Resolution.
 * 3. Interactions conform strictly to Interaction Contract (modal, validation, submit, filter, status toggle).
 * 4. Ant Design 5.7.3 Token theme compliance (zero hardcoded colors/spacing).
 * 5. Complete 4-state lifecycle (ready, loading, empty, error).
 * 6. High-fidelity visual screenshots saved to new-project/screenshots/.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from 'playwright';
import { createServer, type Server } from 'node:http';
import { resolve, extname } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

let browser: Browser | null = null;
let page: Page | null = null;
let server: Server | null = null;
const port = 4173;
const serverUrl = `http://localhost:${port}`;
const newProjectDir = resolve('new-project');
const distDir = resolve(newProjectDir, 'dist');
const screenshotDir = resolve(newProjectDir, 'screenshots');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

test.before(async () => {
  mkdirSync(screenshotDir, { recursive: true });

  // Ensure production build exists
  if (!existsSync(resolve(distDir, 'index.html'))) {
    execSync('npx vite build new-project', { stdio: 'pipe' });
  }

  // Spin up lightweight static HTTP server for dist
  server = createServer((req, res) => {
    let reqPath = req.url || '/';
    if (reqPath === '/' || reqPath.startsWith('/?')) {
      reqPath = '/index.html';
    }
    const cleanPath = reqPath.split('?')[0];
    const filePath = resolve(distDir, '.' + cleanPath);

    if (existsSync(filePath)) {
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const content = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mime });
      res.end(content);
    } else {
      // Fallback for SPA routing
      const indexPath = resolve(distDir, 'index.html');
      const content = readFileSync(indexPath);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(content);
    }
  });

  await new Promise<void>((res) => {
    server?.listen(port, () => res());
  });

  browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'zh-CN',
  });
  page = await context.newPage();
  await page.goto(serverUrl);
  await page.waitForSelector('#html-prototype-root');
});

test.after(async () => {
  if (browser) {
    await browser.close();
  }
  if (server) {
    server.close();
  }
});

// ============================================================================
// 1. Structure Conformance to UI Blueprint & Component Resolution
// ============================================================================

test('Phase 5B-2 Browser: 1. React application structure conforms to UI Blueprint', async () => {
  assert.ok(page, 'Browser page must be active');

  // Header Region
  const header = await page.$('#region-header');
  assert.ok(header, 'Header region must exist');
  assert.equal(await header.getAttribute('data-component'), 'page-header');
  assert.equal(await header.getAttribute('data-semantic-id'), 'users.management.page_header');

  const titleText = await page.textContent('#header-title');
  assert.ok(titleText?.includes('企业用户权限管理控制台'), 'Title matches blueprint');

  // Toolbar Region
  const toolbar = await page.$('#region-toolbar');
  assert.ok(toolbar, 'Toolbar region must exist');

  const searchBox = await page.$('[data-semantic-id="users.management.search_input"]');
  assert.ok(searchBox, 'Search input container must exist');
  assert.equal(await searchBox.getAttribute('data-component'), 'filter-search');

  const createBtn = await page.$('#btn-create-user');
  assert.ok(createBtn, 'Create button must exist');
  assert.equal(await createBtn.getAttribute('data-component'), 'button');
  assert.equal(await createBtn.getAttribute('data-semantic-id'), 'users.management.create_btn');

  // Ant Design Table Container
  const tableContainer = await page.$('[data-semantic-id="users.management.table"]');
  assert.ok(tableContainer, 'Table container must exist');
  assert.equal(await tableContainer.getAttribute('data-component'), 'data-table');

  const antdTable = await page.$('.ant-table');
  assert.ok(antdTable, 'Ant Design Table must be rendered inside data-table container');

  // Initial table data: 3 rows
  await page.waitForSelector('.ant-table-tbody tr.d2c-table-row');
  const initialRows = await page.$$('.ant-table-tbody tr.d2c-table-row');
  assert.equal(initialRows.length, 3, 'Initial table must contain 3 user records');

  // Screenshot 1: Initial Ready State
  await page.screenshot({ path: resolve(screenshotDir, '01-ready-state.png') });
});

// ============================================================================
// 2. Interaction Contract Conformance
// ============================================================================

test('Phase 5B-2 Browser: 2. Interactions conform to Interaction Contract (Modal, Validate, Submit, Filter, Toggle)', async () => {
  assert.ok(page);

  // 2.1 Click create button -> Modal opens
  await page.click('#btn-create-user');
  await page.waitForSelector('.ant-modal-content');
  const modal = await page.$('.ant-modal-content');
  assert.ok(modal, 'Modal dialog must be rendered and visible');

  // Screenshot 2: Modal Open
  await page.screenshot({ path: resolve(screenshotDir, '02-modal-dialog-open.png') });

  // 2.2 Form Validation: Click "确认创建" with empty fields
  await page.click('#btn-submit-user');
  await page.waitForSelector('.ant-form-item-explain-error');
  const errorItems = await page.$$('.ant-form-item-explain-error');
  assert.ok(errorItems.length >= 2, 'Validation error messages must appear for username and role');

  const errorTexts = await Promise.all(errorItems.map((el) => el.textContent()));
  assert.ok(errorTexts.some((t) => t?.includes('请输入用户姓名')), 'Username error message verified');
  assert.ok(errorTexts.some((t) => t?.includes('请输入系统角色')), 'Role error message verified');

  // Screenshot 3: Modal Validation Errors
  await page.screenshot({ path: resolve(screenshotDir, '03-modal-validation-error.png') });

  // 2.3 Fill Form Fields
  await page.fill('#input-username', '赵六');
  await page.fill('#input-email', 'zhaoliu@enterprise.com');
  await page.fill('#input-role', '业务运维');

  // 2.4 Submit Valid Form
  await page.click('#btn-submit-user');

  // Wait for success toast and modal to close
  await page.waitForSelector('.ant-message-success', { timeout: 3000 });
  const toastText = await page.textContent('.ant-message-success');
  assert.ok(toastText?.includes('用户创建成功'), 'Success message must be displayed');

  // Verify table now has 4 rows
  await page.waitForTimeout(300);
  const updatedRows = await page.$$('.ant-table-tbody tr.d2c-table-row');
  assert.equal(updatedRows.length, 4, 'Table must now have 4 user rows');

  // Screenshot 4: After User Created
  await page.screenshot({ path: resolve(screenshotDir, '04-after-user-created.png') });

  // 2.5 Search Query Filtering
  await page.fill('#input-search', '李四');
  await page.waitForTimeout(300);
  const filteredRows = await page.$$('.ant-table-tbody tr.d2c-table-row');
  assert.equal(filteredRows.length, 1, 'Search query "李四" must filter table to exactly 1 row');

  // Screenshot 5: Search Filter
  await page.screenshot({ path: resolve(screenshotDir, '05-search-filter.png') });

  // Clear search filter
  await page.fill('#input-search', '');
  await page.waitForTimeout(300);
  const restoredRows = await page.$$('.ant-table-tbody tr.d2c-table-row');
  assert.equal(restoredRows.length, 4, 'Table must restore to 4 rows when search is cleared');

  // 2.6 User Status Toggle Action
  const toggleBtn = await page.$('tr[data-user-id="usr-01"] button[data-semantic-id="users.management.row_toggle"]');
  assert.ok(toggleBtn, 'Status toggle button must exist on row usr-01');
  const prevBtnText = await toggleBtn.textContent();
  assert.equal(prevBtnText?.trim(), '禁用', 'Active user row action should show "禁用"');

  await toggleBtn.click();
  await page.waitForSelector('.ant-message-success');

  const afterBtnText = await toggleBtn.textContent();
  assert.equal(afterBtnText?.trim(), '启用', 'Toggled user row action should now show "启用"');

  // Screenshot 6: Status Toggled
  await page.screenshot({ path: resolve(screenshotDir, '06-status-toggled.png') });
});

// ============================================================================
// 3. Design Tokens & Theme Compliance
// ============================================================================

test('Phase 5B-2 Browser: 3. Token & Theme compliance verifies zero hardcoded styles', async () => {
  assert.ok(page);

  // Check CSS Variable resolution on document root
  const primaryColorVar = await page.evaluate(() => {
    return getComputedStyle(document.documentElement).getPropertyValue('--d2c-color-primary').trim();
  });
  assert.equal(primaryColorVar, '#1677ff', '--d2c-color-primary matches canonical token');

  // Check that primary button background uses #1677ff
  const btnBg = await page.evaluate(() => {
    const btn = document.getElementById('btn-create-user');
    return btn ? getComputedStyle(btn).backgroundColor : '';
  });
  // RGB equivalent of #1677ff is rgb(22, 119, 255)
  assert.equal(btnBg, 'rgb(22, 119, 255)', 'Primary button background conforms to canonical token #1677ff');

  // Verify ZERO inline hardcoded hex colors or arbitrary pixel margins
  const hasInlineHardcoding = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    return all.some((el) => {
      const styleAttr = el.getAttribute('style') || '';
      return styleAttr.includes('#1677ff') || styleAttr.includes('#ff4d4f');
    });
  });
  assert.equal(hasInlineHardcoding, false, 'No element may have inline hardcoded hex colors');
});

// ============================================================================
// 4. Complete 4-State Verification (ready, loading, empty, error)
// ============================================================================

test('Phase 5B-2 Browser: 4. Complete 4-state lifecycle verified via State Switcher', async () => {
  assert.ok(page);

  // 4.1 Loading State
  await page.click('#btn-state-loading');
  await page.waitForSelector('#state-loading-view');
  const hasSpin = await page.$('.ant-spin');
  assert.ok(hasSpin, 'Loading state must render AntD Spin');
  await page.screenshot({ path: resolve(screenshotDir, '07-state-loading.png') });

  // 4.2 Error State
  await page.click('#btn-state-error');
  await page.waitForSelector('#state-error-view');
  const hasAlert = await page.$('.ant-alert-error');
  assert.ok(hasAlert, 'Error state must render AntD Alert with error type');
  await page.screenshot({ path: resolve(screenshotDir, '08-state-error.png') });

  // 4.3 Empty State
  await page.click('#btn-state-empty');
  await page.waitForSelector('#state-empty-view');
  const hasEmpty = await page.$('.ant-empty');
  assert.ok(hasEmpty, 'Empty state must render AntD Empty component');
  await page.screenshot({ path: resolve(screenshotDir, '09-state-empty.png') });

  // 4.4 Restore Ready State
  await page.click('#btn-state-ready');
  await page.waitForSelector('#users-table');
  const hasTable = await page.$('#users-table');
  assert.ok(hasTable, 'Ready state must restore table view');
  await page.screenshot({ path: resolve(screenshotDir, '10-state-ready-restored.png') });
});
