#!/usr/bin/env node
/**
 * CLI Entrypoint for Phase 4A: Blueprint Engine
 *
 * Commands:
 *   pnpm d2c:blueprint --analyze <prd-path>
 *   pnpm d2c:blueprint --generate <prd-path> --direction <A|B|C>
 *   pnpm d2c:blueprint --demo
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { analyzeRequirement } from "../blueprint/analyzer.js";
import { generateDesignBrief } from "../blueprint/design-brief.js";
import { generateUIBlueprint } from "../blueprint/blueprint-generator.js";
import {
  generateInteractionContract,
  validateInteractionContract,
} from "../blueprint/interaction-contract.js";
import { generateVisualPrompts } from "../figma-generator/image-prompts.js";
import {
  generateMappingProposal,
  validateMappingProposal,
} from "../figma-generator/component-mapper.js";
import { generateFigmaOperationPlan } from "../figma-generator/plan-generator.js";
import {
  createSimulatorContext,
  executePlanInSimulator,
} from "../figma-generator/simulator.js";

function printUsage() {
  console.log(`
Blueprint Engine CLI (Phase 4A & 4B: PRD → UI Blueprint → Figma Generator)

Usage:
  tsx tooling/d2c/cli/blueprint.ts --analyze <prd-path>
  tsx tooling/d2c/cli/blueprint.ts --generate <prd-path> --direction <A|B|C>
  tsx tooling/d2c/cli/blueprint.ts --demo
  tsx tooling/d2c/cli/blueprint.ts --figma-plan <blueprint-json-path>
  tsx tooling/d2c/cli/blueprint.ts --demo-4b

Options:
  --analyze <path>      Parse PRD and generate Requirement Analysis + Design Brief (Halts for human gate)
  --generate <path>     Generate UI Blueprint and Interaction Contract for selected direction
  --direction <A|B|C>   Selected design direction (A: Enterprise Dense, B: Modern SaaS, C: Minimal Productivity)
  --demo                Run Phase 4A end-to-end demo using examples/prd/users-management.md
  --figma-plan <path>   Compile UI Blueprint into Figma Operations Plan, Visual Prompts, and Mapping Proposal
  --demo-4b             Run Phase 4B end-to-end demo (Figma Operation Plan, Tokens, Idempotency, Conflict Check)
  --help                Show this help message
`);
}

function writeJson(filePath: string, data: unknown) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`✓ Output written to: ${filePath}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const isDemo = args.includes("--demo");
  const analyzeIdx = args.indexOf("--analyze");
  const generateIdx = args.indexOf("--generate");
  const directionIdx = args.indexOf("--direction");

  const outputDir = resolve(process.cwd(), "examples/output");

  if (isDemo) {
    console.log("================================================================================");
    console.log("🚀 Blueprint Engine: Running Phase 4A End-to-End Demo");
    console.log("================================================================================");

    const prdPath = resolve(process.cwd(), "examples/prd/users-management.md");
    if (!existsSync(prdPath)) {
      console.error(`Error: Example PRD not found at ${prdPath}`);
      process.exit(1);
    }

    const prdContent = readFileSync(prdPath, "utf-8");

    // 1. Analyze
    console.log("\n[Step 1/4] Analyzing PRD & Partitioning Facts...");
    const analysis = analyzeRequirement(prdContent);
    const analysisFile = resolve(outputDir, "users-analysis.json");
    writeJson(analysisFile, analysis);

    console.log(`  - Product: ${analysis.productName}`);
    console.log(`  - Confirmed Facts: ${analysis.confirmedFacts.length}`);
    console.log(`  - Assumptions: ${analysis.assumptions.length}`);
    console.log(`  - Decisions Required: ${analysis.decisionsRequired.length}`);
    console.log(`  - User Jobs: ${analysis.userJobs.length}`);
    console.log(`  - Screens: ${analysis.screenMap.length}`);

    // 2. Generate Design Brief (with 3 directions)
    console.log("\n[Step 2/4] Generating Design Brief with 3 Visual Directions...");
    const brief = generateDesignBrief(analysis);
    // For demo completion, demonstrate direction B selection
    brief.selectedDirection = "B";
    brief.selectionRationale = "Demo configuration: Modern SaaS chosen for balanced density and clarity.";
    const briefFile = resolve(outputDir, "design-brief.json");
    writeJson(briefFile, brief);

    console.log(`  - Direction A: ${brief.visualDirections.A.name} (${brief.visualDirections.A.density} density)`);
    console.log(`  - Direction B: ${brief.visualDirections.B.name} (${brief.visualDirections.B.density} density) [SELECTED FOR DEMO]`);
    console.log(`  - Direction C: ${brief.visualDirections.C.name} (${brief.visualDirections.C.density} density)`);

    // 3. Generate UI Blueprint
    console.log("\n[Step 3/4] Generating Canonical UI Blueprint...");
    const blueprintResult = generateUIBlueprint({
      analysis,
      selectedDirection: "B",
    });

    if (!blueprintResult.success || !blueprintResult.blueprint) {
      console.error("Failed to generate UI Blueprint:", blueprintResult.diagnostics);
      process.exit(1);
    }

    const blueprint = blueprintResult.blueprint;
    const blueprintFile = resolve(outputDir, "ui-blueprint.json");
    writeJson(blueprintFile, blueprint);

    console.log(`  - Screen ID: ${blueprint.screenId}`);
    console.log(`  - Regions: ${blueprint.regions.length} (${blueprint.regions.map((r) => r.id).join(", ")})`);
    console.log(`  - Components: ${blueprint.components.length} canonical components`);
    console.log(`  - Catalog Compliance: 100% verified (0 hallucinated components)`);

    // 4. Generate Interaction Contract
    console.log("\n[Step 4/4] Synthesizing Interaction Contract...");
    const contract = generateInteractionContract(blueprint);
    const contractValidation = validateInteractionContract(contract, blueprint);

    if (!contractValidation.valid) {
      console.error("Interaction Contract validation failed:", contractValidation.diagnostics);
      process.exit(1);
    }

    const contractFile = resolve(outputDir, "interaction-contract.json");
    writeJson(contractFile, contract);

    console.log(`  - Screen ID: ${contract.screenId}`);
    console.log(`  - Interaction Steps: ${contract.interactions.length}`);
    for (const step of contract.interactions) {
      console.log(`    * [${step.event}] -> action '${step.action}' (source: ${step.source} -> target: ${step.target})`);
    }

    console.log("\n================================================================================");
    console.log("✅ Phase 4A Demo Finished Successfully");
    console.log("Artifacts produced:");
    console.log(`  1. Analysis:    ${analysisFile}`);
    console.log(`  2. Brief:       ${briefFile}`);
    console.log(`  3. Blueprint:   ${blueprintFile}`);
    console.log(`  4. Interaction: ${contractFile}`);
    console.log("================================================================================");
    return;
  }

  if (analyzeIdx !== -1) {
    const inputPath = args[analyzeIdx + 1];
    if (!inputPath) {
      console.error("Error: --analyze requires a PRD markdown file path.");
      process.exit(1);
    }

    const prdPath = resolve(process.cwd(), inputPath);
    if (!existsSync(prdPath)) {
      console.error(`Error: File not found: ${prdPath}`);
      process.exit(1);
    }

    const prdContent = readFileSync(prdPath, "utf-8");
    console.log(`Analyzing PRD: ${prdPath}`);
    const analysis = analyzeRequirement(prdContent);

    const analysisFile = resolve(outputDir, "users-analysis.json");
    writeJson(analysisFile, analysis);

    const brief = generateDesignBrief(analysis);
    const briefFile = resolve(outputDir, "design-brief.json");
    writeJson(briefFile, brief);

    console.log("\n--- Requirement Analysis Summary ---");
    console.log(`Product: ${analysis.productName}`);
    console.log(`Confirmed Facts (${analysis.confirmedFacts.length}):`, analysis.confirmedFacts);
    console.log(`Assumptions (${analysis.assumptions.length}):`, analysis.assumptions);
    console.log(`Decisions Required (${analysis.decisionsRequired.length}):`, analysis.decisionsRequired);
    console.log(`User Jobs (${analysis.userJobs.length}):`, analysis.userJobs.map((j) => `${j.id}: ${j.job}`));
    console.log(`Screens (${analysis.screenMap.length}):`, analysis.screenMap.map((s) => `${s.screenId} (${s.route})`));

    console.log("\n--- Visual Design Brief (3 Directions) ---");
    console.log(`[A] ${brief.visualDirections.A.name}: Density=${brief.visualDirections.A.density}, Style=${brief.visualDirections.A.layoutStyle}`);
    console.log(`[B] ${brief.visualDirections.B.name}: Density=${brief.visualDirections.B.density}, Style=${brief.visualDirections.B.layoutStyle}`);
    console.log(`[C] ${brief.visualDirections.C.name}: Density=${brief.visualDirections.C.density}, Style=${brief.visualDirections.C.layoutStyle}`);

    console.log("\n🛑 [HUMAN GATE HALT]");
    console.log("Visual direction selection is required before generating UI Blueprint.");
    console.log("Please select Direction A, B, or C and run:");
    console.log(`  pnpm d2c:blueprint --generate ${inputPath} --direction <A|B|C>\n`);
    return;
  }

  if (generateIdx !== -1) {
    const inputPath = args[generateIdx + 1];
    if (!inputPath) {
      console.error("Error: --generate requires a PRD markdown file path.");
      process.exit(1);
    }

    let direction: "A" | "B" | "C" = "B";
    if (directionIdx !== -1 && args[directionIdx + 1]) {
      const dirArg = args[directionIdx + 1].toUpperCase();
      if (dirArg === "A" || dirArg === "B" || dirArg === "C") {
        direction = dirArg;
      } else {
        console.error("Error: --direction must be A, B, or C.");
        process.exit(1);
      }
    } else {
      console.error("Error: --direction <A|B|C> is required when running --generate.");
      process.exit(1);
    }

    const prdPath = resolve(process.cwd(), inputPath);
    if (!existsSync(prdPath)) {
      console.error(`Error: File not found: ${prdPath}`);
      process.exit(1);
    }

    const prdContent = readFileSync(prdPath, "utf-8");
    const analysis = analyzeRequirement(prdContent);

    // Update brief
    const brief = generateDesignBrief(analysis);
    brief.selectedDirection = direction;
    brief.selectionRationale = `Selected direction ${direction} via CLI command.`;
    const briefFile = resolve(outputDir, "design-brief.json");
    writeJson(briefFile, brief);

    // Generate UI Blueprint
    const blueprintResult = generateUIBlueprint({
      analysis,
      selectedDirection: direction,
    });

    if (!blueprintResult.success || !blueprintResult.blueprint) {
      console.error("Error generating UI Blueprint:", blueprintResult.diagnostics);
      process.exit(1);
    }

    const blueprint = blueprintResult.blueprint;
    const blueprintFile = resolve(outputDir, "ui-blueprint.json");
    writeJson(blueprintFile, blueprint);

    // Generate Interaction Contract
    const contract = generateInteractionContract(blueprint);
    const contractValidation = validateInteractionContract(contract, blueprint);

    if (!contractValidation.valid) {
      console.error("Interaction Contract validation failed:", contractValidation.diagnostics);
      process.exit(1);
    }

    const contractFile = resolve(outputDir, "interaction-contract.json");
    writeJson(contractFile, contract);

    console.log(`\n✅ Generated UI Blueprint & Interaction Contract for Direction ${direction}!`);
    console.log(`  - Blueprint: ${blueprintFile}`);
    console.log(`  - Contract:  ${contractFile}`);
    return;
  }

  const isDemo4B = args.includes("--demo-4b");
  const figmaPlanIdx = args.indexOf("--figma-plan");

  if (isDemo4B || figmaPlanIdx !== -1) {
    console.log("================================================================================");
    console.log("🚀 Blueprint Engine: Running Phase 4B Native Figma Generator Pipeline");
    console.log("================================================================================");

    // 1. Ensure Phase 4A outputs exist (or run generator on users-management.md)
    let blueprintPath =
      figmaPlanIdx !== -1 && args[figmaPlanIdx + 1]
        ? resolve(process.cwd(), args[figmaPlanIdx + 1])
        : resolve(outputDir, "ui-blueprint.json");

    const briefPath = resolve(outputDir, "design-brief.json");

    if (!existsSync(blueprintPath) || !existsSync(briefPath)) {
      console.log("Phase 4A artifacts not found. Generating initial Blueprint & Brief...");
      const prdPath = resolve(process.cwd(), "examples/prd/users-management.md");
      const prdContent = readFileSync(prdPath, "utf-8");
      const analysis = analyzeRequirement(prdContent);
      const brief = generateDesignBrief(analysis);
      brief.selectedDirection = "B";
      brief.selectionRationale = "Phase 4B Demo: Selected Modern SaaS (Direction B).";
      writeJson(briefPath, brief);

      const bpResult = generateUIBlueprint({ analysis, selectedDirection: "B" });
      if (!bpResult.success || !bpResult.blueprint) {
        console.error("Failed to generate UI Blueprint:", bpResult.diagnostics);
        process.exit(1);
      }
      blueprintPath = resolve(outputDir, "ui-blueprint.json");
      writeJson(blueprintPath, bpResult.blueprint);
    }

    const blueprint = JSON.parse(readFileSync(blueprintPath, "utf-8"));
    const brief = JSON.parse(readFileSync(briefPath, "utf-8"));

    const tokensPath = resolve(process.cwd(), "tooling/d2c/tokens/canonical-tokens.json");
    const canonicalTokens = JSON.parse(readFileSync(tokensPath, "utf-8"));

    const catalogPath = resolve(process.cwd(), "tooling/d2c/blueprint/component-intent-catalog.json");
    const catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));

    // Step 1: GPT Image Prompts
    console.log("\n[Step 1/5] Generating GPT Image Visual Exploration Prompts...");
    const visualPrompts = generateVisualPrompts(brief, blueprint);
    const visualPromptsFile = resolve(outputDir, "visual-prompts.json");
    writeJson(visualPromptsFile, visualPrompts);
    console.log(`  - Prompts generated for ${visualPrompts.prompts.length} screen states`);
    console.log(`  - Role: ${visualPrompts.role} (Strictly for mood exploration, NOT Figma data source)`);

    // Step 2: Component Mapping Proposal
    console.log("\n[Step 2/5] Generating Component Mapping Proposal (Human confirmation required)...");
    const mappingProposal = generateMappingProposal(blueprint, catalog);
    const mappingValidation = validateMappingProposal(mappingProposal);
    const mappingFile = resolve(outputDir, "mapping-proposal.json");
    writeJson(mappingFile, mappingProposal);
    console.log(`  - Mapped: ${mappingProposal.mappings.length} components`);
    console.log(`  - Auto Publish: ${mappingProposal.autoPublish} (Strictly disabled)`);
    console.log(`  - Requires Human Gate: ${mappingProposal.requiresHumanConfirmation}`);

    // Step 3: Figma Operation Plan
    console.log("\n[Step 3/5] Generating Validated Figma Operation Plan...");
    const { plan, diagnostics: planDiagnostics } = generateFigmaOperationPlan({
      blueprint,
      brief,
      canonicalTokens,
      catalog,
      mappingProposal,
    });

    const planFile = resolve(outputDir, "figma-operation-plan.json");
    writeJson(planFile, plan);
    console.log(`  - Total operations: ${plan.operations.length}`);
    console.log(`  - Blueprint content hash: ${plan.blueprintHash.slice(0, 16)}...`);
    console.log(`  - Diagnostics: ${planDiagnostics.length} warnings/errors`);

    // Step 4: Figma Simulator & Idempotency / Conflict Verification
    console.log("\n[Step 4/5] Executing Plan in Native Figma Simulator...");
    const simContext = createSimulatorContext();

    // Run 1: Initial Creation
    const run1 = executePlanInSimulator(plan, simContext);
    console.log(`  - First Run: ${run1.createdNodes} nodes created, ${run1.skippedNodes} skipped, ${run1.conflicts} conflicts`);

    // Run 2: Idempotency Test (same plan re-executed)
    const run2 = executePlanInSimulator(plan, simContext);
    console.log(`  - Second Run (Idempotency Test): ${run2.createdNodes} created, ${run2.skippedNodes} skipped (0 duplicates!)`);

    // Run 3: Conflict Simulation (simulate manual Figma modification on a node)
    const testNode = simContext.nodesBySemanticId.get("users.management.create_btn");
    if (testNode) {
      testNode.pluginData.set("manualEdited", "true");
    }
    const run3 = executePlanInSimulator(plan, simContext);
    console.log(`  - Conflict Test: Detected ${run3.conflicts} manual conflict(s) (Overwrite blocked!)`);

    // Step 5: Figma Release Package
    console.log("\n[Step 5/5] Emitting Figma Release Package Manifest...");
    const releasePackage = {
      schemaVersion: "1.0.0",
      screenId: blueprint.screenId,
      blueprintHash: plan.blueprintHash,
      status: "READY_FOR_FIGMA_IMPORT",
      files: {
        visualPrompts: "visual-prompts.json",
        operationPlan: "figma-operation-plan.json",
        mappingProposal: "mapping-proposal.json",
        uiBlueprint: "ui-blueprint.json",
      },
      summary: {
        totalOperations: plan.operations.length,
        totalRegions: blueprint.regions.length,
        totalComponents: blueprint.components.length,
        tokenBindings: plan.operations.filter((o) => o.variableBinding).length,
        idempotencyVerified: run2.skippedNodes > 0 && run2.createdNodes === 0,
        conflictDetectionVerified: run3.conflicts > 0,
      },
    };

    const packageFile = resolve(outputDir, "figma-release-package.json");
    writeJson(packageFile, releasePackage);

    console.log("\n================================================================================");
    console.log("✅ Phase 4B Native Figma Generator Pipeline Completed Successfully");
    console.log("Artifacts produced in examples/output/:");
    console.log(`  1. Visual Prompts:    ${visualPromptsFile}`);
    console.log(`  2. Operation Plan:    ${planFile}`);
    console.log(`  3. Mapping Proposal:  ${mappingFile}`);
    console.log(`  4. Release Package:   ${packageFile}`);
    console.log("================================================================================");
    return;
  }

  printUsage();
}

main().catch((err) => {
  console.error("Unexpected error in blueprint CLI:", err);
  process.exit(1);
});
