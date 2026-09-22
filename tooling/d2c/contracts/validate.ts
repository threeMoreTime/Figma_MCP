/**
 * Contract Validation Utilities
 */

import {
  UIBlueprintSchema,
  DesignContextSchema,
  DesignPackageManifestSchema,
  ComponentRegistrySchema,
  InteractionContractSchema,
  DesignPatchSchema,
  type Diagnostic,
} from "./schema.js";
import { isApprovalValid } from "./hash.js";
import { z } from "zod";

export type ContractType =
  | "blueprint"
  | "context"
  | "manifest"
  | "registry"
  | "interaction"
  | "patch";

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  diagnostics: Diagnostic[];
}

export function validateContract<T>(
  type: ContractType,
  raw: unknown
): ValidationResult<T> {
  let schema: z.ZodType<any>;

  switch (type) {
    case "blueprint":
      schema = UIBlueprintSchema;
      break;
    case "context":
      schema = DesignContextSchema;
      break;
    case "manifest":
      schema = DesignPackageManifestSchema;
      break;
    case "registry":
      schema = ComponentRegistrySchema;
      break;
    case "interaction":
      schema = InteractionContractSchema;
      break;
    case "patch":
      schema = DesignPatchSchema;
      break;
    default:
      return {
        success: false,
        diagnostics: [
          {
            code: "UNKNOWN_CONTRACT_TYPE",
            message: `Unknown contract type: ${type}`,
            severity: "ERROR",
          },
        ],
      };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const diagnostics: Diagnostic[] = result.error.errors.map((err) => ({
      code: "SCHEMA_VALIDATION_ERROR",
      message: `${err.path.join(".")}: ${err.message}`,
      severity: "ERROR",
      path: err.path.join("."),
    }));
    return { success: false, diagnostics };
  }

  const diagnostics: Diagnostic[] = [];

  // Helper to validate compound element identity uniqueness
  function checkCompoundIdentities(root: any, pathPrefix: string) {
    const seen = new Set<string>();

    function walk(node: any, currentPath: string) {
      if (!node || typeof node !== "object") return;
      if (node.identity && typeof node.identity === "object") {
        const id = node.identity;
        const compoundKey = `${id.screenId}:${id.state || "ready"}:${id.breakpoint || "desktop"}:${id.semanticId}:${id.instanceKey}`;
        if (seen.has(compoundKey)) {
          diagnostics.push({
            code: "DUPLICATE_ELEMENT_IDENTITY",
            message: `Duplicate compound element identity detected in tree: '${compoundKey}'. Complete identity must be unique per screen/state/breakpoint/semanticId/instanceKey.`,
            severity: "ERROR",
            path: `${currentPath}.identity`,
            details: { compoundKey, identity: id },
          });
        }
        seen.add(compoundKey);
      }

      if (Array.isArray(node.children)) {
        node.children.forEach((child: any, idx: number) => {
          walk(child, `${currentPath}.children[${idx}]`);
        });
      }
    }

    walk(root, pathPrefix);
  }

  // 1. Blueprint validation: Compound identities must be unique
  if (type === "blueprint") {
    const bp = result.data as any;
    if (bp.rootNode) {
      checkCompoundIdentities(bp.rootNode, "rootNode");
    }
  }

  // 2. Context validation: Compound identities must be unique across exportedTree
  if (type === "context") {
    const ctx = result.data as any;
    if (ctx.exportedTree) {
      checkCompoundIdentities(ctx.exportedTree, "exportedTree");
    }
  }

  // 3. Manifest validation: Stale approval and provenance declaration consistency
  if (type === "manifest") {
    const manifest = result.data as any;
    if (manifest.approval && manifest.approval.status === "APPROVED" && !isApprovalValid(manifest)) {
      diagnostics.push({
        code: "STALE_APPROVAL_HASH_MISMATCH",
        message: `Approval bindingContentHash (${manifest.approval.bindingContentHash}) does not match manifest contentHash (${manifest.contentHash})`,
        severity: "ERROR",
      });
    }

    // Provenance declaration consistency check (声明一致性，非真实性密码学认证)
    if (manifest.provenance && typeof manifest.provenance === "object") {
      const p = manifest.provenance;
      const allSynthetic =
        p.designOrigin === "SYNTHETIC_SPEC" &&
        p.componentOrigin === "SYNTHETIC_FIXTURE" &&
        p.tokenOrigin === "SYNTHETIC_CANONICAL" &&
        p.dataOrigin === "SYNTHETIC_MOCK";

      const allReal =
        p.designOrigin === "REAL_FIGMA" &&
        p.componentOrigin === "REAL_REPO" &&
        p.tokenOrigin === "REAL_FIGMA_VARIABLES" &&
        p.dataOrigin === "REAL_BACKEND";

      if (manifest.dataSource === "REAL" && allSynthetic) {
        diagnostics.push({
          code: "PROVENANCE_DECLARATION_CONTRADICTION",
          message:
            "Manifest declares dataSource: 'REAL', but all provenance origin dimensions are declared SYNTHETIC_*. Provenance declarations are contradictory.",
          severity: "ERROR",
          path: "provenance",
        });
      } else if (manifest.dataSource === "SYNTHETIC" && allReal) {
        diagnostics.push({
          code: "PROVENANCE_DECLARATION_CONTRADICTION",
          message:
            "Manifest declares dataSource: 'SYNTHETIC', but all provenance origin dimensions are declared REAL_*. Provenance declarations are contradictory.",
          severity: "ERROR",
          path: "provenance",
        });
      }
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === "ERROR");
  return {
    success: !hasErrors,
    data: result.data as T,
    diagnostics,
  };
}
