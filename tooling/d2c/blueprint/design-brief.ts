/**
 * Design Brief Generator
 *
 * Generates 3 distinct visual directions (Enterprise Dense, Modern SaaS, Minimal Productivity)
 * from requirement analysis, strictly halting without auto-selection.
 */

import { SCHEMA_VERSION } from "../contracts/schema.js";
import type { DesignBrief, RequirementAnalysis, VisualDirection } from "./schema.js";

export function generateDesignBrief(analysis: RequirementAnalysis): DesignBrief {
  const directionA: VisualDirection = {
    key: "A",
    name: "Enterprise Dense",
    brandTone: "专业、严谨、信息高密度、高确定性与高吞吐",
    layoutStyle: "紧凑网格排版，密集型多列数据表格，行内紧凑操作与固定操作栏",
    density: "high",
    typography: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      baseFontSize: 12,
      headingScale: "1.2",
    },
    colorStrategy: {
      primaryColor: "#1677ff",
      surfaceStyle: "纯白表格容器搭配浅灰高对比边框 (#d9d9d9) 与浅条纹背景",
      contrastRatio: "4.5:1 (符合 WCAG AA 级标准)",
    },
    interactionStyle: "行内快捷操作，键盘快捷键优先，单屏信息吞吐量最大化",
    referenceProducts: ["AWS Management Console", "Alibaba Cloud Console", "Ant Design Pro (Compact)"],
    risk: "对新用户认知负荷较高，信息密集时需配合字段筛选与列展示配置",
  };

  const directionB: VisualDirection = {
    key: "B",
    name: "Modern SaaS",
    brandTone: "现代、开阔、平衡操作效率与视觉呼吸感、清晰直观",
    layoutStyle: "标准网格布局，卡片容器与层次分明的工具栏，支持抽屉与弹窗分流",
    density: "medium",
    typography: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      baseFontSize: 14,
      headingScale: "1.25",
    },
    colorStrategy: {
      primaryColor: "#1677ff",
      surfaceStyle: "微投影卡片面 (#ffffff) 搭配浅底 (#f5f7fa) 与统一圆角",
      contrastRatio: "4.5:1",
    },
    interactionStyle: "模态弹窗与侧滑抽屉组合，批量选择栏浮动提示，平滑状态过渡",
    referenceProducts: ["Linear", "Stripe Dashboard", "GitHub Settings"],
    risk: "单屏可视表格行数相比紧凑版有所减少，需配合翻页或虚拟滚动",
  };

  const directionC: VisualDirection = {
    key: "C",
    name: "Minimal Productivity",
    brandTone: "极简、低干扰、轻质感、专注核心任务完成",
    layoutStyle: "单列聚焦流式排版，无装饰边框，强调内容本位与无干扰交互",
    density: "low",
    typography: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      baseFontSize: 14,
      headingScale: "1.33",
    },
    colorStrategy: {
      primaryColor: "#000000",
      surfaceStyle: "无边框平铺，黑白极简分割线与大留白空间",
      contrastRatio: "7:1 (高对比黑白)",
    },
    interactionStyle: "命令面板驱动，快捷键无缝导航，无多余确认步骤",
    referenceProducts: ["Notion", "Raycast", "Vercel Dashboard"],
    risk: "部分习惯传统表格后台的用户可能会对缺少明确框线与操作按钮感到不适应",
  };

  return {
    schemaVersion: SCHEMA_VERSION,
    productType: "Enterprise SaaS",
    visualDirections: {
      A: directionA,
      B: directionB,
      C: directionC,
    },
    // Strictly halt without auto-selection: human gate
    selectedDirection: null,
    selectionRationale: null,
    diagnostics: [],
  };
}
