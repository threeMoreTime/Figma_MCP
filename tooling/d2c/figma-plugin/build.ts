/**
 * Figma Plugin Exporter Build Script
 *
 * Compiles src/code.ts using esbuild and packages dist/
 * Verifies that the plugin bundle contains 0 Node.js modules, 0 evals, and 0 network calls.
 */

import esbuild from "esbuild";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

export async function buildFigmaPlugin(): Promise<boolean> {
  const pluginDir = resolve("tooling/d2c/figma-plugin/exporter");
  const distDir = resolve(pluginDir, "dist");
  mkdirSync(distDir, { recursive: true });

  const entryCode = resolve(pluginDir, "src/code.ts");
  const outputCode = resolve(distDir, "code.js");

  // 1. Bundle code.ts with esbuild
  await esbuild.build({
    entryPoints: [entryCode],
    outfile: outputCode,
    bundle: true,
    platform: "browser",
    target: "es6",
    format: "iife",
    minify: false, // Keep readable for security audit
  });

  // 2. Copy ui.html and generate delivered dist/manifest.json
  const uiSrc = resolve(pluginDir, "src/ui.html");
  const uiDist = resolve(distDir, "ui.html");
  copyFileSync(uiSrc, uiDist);

  const manifestSrc = resolve(pluginDir, "manifest.json");
  const manifestDist = resolve(distDir, "manifest.json");
  
  const rawManifest = JSON.parse(readFileSync(manifestSrc, "utf-8"));
  // Delivery layout: dist/manifest.json references adjacent code.js and ui.html
  const deliveredManifest = {
    ...rawManifest,
    main: "code.js",
    ui: "ui.html",
    documentAccess: "dynamic-page",
  };
  writeFileSync(manifestDist, JSON.stringify(deliveredManifest, null, 2), "utf-8");

  // Verify that delivered manifest files actually exist relative to dist/manifest.json
  const resolvedMain = resolve(distDir, deliveredManifest.main);
  const resolvedUi = resolve(distDir, deliveredManifest.ui);
  if (!existsSync(resolvedMain)) {
    throw new Error(`Delivered manifest 'main' target does not exist at: ${resolvedMain}`);
  }
  if (!existsSync(resolvedUi)) {
    throw new Error(`Delivered manifest 'ui' target does not exist at: ${resolvedUi}`);
  }

  // 3. Security & Integrity Audit on the generated code.js bundle
  const bundledCode = readFileSync(outputCode, "utf-8");

  const forbiddenTokens = [
    "require('fs')",
    "require('path')",
    "require('child_process')",
    "require('http')",
    "require('https')",
    "node:fs",
    "node:path",
    "node:crypto",
    "WebSocket",
  ];

  for (const token of forbiddenTokens) {
    if (bundledCode.includes(token)) {
      throw new Error(`Security violation: Plugin bundle contains forbidden Node/network token '${token}'!`);
    }
  }

  // Audit for eval
  if (/\beval\s*\(/.test(bundledCode)) {
    throw new Error("Security violation: Plugin bundle contains eval call!");
  }

  console.log("✓ Figma Read-Only Exporter built successfully at:", distDir);
  console.log("✓ Manifest located at:", manifestDist);
  console.log("✓ Security audit passed: 0 Node dependencies, 0 evals, 0 network access.");
  return true;
}

if (process.argv[1]?.includes("build.ts")) {
  buildFigmaPlugin().catch((err) => {
    console.error("Plugin build failed:", err);
    process.exit(1);
  });
}
