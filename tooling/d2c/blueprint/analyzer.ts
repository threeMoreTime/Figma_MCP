/**
 * PRD & Requirement Analyzer
 *
 * Parses PRD documents, partitions facts/assumptions/decisions,
 * maps user jobs and state matrices, and emits structural diagnostics.
 */

import { SCHEMA_VERSION, type Diagnostic } from "../contracts/schema.js";
import type {
  RequirementAnalysis,
  UserJob,
  ScreenMapItem,
  StateMatrixItem,
} from "./schema.js";

export function analyzeRequirement(markdown: string): RequirementAnalysis {
  const lines = markdown.split(/\r?\n/);
  const diagnostics: Diagnostic[] = [];

  let productName = "Untitled Product";
  const confirmedFacts: string[] = [];
  const assumptions: string[] = [];
  const decisionsRequired: string[] = [];
  const userJobs: UserJob[] = [];
  const screenMap: ScreenMapItem[] = [];
  const stateMatrix: Record<string, StateMatrixItem[]> = {};

  let currentSection = "";
  const roles: Array<{ role: string; description?: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) continue;

    // H1 Heading -> Product Name
    if (line.startsWith("# ")) {
      productName = line.replace(/^#\s+/, "").replace(/\s*\(PRD\)\s*/i, "").trim();
      continue;
    }

    // H2/H3 Headings
    if (line.startsWith("## ") || line.startsWith("### ")) {
      const heading = line.replace(/^#+\s+/, "").trim().toLowerCase();
      if (heading.includes("目标") || heading.includes("goal") || heading.includes("objective")) {
        currentSection = "goals";
      } else if (heading.includes("角色") || heading.includes("role")) {
        currentSection = "roles";
      } else if (heading.includes("任务") || heading.includes("job")) {
        currentSection = "jobs";
      } else if (heading.includes("页面") || heading.includes("screen")) {
        currentSection = "screens";
      } else if (heading.includes("状态") || heading.includes("state")) {
        currentSection = "states";
      } else if (
        heading.includes("约束") ||
        heading.includes("决策") ||
        heading.includes("constraint") ||
        heading.includes("decision")
      ) {
        currentSection = "constraints";
      } else {
        currentSection = "other";
      }
      continue;
    }

    // Process bullet points and text by section
    if (line.startsWith("- ") || line.startsWith("* ") || line.startsWith("1. ") || line.startsWith("2. ")) {
      const content = line.replace(/^[-*]\s+|\d+\.\s+/, "").trim();

      // Check for Assumption / Decision Required tags first
      if (/\[ASSUMPTION\]|【假设】/i.test(content)) {
        assumptions.push(content.replace(/\[ASSUMPTION\]|【假设】/gi, "").trim());
        continue;
      }
      if (/\[DECISION_REQUIRED\]|【待定决策】|【待确认】/i.test(content)) {
        decisionsRequired.push(content.replace(/\[DECISION_REQUIRED\]|【待定决策】|【待确认】/gi, "").trim());
        continue;
      }

      if (currentSection === "roles") {
        const parts = content.split(/[:：]/);
        roles.push({
          role: parts[0]?.trim() || content,
          description: parts[1]?.trim(),
        });
        confirmedFacts.push(`用户角色: ${content}`);
      } else if (currentSection === "jobs") {
        // e.g. JOB-01: 超级管理员新建企业用户并指派角色。
        const jobMatch = content.match(/^(JOB-\d+|J\d+|[\w-]+)[:：]\s*(.+)$/i);
        if (jobMatch) {
          const jobId = jobMatch[1];
          const desc = jobMatch[2];
          // Try to extract role
          const roleMatch = desc.match(/^([^，,。.]+?)(?:新建|查看|搜索|操作|修改|指派|导出|管理)/);
          const role = roleMatch ? roleMatch[1].trim() : "用户";
          userJobs.push({
            id: jobId,
            role,
            job: desc,
            expectedOutcome: `完成${desc}`,
          });
        } else {
          userJobs.push({
            id: `JOB-${String(userJobs.length + 1).padStart(2, "0")}`,
            role: roles[0]?.role || "用户",
            job: content,
            expectedOutcome: `完成${content}`,
          });
        }
      } else if (currentSection === "screens") {
        // e.g. 页面ID: users.management, 路由: /users, 目标: 展示企业全量用户列表并提供新建与查询操作, 布局: admin-crud
        const screenIdMatch = content.match(/页面ID[:：]\s*([\w.-]+)/i);
        const routeMatch = content.match(/路由[:：]\s*([^\s,，]+)/i);
        const purposeMatch = content.match(/目标[:：]\s*([^,，]+?)(?:,|$|布局)/i);
        const layoutMatch = content.match(/布局[:：]\s*([\w-]+)/i);

        const screenId = screenIdMatch ? screenIdMatch[1].trim() : `screen-${screenMap.length + 1}`;
        const route = routeMatch ? routeMatch[1].trim() : `/${screenId.replace(/\./g, "/")}`;
        const purpose = purposeMatch ? purposeMatch[1].trim() : content;
        const layout = layoutMatch ? layoutMatch[1].trim() : "admin-crud";

        screenMap.push({
          screenId,
          route,
          purpose,
          layout,
        });
      } else if (currentSection === "states") {
        // e.g. loading: 正在从后端拉取用户分页列表
        const stateMatch = content.match(/^([a-zA-Z_-]+)[:：]\s*(.+)$/);
        if (stateMatch) {
          const state = stateMatch[1].toLowerCase().trim();
          const description = stateMatch[2].trim();
          const targetScreen = screenMap[0]?.screenId || "users.management";
          if (!stateMatrix[targetScreen]) {
            stateMatrix[targetScreen] = [];
          }
          stateMatrix[targetScreen].push({
            state,
            description,
            triggers: [],
          });
        }
      } else if (currentSection === "goals") {
        confirmedFacts.push(`产品目标: ${content}`);
      } else if (currentSection === "constraints") {
        confirmedFacts.push(`业务约束: ${content}`);
      } else {
        confirmedFacts.push(content);
      }
    } else {
      // Non-bullet line in sections like goals or constraints
      if (currentSection === "goals") {
        confirmedFacts.push(`产品目标: ${line}`);
      } else if (currentSection === "constraints") {
        if (/\[ASSUMPTION\]|【假设】/i.test(line)) {
          assumptions.push(line.replace(/\[ASSUMPTION\]|【假设】/gi, "").trim());
        } else if (/\[DECISION_REQUIRED\]|【待定决策】|【待确认】/i.test(line)) {
          decisionsRequired.push(line.replace(/\[DECISION_REQUIRED\]|【待定决策】|【待确认】/gi, "").trim());
        } else {
          confirmedFacts.push(`业务约束: ${line}`);
        }
      }
    }
  }

  // Diagnostic 1: MISSING_USER_GOALS
  if (roles.length === 0 && userJobs.length === 0) {
    diagnostics.push({
      code: "MISSING_USER_GOALS",
      message: "PRD must explicitly define user roles and user jobs (goals).",
      severity: "ERROR",
      path: "userRoles",
    });
  }

  // Diagnostic 2: MISSING_SCREEN_GOALS
  if (screenMap.length === 0) {
    diagnostics.push({
      code: "MISSING_SCREEN_GOALS",
      message: "PRD must specify at least one screen with its purpose and route.",
      severity: "ERROR",
      path: "screenMap",
    });
  }

  // Diagnostic 3: MISSING_ESSENTIAL_STATES
  const essentialStates = ["ready", "loading", "empty", "error"];
  const allIdentifiedStates = new Set(
    Object.values(stateMatrix)
      .flat()
      .map((s) => s.state)
  );

  const missingStates = essentialStates.filter((s) => !allIdentifiedStates.has(s));
  if (missingStates.length > 0) {
    diagnostics.push({
      code: "MISSING_ESSENTIAL_STATES",
      message: `State matrix is missing essential states: ${missingStates.join(", ")}.`,
      severity: "ERROR",
      path: "stateMatrix",
      details: { missingStates },
    });
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    productName,
    confirmedFacts,
    assumptions,
    decisionsRequired,
    userJobs,
    screenMap,
    stateMatrix,
    diagnostics,
  };
}
