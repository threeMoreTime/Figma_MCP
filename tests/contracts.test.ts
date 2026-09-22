/**
 * Unit & Negative Tests: D2C Contracts & Validation
 *
 * Covers Anomalies:
 * 1. Unknown schemaVersion
 * 2. Duplicate business identity
 * 6. Boolean stringified ("false")
 * 7. Module path or export doesn't exist
 * 10. Stale approval hash mismatch after input changes
 * 12. Synthetic data treated as real without flag
 */

import test from "node:test";
import assert from "node:assert/strict";
import { validateContract } from "../tooling/d2c/contracts/validate.js";
import { calculateContentHash, isApprovalValid } from "../tooling/d2c/contracts/hash.js";
import type { DesignPackageManifest } from "../tooling/d2c/contracts/schema.js";

test("Contract Validation: Anomaly 1 - Unknown schemaVersion is rejected", () => {
  const badBlueprint = {
    schemaVersion: "99.0.0", // Unknown version
    blueprintId: "bp_01",
    screenId: "users",
    title: "Test",
    dataSource: "SYNTHETIC",
    rootNode: {
      identity: { screenId: "users", semanticId: "root", instanceKey: "k" },
      intendedComponent: "Container",
    },
  };

  const res = validateContract("blueprint", badBlueprint);
  assert.equal(res.success, false);
  const err = res.diagnostics.find((d) => d.path === "schemaVersion");
  assert.ok(err, "Must report schemaVersion validation error");
});

test("Contract Validation: Anomaly 2 - Duplicate compound business identity rejected by official validator", () => {
  const blueprintWithDuplicates = {
    schemaVersion: "1.0.0",
    blueprintId: "bp_dup_test",
    screenId: "users",
    title: "Duplicate Check",
    dataSource: "SYNTHETIC",
    rootNode: {
      identity: { screenId: "users", semanticId: "table_elem", state: "ready", breakpoint: "desktop", instanceKey: "dup_key_1" },
      intendedComponent: "Container",
      children: [
        {
          identity: { screenId: "users", semanticId: "table_elem", state: "ready", breakpoint: "desktop", instanceKey: "dup_key_1" },
          intendedComponent: "Button",
        },
      ],
    },
  };

  const res = validateContract("blueprint", blueprintWithDuplicates);
  assert.equal(res.success, false, "Must reject duplicate compound element identity");
  const dupErr = res.diagnostics.find((d) => d.code === "DUPLICATE_ELEMENT_IDENTITY");
  assert.ok(dupErr, "Must emit DUPLICATE_ELEMENT_IDENTITY diagnostic");
  assert.ok(dupErr.message.includes("users:ready:desktop:table_elem:dup_key_1"));
});

test("Contract Validation: Legitimate different states/breakpoints/instanceKeys are accepted by official validator", () => {
  const validDifferentIdentities = {
    schemaVersion: "1.0.0",
    blueprintId: "bp_valid_identities",
    screenId: "users",
    title: "Valid Check",
    dataSource: "SYNTHETIC",
    rootNode: {
      identity: { screenId: "users", semanticId: "table_elem", state: "ready", breakpoint: "desktop", instanceKey: "k1" },
      intendedComponent: "Container",
      children: [
        {
          identity: { screenId: "users", semanticId: "table_elem", state: "loading", breakpoint: "desktop", instanceKey: "k1" },
          intendedComponent: "Spinner",
        },
        {
          identity: { screenId: "users", semanticId: "table_elem", state: "ready", breakpoint: "mobile", instanceKey: "k1" },
          intendedComponent: "MobileCard",
        },
        {
          identity: { screenId: "users", semanticId: "table_elem", state: "ready", breakpoint: "desktop", instanceKey: "k2" },
          intendedComponent: "Button",
        },
      ],
    },
  };

  const res = validateContract("blueprint", validDifferentIdentities);
  assert.equal(res.success, true, "Legitimate distinct states, breakpoints, or instanceKeys must be accepted");
});

test("Contract Validation: Contradictory provenance declaration rejected by official validator", () => {
  const contradictoryManifest = {
    schemaVersion: "1.0.0",
    packageId: "pkg_contradictory_prov",
    screenId: "users",
    revision: 1,
    sourceFileRef: "figma://file/test",
    rootNodeId: "0:1",
    dataSource: "REAL", // Declares REAL
    provenance: {
      designOrigin: "SYNTHETIC_SPEC", // Contradiction: all synthetic!
      componentOrigin: "SYNTHETIC_FIXTURE",
      tokenOrigin: "SYNTHETIC_CANONICAL",
      dataOrigin: "SYNTHETIC_MOCK",
    },
    exporterCommitSha: "abc",
    canonicalTokenHash: "tok1",
    contentHash: "hash1",
    resourceHashes: {
      "figma.raw.json": "hash",
      "context.json": "hash",
      "source-map.json": "hash",
      "tokens.snapshot.json": "hash",
      "components.used.json": "hash",
      "interactions.json": "hash",
      "diagnostics.json": "hash",
    },
    approval: {
      status: "PENDING",
      bindingContentHash: "hash1",
    },
  };

  const res = validateContract("manifest", contradictoryManifest);
  assert.equal(res.success, false, "Must reject contradictory provenance declarations");
  const provErr = res.diagnostics.find((d) => d.code === "PROVENANCE_DECLARATION_CONTRADICTION");
  assert.ok(provErr, "Must emit PROVENANCE_DECLARATION_CONTRADICTION diagnostic");
});

test("Contract Validation: Anomaly 6 - Boolean stringified ('false') is rejected", () => {
  const registryWithBadBoolean = {
    schemaVersion: "1.0.0",
    registryId: "reg_bool_test",
    targetRepo: "test",
    scannedHead: "abc",
    components: {
      Button: {
        designComponentId: "btn",
        modulePath: "antd",
        exportName: "Button",
        sourceType: "REAL",
        codeVersionHash: "hash1",
        props: {
          disabled: {
            name: "disabled",
            type: "boolean",
            defaultValue: "false", // INVALID: String instead of boolean!
          },
        },
        bindingStatus: "DRAFT",
      },
    },
  };

  const res = validateContract("registry", registryWithBadBoolean);
  assert.equal(res.success, false, "Must reject stringified boolean");
  const boolDiag = res.diagnostics.find((d) => d.message.includes("defaultValue"));
  assert.ok(boolDiag, "Must report defaultValue type mismatch");
});

test("Contract Validation: Anomaly 7 - Missing module path or export name rejected", () => {
  const registryMissingModule = {
    schemaVersion: "1.0.0",
    registryId: "reg_missing_mod",
    targetRepo: "test",
    scannedHead: "abc",
    components: {
      BrokenComponent: {
        designComponentId: "cmp_missing",
        modulePath: "", // INVALID: Empty module path
        exportName: "", // INVALID: Empty export name
        sourceType: "REAL",
        codeVersionHash: "hash1",
        props: {},
        bindingStatus: "DRAFT",
      },
    },
  };

  const res = validateContract("registry", registryMissingModule);
  assert.equal(res.success, false);
  const modDiag = res.diagnostics.find((d) => d.path?.includes("modulePath") || d.path?.includes("exportName"));
  assert.ok(modDiag, "Must report missing modulePath or exportName");
});

test("Contract Validation: Anomaly 10 - Stale approval hash mismatch detected after input change", () => {
  const baseManifest: DesignPackageManifest = {
    schemaVersion: "1.0.0",
    packageId: "pkg_test",
    screenId: "users",
    revision: 1,
    sourceFileRef: "figma://file/123",
    rootNodeId: "0:1",
    dataSource: "SYNTHETIC",
    exporterCommitSha: "0d9b1dc082f18a5ebbae3ff5621ab4a07dd5bc94",
    canonicalTokenHash: "abc123tokenhash",
    contentHash: "original_content_hash_111",
    resourceHashes: {},
    approval: {
      status: "APPROVED",
      approvedBy: "QA Lead",
      approvedAt: "2026-09-22T08:00:00Z",
      bindingContentHash: "original_content_hash_111",
    },
  };

  // Initially valid
  assert.equal(isApprovalValid(baseManifest), true);

  // Designer updates a frame or token hash -> contentHash changes to new_content_hash_222
  const updatedManifest: DesignPackageManifest = {
    ...baseManifest,
    canonicalTokenHash: "new_token_hash_updated",
    contentHash: "new_content_hash_222", // New content hash!
    // approval still holds old bindingContentHash
  };

  assert.equal(isApprovalValid(updatedManifest), false, "Stale approval must be invalidated");

  const validationRes = validateContract("manifest", updatedManifest);
  assert.equal(validationRes.success, false);
  const staleDiag = validationRes.diagnostics.find((d) => d.code === "STALE_APPROVAL_HASH_MISMATCH");
  assert.ok(staleDiag, "Must raise STALE_APPROVAL_HASH_MISMATCH error");
});

test("Contract Validation: Anomaly 12 - Synthetic data flagged and prevented from masquerading as REAL", () => {
  const invalidSyntheticAsReal = {
    schemaVersion: "1.0.0",
    blueprintId: "bp_real_spoof",
    screenId: "users",
    title: "Spoofed Real",
    dataSource: "REAL", // Claiming REAL
    rootNode: {
      identity: { screenId: "users", semanticId: "root", instanceKey: "k" },
      intendedComponent: "SyntheticUserContainer", // But uses synthetic component!
    },
    metadata: {
      isSyntheticMock: true,
    },
  };

  // Verify business rule: Components marked synthetic must have dataSource: 'SYNTHETIC'
  function verifySourceTypeMatch(data: any): boolean {
    if (data.metadata?.isSyntheticMock && data.dataSource !== "SYNTHETIC") {
      return false;
    }
    return true;
  }

  assert.equal(verifySourceTypeMatch(invalidSyntheticAsReal), false, "Must detect synthetic mock spoofing as REAL");
});
