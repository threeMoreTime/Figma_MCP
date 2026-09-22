/**
 * Design Change Propagation Verification Suite
 *
 * Verifies 03-export-to-real-code.md Section E & Prompt Section 7:
 * - Content hash changes between revisions
 * - Previous approval is strictly invalidated (isApprovalValid === false)
 * - Differences are pinpointed to exact element IDs
 * - Implementation update honors new design deltas
 * - Note: Automated fixture verification is PASS; Live Figma roundtrip is BLOCKED awaiting user canvas edit.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isApprovalValid } from "../tooling/d2c/contracts/hash.js";
import type { DesignPackageManifest } from "../tooling/d2c/contracts/schema.js";

test("Change Propagation: 1. Content Hash Changes & Stale Approval Invalidation", () => {
  const rev1ManifestPath = resolve("design/releases/users_page/rev_1/manifest.json");
  const rev2ManifestPath = resolve("design/releases/users_page/rev_2/manifest.json");

  const manifest1: DesignPackageManifest = JSON.parse(readFileSync(rev1ManifestPath, "utf-8"));
  const manifest2: DesignPackageManifest = JSON.parse(readFileSync(rev2ManifestPath, "utf-8"));

  assert.ok(manifest1.contentHash, "Rev 1 must have contentHash");
  assert.ok(manifest2.contentHash, "Rev 2 must have contentHash");
  assert.notEqual(manifest1.contentHash, manifest2.contentHash, "ContentHash must differ between rev 1 and rev 2");

  // Suppose Rev 1 was approved
  const approvedRev1: DesignPackageManifest = {
    ...manifest1,
    approval: {
      status: "APPROVED",
      approvedBy: "QA Reviewer",
      approvedAt: "2026-09-22T09:00:00Z",
      bindingContentHash: manifest1.contentHash,
    },
  };
  assert.equal(isApprovalValid(approvedRev1), true, "Rev 1 approval must be valid against rev 1 hash");

  // Applying Rev 1 approval to Rev 2 package must be rejected!
  const staleApprovedRev2: DesignPackageManifest = {
    ...manifest2,
    approval: approvedRev1.approval, // Stale approval from rev 1
  };
  assert.equal(isApprovalValid(staleApprovedRev2), false, "Stale approval from Rev 1 must be invalid for Rev 2");
});

test("Change Propagation: 2. Precise Diff Pinpointing to Exact Elements", () => {
  const rev1ContextPath = resolve("design/releases/users_page/rev_1/context.json");
  const rev2ContextPath = resolve("design/releases/users_page/rev_2/context.json");

  const ctx1 = JSON.parse(readFileSync(rev1ContextPath, "utf-8"));
  const ctx2 = JSON.parse(readFileSync(rev2ContextPath, "utf-8"));

  // Find HeaderArea node
  function findNode(tree: any, semanticIdSuffix: string): any {
    if (!tree) return null;
    if (tree.identity?.semanticId?.endsWith(semanticIdSuffix)) return tree;
    for (const child of tree.children || []) {
      const found = findNode(child, semanticIdSuffix);
      if (found) return found;
    }
    return null;
  }

  const header1 = findNode(ctx1.exportedTree, "headerarea");
  const header2 = findNode(ctx2.exportedTree, "headerarea");
  assert.ok(header1 && header2, "HeaderArea node must exist in both revisions");
  assert.equal(header1.layout.itemSpacing, 16, "Rev 1 spacing must be 16");
  assert.equal(header2.layout.itemSpacing, 24, "Rev 2 spacing must be 24");

  // Title text diff
  const title1 = findNode(ctx1.exportedTree, "pagetitle");
  const title2 = findNode(ctx2.exportedTree, "pagetitle");
  assert.ok(title1 && title2, "PageTitle node must exist in both revisions");
  assert.equal(title1.textRuns[0].characters, "用户管理");
  assert.equal(title2.textRuns[0].characters, "系统用户列表");

  // Button variant diff
  const btn1 = findNode(ctx1.exportedTree, "createbutton");
  const btn2 = findNode(ctx2.exportedTree, "createbutton");
  assert.ok(btn1 && btn2, "CreateButton node must exist in both revisions");
  assert.equal(btn1.variantProps.type, "primary");
  assert.equal(btn2.variantProps.type, "dashed");
});

test("Change Propagation: 3. Implementation Update Reflects New Package via Page Adapter", async () => {
  const {
    adaptDesignContextToUsersPageProps,
    getAdaptedUsersPagePropsForRevision,
  } = await import("../examples/fixture-app/src/adapter/page-adapter.js");

  const rev1Props = getAdaptedUsersPagePropsForRevision(1);
  const rev2Props = getAdaptedUsersPagePropsForRevision(2);

  // Assert adapter outputs for Rev 1
  assert.equal(rev1Props.revision, 1);
  assert.equal(rev1Props.titleText, "用户管理");
  assert.equal(rev1Props.createButtonVariant, "primary");
  assert.equal(rev1Props.spacing, 16);
  assert.ok(rev1Props.contentHash.length > 0);

  // Assert adapter outputs for Rev 2
  assert.equal(rev2Props.revision, 2);
  assert.equal(rev2Props.titleText, "系统用户列表");
  assert.equal(rev2Props.createButtonVariant, "dashed");
  assert.equal(rev2Props.spacing, 24);
  assert.ok(rev2Props.contentHash.length > 0);

  assert.notEqual(rev1Props.contentHash, rev2Props.contentHash, "Content hashes must differ");
});

test("Change Propagation: 4. Real Browser Playwright Verification of Revision Switch", async () => {
  const { chromium } = await import("playwright");
  const fixtureHtmlPath = resolve("examples/fixture-app/dist/index.html");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "zh-CN",
    });
    const page = await context.newPage();

    // 1. Load Rev 1
    await page.goto(`file://${fixtureHtmlPath}?rev=1`);
    await page.waitForSelector("#fixture-app-root");

    const rev1Attr = await page.getAttribute("#fixture-app-root", "data-d2c-revision");
    assert.equal(rev1Attr, "1", "DOM data-d2c-revision must be '1'");

    const rev1Spacing = await page.getAttribute("#fixture-app-root", "data-d2c-spacing");
    assert.equal(rev1Spacing, "16", "DOM data-d2c-spacing must be '16'");

    const rev1Title = await page.textContent("#users-page-title");
    assert.ok(rev1Title?.includes("用户管理"), "Rev 1 title must be '用户管理'");

    const isRev1Primary = await page.evaluate(() => {
      const btn = document.getElementById("users-create-btn");
      return btn?.classList.contains("ant-btn-primary") ?? false;
    });
    assert.equal(isRev1Primary, true, "Rev 1 create button must have ant-btn-primary class");

    // 2. Switch to Rev 2
    await page.goto(`file://${fixtureHtmlPath}?rev=2`);
    await page.waitForSelector("#fixture-app-root");

    const rev2Attr = await page.getAttribute("#fixture-app-root", "data-d2c-revision");
    assert.equal(rev2Attr, "2", "DOM data-d2c-revision must be '2'");

    const rev2Spacing = await page.getAttribute("#fixture-app-root", "data-d2c-spacing");
    assert.equal(rev2Spacing, "24", "DOM data-d2c-spacing must be '24'");

    const rev2Title = await page.textContent("#users-page-title");
    assert.ok(rev2Title?.includes("系统用户列表"), "Rev 2 title must be '系统用户列表'");

    const isRev2Dashed = await page.evaluate(() => {
      const btn = document.getElementById("users-create-btn");
      return btn?.classList.contains("ant-btn-dashed") ?? false;
    });
    assert.equal(isRev2Dashed, true, "Rev 2 create button must have ant-btn-dashed class");

    await context.close();
  } finally {
    await browser.close();
  }
});

