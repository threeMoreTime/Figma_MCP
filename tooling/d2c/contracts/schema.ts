/**
 * D2C Unified Contracts & Runtime Schemas
 *
 * Single source of truth for runtime validation and TypeScript types.
 * Schema versions are explicitly locked to "1.0.0".
 */

import { z } from "zod";

export const SCHEMA_VERSION = "1.0.0" as const;

// ============================================================================
// 1. Common Primitives & Identities
// ============================================================================

export const DataSourceSchema = z.enum(["SYNTHETIC", "REAL"]);
export type DataSource = z.infer<typeof DataSourceSchema>;

export const DiagnosticSeveritySchema = z.enum(["INFO", "WARNING", "ERROR"]);
export const DiagnosticSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: DiagnosticSeveritySchema,
  nodeId: z.string().optional(),
  path: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
export type Diagnostic = z.infer<typeof DiagnosticSchema>;

// Compound Business Element Identity
export const ElementIdentitySchema = z.object({
  screenId: z.string().min(1),
  semanticId: z.string().min(1),
  state: z.string().default("ready"),
  breakpoint: z.enum(["desktop", "tablet", "mobile"]).default("desktop"),
  instanceKey: z.string().min(1),
});
export type ElementIdentity = z.infer<typeof ElementIdentitySchema>;

// Detailed Multi-Dimensional Provenance
export const ProvenanceRecordSchema = z.object({
  designOrigin: z.enum(["REAL_FIGMA", "SYNTHETIC_SPEC"]),
  componentOrigin: z.enum(["REAL_REPO", "SYNTHETIC_FIXTURE"]),
  tokenOrigin: z.enum(["REAL_FIGMA_VARIABLES", "SYNTHETIC_CANONICAL"]),
  dataOrigin: z.enum(["REAL_BACKEND", "SYNTHETIC_MOCK"]),
});
export type ProvenanceRecord = z.infer<typeof ProvenanceRecordSchema>;

// ============================================================================
// 2. Token & Variable References
// ============================================================================

export const TokenRefSchema = z.object({
  collection: z.string().min(1),
  collectionId: z.string().optional(),
  name: z.string().min(1),
  variableId: z.string().optional(),
  mode: z.string().min(1),
  modeId: z.string().optional(),
  resolutionRationale: z.enum(["EXPLICIT_MODE", "INHERITED_DEFAULT", "API_RESOLVED", "UNKNOWN_MODE"]).default("EXPLICIT_MODE"),
  resolvedValue: z.union([z.string(), z.number(), z.boolean()]),
  resolvedPath: z.array(z.string()).default([]),
  aliasSource: z.string().optional(),
});
export type TokenRef = z.infer<typeof TokenRefSchema>;

// ============================================================================
// 3. Native Layout & Typography Contracts
// ============================================================================

export const NativeLayoutSchema = z.object({
  layoutMode: z.enum(["NONE", "HORIZONTAL", "VERTICAL"]),
  layoutWrap: z.enum(["NO_WRAP", "WRAP"]).default("NO_WRAP"),
  layoutSizingHorizontal: z.enum(["FIXED", "HUG", "FILL"]),
  layoutSizingVertical: z.enum(["FIXED", "HUG", "FILL"]),
  padding: z.object({
    top: z.number().nonnegative(),
    right: z.number().nonnegative(),
    bottom: z.number().nonnegative(),
    left: z.number().nonnegative(),
  }),
  itemSpacing: z.number().nonnegative().default(0),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type NativeLayout = z.infer<typeof NativeLayoutSchema>;

export const TextRunSchema = z.object({
  characters: z.string(),
  fontFamily: z.string(),
  fontSize: z.number().positive(),
  fontWeight: z.union([z.number(), z.string()]),
  lineHeight: z.union([z.number(), z.string()]).optional(),
  colorToken: z.string().optional(),
});
export type TextRun = z.infer<typeof TextRunSchema>;

// ============================================================================
// 4. UIBlueprint (Declaration of intent from PRD/Brief)
// ============================================================================

export const BlueprintNodeSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    identity: ElementIdentitySchema,
    intendedComponent: z.string().min(1),
    layout: NativeLayoutSchema.partial().optional(),
    props: z.record(z.unknown()).default({}),
    tokenBindings: z.record(z.string()).default({}),
    children: z.array(BlueprintNodeSchema).default([]),
    unsupportedFeatures: z.array(z.string()).default([]),
  })
);

export const UIBlueprintSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  blueprintId: z.string().min(1),
  screenId: z.string().min(1),
  title: z.string().min(1),
  dataSource: DataSourceSchema,
  rootNode: BlueprintNodeSchema,
  metadata: z.record(z.unknown()).default({}),
});
export type UIBlueprint = z.infer<typeof UIBlueprintSchema>;

// ============================================================================
// 5. DesignContext (Captured Figma context & extracted semantics)
// ============================================================================

export const DesignNodeContextSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    sourceNodeId: z.string().min(1),
    sourceFileRef: z.string().min(1),
    identity: ElementIdentitySchema,
    name: z.string().min(1),
    isComponentInstance: z.boolean(),
    isSynthesized: z.boolean(),
    nativeComponentKey: z.string().optional(),
    variantProps: z.record(z.union([z.string(), z.boolean(), z.number()])).default({}),
    instanceOverrides: z.record(z.unknown()).default({}),
    layout: NativeLayoutSchema,
    textRuns: z.array(TextRunSchema).default([]),
    tokenBindings: z.record(TokenRefSchema).default({}),
    children: z.array(DesignNodeContextSchema).default([]),
  })
);

export const DesignContextSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  sourceFileRef: z.string().min(1),
  rootNodeId: z.string().min(1),
  exporter: z.object({
    tool: z.string().min(1),
    version: z.string().min(1),
    commitSha: z.string().min(1),
  }),
  dataSource: DataSourceSchema,
  exportedTree: DesignNodeContextSchema,
  tokenCollections: z.record(z.string(), z.array(TokenRefSchema)).default({}),
  diagnostics: z.array(DiagnosticSchema).default([]),
});
export type DesignContext = z.infer<typeof DesignContextSchema>;

// ============================================================================
// 6. ComponentRegistry (Binding of Figma key to real code component)
// ============================================================================

export const ComponentPropMetaSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["boolean", "string", "number", "enum", "node", "function", "object"]),
    required: z.boolean().default(false),
    defaultValue: z.unknown().optional(),
    enumOptions: z.array(z.string()).optional(),
    description: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === "boolean" && data.defaultValue !== undefined) {
        return typeof data.defaultValue === "boolean";
      }
      return true;
    },
    {
      message: "When type is 'boolean', defaultValue must be a boolean (true/false); stringified boolean is forbidden",
      path: ["defaultValue"],
    }
  );
export type ComponentPropMeta = z.infer<typeof ComponentPropMetaSchema>;

export const ComponentRecordSchema = z.object({
  designComponentId: z.string().min(1),
  modulePath: z.string().min(1),
  exportName: z.string().min(1),
  exportKind: z.enum(["default", "named"]).default("named").optional(),
  sourceType: DataSourceSchema,
  codeVersionHash: z.string().min(1),
  props: z.record(ComponentPropMetaSchema).default({}),
  supportedStates: z.array(z.string()).default(["ready"]),
  bindingStatus: z.enum(["UNBOUND", "DRAFT", "APPROVED", "CONFLICT"]),
  verificationStatus: z.enum(["VERIFIED", "UNVERIFIED_DEPENDENCY", "FAILED"]).default("VERIFIED").optional(),
  knownConstraints: z.array(z.string()).default([]),
  usageExample: z.string().optional(),
});
export type ComponentRecord = z.infer<typeof ComponentRecordSchema>;

export const ComponentRegistrySchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  registryId: z.string().min(1),
  targetRepo: z.string().min(1),
  scannedHead: z.string().min(1),
  components: z.record(z.string(), ComponentRecordSchema),
  diagnostics: z.array(DiagnosticSchema).default([]),
});
export type ComponentRegistry = z.infer<typeof ComponentRegistrySchema>;

// ============================================================================
// 7. InteractionContract (Behavioral specification)
// ============================================================================

export const InteractionStepSchema = z.object({
  trigger: z.enum(["onClick", "onChange", "onSubmit", "onHover", "onFocus"]),
  targetElementIdentity: ElementIdentitySchema,
  expectedEffect: z.enum(["navigate", "openModal", "closeModal", "toast", "stateChange", "apiCall"]),
  payload: z.record(z.unknown()).default({}),
});

export const InteractionContractSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  contractId: z.string().min(1),
  screenId: z.string().min(1),
  interactions: z.array(InteractionStepSchema).default([]),
});
export type InteractionContract = z.infer<typeof InteractionContractSchema>;

// ============================================================================
// 8. DesignPackageManifest (Immutable Package snapshot with Approval Hash)
// ============================================================================

export const ApprovalRecordSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  approvedBy: z.string().optional(),
  approvedAt: z.string().optional(),
  bindingContentHash: z.string().min(1),
  notes: z.string().optional(),
});
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export const DesignPackageManifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  packageId: z.string().min(1),
  screenId: z.string().min(1),
  revision: z.number().int().positive(),
  sourceFileRef: z.string().min(1),
  rootNodeId: z.string().min(1),
  dataSource: DataSourceSchema,
  provenance: ProvenanceRecordSchema.default({
    designOrigin: "SYNTHETIC_SPEC",
    componentOrigin: "SYNTHETIC_FIXTURE",
    tokenOrigin: "SYNTHETIC_CANONICAL",
    dataOrigin: "SYNTHETIC_MOCK",
  }).optional(),
  exporterCommitSha: z.string().min(1),
  canonicalTokenHash: z.string().min(1),
  contentHash: z.string().min(1),
  resourceHashes: z.record(z.string()).default({}),
  approval: ApprovalRecordSchema,
});
export type DesignPackageManifest = z.infer<typeof DesignPackageManifestSchema>;

// ============================================================================
// 9. DesignPatch (Controlled design delta contract for future writebacks)
// ============================================================================

export const PatchOperationSchema = z.object({
  op: z.enum(["add", "replace", "remove"]),
  path: z.string().min(1),
  value: z.unknown().optional(),
  beforeValue: z.unknown().optional(),
  targetIdentity: ElementIdentitySchema,
  fieldOwner: z.enum(["DESIGNER", "ENGINEER", "SYSTEM"]),
});

export const DesignPatchSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  patchId: z.string().min(1),
  baseContentHash: z.string().min(1),
  targetFileRef: z.string().min(1),
  operations: z.array(PatchOperationSchema).min(1),
  preconditions: z.record(z.unknown()).default({}),
  diagnostics: z.array(DiagnosticSchema).default([]),
});
export type DesignPatch = z.infer<typeof DesignPatchSchema>;
