/**
 * Build Script for examples/fixture-app
 *
 * Compiles React + AntD into standalone dist/index.html & bundle.js
 * Injects generated tokens.css for visual validation.
 */

import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export async function buildFixtureApp(): Promise<string> {
  const fixtureDir = resolve("examples/fixture-app");
  const distDir = resolve(fixtureDir, "dist");
  mkdirSync(distDir, { recursive: true });

  const entry = resolve(fixtureDir, "src/index.tsx");
  const outBundle = resolve(distDir, "bundle.js");

  // Bundle React + AntD with esbuild
  await esbuild.build({
    entryPoints: [entry],
    outfile: outBundle,
    bundle: true,
    platform: "browser",
    target: "es2020",
    format: "iife",
    define: {
      "process.env.NODE_ENV": '"development"',
    },
    loader: {
      ".png": "dataurl",
      ".svg": "dataurl",
    },
  });

  // Read generated tokens.css
  let tokensCss = "";
  const tokensCssPath = resolve("tooling/d2c/tokens/dist/tokens.css");
  try {
    tokensCss = readFileSync(tokensCssPath, "utf-8");
  } catch {
    tokensCss = "/* tokens.css not found */";
  }

  // HTML Template
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>D2C Fixture App - Users Prototype</title>
  <style>
    ${tokensCss}
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--d2c-color-bg-layout, #f0f2f5);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="./bundle.js"></script>
</body>
</html>`;

  const htmlPath = resolve(distDir, "index.html");
  writeFileSync(htmlPath, htmlContent, "utf-8");

  console.log("✓ Fixture app built successfully at:", htmlPath);
  return htmlPath;
}

if (process.argv[1]?.includes("build-fixture.ts")) {
  buildFixtureApp().catch((err) => {
    console.error("Fixture build failed:", err);
    process.exit(1);
  });
}
