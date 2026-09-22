/**
 * Sample Design Packages Generator for Users Page (rev_1 and rev_2)
 *
 * Sourced: Explicitly SYNTHETIC_SPEC (Demonstrates package ingestion, validation & change propagation)
 */

import { createDesignPackage } from "./package.js";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

export function generateSamplePackages(): void {
  const canonicalTokens = JSON.parse(
    readFileSync("tooling/d2c/tokens/canonical-tokens.json", "utf-8")
  );

  // 1. Revision 1 Baseline Package
  const rev1Input = {
    screenId: "users_page",
    revision: 1,
    sourceFileRef: "figma://file/demo_offline_workspace",
    rootNodeId: "10:100",
    provenance: {
      designOrigin: "SYNTHETIC_SPEC" as const,
      componentOrigin: "SYNTHETIC_FIXTURE" as const,
      tokenOrigin: "SYNTHETIC_CANONICAL" as const,
      dataOrigin: "SYNTHETIC_MOCK" as const,
    },
    rawFigmaTree: {
      id: "10:100",
      name: "UsersScreen",
      type: "FRAME",
      width: 1200,
      height: 800,
      layoutMode: "VERTICAL",
      itemSpacing: 16,
      children: [
        {
          id: "10:101",
          name: "HeaderArea",
          type: "FRAME",
          layoutMode: "HORIZONTAL",
          itemSpacing: 16,
          children: [
            { id: "10:102", name: "PageTitle", type: "TEXT", characters: "用户管理" },
            { id: "10:103", name: "CreateButton", type: "INSTANCE", mainComponentKey: "btn_primary", variantProperties: { type: "primary" } },
          ],
        },
        {
          id: "10:104",
          name: "UserTable",
          type: "INSTANCE",
          mainComponentKey: "table_users",
        },
      ],
    },
    contextTree: {
      rootNodeId: "10:100",
      screenTitle: "用户管理",
      nodes: {
        "10:102": { semanticId: "users.header.title", text: "用户管理" },
        "10:103": { semanticId: "users.header.create_btn", variant: "primary", text: "新建用户" },
        "10:104": { semanticId: "users.content.table" },
      },
    },
    sourceMap: {
      version: "1.0.0",
      screenId: "users_page",
      elements: {
        "users.header.title": { figmaNodeId: "10:102", targetDomId: "users-page-title" },
        "users.header.create_btn": { figmaNodeId: "10:103", targetDomId: "users-create-btn" },
        "users.content.table": { figmaNodeId: "10:104", targetDomId: "users-table-container" },
      },
    },
    tokensSnapshot: canonicalTokens,
    componentsUsed: {
      btn_primary: { name: "Button", variant: "primary" },
      table_users: { name: "Table", variant: "default" },
    },
    interactions: [
      {
        trigger: "onClick",
        targetElementIdentity: { screenId: "users_page", semanticId: "users.header.create_btn", instanceKey: "main" },
        expectedEffect: "openModal",
        payload: { modalId: "create_user_modal" },
      },
    ],
    diagnostics: [
      {
        code: "OFFLINE_SYNTHETIC_FIXTURE",
        message: "This design package is an offline fixture generated for contract verification, not from live Figma API.",
        severity: "INFO",
      },
    ],
  };

  const res1 = createDesignPackage(rev1Input);
  console.log("✓ Created Rev 1 package at:", res1.packagePath, "ContentHash:", res1.contentHash);

  // 2. Revision 2 Delta Package (Text change, spacing change, variant change)
  const rev2Input = {
    ...rev1Input,
    revision: 2,
    rawFigmaTree: {
      id: "10:100",
      name: "UsersScreen",
      type: "FRAME",
      width: 1200,
      height: 800,
      layoutMode: "VERTICAL",
      itemSpacing: 24, // CHANGED: 16 -> 24px
      children: [
        {
          id: "10:101",
          name: "HeaderArea",
          type: "FRAME",
          layoutMode: "HORIZONTAL",
          itemSpacing: 24,
          children: [
            { id: "10:102", name: "PageTitle", type: "TEXT", characters: "系统用户列表" }, // CHANGED: "用户管理" -> "系统用户列表"
            { id: "10:103", name: "CreateButton", type: "INSTANCE", mainComponentKey: "btn_primary", variantProperties: { type: "dashed" } }, // CHANGED: "primary" -> "dashed"
          ],
        },
        {
          id: "10:104",
          name: "UserTable",
          type: "INSTANCE",
          mainComponentKey: "table_users",
        },
      ],
    },
    contextTree: {
      rootNodeId: "10:100",
      screenTitle: "系统用户列表",
      nodes: {
        "10:102": { semanticId: "users.header.title", text: "系统用户列表" },
        "10:103": { semanticId: "users.header.create_btn", variant: "dashed", text: "添加新账号" },
        "10:104": { semanticId: "users.content.table" },
      },
    },
  };

  const res2 = createDesignPackage(rev2Input);
  console.log("✓ Created Rev 2 package at:", res2.packagePath, "ContentHash:", res2.contentHash);
}

if (process.argv[1]?.includes("generate-sample-packages.ts")) {
  generateSamplePackages();
}
