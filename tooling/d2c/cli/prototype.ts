#!/usr/bin/env node
/**
 * CLI Entrypoint for Phase 5A: Prototype Generator & Runner
 *
 * Commands:
 *   pnpm d2c:prototype --generate
 *   pnpm d2c:prototype --build
 *   pnpm d2c:prototype --demo-5a
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { adaptBlueprintToPrototype, validatePrototypeTokens } from "../prototype/adapter.js";
import { generatePrototypeFiles } from "../prototype/generator.js";
import { buildPrototypeApp } from "../prototype/builder.js";

function printUsage() {
  console.log(`
React Prototype Generator CLI (Phase 5A: Design Package → React Prototype)

Usage:
  tsx tooling/d2c/cli/prototype.ts --generate
  tsx tooling/d2c/cli/prototype.ts --build
  tsx tooling/d2c/cli/prototype.ts --demo-5a

Options:
  --generate   Read examples/output/ and generate React prototype files in examples/prototype/users/
  --build      Bundle React prototype with esbuild into runnable dist/index.html
  --demo-5a    End-to-end generate & build prototype application
  --help       Show this help message
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const isGenerate = args.includes("--generate");
  const isBuild = args.includes("--build");
  const isDemo = args.includes("--demo-5a");

  const outputDir = resolve(process.cwd(), "examples/output");
  const prototypeDir = resolve(process.cwd(), "examples/prototype/users");

  const blueprintPath = resolve(outputDir, "ui-blueprint.json");
  const contractPath = resolve(outputDir, "interaction-contract.json");
  const mappingPath = resolve(outputDir, "mapping-proposal.json");

  if (isGenerate || isDemo) {
    console.log("================================================================================");
    console.log("🚀 Prototype Engine: Generating React Prototype from Design Package (Phase 5A)");
    console.log("================================================================================");

    if (!existsSync(blueprintPath) || !existsSync(contractPath) || !existsSync(mappingPath)) {
      console.error("Error: Required input files from Phase 4 not found in examples/output/.");
      console.error("Please run 'pnpm d2c:blueprint --demo-4b' first.");
      process.exit(1);
    }

    const blueprint = JSON.parse(readFileSync(blueprintPath, "utf-8"));
    const contract = JSON.parse(readFileSync(contractPath, "utf-8"));
    const mappingProposal = JSON.parse(readFileSync(mappingPath, "utf-8"));

    console.log("\n[Step 1/3] Adapting Blueprint and Interaction Contract to React Prototype...");
    const spec = adaptBlueprintToPrototype(blueprint, contract, mappingProposal);
    console.log(`  - Target Screen: ${spec.screenId}`);
    console.log(`  - States Sourced from Contract: ${spec.states.join(", ")}`);
    console.log(`  - Regions Adapted: ${spec.regions.length}`);
    console.log(`  - Resolved Components: ${spec.componentsById.size}`);

    console.log("\n[Step 2/3] Generating Component Code & Semantic Token CSS...");
    generatePrototypeFiles(spec, prototypeDir);

    const cssPath = resolve(prototypeDir, "prototype.css");
    const cssContent = readFileSync(cssPath, "utf-8");
    const tokenCheck = validatePrototypeTokens(cssContent);
    if (!tokenCheck.valid) {
      console.error("❌ Token validation failed! Hardcoded values found:", tokenCheck.violations);
      process.exit(1);
    }
    console.log("  - Token Validation: PASS (Zero hardcoded #1677ff or 16px, 100% semantic CSS variables)");
  }

  if (isBuild || isDemo) {
    console.log("\n[Step 3/3] Compiling Standalone Prototype App via esbuild...");
    const htmlPath = await buildPrototypeApp(prototypeDir);
    console.log(`\n✅ Prototype build complete! Launch URL: file://${htmlPath}`);
    console.log("================================================================================");
  }
}

main().catch((err) => {
  console.error("Unexpected error in prototype CLI:", err);
  process.exit(1);
});
