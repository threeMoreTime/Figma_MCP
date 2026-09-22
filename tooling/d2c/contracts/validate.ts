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

  // Semantic checks:
  if (type === "manifest") {
    const manifest = result.data;
    if (manifest.approval.status === "APPROVED" && !isApprovalValid(manifest)) {
      diagnostics.push({
        code: "STALE_APPROVAL_HASH_MISMATCH",
        message: `Approval bindingContentHash (${manifest.approval.bindingContentHash}) does not match manifest contentHash (${manifest.contentHash})`,
        severity: "ERROR",
      });
      return { success: false, diagnostics };
    }
  }

  return { success: true, data: result.data as T, diagnostics };
}
