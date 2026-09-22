#!/usr/bin/env node
/**
 * CLI: d2c:tokens
 *
 * Builds canonical design tokens into Ant Design 5 ThemeConfig, CSS variables, and Less variables.
 */

import { buildTokens } from "../tokens/builder.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: pnpm run d2c:tokens [options]

Options:
  --tokens <path>    Path to canonical tokens JSON (default: tooling/d2c/tokens/canonical-tokens.json)
  --outDir <path>    Output directory for artifacts (default: tooling/d2c/tokens/dist)
  --help, -h         Show this help message
`);
    process.exit(0);
  }

  let tokenFilePath: string | undefined;
  let outputDir: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tokens" && args[i + 1]) {
      tokenFilePath = args[++i];
    } else if (args[i] === "--outDir" && args[i + 1]) {
      outputDir = args[++i];
    }
  }

  console.log("Antigravity D2C: Building design tokens via Style Dictionary 5.5.5...");
  const result = await buildTokens({ tokenFilePath, outputDir });

  if (!result.success) {
    console.error("Token build encountered errors:");
    for (const d of result.diagnostics) {
      console.error(`  [${d.severity}] ${d.code}: ${d.message}`);
    }
    process.exit(1);
  }

  console.log("Token build succeeded!");
  console.log(`- Ant Design Theme: ${result.artifacts.antdThemePath}`);
  console.log(`  SHA256: ${result.hashes.antdThemeHash}`);
  console.log(`- CSS Variables:    ${result.artifacts.cssTokensPath}`);
  console.log(`  SHA256: ${result.hashes.cssTokensHash}`);
  console.log(`- Less Variables:   ${result.artifacts.lessTokensPath}`);
  console.log(`  SHA256: ${result.hashes.lessTokensHash}`);
}

main().catch((err) => {
  console.error("Fatal token build error:", err);
  process.exit(1);
});
