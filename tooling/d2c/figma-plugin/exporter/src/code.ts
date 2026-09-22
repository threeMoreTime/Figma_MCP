/**
 * Antigravity D2C Read-Only Exporter (Figma Plugin Main Thread)
 *
 * Principles:
 * - Strictly READ-ONLY: 0 node mutations, 0 deletions, 0 setPluginData, 0 writes.
 * - Zero network: networkAccess allowedDomains: ['none'].
 * - Zero MCP: Completely offline in-editor export.
 * - Extracts:
 *   1. Full raw node tree with layout, bounds, styles, text segments
 *   2. Component identity, key, variants, and overrides
 *   3. Bound variables, collections, modes, and complete alias graph
 *   4. Rendered PNG screenshot of selected frame
 *   5. Structured diagnostics (missing variables, font requirements)
 */

/// <reference types="@figma/plugin-typings" />

declare const __html__: string;

figma.showUI(__html__, { width: 480, height: 600 });

interface Diagnostic {
  code: string;
  message: string;
  severity: "INFO" | "WARNING" | "ERROR";
  nodeId?: string;
  details?: Record<string, unknown>;
}

interface RawNodePayload {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  layout?: {
    mode: "NONE" | "HORIZONTAL" | "VERTICAL";
    wrap?: "NO_WRAP" | "WRAP";
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
    itemSpacing: number;
    primaryAxisAlignItems?: string;
    counterAxisAlignItems?: string;
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
    segments?: unknown[];
  };
  boundVariables?: Record<string, unknown>;
  fills?: unknown;
  strokes?: unknown;
  children?: RawNodePayload[];
}

interface ExportResult {
  rootNodeId: string;
  rootNodeName: string;
  documentTitle: string;
  exportedAt: string;
  tree: RawNodePayload;
  componentsUsed: Record<string, unknown>;
  variables: Record<string, unknown>;
  collections: Record<string, unknown>;
  diagnostics: Diagnostic[];
  screenshotBase64?: string;
}

// Convert Uint8Array to Base64 in browser/plugin sandbox
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  // btoa is available in Figma plugin sandbox
  return typeof btoa !== "undefined" ? btoa(binary) : "";
}

async function runExport(): Promise<void> {
  const selection = figma.currentPage.selection;
  const diagnostics: Diagnostic[] = [];

  if (selection.length === 0) {
    figma.ui.postMessage({
      type: "SELECTION_EMPTY",
      message: "Please select a frame or component to export.",
    });
    return;
  }

  if (selection.length > 1) {
    diagnostics.push({
      code: "MULTIPLE_SELECTIONS",
      message: `Multiple elements selected (${selection.length}). Exporting the first selected element: '${selection[0].name}'.`,
      severity: "WARNING",
      nodeId: selection[0].id,
    });
  }

  const rootNode = selection[0];
  const referencedVariableIds = new Set<string>();
  const componentsUsed: Record<string, unknown> = {};

  // 1. Traverse and extract node tree (READ-ONLY)
  function walkNode(node: SceneNode): RawNodePayload {
    const payload: RawNodePayload = {
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };

    // Auto Layout
    if ("layoutMode" in node && node.layoutMode !== undefined) {
      payload.layout = {
        mode: node.layoutMode === "NONE" ? "NONE" : node.layoutMode === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL",
        wrap: "layoutWrap" in node && node.layoutWrap === "WRAP" ? "WRAP" : "NO_WRAP",
        paddingTop: "paddingTop" in node ? (node.paddingTop as number) : 0,
        paddingRight: "paddingRight" in node ? (node.paddingRight as number) : 0,
        paddingBottom: "paddingBottom" in node ? (node.paddingBottom as number) : 0,
        paddingLeft: "paddingLeft" in node ? (node.paddingLeft as number) : 0,
        itemSpacing: "itemSpacing" in node ? (node.itemSpacing as number) : 0,
        primaryAxisAlignItems: "primaryAxisAlignItems" in node ? String(node.primaryAxisAlignItems) : undefined,
        counterAxisAlignItems: "counterAxisAlignItems" in node ? String(node.counterAxisAlignItems) : undefined,
      };
    }

    // Component Instance
    if (node.type === "INSTANCE") {
      const instance = node as InstanceNode;
      const main = instance.mainComponent;
      payload.component = {
        isInstance: true,
        mainComponentId: main?.id,
        mainComponentKey: main?.key,
        mainComponentName: main?.name,
        variantProperties: instance.variantProperties || undefined,
        componentProperties: instance.componentProperties as Record<string, unknown>,
        overrides: instance.overrides ? (instance.overrides as unknown[]) : undefined,
      };

      if (main) {
        componentsUsed[main.key || main.id] = {
          id: main.id,
          key: main.key,
          name: main.name,
          parentSet: main.parent && main.parent.type === "COMPONENT_SET" ? main.parent.name : undefined,
        };
      }
    }

    // Text details
    if (node.type === "TEXT") {
      const textNode = node as TextNode;
      payload.text = {
        characters: textNode.characters,
        fontSize: typeof textNode.fontSize === "number" ? textNode.fontSize : undefined,
      };

      // Record font dependency
      if (typeof textNode.fontName === "object" && textNode.fontName !== null) {
        payload.text.fontFamily = (textNode.fontName as FontName).family;
        payload.text.fontWeight = (textNode.fontName as FontName).style;
      } else {
        diagnostics.push({
          code: "MIXED_FONTS_DETECTED",
          message: `Text node '${node.name}' uses mixed fonts.`,
          severity: "INFO",
          nodeId: node.id,
        });
      }
    }

    // Bound variables
    if ("boundVariables" in node && node.boundVariables) {
      payload.boundVariables = node.boundVariables as Record<string, unknown>;
      // Harvest variable IDs
      const bound = node.boundVariables as Record<string, any>;
      for (const [prop, val] of Object.entries(bound)) {
        if (val && typeof val === "object") {
          if ("id" in val && typeof val.id === "string") {
            referencedVariableIds.add(val.id);
          } else if (Array.isArray(val)) {
            for (const item of val) {
              if (item && item.id) referencedVariableIds.add(item.id);
            }
          }
        }
      }
    }

    // Fills / Strokes
    if ("fills" in node && node.fills) {
      payload.fills = node.fills;
    }
    if ("strokes" in node && node.strokes) {
      payload.strokes = node.strokes;
    }

    // Children
    if ("children" in node && Array.isArray((node as any).children)) {
      payload.children = ((node as any).children as SceneNode[]).map(walkNode);
    }

    return payload;
  }

  const tree = walkNode(rootNode);

  // 2. Resolve referenced Variables and Collections via BFS
  const variablesMap: Record<string, unknown> = {};
  const collectionsMap: Record<string, unknown> = {};
  const varQueue = Array.from(referencedVariableIds);
  const visitedVars = new Set<string>();

  while (varQueue.length > 0) {
    const varId = varQueue.shift()!;
    if (visitedVars.has(varId)) continue;
    visitedVars.add(varId);

    try {
      const v = await figma.variables.getVariableByIdAsync(varId);
      if (v) {
        variablesMap[v.id] = {
          id: v.id,
          name: v.name,
          resolvedType: v.resolvedType,
          valuesByMode: v.valuesByMode,
          collectionId: v.variableCollectionId,
        };

        // Enqueue aliases
        for (const modeVal of Object.values(v.valuesByMode)) {
          if (
            modeVal &&
            typeof modeVal === "object" &&
            (modeVal as any).type === "VARIABLE_ALIAS" &&
            (modeVal as any).id
          ) {
            varQueue.push((modeVal as any).id);
          }
        }

        // Fetch collection
        if (!collectionsMap[v.variableCollectionId]) {
          try {
            const coll = await figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
            if (coll) {
              collectionsMap[coll.id] = {
                id: coll.id,
                name: coll.name,
                modes: coll.modes,
                defaultModeId: coll.defaultModeId,
              };
            }
          } catch (e: any) {
            diagnostics.push({
              code: "COLLECTION_FETCH_FAILED",
              message: `Could not fetch collection '${v.variableCollectionId}': ${e.message}`,
              severity: "WARNING",
            });
          }
        }
      }
    } catch (e: any) {
      diagnostics.push({
        code: "VARIABLE_FETCH_FAILED",
        message: `Could not fetch variable '${varId}': ${e.message}`,
        severity: "WARNING",
      });
    }
  }

  // 3. Render PNG Screenshot of root node
  let screenshotBase64 = "";
  try {
    const pngBytes = await rootNode.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: 1 },
    });
    screenshotBase64 = uint8ArrayToBase64(pngBytes);
  } catch (err: any) {
    diagnostics.push({
      code: "SCREENSHOT_EXPORT_FAILED",
      message: `Failed to export frame screenshot: ${err.message}`,
      severity: "WARNING",
      nodeId: rootNode.id,
    });
  }

  const result: ExportResult = {
    rootNodeId: rootNode.id,
    rootNodeName: rootNode.name,
    documentTitle: figma.root.name,
    exportedAt: new Date().toISOString(),
    tree,
    componentsUsed,
    variables: variablesMap,
    collections: collectionsMap,
    diagnostics,
    screenshotBase64,
  };

  figma.ui.postMessage({
    type: "EXPORT_SUCCESS",
    payload: result,
  });
}

// Event Listeners
figma.ui.onmessage = async (msg: any) => {
  if (msg.type === "TRIGGER_EXPORT") {
    await runExport();
  } else if (msg.type === "CLOSE_PLUGIN") {
    figma.closePlugin();
  }
};

// Auto-run on initial launch if selection is already present
runExport();
