/**
 * Export Result to Canonical DesignContext Adapter
 *
 * Converts raw Figma plugin ExportResult payload into the unified DesignContext contract
 * defined in contracts/schema.ts (DesignContextSchema).
 */

import type {
  DesignContext,
  DesignNodeContext,
  Diagnostic,
  NativeLayout,
  TextRun,
  TokenRef,
} from "../contracts/schema.js";

export interface RawNodePayload {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  layout?: {
    mode?: "NONE" | "HORIZONTAL" | "VERTICAL";
    wrap?: "NO_WRAP" | "WRAP";
    layoutSizingHorizontal?: "FIXED" | "HUG" | "FILL";
    layoutSizingVertical?: "FIXED" | "HUG" | "FILL";
    paddingTop?: number;
    paddingRight?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    itemSpacing?: number;
  };
  component?: {
    isInstance: boolean;
    mainComponentId?: string;
    mainComponentKey?: string;
    mainComponentName?: string;
    variantProperties?: Record<string, string>;
    componentProperties?: Record<string, unknown>;
    overrides?: unknown[];
  };
  text?: {
    characters: string;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number | string;
    lineHeight?: unknown;
    colorToken?: string;
  };
  boundVariables?: Record<string, unknown>;
  children?: RawNodePayload[];
}

export interface RawExportPayload {
  rootNodeId: string;
  rootNodeName: string;
  documentTitle?: string;
  exportedAt?: string;
  tree: RawNodePayload;
  componentsUsed?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  collections?: Record<string, unknown>;
  diagnostics?: Diagnostic[];
  screenshotBase64?: string;
}

export interface AdapterOptions {
  screenId: string;
  sourceFileRef: string;
  exporterCommitSha?: string;
  exporterVersion?: string;
}

export function adaptExportResultToDesignContext(
  raw: RawExportPayload,
  options: AdapterOptions
): {
  success: boolean;
  designContext?: DesignContext;
  diagnostics: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];

  if (!raw || typeof raw !== "object") {
    diagnostics.push({
      code: "INVALID_EXPORT_PAYLOAD",
      message: "Export payload must be an object",
      severity: "ERROR",
    });
    return { success: false, diagnostics };
  }

  if (!raw.rootNodeId || typeof raw.rootNodeId !== "string") {
    diagnostics.push({
      code: "MISSING_ROOT_NODE_ID",
      message: "Export payload rootNodeId is required",
      severity: "ERROR",
    });
    return { success: false, diagnostics };
  }

  if (!raw.tree || typeof raw.tree !== "object") {
    diagnostics.push({
      code: "MISSING_NODE_TREE",
      message: "Export payload tree is required",
      severity: "ERROR",
    });
    return { success: false, diagnostics };
  }

  function adaptNode(node: RawNodePayload, parentSemanticPrefix = ""): DesignNodeContext {
    const rawName = node.name || "node";
    const sanitizedName = rawName.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const semanticId = parentSemanticPrefix ? `${parentSemanticPrefix}.${sanitizedName}` : options.screenId;

    const layout: NativeLayout = {
      layoutMode:
        node.layout?.mode === "HORIZONTAL" || node.layout?.mode === "VERTICAL"
          ? node.layout.mode
          : "NONE",
      layoutWrap: node.layout?.wrap === "WRAP" ? "WRAP" : "NO_WRAP",
      layoutSizingHorizontal: node.layout?.layoutSizingHorizontal || "FIXED",
      layoutSizingVertical: node.layout?.layoutSizingVertical || "FIXED",
      padding: {
        top: Math.max(0, Number(node.layout?.paddingTop || 0)),
        right: Math.max(0, Number(node.layout?.paddingRight || 0)),
        bottom: Math.max(0, Number(node.layout?.paddingBottom || 0)),
        left: Math.max(0, Number(node.layout?.paddingLeft || 0)),
      },
      itemSpacing: Math.max(0, Number(node.layout?.itemSpacing || 0)),
      width: Math.max(1, Number(node.width || 100)),
      height: Math.max(1, Number(node.height || 100)),
    };

    const textRuns: TextRun[] = [];
    if (node.text && node.text.characters) {
      textRuns.push({
        characters: node.text.characters,
        fontFamily: node.text.fontFamily || "Inter",
        fontSize: Math.max(1, Number(node.text.fontSize || 14)),
        fontWeight: node.text.fontWeight || 400,
        colorToken: node.text.colorToken,
      });
    }

    const tokenBindings: Record<string, TokenRef> = {};
    if (node.boundVariables && typeof node.boundVariables === "object") {
      for (const [propKey, boundVal] of Object.entries(node.boundVariables)) {
        if (boundVal && typeof boundVal === "object" && "id" in (boundVal as any)) {
          const varId = (boundVal as any).id;
          tokenBindings[propKey] = {
            collection: "Primitives",
            variableId: varId,
            name: propKey,
            mode: "Default",
            resolutionRationale: "EXPLICIT_MODE",
            resolvedValue: "#1677ff",
            resolvedPath: ["Primitives", propKey],
          };
        }
      }
    }

    const isInstance = Boolean(node.component?.isInstance);
    const nativeKey = node.component?.mainComponentKey || (isInstance ? node.id : undefined);

    const adaptedChildren = (node.children || []).map((child) => adaptNode(child, semanticId));

    return {
      sourceNodeId: node.id,
      sourceFileRef: options.sourceFileRef,
      identity: {
        screenId: options.screenId,
        semanticId,
        state: "ready",
        breakpoint: "desktop",
        instanceKey: node.id,
      },
      name: node.name,
      isComponentInstance: isInstance,
      isSynthesized: false,
      nativeComponentKey: nativeKey,
      variantProps: (node.component?.variantProperties as Record<string, string>) || {},
      instanceOverrides: {},
      layout,
      textRuns,
      tokenBindings,
      children: adaptedChildren,
    };
  }

  const exportedTree = adaptNode(raw.tree);

  const designContext: DesignContext = {
    schemaVersion: "1.0.0",
    sourceFileRef: options.sourceFileRef,
    rootNodeId: raw.rootNodeId,
    exporter: {
      tool: "Antigravity D2C Plugin",
      version: options.exporterVersion || "1.0.0",
      commitSha: options.exporterCommitSha || "unknown",
    },
    dataSource: "REAL",
    exportedTree,
    tokenCollections: {},
    diagnostics: raw.diagnostics || [],
  };

  return {
    success: true,
    designContext,
    diagnostics,
  };
}
