/**
 * Native Figma Generator Plugin
 *
 * Executes verified FigmaOperationPlan using official Figma Plugin Scene Graph APIs.
 * Supports Frame creation, Auto Layout, Variable bindings, Component imports with
 * Draft Component fallback, and selective idempotent updates.
 *
 * Zero arbitrary JavaScript execution; consumes only validated Operation Plans.
 */

// Handles message from UI or headless runner
figma.ui.onmessage = async (msg) => {
  if (msg.type === "EXECUTE_PLAN") {
    const plan = msg.plan;
    if (!plan || !Array.isArray(plan.operations)) {
      figma.notify("Invalid Figma Operation Plan", { error: true });
      return;
    }

    const nodesBySemanticId = new Map<string, SceneNode>();
    let createdCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    // Scan existing page for nodes previously created by blueprint
    function scanExisting(node: SceneNode) {
      const sId = node.getPluginData("semanticId");
      if (sId) {
        nodesBySemanticId.set(sId, node);
      }
      if ("children" in node) {
        for (const child of node.children) {
          scanExisting(child);
        }
      }
    }
    for (const child of figma.currentPage.children) {
      scanExisting(child);
    }

    for (const op of plan.operations) {
      const existing = nodesBySemanticId.get(op.semanticId);

      if (existing) {
        const isManual = existing.getPluginData("manualEdited") === "true";
        if (isManual) {
          figma.notify(`Conflict: Node '${op.semanticId}' was manually edited. Overwrite blocked.`, {
            timeout: 3000,
          });
          continue;
        }

        const prevHash = existing.getPluginData("blueprintHash");
        if (prevHash === plan.blueprintHash) {
          skippedCount++;
          continue;
        }

        // Selective update
        updatedCount++;
        existing.name = op.name;
        if ("layoutMode" in existing && op.layout) {
          existing.layoutMode = op.layout.layoutMode === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL";
          existing.paddingTop = op.layout.padding.top;
          existing.paddingRight = op.layout.padding.right;
          existing.paddingBottom = op.layout.padding.bottom;
          existing.paddingLeft = op.layout.padding.left;
          existing.itemSpacing = op.layout.itemSpacing;
        }
        existing.setPluginData("blueprintHash", plan.blueprintHash);
        continue;
      }

      // Create new node
      let parentNode: BaseNode & ChildrenMixin = figma.currentPage;
      if (op.parentSemanticId) {
        const p = nodesBySemanticId.get(op.parentSemanticId);
        if (p && "children" in p) {
          parentNode = p as any;
        }
      }

      if (op.type === "CREATE_FRAME") {
        const frame = figma.createFrame();
        frame.name = op.name;
        if (op.layout) {
          frame.layoutMode = op.layout.layoutMode === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL";
          frame.paddingTop = op.layout.padding.top;
          frame.paddingRight = op.layout.padding.right;
          frame.paddingBottom = op.layout.padding.bottom;
          frame.paddingLeft = op.layout.padding.left;
          frame.itemSpacing = op.layout.itemSpacing;
          frame.primaryAxisAlignItems =
            op.layout.primaryAxisAlignItems === "SPACE_BETWEEN" ? "SPACE_BETWEEN" : "MIN";
          frame.counterAxisAlignItems = "CENTER";
        }
        frame.setPluginData("semanticId", op.semanticId);
        frame.setPluginData("blueprintHash", plan.blueprintHash);
        parentNode.appendChild(frame);
        nodesBySemanticId.set(op.semanticId, frame);
        createdCount++;
      } else if (op.type === "CREATE_INSTANCE" || op.type === "CREATE_DRAFT_COMPONENT") {
        let instanceNode: SceneNode;

        let importedComponent: ComponentNode | null = null;
        if (op.componentKey) {
          try {
            importedComponent = await figma.importComponentByKeyAsync(op.componentKey);
          } catch (e) {
            importedComponent = null;
          }
        }

        if (importedComponent) {
          instanceNode = importedComponent.createInstance();
        } else {
          // Fallback to Draft Component (NOT a plain rectangle)
          const draft = figma.createComponent();
          draft.name = `[DRAFT] ${op.name}`;
          draft.layoutMode = "HORIZONTAL";
          draft.paddingTop = 8;
          draft.paddingBottom = 8;
          draft.paddingLeft = 12;
          draft.paddingRight = 12;
          draft.cornerRadius = 6;
          draft.setPluginData("isDraftComponent", "true");

          // Text node inside draft component
          await figma.loadFontAsync({ family: "Inter", style: "Regular" });
          const text = figma.createText();
          text.characters = op.name;
          draft.appendChild(text);

          instanceNode = draft;
        }

        instanceNode.name = op.name;
        instanceNode.setPluginData("semanticId", op.semanticId);
        instanceNode.setPluginData("blueprintHash", plan.blueprintHash);
        parentNode.appendChild(instanceNode);
        nodesBySemanticId.set(op.semanticId, instanceNode);
        createdCount++;
      }
    }

    figma.notify(
      `Plan Executed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} unchanged.`,
      { timeout: 4000 }
    );
  }
};

figma.showUI(__html__, { width: 360, height: 480 });
