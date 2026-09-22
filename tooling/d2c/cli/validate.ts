#!/usr/bin/env node
/**
 * CLI: d2c:validate
 *
 * Validates D2C contract files against unified Zod schemas and semantic integrity rules.
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { validateContract, type ContractType } from "../contracts/validate.js";
import { verifyPackageDiskIntegrity } from "../contracts/hash.js";
import type { Diagnostic } from "../contracts/schema.js";

export interface ValidateReleasesResult {
  success: boolean;
  checkedPackages: string[];
  diagnostics: Diagnostic[];
}

/**
 * Validates all design release candidate packages in the given directory.
 */
export async function validateAllReleases(releasesBaseDir: string): Promise<ValidateReleasesResult> {
  const diagnostics: Diagnostic[] = [];
  const checkedPackages: string[] = [];

  if (!existsSync(releasesBaseDir)) {
    return { success: true, checkedPackages, diagnostics };
  }

  const screens = readdirSync(releasesBaseDir);
  for (const screen of screens) {
    const screenDir = join(releasesBaseDir, screen);
    if (!statSync(screenDir).isDirectory()) continue;

    const revs = readdirSync(screenDir);
    for (const rev of revs) {
      const pkgDir = join(screenDir, rev);
      if (!statSync(pkgDir).isDirectory() || !rev.startsWith("rev_")) continue;

      const pkgName = `${screen}/${rev}`;
      checkedPackages.push(pkgName);

      const manifestPath = join(pkgDir, "manifest.json");
      if (!existsSync(manifestPath)) {
        diagnostics.push({
          code: "MISSING_MANIFEST",
          message: `Package ${pkgName} is missing manifest.json`,
          severity: "ERROR",
        });
        continue;
      }

      let manifest: any;
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      } catch (err: any) {
        diagnostics.push({
          code: "INVALID_MANIFEST_JSON",
          message: `Package ${pkgName} manifest.json is invalid JSON: ${err.message}`,
          severity: "ERROR",
        });
        continue;
      }

      // 1. Validate manifest schema & provenance
      const manifestRes = validateContract("manifest", manifest);
      if (!manifestRes.success) {
        for (const d of manifestRes.diagnostics) {
          diagnostics.push({
            ...d,
            path: `${pkgName}/manifest.json:${d.path || ""}`,
          });
        }
      }

      // 2. Validate disk integrity & required files
      const integrityRes = verifyPackageDiskIntegrity(pkgDir, manifest);
      if (!integrityRes.valid) {
        for (const d of integrityRes.diagnostics) {
          diagnostics.push({
            ...d,
            path: `${pkgName}:${d.path || ""}`,
          });
        }
      }

      // 3. Validate context.json if present
      const contextPath = join(pkgDir, "context.json");
      if (existsSync(contextPath)) {
        try {
          const ctx = JSON.parse(readFileSync(contextPath, "utf-8"));
          const ctxRes = validateContract("context", ctx);
          if (!ctxRes.success) {
            for (const d of ctxRes.diagnostics) {
              diagnostics.push({
                ...d,
                path: `${pkgName}/context.json:${d.path || ""}`,
              });
            }
          }
        } catch (err: any) {
          diagnostics.push({
            code: "INVALID_CONTEXT_JSON",
            message: `Package ${pkgName} context.json is invalid: ${err.message}`,
            severity: "ERROR",
          });
        }
      }
    }
  }

  const success = diagnostics.every((d) => d.severity !== "ERROR");
  return { success, checkedPackages, diagnostics };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: pnpm run d2c:validate [options]

Options:
  --type <type>      Contract type (blueprint|context|manifest|registry|interaction|patch)
  --file <path>      Path to JSON file to validate
  --all-samples      Validate all built-in contract samples
  --all              Validate all built-in samples AND candidate packages in design/releases
  --releases         Validate candidate packages in design/releases
  --help, -h         Show this help message
`);
    process.exit(0);
  }

  let contractType: ContractType | undefined;
  let filePath: string | undefined;
  let allSamples = false;
  let includeReleases = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--type" && args[i + 1]) {
      contractType = args[++i] as ContractType;
    } else if (args[i] === "--file" && args[i + 1]) {
      filePath = args[++i];
    } else if (args[i] === "--all-samples") {
      allSamples = true;
    } else if (args[i] === "--all") {
      allSamples = true;
      includeReleases = true;
    } else if (args[i] === "--releases") {
      includeReleases = true;
    }
  }

  if (includeReleases && !allSamples && !contractType) {
    console.log("Antigravity D2C: Validating candidate packages in design/releases...");
    const res = await validateAllReleases(resolve("design/releases"));
    for (const pkg of res.checkedPackages) {
      console.log(`  ✓ Package verified: ${pkg}`);
    }
    if (!res.success) {
      console.error("\nRelease package validation failures:");
      for (const d of res.diagnostics) {
        console.error(`  ✗ [${d.severity}] ${d.path || ""}: ${d.message}`);
      }
      process.exit(1);
    }
    console.log(`\nValidated ${res.checkedPackages.length} release package(s) successfully.`);
    return;
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

    if (includeReleases) {
      console.log("\nAntigravity D2C: Validating candidate packages in design/releases...");
      const relRes = await validateAllReleases(resolve("design/releases"));
      for (const pkg of relRes.checkedPackages) {
        console.log(`  ✓ Package verified: ${pkg}`);
      }
      if (!relRes.success) {
        console.error("\nRelease package validation failures:");
        for (const d of relRes.diagnostics) {
          console.error(`  ✗ [${d.severity}] ${d.path || ""}: ${d.message}`);
        }
        process.exit(1);
      }
      console.log(`Validated ${relRes.checkedPackages.length} release package(s) successfully.`);
    }

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
