#!/usr/bin/env node
/**
 * CLI: d2c:validate
 *
 * Validates D2C contract files against unified Zod schemas and semantic integrity rules.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { validateContract, type ContractType } from "../contracts/validate.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: pnpm run d2c:validate [options]

Options:
  --type <type>      Contract type (blueprint|context|manifest|registry|interaction|patch)
  --file <path>      Path to JSON file to validate
  --all-samples      Validate all built-in valid and invalid contract samples
  --help, -h         Show this help message
`);
    process.exit(0);
  }

  let contractType: ContractType | undefined;
  let filePath: string | undefined;
  let allSamples = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type" && args[i + 1]) {
      contractType = args[++i] as ContractType;
    } else if (args[i] === "--file" && args[i + 1]) {
      filePath = args[++i];
    } else if (args[i] === "--all-samples") {
      allSamples = true;
    }
  }

  if (allSamples || (!contractType && !filePath)) {
    console.log("Antigravity D2C: Validating all built-in contract samples...");
    const sampleDir = resolve("tooling/d2c/contracts/samples");
    const files = readdirSync(sampleDir);

    let passed = 0;
    let failed = 0;

    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const fullPath = join(sampleDir, f);
      const isExpectedValid = f.startsWith("valid-");

      // Infer contract type from filename (e.g. valid-blueprint.json -> blueprint)
      const type = f.replace(/^(valid|invalid)-/, "").replace(/\.json$/, "") as ContractType;
      const raw = JSON.parse(readFileSync(fullPath, "utf-8"));
      const res = validateContract(type, raw);

      if (isExpectedValid) {
        if (res.success) {
          console.log(`  ✓ [PASS] Expected VALID: ${f}`);
          passed++;
        } else {
          console.error(`  ✗ [FAIL] Expected VALID but got errors: ${f}`);
          for (const d of res.diagnostics) {
            console.error(`      - ${d.message}`);
          }
          failed++;
        }
      } else {
        if (!res.success) {
          console.log(`  ✓ [PASS] Expected INVALID correctly rejected: ${f} (${res.diagnostics.length} errors caught)`);
          passed++;
        } else {
          console.error(`  ✗ [FAIL] Expected INVALID was incorrectly accepted: ${f}`);
          failed++;
        }
      }
    }

    console.log(`\nSample Validation Summary: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
    return;
  }

  if (!contractType || !filePath) {
    console.error("Error: Both --type and --file must be provided.");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(resolve(filePath), "utf-8"));
  const res = validateContract(contractType, raw);

  if (!res.success) {
    console.error(`Validation failed for ${filePath} (${contractType}):`);
    for (const d of res.diagnostics) {
      console.error(`  [${d.severity}] ${d.code}: ${d.message}`);
    }
    process.exit(1);
  }

  console.log(`Validation succeeded for ${filePath} (${contractType})`);
}

main().catch((err) => {
  console.error("Fatal validation error:", err);
  process.exit(1);
});
