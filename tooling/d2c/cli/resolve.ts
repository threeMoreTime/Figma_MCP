#!/usr/bin/env node
/**
 * CLI: d2c:resolve
 *
 * Read-only scans target repository to generate candidate ComponentRegistry.
 * Outputs REUSE / EXTEND / MISSING / CONFLICT report.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { scanRepository } from "../registry/scanner.js";
import { verifyComponentRecord } from "../registry/verifier.js";
import { validateContract } from "../contracts/validate.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: pnpm run d2c:resolve [options]

Options:
  --repo <path>      Path to target repository (default: ../workspace/cs_admin-client)
  --out <path>       Output path for candidate registry (default: tooling/d2c/registry/candidates.json)
  --help, -h         Show this help message
`);
    process.exit(0);
  }

  let repoPath = resolve("../workspace/cs_admin-client");
  let outputPath = resolve("tooling/d2c/registry/candidates.json");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--repo" && args[i + 1]) {
      repoPath = resolve(args[++i]);
    } else if (args[i] === "--out" && args[i + 1]) {
      outputPath = resolve(args[++i]);
    }
  }

  console.log(`Antigravity D2C: Scanning target repository at ${repoPath}...`);

  // Obtain Git metadata read-only
  let head = "unknown";
  let branch = "unknown";
  try {
    head = execSync(`git -C "${repoPath}" rev-parse HEAD`, { encoding: "utf-8" }).trim();
    branch = execSync(`git -C "${repoPath}" rev-parse --abbrev-ref HEAD`, { encoding: "utf-8" }).trim();
  } catch (err) {
    console.warn("Could not query git metadata for target repo; using fallback values.");
  }

  const scanResult = scanRepository({
    targetRepoPath: repoPath,
    targetRepoName: "cs_admin-client",
    scannedHead: head,
    scannedBranch: branch,
  });

  // Verify all components using TypeScript AST / module checks
  for (const [compName, compRecord] of Object.entries(scanResult.registry.components)) {
    const verRes = verifyComponentRecord(compName, compRecord, repoPath);
    if (!verRes.verified) {
      const isUnverifiedDep = verRes.diagnostics.some(
        (d) => d.code === "UNVERIFIED_EXTERNAL_DEPENDENCY"
      );
      compRecord.verificationStatus = isUnverifiedDep ? "UNVERIFIED_DEPENDENCY" : "FAILED";
    } else {
      compRecord.verificationStatus = "VERIFIED";
    }
    scanResult.registry.diagnostics.push(...verRes.diagnostics);
  }

  // Validate the resulting registry against our unified contract schema
  const validation = validateContract("registry", scanResult.registry);
  if (!validation.success) {
    console.error("Generated component registry failed schema validation:");
    for (const d of validation.diagnostics) {
      console.error(`  [${d.severity}] ${d.code}: ${d.message}`);
    }
    process.exit(1);
  }

  // Save the candidate registry to D2C workspace
  writeFileSync(outputPath, JSON.stringify(scanResult.registry, null, 2), "utf-8");

  console.log(`\nComponent Registry Candidate Generated: ${outputPath}`);
  console.log(`- Scanned HEAD:   ${head} (${branch})`);
  console.log(`- Scanned Files:  ${Object.keys(scanResult.fileHashes).length} files hashed`);
  console.log(`- Total Components: ${Object.keys(scanResult.registry.components).length}`);
  console.log("\n--- Component Analysis & Resolution Report ---");
  console.log(`  REUSE:    ${scanResult.summary.reuseCount} components`);
  console.log(`  EXTEND:   ${scanResult.summary.extendCount} components`);
  console.log(`  MISSING:  ${scanResult.summary.missingCount} components`);
  console.log(`  CONFLICT: ${scanResult.summary.conflictCount} components`);

  console.log("\nDetails:");
  for (const item of scanResult.details) {
    console.log(`  [${item.action.padEnd(8)}] ${item.componentName}: ${item.rationale}`);
  }

  console.log("\nAll candidate components currently marked bindingStatus: 'UNBOUND' (Awaiting Phase 3 Figma binding verification).");
}

main().catch((err) => {
  console.error("Fatal resolve error:", err);
  process.exit(1);
});
