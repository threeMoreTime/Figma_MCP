/**
 * Unit Tests for Phase 5B-1: HTML Prototype Generator
 *
 * Verifies:
 * 1. Design Element Resolver maps intent to semantic HTML elements with data-semantic-id and data-component.
 * 2. Anti-hallucination guards strictly forbid SmartButton, AIButton, FancyTable.
 * 3. Hardcoded Style Detector identifies hex colors and raw pixel dimensions.
 * 4. Zero hardcoding in generated prototype files.
 * 5. Prototype manifest integrity.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import {
  resolveHtmlElement,
  assertNoHallucinations,
  FORBIDDEN_HALLUCINATIONS,
} from "../tooling/d2c/html-prototype/resolver.js";
import {
  detectHardcodedStyles,
  assertZeroHardcodedStyles,
} from "../tooling/d2c/html-prototype/detector.js";
import { generateHtmlPrototype } from "../tooling/d2c/html-prototype/generator.js";

// ============================================================================
// 1. Design Element Resolver Tests
// ============================================================================

test("Phase 5B-1: Design Element Resolver maps standard intents to semantic HTML elements", () => {
  // 1.1 primary-action -> button
  const button = resolveHtmlElement("primary-action", "users.management.create_btn", {
    label: "新建用户",
  });
  assert.equal(button.tagName, "button");
  assert.equal(button.componentName, "button");
  assert.equal(button.attributes["data-semantic-id"], "users.management.create_btn");
  assert.equal(button.attributes["data-component"], "button");
  assert.ok(button.htmlSnippet.includes('data-semantic-id="users.management.create_btn"'));
  assert.ok(button.htmlSnippet.includes('data-component="button"'));
  assert.ok(button.htmlSnippet.includes("新建用户"));

  // 1.2 data-table -> data-table container with table
  const table = resolveHtmlElement("data-table", "users.management.table");
  assert.equal(table.tagName, "div");
  assert.equal(table.componentName, "data-table");
  assert.equal(table.attributes["data-semantic-id"], "users.management.table");
  assert.equal(table.attributes["data-component"], "data-table");
  assert.ok(table.htmlSnippet.includes("<table"));
  assert.ok(table.htmlSnippet.includes('data-semantic-id="users.management.table"'));

  // 1.3 modal-dialog -> dialog
  const dialog = resolveHtmlElement("modal-dialog", "users.management.create_modal", {
    props: { title: "新建用户" },
  });
  assert.equal(dialog.tagName, "dialog");
  assert.equal(dialog.componentName, "modal-dialog");
  assert.equal(dialog.attributes["data-semantic-id"], "users.management.create_modal");
  assert.equal(dialog.attributes["data-component"], "modal-dialog");
  assert.ok(dialog.htmlSnippet.includes("<dialog"));
  assert.ok(dialog.htmlSnippet.includes('data-semantic-id="users.management.create_modal"'));

  // 1.4 filter-search -> filter-search with search input
  const search = resolveHtmlElement("filter-search", "users.management.search_input", {
    props: { placeholder: "搜索用户..." },
  });
  assert.equal(search.tagName, "div");
  assert.equal(search.componentName, "filter-search");
  assert.ok(search.htmlSnippet.includes('type="search"'));
  assert.ok(search.htmlSnippet.includes('placeholder="搜索用户..."'));
});

// ============================================================================
// 2. Anti-Hallucination Guard Tests
// ============================================================================

test("Phase 5B-1: Anti-hallucination guards strictly forbid SmartButton, AIButton, and FancyTable", () => {
  for (const forbidden of FORBIDDEN_HALLUCINATIONS) {
    assert.throws(
      () => {
        assertNoHallucinations(forbidden);
      },
      (err: any) => err.message.includes("ILLEGAL_HALLUCINATED_COMPONENT")
    );

    assert.throws(
      () => {
        resolveHtmlElement("primary-action", "users.test", { label: forbidden });
      },
      (err: any) => err.message.includes("ILLEGAL_HALLUCINATED_COMPONENT")
    );
  }

  // Missing semanticId must fail
  assert.throws(
    () => {
      resolveHtmlElement("primary-action", "");
    },
    (err: any) => err.message.includes("MISSING_SEMANTIC_ID")
  );

  // Unregistered intent must fail
  assert.throws(
    () => {
      resolveHtmlElement("unknown-ai-widget", "users.test");
    },
    (err: any) => err.message.includes("UNRESOLVED_INTENT")
  );
});

// ============================================================================
// 3. Hardcoded Style Detector Tests
// ============================================================================

test("Phase 5B-1: Hardcoded Style Detector detects forbidden hex colors and raw dimensions", () => {
  // 3.1 Raw hex color detection
  const badColorCss = `.btn { color: #1677ff; }`;
  const colorDiags = detectHardcodedStyles(badColorCss, "test.css");
  assert.equal(colorDiags.length, 1);
  assert.equal(colorDiags[0].type, "HEX_COLOR");
  assert.ok(colorDiags[0].message.includes("#1677ff"));

  // 3.2 Raw pixel dimension detection
  const badDimensionCss = `.card { padding: 16px; margin: 24px; }`;
  const dimDiags = detectHardcodedStyles(badDimensionCss, "test.css");
  assert.equal(dimDiags.length, 2);
  assert.equal(dimDiags[0].type, "RAW_DIMENSION");
  assert.ok(dimDiags[0].message.includes("16px"));
  assert.ok(dimDiags[1].message.includes("24px"));

  // 3.3 Inline style violation in HTML
  const badHtml = `<div style="color: #1677ff; padding: 16px;">Test</div>`;
  const htmlDiags = detectHardcodedStyles(badHtml, "test.html");
  assert.ok(htmlDiags.length >= 1);
  assert.ok(htmlDiags.some((d) => d.type === "INLINE_STYLE"));

  // 3.4 Valid CSS with var(--d2c-*) passes with 0 diagnostics
  const validCss = `.btn {
  color: var(--d2c-color-primary);
  padding: var(--d2c-spacing-md);
  border: var(--d2c-borderWidth-base) solid var(--d2c-color-border);
}`;
  const validDiags = detectHardcodedStyles(validCss, "valid.css");
  assert.equal(validDiags.length, 0, "Valid token CSS must produce 0 diagnostics");

  // 3.5 tokens.css allowed root declarations
  const tokensCss = `:root {
  --d2c-color-primary: #1677ff;
  --d2c-spacing-md: 16px;
}`;
  const tokenDiags = detectHardcodedStyles(tokensCss, "tokens.css");
  assert.equal(tokenDiags.length, 0, "tokens.css root declarations must be allowed");
});

// ============================================================================
// 4. Greenfield HTML Prototype Generator & Manifest Verification
// ============================================================================

test("Phase 5B-1: HTML Prototype Generator emits valid Greenfield prototype and manifest", () => {
  const result = generateHtmlPrototype({
    inputDir: resolve(process.cwd(), "examples/output"),
    outputDir: resolve(process.cwd(), "examples/html-prototype"),
  });

  assert.ok(result.manifest);
  assert.equal(result.manifest.prototypeType, "HTML5_GREENFIELD");
  assert.equal(result.manifest.screenId, "users.management");
  assert.ok(result.manifest.components.length >= 6, "Must contain all base components");

  // Check generated file exists
  const indexHtmlPath = resolve(result.outputDir, "index.html");
  const layoutCssPath = resolve(result.outputDir, "styles/layout.css");
  const componentsCssPath = resolve(result.outputDir, "styles/components.css");
  const stateJsPath = resolve(result.outputDir, "runtime/state.js");
  const mockApiJsPath = resolve(result.outputDir, "runtime/mock-api.js");

  assert.ok(existsSync(indexHtmlPath), "index.html must exist");
  assert.ok(existsSync(layoutCssPath), "styles/layout.css must exist");
  assert.ok(existsSync(componentsCssPath), "styles/components.css must exist");
  assert.ok(existsSync(stateJsPath), "runtime/state.js must exist");
  assert.ok(existsSync(mockApiJsPath), "runtime/mock-api.js must exist");

  const indexHtml = readFileSync(indexHtmlPath, "utf-8");
  assert.ok(indexHtml.includes('id="html-prototype-root"'));
  assert.ok(indexHtml.includes('data-semantic-id="users.management.create_btn"'));
  assert.ok(indexHtml.includes('data-semantic-id="users.management.table"'));
  assert.ok(indexHtml.includes('data-semantic-id="users.management.search_input"'));
  assert.ok(indexHtml.includes('data-semantic-id="users.management.create_modal"'));

  // Ensure zero hardcoding
  assertZeroHardcodedStyles([
    { filename: "styles/layout.css", content: readFileSync(layoutCssPath, "utf-8") },
    { filename: "styles/components.css", content: readFileSync(componentsCssPath, "utf-8") },
    { filename: "index.html", content: indexHtml },
  ]);
});
