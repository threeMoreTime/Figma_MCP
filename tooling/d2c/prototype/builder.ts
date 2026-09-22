/**
 * Prototype Build Script (Phase 5A)
 *
 * Bundles examples/prototype/users into a standalone, browser-runnable index.html & bundle.js
 * Injects tokens.css and prototype.css for live Playwright browser verification.
 */

import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export async function buildPrototypeApp(prototypeDir: string): Promise<string> {
  const distDir = resolve(prototypeDir, "dist");
  mkdirSync(distDir, { recursive: true });

  const entry = resolve(prototypeDir, "index.tsx");
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
  const tokensCssPath = resolve(process.cwd(), "tooling/d2c/tokens/dist/tokens.css");
  if (existsSync(tokensCssPath)) {
    tokensCss = readFileSync(tokensCssPath, "utf-8");
  }

  // Read prototype.css
  let prototypeCss = "";
  const prototypeCssPath = resolve(prototypeDir, "prototype.css");
  if (existsSync(prototypeCssPath)) {
    prototypeCss = readFileSync(prototypeCssPath, "utf-8");
  }

  // HTML Template
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>D2C React Prototype - Users Management</title>
  <style>
    ${tokensCss}
    ${prototypeCss}
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
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

  console.log("✓ Prototype app built successfully at:", htmlPath);
  return htmlPath;
}
