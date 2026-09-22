/**
 * Design Element Resolver for HTML Prototype Generator (Phase 5B-1)
 *
 * Sourced strictly from component-intent-catalog.json.
 * Enforces:
 * 1. Output standard W3C semantic HTML elements.
 * 2. Strict retention of data-semantic-id and data-component attributes.
 * 3. Anti-hallucination guard forbidding SmartButton, AIButton, FancyTable, etc.
 * 4. Zero random divs without semantic classification.
 */

export interface ResolvedHtmlElement {
  tagName: string;
  componentName: string;
  semanticId: string;
  attributes: Record<string, string>;
  htmlSnippet: string;
}

export interface ElementResolveOptions {
  label?: string;
  props?: Record<string, any>;
  variant?: string;
  childrenHtml?: string;
}

// Strictly forbidden hallucinated names
export const FORBIDDEN_HALLUCINATIONS = [
  "SmartButton",
  "AIButton",
  "FancyTable",
  "CustomButton",
  "NewTable",
  "MagicModal",
  "AutoInput",
  "SuperTable",
];

// Valid intents catalog mapping to standard HTML tags & component names
export const INTENT_HTML_MAPPING: Record<
  string,
  {
    tagName: string;
    componentName: string;
    defaultClass: string;
  }
> = {
  "primary-action": {
    tagName: "button",
    componentName: "button",
    defaultClass: "d2c-btn d2c-btn-primary",
  },
  "secondary-action": {
    tagName: "button",
    componentName: "button",
    defaultClass: "d2c-btn d2c-btn-secondary",
  },
  "destructive-action": {
    tagName: "button",
    componentName: "button",
    defaultClass: "d2c-btn d2c-btn-danger",
  },
  "data-table": {
    tagName: "div",
    componentName: "data-table",
    defaultClass: "d2c-table-container",
  },
  "filter-search": {
    tagName: "div",
    componentName: "filter-search",
    defaultClass: "d2c-search-box",
  },
  "status-indicator": {
    tagName: "span",
    componentName: "status-indicator",
    defaultClass: "d2c-tag",
  },
  "modal-dialog": {
    tagName: "dialog",
    componentName: "modal-dialog",
    defaultClass: "d2c-dialog",
  },
  "form-container": {
    tagName: "form",
    componentName: "form-container",
    defaultClass: "d2c-form",
  },
  "form-field": {
    tagName: "div",
    componentName: "form-field",
    defaultClass: "d2c-form-item",
  },
  "page-header": {
    tagName: "header",
    componentName: "page-header",
    defaultClass: "d2c-page-header",
  },
  "alert-notice": {
    tagName: "div",
    componentName: "alert-notice",
    defaultClass: "d2c-alert",
  },
  "empty-placeholder": {
    tagName: "div",
    componentName: "empty-placeholder",
    defaultClass: "d2c-empty-placeholder",
  },
};

/**
 * Asserts that a component name or template string does not violate anti-hallucination rules.
 */
export function assertNoHallucinations(input: string): void {
  for (const forbidden of FORBIDDEN_HALLUCINATIONS) {
    if (input.includes(forbidden)) {
      throw new Error(
        `ILLEGAL_HALLUCINATED_COMPONENT: Component name "${forbidden}" violates Greenfield Phase 5B-1 anti-hallucination rules.`
      );
    }
  }
}

/**
 * Resolves a semanticId and intent to a concrete HTML semantic element descriptor.
 */
export function resolveHtmlElement(
  intent: string,
  semanticId: string,
  options: ElementResolveOptions = {}
): ResolvedHtmlElement {
  if (!semanticId || semanticId.trim().length === 0) {
    throw new Error("MISSING_SEMANTIC_ID: semanticId is strictly required for every resolved HTML element.");
  }

  // Check intent and options for hallucinated tokens
  assertNoHallucinations(intent);
  if (options.label) assertNoHallucinations(options.label);

  const mapping = INTENT_HTML_MAPPING[intent];
  if (!mapping) {
    throw new Error(
      `UNRESOLVED_INTENT: Intent "${intent}" is not registered in component-intent-catalog.`
    );
  }

  const attributes: Record<string, string> = {
    "data-semantic-id": semanticId,
    "data-component": mapping.componentName,
    class: mapping.defaultClass,
  };

  let htmlSnippet = "";

  switch (intent) {
    case "primary-action": {
      const text = options.label || options.props?.text || "确认";
      htmlSnippet = `<button type="button" class="${mapping.defaultClass}" data-semantic-id="${semanticId}" data-component="button" id="btn-create-user">${text}</button>`;
      break;
    }
    case "secondary-action": {
      const text = options.label || options.props?.text || "取消";
      htmlSnippet = `<button type="button" class="${mapping.defaultClass}" data-semantic-id="${semanticId}" data-component="button">${text}</button>`;
      break;
    }
    case "filter-search": {
      const placeholder = options.props?.placeholder || "搜索...";
      htmlSnippet = `<div class="${mapping.defaultClass}" data-semantic-id="${semanticId}" data-component="filter-search">
  <input type="search" id="input-search" class="d2c-input d2c-input-search" placeholder="${placeholder}" autocomplete="off" />
</div>`;
      break;
    }
    case "page-header": {
      const title = options.props?.title || "用户管理";
      const subtitle = options.props?.subtitle || "";
      htmlSnippet = `<header class="${mapping.defaultClass}" data-semantic-id="${semanticId}" data-component="page-header" id="region-header">
  <h1 class="d2c-header-title" id="header-title">${title}</h1>
  ${subtitle ? `<p class="d2c-header-subtitle" id="header-subtitle">${subtitle}</p>` : ""}
</header>`;
      break;
    }
    case "data-table": {
      htmlSnippet = `<div class="${mapping.defaultClass}" data-semantic-id="${semanticId}" data-component="data-table" id="table-container">
  <table class="d2c-table" id="users-table">
    <thead class="d2c-table-thead">
      <tr>
        <th class="d2c-th">用户姓名</th>
        <th class="d2c-th">企业邮箱</th>
        <th class="d2c-th">系统角色</th>
        <th class="d2c-th">状态</th>
        <th class="d2c-th">创建时间</th>
        <th class="d2c-th">操作</th>
      </tr>
    </thead>
    <tbody class="d2c-table-tbody" id="users-table-tbody">
      <!-- Dynamically rendered by state.js -->
    </tbody>
  </table>
</div>`;
      break;
    }
    case "modal-dialog": {
      const title = options.props?.title || "新建用户";
      htmlSnippet = `<dialog class="${mapping.defaultClass}" data-semantic-id="${semanticId}" data-component="modal-dialog" id="modal-create-user">
  <div class="d2c-dialog-box">
    <div class="d2c-dialog-header">
      <h3 class="d2c-dialog-title">${title}</h3>
      <button type="button" class="d2c-dialog-close" id="btn-modal-close" aria-label="关闭">&times;</button>
    </div>
    <div class="d2c-dialog-body" id="modal-body">
      ${options.childrenHtml || ""}
    </div>
  </div>
</dialog>`;
      break;
    }
    case "form-container": {
      htmlSnippet = `<form class="${mapping.defaultClass}" data-semantic-id="${semanticId}" data-component="form-container" id="form-create-user" novalidate>
  ${options.childrenHtml || ""}
</form>`;
      break;
    }
    default: {
      htmlSnippet = `<${mapping.tagName} class="${mapping.defaultClass}" data-semantic-id="${semanticId}" data-component="${mapping.componentName}">
  ${options.childrenHtml || options.label || ""}
</${mapping.tagName}>`;
      break;
    }
  }

  return {
    tagName: mapping.tagName,
    componentName: mapping.componentName,
    semanticId,
    attributes,
    htmlSnippet,
  };
}
