/**
 * Figma Scene Graph Simulator
 *
 * Simulates Figma Plugin API execution in Node.js environment to enable deterministic
 * automated testing of Frame creation, Auto Layout, Variable bindings, Component instantiation,
 * Draft Component fallback, second-run idempotency, and conflict detection.
 */

import { type Diagnostic } from "../contracts/schema.js";
import type { FigmaOperationPlan, FigmaOperation } from "../blueprint/schema.js";

export interface SimulatedNode {
  id: string;
  name: string;
  type: "FRAME" | "COMPONENT" | "INSTANCE";
  layoutMode: "NONE" | "HORIZONTAL" | "VERTICAL";
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  itemSpacing: number;
  primaryAxisAlignItems: string;
  counterAxisAlignItems: string;
  fills: Array<{ type: string; color?: string; boundVariable?: string }>;
  strokes: Array<{ type: string; color?: string; boundVariable?: string }>;
  boundVariables: Record<string, string>;
  pluginData: Map<string, string>;
  children: SimulatedNode[];
  parent: SimulatedNode | null;
  isDraftComponent?: boolean;
}

export interface SimulatorContext {
  rootPage: SimulatedNode;
  nodesBySemanticId: Map<string, SimulatedNode>;
  libraryComponents: Map<string, { key: string; name: string }>;
}

export function createSimulatorContext(): SimulatorContext {
  const rootPage: SimulatedNode = {
    id: "figma-page-0",
    name: "Page 1",
    type: "FRAME",
    layoutMode: "NONE",
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    itemSpacing: 0,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    fills: [{ type: "SOLID", color: "#ffffff" }],
    strokes: [],
    boundVariables: {},
    pluginData: new Map(),
    children: [],
    parent: null,
  };

  return {
    rootPage,
    nodesBySemanticId: new Map(),
    libraryComponents: new Map(),
  };
}

export interface SimulationResult {
  success: boolean;
  createdNodes: number;
  skippedNodes: number;
  updatedNodes: number;
  conflicts: number;
  diagnostics: Diagnostic[];
}

export function executePlanInSimulator(
  plan: FigmaOperationPlan,
  context: SimulatorContext
): SimulationResult {
  let createdNodes = 0;
  let skippedNodes = 0;
  let updatedNodes = 0;
  let conflicts = 0;
  const diagnostics: Diagnostic[] = [];

  let nextId = 100;

  for (const op of plan.operations) {
    const existingNode = context.nodesBySemanticId.get(op.semanticId);

    if (existingNode) {
      // 1. Conflict Detection: User modified node manually
      if (existingNode.pluginData.get("manualEdited") === "true") {
        conflicts++;
        diagnostics.push({
          code: "MANUAL_CONFLICT_DETECTED",
          message: `Node '${op.semanticId}' was manually modified in Figma. Overwrite blocked.`,
          severity: "WARNING",
          nodeId: existingNode.id,
          path: op.semanticId,
        });
        continue;
      }

      // 2. Idempotency Check: Same blueprint hash, no changes needed
      const prevHash = existingNode.pluginData.get("blueprintHash");
      if (prevHash === plan.blueprintHash) {
        skippedNodes++;
        continue;
      }

      // 3. Selective Update: Blueprint changed, update properties without duplicating node
      updatedNodes++;
      existingNode.name = op.name;
      if (op.layout) {
        existingNode.layoutMode = op.layout.layoutMode;
        existingNode.paddingTop = op.layout.padding.top;
        existingNode.paddingRight = op.layout.padding.right;
        existingNode.paddingBottom = op.layout.padding.bottom;
        existingNode.paddingLeft = op.layout.padding.left;
        existingNode.itemSpacing = op.layout.itemSpacing;
        existingNode.primaryAxisAlignItems = op.layout.primaryAxisAlignItems;
        existingNode.counterAxisAlignItems = op.layout.counterAxisAlignItems;
      }
      if (op.variableBinding) {
        existingNode.boundVariables[op.variableBinding.property] = `VariableID:${op.variableBinding.variableToken}`;
      }
      existingNode.pluginData.set("blueprintHash", plan.blueprintHash);
      continue;
    }

    // 4. Create New Node
    let parentNode: SimulatedNode = context.rootPage;
    if (op.parentSemanticId) {
      const parent = context.nodesBySemanticId.get(op.parentSemanticId);
      if (parent) {
        parentNode = parent;
      } else {
        diagnostics.push({
          code: "PARENT_NODE_NOT_FOUND",
          message: `Parent node with semanticId '${op.parentSemanticId}' not found for '${op.semanticId}'. Attached to root.`,
          severity: "WARNING",
        });
      }
    }

    const newNodeId = `figma-node-${nextId++}`;
    let nodeType: "FRAME" | "COMPONENT" | "INSTANCE" = "FRAME";
    let isDraftComponent = false;

    if (op.type === "CREATE_INSTANCE") {
      const compTarget = op.component || "";
      const hasInLib = context.libraryComponents.has(compTarget);

      if (hasInLib) {
        nodeType = "INSTANCE";
      } else {
        // Missing component: Fallback to Draft Component (NOT a plain rectangle)
        nodeType = "COMPONENT";
        isDraftComponent = true;
        diagnostics.push({
          code: "DRAFT_COMPONENT_FALLBACK",
          message: `Component '${compTarget}' not found in library. Created structured Draft Component.`,
          severity: "INFO",
          nodeId: newNodeId,
          details: { component: compTarget, semanticId: op.semanticId },
        });
      }
    } else if (op.type === "CREATE_DRAFT_COMPONENT") {
      nodeType = "COMPONENT";
      isDraftComponent = true;
    }

    const newNode: SimulatedNode = {
      id: newNodeId,
      name: op.name,
      type: nodeType,
      isDraftComponent,
      layoutMode: op.layout ? op.layout.layoutMode : "NONE",
      paddingTop: op.layout?.padding.top ?? 0,
      paddingRight: op.layout?.padding.right ?? 0,
      paddingBottom: op.layout?.padding.bottom ?? 0,
      paddingLeft: op.layout?.padding.left ?? 0,
      itemSpacing: op.layout?.itemSpacing ?? 0,
      primaryAxisAlignItems: op.layout?.primaryAxisAlignItems ?? "MIN",
      counterAxisAlignItems: op.layout?.counterAxisAlignItems ?? "MIN",
      fills: [],
      strokes: [],
      boundVariables: {},
      pluginData: new Map(),
      children: [],
      parent: parentNode,
    };

    if (op.variableBinding) {
      newNode.boundVariables[op.variableBinding.property] = `VariableID:${op.variableBinding.variableToken}`;
      if (op.variableBinding.property === "fills") {
        newNode.fills.push({
          type: "SOLID",
          color: String(op.variableBinding.fallbackValue),
          boundVariable: op.variableBinding.variableToken,
        });
      } else if (op.variableBinding.property === "strokes") {
        newNode.strokes.push({
          type: "SOLID",
          color: String(op.variableBinding.fallbackValue),
          boundVariable: op.variableBinding.variableToken,
        });
      }
    }

    newNode.pluginData.set("semanticId", op.semanticId);
    newNode.pluginData.set("blueprintHash", plan.blueprintHash);

    parentNode.children.push(newNode);
    context.nodesBySemanticId.set(op.semanticId, newNode);
    createdNodes++;
  }

  return {
    success: diagnostics.filter((d) => d.severity === "ERROR").length === 0,
    createdNodes,
    skippedNodes,
    updatedNodes,
    conflicts,
    diagnostics,
  };
}
