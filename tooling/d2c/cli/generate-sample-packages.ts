/**
 * Sample Design Packages Generator for Users Page (rev_1 and rev_2)
 *
 * Uses the official runIntakePipeline to ensure:
 * 1. Raw ExportResult payload → export-adapter → canonical DesignContext (validateContract('context', ...)).
 * 2. Generated packages strictly conform to unified contracts and pass disk integrity.
 * 3. exporterCommitSha is real git commit hash.
 * 4. Separate canonicalTokenHash and tokens.snapshot.json hash.
 */

import { resolve } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { runIntakePipeline } from "./intake.js";
import { validateContract } from "../contracts/validate.js";

export async function generateSamplePackages(): Promise<void> {
  const canonicalTokens = JSON.parse(
    readFileSync("tooling/d2c/tokens/canonical-tokens.json", "utf-8")
  );

  const buildDir = resolve("build");
  mkdirSync(buildDir, { recursive: true });

  // 1. Raw Export Payload for Revision 1
  const rawRev1 = {
    rootNodeId: "10:100",
    rootNodeName: "UsersScreen",
    documentTitle: "Admin Platform Design",
    exportedAt: new Date().toISOString(),
    tree: {
      id: "10:100",
      name: "UsersScreen",
      type: "FRAME",
      visible: true,
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
      layout: {
        mode: "VERTICAL",
        wrap: "NO_WRAP",
        layoutSizingHorizontal: "FIXED",
        layoutSizingVertical: "FIXED",
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 16,
        paddingLeft: 16,
        itemSpacing: 16,
      },
      children: [
        {
          id: "10:101",
          name: "HeaderArea",
          type: "FRAME",
          visible: true,
          x: 16,
          y: 16,
          width: 1168,
          height: 48,
          layout: {
            mode: "HORIZONTAL",
            wrap: "NO_WRAP",
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            itemSpacing: 16,
          },
          children: [
            {
              id: "10:102",
              name: "PageTitle",
              type: "TEXT",
              visible: true,
              x: 0,
              y: 0,
              width: 200,
              height: 32,
              text: {
                characters: "用户管理",
                fontFamily: "Inter",
                fontSize: 20,
                fontWeight: 600,
              },
            },
            {
              id: "10:103",
              name: "CreateButton",
              type: "INSTANCE",
              visible: true,
              x: 1000,
              y: 0,
              width: 90,
              height: 32,
              component: {
                isInstance: true,
                mainComponentId: "cmp_btn",
                mainComponentKey: "btn_primary",
                mainComponentName: "PrimaryButton",
                variantProperties: { type: "primary" },
              },
            },
          ],
        },
        {
          id: "10:104",
          name: "UserTable",
          type: "INSTANCE",
          visible: true,
          x: 16,
          y: 80,
          width: 1168,
          height: 600,
          component: {
            isInstance: true,
            mainComponentId: "cmp_table",
            mainComponentKey: "table_users",
            mainComponentName: "UserTable",
          },
        },
      ],
    },
    componentsUsed: {
      btn_primary: { id: "cmp_btn", key: "btn_primary", name: "PrimaryButton" },
      table_users: { id: "cmp_table", key: "table_users", name: "UserTable" },
    },
    variables: canonicalTokens,
    diagnostics: [],
  };

  const rawRev1Path = resolve(buildDir, "raw-export-users-rev1.json");
  writeFileSync(rawRev1Path, JSON.stringify(rawRev1, null, 2), "utf-8");

  const res1 = await runIntakePipeline({
    rawExportPath: rawRev1Path,
    screenId: "users_page",
    revision: 1,
    sourceFileRef: "figma://file/demo_offline_workspace",
    allowOverwrite: true,
  });

  if (!res1.success) {
    throw new Error(`Failed to generate sample package rev_1: ${JSON.stringify(res1.diagnostics)}`);
  }
  console.log("✓ Ingested and validated Rev 1 package at:", res1.packagePath, "ContentHash:", res1.manifest?.contentHash);

  // 2. Raw Export Payload for Revision 2 (spacing 16->24, title text, button variant primary->dashed)
  const rawRev2 = JSON.parse(JSON.stringify(rawRev1));
  rawRev2.tree.layout.itemSpacing = 24; // Spacing change
  rawRev2.tree.children[0].layout.itemSpacing = 24;
  rawRev2.tree.children[0].children[0].text.characters = "系统用户列表"; // Title change
  rawRev2.tree.children[0].children[1].component.variantProperties.type = "dashed"; // Button variant change

  const rawRev2Path = resolve(buildDir, "raw-export-users-rev2.json");
  writeFileSync(rawRev2Path, JSON.stringify(rawRev2, null, 2), "utf-8");

  const res2 = await runIntakePipeline({
    rawExportPath: rawRev2Path,
    screenId: "users_page",
    revision: 2,
    sourceFileRef: "figma://file/demo_offline_workspace",
    allowOverwrite: true,
  });

  if (!res2.success) {
    throw new Error(`Failed to generate sample package rev_2: ${JSON.stringify(res2.diagnostics)}`);
  }
  console.log("✓ Ingested and validated Rev 2 package at:", res2.packagePath, "ContentHash:", res2.manifest?.contentHash);
}

if (process.argv[1]?.includes("generate-sample-packages.ts")) {
  generateSamplePackages().catch((err) => {
    console.error("Failed to generate sample packages:", err);
    process.exit(1);
  });
}
