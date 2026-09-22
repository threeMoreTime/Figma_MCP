/**
 * Test Suite for Phase 5A: Component Resolution & React Prototype Adapter
 *
 * Covers:
 * 1. Component Resolution: maps Design System candidates to code primitives.
 * 2. Missing component rejection: emits MISSING_COMPONENT.
 * 3. Anti-hallucination defense: strictly forbids SmartButton, CustomButton, NewTable.
 * 4. Token validation: detects and blocks hardcoded #1677ff or 16px.
 * 5. State sourcing: strictly adheres to InteractionContract states (ready, loading, empty, error).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

import { resolveCodeComponent } from "../tooling/d2c/prototype/resolver.js";
import {
  adaptBlueprintToPrototype,
  validatePrototypeTokens,
} from "../tooling/d2c/prototype/adapter.js";
import type {
  MappingProposalDocument,
  ScreenBlueprint,
  InteractionContract,
} from "../tooling/d2c/blueprint/schema.js";

const outputDir = resolve(process.cwd(), "examples/output");
const mappingProposal: MappingProposalDocument = JSON.parse(
  readFileSync(resolve(outputDir, "mapping-proposal.json"), "utf-8")
);
const blueprint: ScreenBlueprint = JSON.parse(
  readFileSync(resolve(outputDir, "ui-blueprint.json"), "utf-8")
);
const contract: InteractionContract = JSON.parse(
  readFileSync(resolve(outputDir, "interaction-contract.json"), "utf-8")
);

// ============================================================================
// 1. Component Resolution
// ============================================================================

test("Phase 5A: Component Resolution resolves standard design components to AntD primitives", () => {
  const btnRes = resolveCodeComponent("users.management.create_btn", mappingProposal);
  assert.equal(btnRes.success, true);
  assert.equal(btnRes.resolved?.component, "Button");
  assert.equal(btnRes.resolved?.props.type, "primary");

  const tableRes = resolveCodeComponent("users.management.table", mappingProposal);
  assert.equal(tableRes.success, true);
  assert.equal(tableRes.resolved?.component, "Table");

  const searchRes = resolveCodeComponent("users.management.search_input", mappingProposal);
  assert.equal(searchRes.success, true);
  assert.equal(searchRes.resolved?.component, "Input.Search");

  const modalRes = resolveCodeComponent("users.management.create_modal", mappingProposal);
  assert.equal(modalRes.success, true);
  assert.equal(modalRes.resolved?.component, "Modal");
});

test("Phase 5A: Missing component mapping strictly emits MISSING_COMPONENT", () => {
  const res = resolveCodeComponent("ghost.unregistered.component", mappingProposal);
  assert.equal(res.success, false);
  assert.equal(res.error?.code, "MISSING_COMPONENT");
});

test("Phase 5A: Unresolved mapping strictly emits UNRESOLVED_MAPPING", () => {
  const mockUnresolvedProposal: MappingProposalDocument = {
    ...mappingProposal,
    mappings: [
      {
        semanticId: "users.special_action",
        intent: "magic-intent",
        candidate: {
          figmaComponent: "UNRESOLVED",
          status: "UNRESOLVED",
        },
      },
    ],
  };

  const res = resolveCodeComponent("users.special_action", mockUnresolvedProposal);
  assert.equal(res.success, false);
  assert.equal(res.error?.code, "UNRESOLVED_MAPPING");
});

// ============================================================================
// 2. Anti-Hallucination Guard (SmartButton, CustomButton, NewTable)
// ============================================================================

test("Phase 5A: Anti-hallucination guard strictly forbids SmartButton, CustomButton, and NewTable", () => {
  const hallucinatedProposal: MappingProposalDocument = {
    ...mappingProposal,
    mappings: [
      {
        semanticId: "test.smart_btn",
        intent: "primary-action",
        candidate: {
          figmaComponent: "DS/SmartButton",
          status: "PROPOSAL",
        },
      },
      {
        semanticId: "test.custom_btn",
        intent: "secondary-action",
        candidate: {
          figmaComponent: "DS/CustomButton",
          status: "PROPOSAL",
        },
      },
      {
        semanticId: "test.new_table",
        intent: "data-table",
        candidate: {
          figmaComponent: "DS/NewTable",
          status: "PROPOSAL",
        },
      },
    ],
  };

  const r1 = resolveCodeComponent("test.smart_btn", hallucinatedProposal);
  assert.equal(r1.success, false);
  assert.equal(r1.error?.code, "FORBIDDEN_HALLUCINATED_COMPONENT");

  const r2 = resolveCodeComponent("test.custom_btn", hallucinatedProposal);
  assert.equal(r2.success, false);
  assert.equal(r2.error?.code, "FORBIDDEN_HALLUCINATED_COMPONENT");

  const r3 = resolveCodeComponent("test.new_table", hallucinatedProposal);
  assert.equal(r3.success, false);
  assert.equal(r3.error?.code, "FORBIDDEN_HALLUCINATED_COMPONENT");
});

// ============================================================================
// 3. Token Hardcoding Guards
// ============================================================================

test("Phase 5A: Token validator catches hardcoded #1677ff and 16px violations", () => {
  const validCss = `
    .btn {
      color: var(--d2c-color-primary);
      padding: var(--d2c-spacing-md);
    }
  `;
  const validCheck = validatePrototypeTokens(validCss);
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.violations.length, 0);

  const badCss1 = `
    .bad-btn {
      background-color: #1677ff;
      padding: 16px;
    }
  `;
  const badCheck = validatePrototypeTokens(badCss1);
  assert.equal(badCheck.valid, false);
  assert.ok(badCheck.violations.some((v) => v.includes("#1677ff")));
  assert.ok(badCheck.violations.some((v) => v.includes("16px")));
});

// ============================================================================
// 4. State Sourcing from InteractionContract
// ============================================================================

test("Phase 5A: Prototype states strictly source ready, loading, empty, error from contract", () => {
  const spec = adaptBlueprintToPrototype(blueprint, contract, mappingProposal);

  assert.equal(spec.screenId, "users.management");
  assert.deepEqual(spec.states, ["loading", "ready", "empty", "error"]);
  assert.ok(spec.regions.length >= 4);
  assert.ok(spec.componentsById.has("users.management.create_btn"));
  assert.ok(spec.componentsById.has("users.management.table"));
});
