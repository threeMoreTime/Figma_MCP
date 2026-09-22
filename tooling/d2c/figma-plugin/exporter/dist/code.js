"use strict";
(() => {
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // tooling/d2c/figma-plugin/exporter/src/code.ts
  figma.showUI(__html__, { width: 480, height: 600 });
  function uint8ArrayToBase64(bytes) {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return typeof btoa !== "undefined" ? btoa(binary) : "";
  }
  function runExport() {
    return __async(this, null, function* () {
      const selection = figma.currentPage.selection;
      const diagnostics = [];
      if (selection.length === 0) {
        figma.ui.postMessage({
          type: "SELECTION_EMPTY",
          message: "Please select a frame or component to export."
        });
        return;
      }
      if (selection.length > 1) {
        diagnostics.push({
          code: "MULTIPLE_SELECTIONS",
          message: `Multiple elements selected (${selection.length}). Exporting the first selected element: '${selection[0].name}'.`,
          severity: "WARNING",
          nodeId: selection[0].id
        });
      }
      const rootNode = selection[0];
      const referencedVariableIds = /* @__PURE__ */ new Set();
      const componentsUsed = {};
      function walkNode(node) {
        const payload = {
          id: node.id,
          name: node.name,
          type: node.type,
          visible: node.visible,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height
        };
        if ("layoutMode" in node && node.layoutMode !== void 0) {
          payload.layout = {
            mode: node.layoutMode === "NONE" ? "NONE" : node.layoutMode === "HORIZONTAL" ? "HORIZONTAL" : "VERTICAL",
            wrap: "layoutWrap" in node && node.layoutWrap === "WRAP" ? "WRAP" : "NO_WRAP",
            layoutSizingHorizontal: "layoutSizingHorizontal" in node ? node.layoutSizingHorizontal : void 0,
            layoutSizingVertical: "layoutSizingVertical" in node ? node.layoutSizingVertical : void 0,
            paddingTop: "paddingTop" in node ? node.paddingTop : 0,
            paddingRight: "paddingRight" in node ? node.paddingRight : 0,
            paddingBottom: "paddingBottom" in node ? node.paddingBottom : 0,
            paddingLeft: "paddingLeft" in node ? node.paddingLeft : 0,
            itemSpacing: "itemSpacing" in node ? node.itemSpacing : 0,
            primaryAxisAlignItems: "primaryAxisAlignItems" in node ? String(node.primaryAxisAlignItems) : void 0,
            counterAxisAlignItems: "counterAxisAlignItems" in node ? String(node.counterAxisAlignItems) : void 0
          };
        }
        if (node.type === "INSTANCE") {
          const instance = node;
          const main = instance.mainComponent;
          payload.component = {
            isInstance: true,
            mainComponentId: main == null ? void 0 : main.id,
            mainComponentKey: main == null ? void 0 : main.key,
            mainComponentName: main == null ? void 0 : main.name,
            variantProperties: instance.variantProperties || void 0,
            componentProperties: instance.componentProperties,
            overrides: instance.overrides ? instance.overrides : void 0
          };
          if (main) {
            componentsUsed[main.key || main.id] = {
              id: main.id,
              key: main.key,
              name: main.name,
              parentSet: main.parent && main.parent.type === "COMPONENT_SET" ? main.parent.name : void 0
            };
          }
        }
        if (node.type === "TEXT") {
          const textNode = node;
          payload.text = {
            characters: textNode.characters,
            fontSize: typeof textNode.fontSize === "number" ? textNode.fontSize : void 0
          };
          try {
            if (typeof textNode.getStyledTextSegments === "function") {
              const segs = textNode.getStyledTextSegments(["fontSize", "fontName", "fontWeight", "fills", "lineHeight"]);
              if (segs && Array.isArray(segs)) {
                payload.text.segments = segs;
              }
            }
          } catch (e) {
          }
          if (typeof textNode.fontName === "object" && textNode.fontName !== null) {
            payload.text.fontFamily = textNode.fontName.family;
            payload.text.fontWeight = textNode.fontName.style;
          } else {
            diagnostics.push({
              code: "MIXED_FONTS_DETECTED",
              message: `Text node '${node.name}' uses mixed fonts.`,
              severity: "INFO",
              nodeId: node.id
            });
          }
        }
        if ("boundVariables" in node && node.boundVariables) {
          payload.boundVariables = node.boundVariables;
          const bound = node.boundVariables;
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
        if ("fills" in node && node.fills) {
          payload.fills = node.fills;
        }
        if ("strokes" in node && node.strokes) {
          payload.strokes = node.strokes;
        }
        if ("children" in node && Array.isArray(node.children)) {
          payload.children = node.children.map(walkNode);
        }
        return payload;
      }
      const tree = walkNode(rootNode);
      const variablesMap = {};
      const collectionsMap = {};
      const varQueue = Array.from(referencedVariableIds);
      const visitedVars = /* @__PURE__ */ new Set();
      while (varQueue.length > 0) {
        const varId = varQueue.shift();
        if (visitedVars.has(varId)) continue;
        visitedVars.add(varId);
        try {
          const v = yield figma.variables.getVariableByIdAsync(varId);
          if (v) {
            variablesMap[v.id] = {
              id: v.id,
              name: v.name,
              resolvedType: v.resolvedType,
              valuesByMode: v.valuesByMode,
              collectionId: v.variableCollectionId
            };
            for (const modeVal of Object.values(v.valuesByMode)) {
              if (modeVal && typeof modeVal === "object" && modeVal.type === "VARIABLE_ALIAS" && modeVal.id) {
                varQueue.push(modeVal.id);
              }
            }
            if (!collectionsMap[v.variableCollectionId]) {
              try {
                const coll = yield figma.variables.getVariableCollectionByIdAsync(v.variableCollectionId);
                if (coll) {
                  collectionsMap[coll.id] = {
                    id: coll.id,
                    name: coll.name,
                    modes: coll.modes,
                    defaultModeId: coll.defaultModeId
                  };
                } else {
                  diagnostics.push({
                    code: "COLLECTION_NOT_FOUND",
                    message: `Variable collection '${v.variableCollectionId}' returned null from Figma API.`,
                    severity: "WARNING"
                  });
                }
              } catch (e) {
                diagnostics.push({
                  code: "COLLECTION_FETCH_FAILED",
                  message: `Could not fetch collection '${v.variableCollectionId}': ${e.message}`,
                  severity: "WARNING"
                });
              }
            }
          } else {
            diagnostics.push({
              code: "VARIABLE_NOT_FOUND",
              message: `Variable '${varId}' was referenced but returned null from Figma API.`,
              severity: "WARNING"
            });
          }
        } catch (e) {
          diagnostics.push({
            code: "VARIABLE_FETCH_FAILED",
            message: `Could not fetch variable '${varId}': ${e.message}`,
            severity: "WARNING"
          });
        }
      }
      let screenshotBase64 = "";
      try {
        const pngBytes = yield rootNode.exportAsync({
          format: "PNG",
          constraint: { type: "SCALE", value: 1 }
        });
        screenshotBase64 = uint8ArrayToBase64(pngBytes);
      } catch (err) {
        diagnostics.push({
          code: "SCREENSHOT_EXPORT_FAILED",
          message: `Failed to export frame screenshot: ${err.message}`,
          severity: "WARNING",
          nodeId: rootNode.id
        });
      }
      const result = {
        rootNodeId: rootNode.id,
        rootNodeName: rootNode.name,
        documentTitle: figma.root.name,
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        tree,
        componentsUsed,
        variables: variablesMap,
        collections: collectionsMap,
        diagnostics,
        screenshotBase64
      };
      figma.ui.postMessage({
        type: "EXPORT_SUCCESS",
        payload: result
      });
    });
  }
  figma.ui.onmessage = (msg) => __async(null, null, function* () {
    if (msg.type === "TRIGGER_EXPORT") {
      yield runExport();
    } else if (msg.type === "CLOSE_PLUGIN") {
      figma.closePlugin();
    }
  });
  runExport();
})();
