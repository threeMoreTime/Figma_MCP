/**
 * Prototype Component Adapter (Phase 5A)
 *
 * Translates Design Semantics and States into Concrete React / Ant Design Props.
 *
 * Example:
 * Design: { component: "primary-action", state: "loading" }
 * Result: { type: "primary", loading: true } -> <Button type="primary" loading={true} />
 */

export interface DesignComponentSpec {
  component: string;
  intent?: string;
  state?: "ready" | "loading" | "empty" | "error" | "disabled" | string;
  variant?: "primary" | "default" | "danger" | "link" | string;
  size?: "small" | "middle" | "large";
  properties?: Record<string, any>;
}

export interface AdaptedComponentProps {
  componentType: string;
  props: Record<string, any>;
}

/**
 * Adapts design attributes and state into standard React Props
 */
export function adaptDesignProps(spec: DesignComponentSpec): AdaptedComponentProps {
  const { component, intent, state, variant, size, properties = {} } = spec;

  let componentType = component;
  const props: Record<string, any> = { ...properties };

  // 1. Button adaptations
  if (
    component === "Button" ||
    component === "primary-action" ||
    component === "secondary-action" ||
    component === "destructive-action" ||
    intent?.includes("action")
  ) {
    componentType = "Button";

    if (component === "primary-action" || variant === "primary") {
      props.type = "primary";
    } else if (component === "secondary-action" || variant === "default") {
      props.type = "default";
    } else if (component === "destructive-action" || variant === "danger") {
      props.danger = true;
    } else if (variant === "link") {
      props.type = "link";
    }

    if (state === "loading") {
      props.loading = true;
    } else if (state === "disabled") {
      props.disabled = true;
    }
  }

  // 2. Table adaptations
  else if (component === "Table" || component === "data-table" || intent === "data-table") {
    componentType = "Table";
    props.rowKey = props.rowKey || "id";
    props.pagination = props.pagination || { pageSize: 10 };

    if (state === "loading") {
      props.loading = true;
    } else if (state === "empty") {
      props.dataSource = [];
    }
  }

  // 3. Input adaptations
  else if (
    component === "Input" ||
    component === "Input.Search" ||
    component === "filter-search" ||
    intent === "filter-search"
  ) {
    componentType = component === "filter-search" || intent === "filter-search" ? "Input.Search" : "Input";
    props.allowClear = true;

    if (state === "disabled") {
      props.disabled = true;
    }
  }

  // 4. Modal adaptations
  else if (
    component === "Modal" ||
    component === "modal-dialog" ||
    intent === "modal-dialog"
  ) {
    componentType = "Modal";
    props.destroyOnClose = true;

    if (state === "open" || state === "visible") {
      props.open = true;
    }
  }

  // 5. General size mapping
  if (size) {
    props.size = size;
  }

  return {
    componentType,
    props,
  };
}
