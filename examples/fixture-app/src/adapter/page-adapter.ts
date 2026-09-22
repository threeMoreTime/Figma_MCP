/**
 * Single-page Package Adapter for UsersPage
 *
 * Converts Canonical Design Release Packages (manifest.json & context.json)
 * into UsersPageProps, layout spacing, and styling tokens.
 */

import rev1Manifest from "../../../../design/releases/users_page/rev_1/manifest.json" with { type: "json" };
import rev1Context from "../../../../design/releases/users_page/rev_1/context.json" with { type: "json" };
import rev2Manifest from "../../../../design/releases/users_page/rev_2/manifest.json" with { type: "json" };
import rev2Context from "../../../../design/releases/users_page/rev_2/context.json" with { type: "json" };

export interface UsersPageDesignProps {
  screenId: string;
  revision: number;
  contentHash: string;
  titleText: string;
  createButtonText: string;
  createButtonVariant: "primary" | "dashed" | "default";
  spacing: number;
}

export function adaptDesignContextToUsersPageProps(
  manifest: any,
  context: any
): UsersPageDesignProps {
  let titleText = "用户管理";
  let createButtonVariant: "primary" | "dashed" | "default" = "primary";
  let spacing = 16;

  function walk(node: any) {
    if (!node) return;

    // Check title text
    if (
      node.name === "PageTitle" ||
      node.identity?.semanticId?.includes("pagetitle") ||
      (node.textRuns && node.textRuns.length > 0 && node.textRuns[0].characters)
    ) {
      if (node.textRuns && node.textRuns[0]?.characters) {
        titleText = node.textRuns[0].characters;
      }
    }

    // Check button variant
    if (
      node.name === "CreateButton" ||
      node.identity?.semanticId?.includes("createbutton") ||
      node.nativeComponentKey === "btn_primary"
    ) {
      const v = node.variantProps?.type;
      if (v === "primary" || v === "dashed" || v === "default") {
        createButtonVariant = v;
      }
    }

    // Check spacing on header area
    const isHeaderArea =
      node.name === "HeaderArea" ||
      node.identity?.semanticId === "users_page.headerarea" ||
      node.identity?.semanticId?.endsWith(".headerarea");

    if (isHeaderArea) {
      if (typeof node.layout?.itemSpacing === "number" && node.layout.itemSpacing > 0) {
        spacing = node.layout.itemSpacing;
      }
    }


    for (const child of node.children || []) {
      walk(child);
    }
  }

  if (context?.exportedTree) {
    walk(context.exportedTree);
  }

  return {
    screenId: manifest?.screenId || "users_page",
    revision: manifest?.revision || 1,
    contentHash: manifest?.contentHash || "",
    titleText,
    createButtonText: "新建用户",
    createButtonVariant,
    spacing,
  };
}

export function getAdaptedUsersPagePropsForRevision(revision: 1 | 2): UsersPageDesignProps {
  if (revision === 2) {
    return adaptDesignContextToUsersPageProps(rev2Manifest, rev2Context);
  }
  return adaptDesignContextToUsersPageProps(rev1Manifest, rev1Context);
}
