/**
 * Blueprint Engine Contract Schemas
 *
 * Single source of truth for Phase 4A:
 * PRD → Requirement Analysis → Design Brief → UI Blueprint → Interaction Contract
 */

import { z } from "zod";
import { SCHEMA_VERSION, DiagnosticSchema, type Diagnostic } from "../contracts/schema.js";

// ============================================================================
// 1. UI Requirement & Analysis
// ============================================================================

export const UserRoleSchema = z.object({
  role: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.string()).default([]),
});
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserJobSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  job: z.string().min(1),
  expectedOutcome: z.string().min(1),
});
export type UserJob = z.infer<typeof UserJobSchema>;

export const ScreenGoalSchema = z.object({
  screenId: z.string().min(1),
  purpose: z.string().min(1),
  successMetrics: z.array(z.string()).default([]),
});
export type ScreenGoal = z.infer<typeof ScreenGoalSchema>;

export const UIRequirementSchema = z.object({
  productGoals: z.array(z.string().min(1)).min(1),
  userRoles: z.array(UserRoleSchema).min(1),
  userJobs: z.array(UserJobSchema).min(1),
  screenGoals: z.array(ScreenGoalSchema).min(1),
  businessConstraints: z.array(z.string().min(1)).default([]),
});
export type UIRequirement = z.infer<typeof UIRequirementSchema>;

export const StateMatrixItemSchema = z.object({
  state: z.string().min(1),
  description: z.string().min(1),
  triggers: z.array(z.string()).default([]),
});
export type StateMatrixItem = z.infer<typeof StateMatrixItemSchema>;

export const ScreenMapItemSchema = z.object({
  screenId: z.string().min(1),
  route: z.string().min(1),
  purpose: z.string().min(1),
  layout: z.string().min(1),
});
export type ScreenMapItem = z.infer<typeof ScreenMapItemSchema>;

export const RequirementAnalysisSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  productName: z.string().min(1),
  confirmedFacts: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  decisionsRequired: z.array(z.string()).default([]),
  userJobs: z.array(UserJobSchema).default([]),
  screenMap: z.array(ScreenMapItemSchema).default([]),
  stateMatrix: z.record(z.array(StateMatrixItemSchema)).default({}),
  diagnostics: z.array(DiagnosticSchema).default([]),
});
export type RequirementAnalysis = z.infer<typeof RequirementAnalysisSchema>;

// ============================================================================
// 2. Component Intent & Catalog
// ============================================================================

export const ComponentIntentSchema = z.object({
  semanticId: z.string().min(1),
  intent: z.string().min(1),
  component: z.string().min(1),
  variant: z.string().default("default"),
  importance: z.enum(["high", "medium", "low"]).default("medium"),
  regionId: z.string().optional(),
  label: z.string().optional(),
  props: z.record(z.unknown()).default({}),
  boundStates: z.array(z.string()).default([]),
});
export type ComponentIntent = z.infer<typeof ComponentIntentSchema>;

export const CatalogIntentDefSchema = z.object({
  description: z.string().optional(),
  allowedComponents: z.array(z.string().min(1)).min(1),
  allowedVariants: z.array(z.string()).default(["default"]),
  states: z.array(z.string()).default(["default"]),
  defaultComponent: z.string().min(1),
});
export type CatalogIntentDef = z.infer<typeof CatalogIntentDefSchema>;

export const ComponentIntentCatalogSchema = z.record(CatalogIntentDefSchema);
export type ComponentIntentCatalog = z.infer<typeof ComponentIntentCatalogSchema>;

// ============================================================================
// 3. Design Brief (3 Visual Directions)
// ============================================================================

export const VisualDirectionSchema = z.object({
  key: z.enum(["A", "B", "C"]),
  name: z.string().min(1),
  brandTone: z.string().min(1),
  layoutStyle: z.string().min(1),
  density: z.enum(["high", "medium", "low"]),
  typography: z.object({
    fontFamily: z.string().min(1),
    baseFontSize: z.number().positive(),
    headingScale: z.string().min(1),
  }),
  colorStrategy: z.object({
    primaryColor: z.string().min(1),
    surfaceStyle: z.string().min(1),
    contrastRatio: z.string().min(1),
  }),
  interactionStyle: z.string().min(1),
  referenceProducts: z.array(z.string()).min(1),
  risk: z.string().min(1),
});
export type VisualDirection = z.infer<typeof VisualDirectionSchema>;

export const DesignBriefSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  productType: z.string().min(1),
  visualDirections: z.object({
    A: VisualDirectionSchema,
    B: VisualDirectionSchema,
    C: VisualDirectionSchema,
  }),
  selectedDirection: z.enum(["A", "B", "C"]).nullable().default(null),
  selectionRationale: z.string().nullable().default(null),
  diagnostics: z.array(DiagnosticSchema).default([]),
});
export type DesignBrief = z.infer<typeof DesignBriefSchema>;

// ============================================================================
// 4. UI Blueprint (Screen Blueprint)
// ============================================================================

export const RegionBlueprintSchema = z.object({
  id: z.string().min(1),
  intent: z.string().min(1),
  layout: z
    .object({
      type: z.enum(["horizontal", "vertical", "grid", "free"]).default("horizontal"),
      spacing: z.number().nonnegative().optional(),
      align: z.string().optional(),
    })
    .default({ type: "horizontal" }),
  components: z.array(ComponentIntentSchema).default([]),
});
export type RegionBlueprint = z.infer<typeof RegionBlueprintSchema>;

export const ScreenBlueprintSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  screenId: z.string().min(1),
  route: z.string().min(1),
  purpose: z.string().min(1),
  layout: z.object({
    type: z.string().min(1),
    breakpoints: z.array(z.enum(["desktop", "tablet", "mobile"])).default(["desktop", "mobile"]),
  }),
  states: z.array(z.string().min(1)).min(1),
  regions: z.array(RegionBlueprintSchema).min(1),
  components: z.array(ComponentIntentSchema).min(1),
  selectedDirection: z.enum(["A", "B", "C"]).optional(),
  diagnostics: z.array(DiagnosticSchema).default([]),
});
export type ScreenBlueprint = z.infer<typeof ScreenBlueprintSchema>;

// ============================================================================
// 5. Interaction Contract
// ============================================================================

export const InteractionStepSchema = z.object({
  id: z.string().min(1),
  event: z.string().min(1),
  source: z.string().min(1),
  action: z.enum([
    "open-modal",
    "close-modal",
    "submit-form",
    "validate-fields",
    "filter-table",
    "navigate",
    "trigger-mutation",
    "show-notification",
    "reset-form",
  ]),
  target: z.string().min(1),
  validationRules: z
    .array(
      z.object({
        field: z.string().min(1),
        rule: z.string().min(1),
      })
    )
    .optional(),
  onSuccess: z
    .object({
      action: z.string().min(1),
      feedback: z.string().optional(),
      target: z.string().optional(),
    })
    .optional(),
  onError: z
    .object({
      action: z.string().min(1),
      feedback: z.string().optional(),
      target: z.string().optional(),
    })
    .optional(),
});
export type InteractionStep = z.infer<typeof InteractionStepSchema>;

export const InteractionContractSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION).default(SCHEMA_VERSION),
  screenId: z.string().min(1),
  interactions: z.array(InteractionStepSchema).min(1),
  diagnostics: z.array(DiagnosticSchema).default([]),
});
export type InteractionContract = z.infer<typeof InteractionContractSchema>;
