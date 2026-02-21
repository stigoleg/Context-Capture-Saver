export const BUBBLE_MENU_ACTIONS = [
  "save_content",
  "save_content_with_highlight",
  "save_content_with_note",
  "highlight",
  "highlight_with_note"
];

export const DEFAULT_BUBBLE_MENU_ORDER = [
  "save_content",
  "save_content_with_highlight",
  "highlight",
  "highlight_with_note",
  "save_content_with_note"
];

export const DEFAULT_BUBBLE_MENU_ENABLED = ["save_content", "highlight", "highlight_with_note"];

export const BUBBLE_MENU_STYLES = ["glass", "clean", "midnight"];
export const BUBBLE_MENU_LAYOUTS = ["horizontal", "vertical"];
export const DEFAULT_BUBBLE_MENU_LAYOUT = "horizontal";
export const DEFAULT_BUBBLE_MENU_STYLE = "glass";

function sanitizeActionList(input) {
  const incoming = Array.isArray(input) ? input : [];
  const filtered = incoming.filter((value) => BUBBLE_MENU_ACTIONS.includes(value));
  const deduped = [];
  for (const value of filtered) {
    if (!deduped.includes(value)) {
      deduped.push(value);
    }
  }
  return deduped;
}

export function normalizeBubbleMenuActions(orderInput, enabledInput) {
  const orderFromInput = sanitizeActionList(orderInput);
  const order = orderFromInput.length ? [...orderFromInput] : [...DEFAULT_BUBBLE_MENU_ORDER];
  for (const action of BUBBLE_MENU_ACTIONS) {
    if (!order.includes(action)) {
      order.push(action);
    }
  }

  const enabledFromInput = sanitizeActionList(enabledInput);
  const enabled = enabledFromInput.length ? enabledFromInput : [...DEFAULT_BUBBLE_MENU_ENABLED];
  const enabledInOrder = enabled.filter((action) => order.includes(action));
  if (!enabledInOrder.length) {
    enabledInOrder.push("save_content");
  }

  return {
    order,
    enabled: enabledInOrder
  };
}

export function normalizeBubbleMenuLayout(value, fallback = "horizontal") {
  if (BUBBLE_MENU_LAYOUTS.includes(value)) {
    return value;
  }
  return fallback;
}

export function normalizeBubbleMenuStyle(value, fallback = "glass") {
  if (BUBBLE_MENU_STYLES.includes(value)) {
    return value;
  }
  return fallback;
}

export function normalizeBubbleMenuConfig(raw, defaults = {}) {
  const fallbackOrder = Array.isArray(defaults.order) ? defaults.order : DEFAULT_BUBBLE_MENU_ORDER;
  const fallbackEnabled = Array.isArray(defaults.enabled)
    ? defaults.enabled
    : DEFAULT_BUBBLE_MENU_ENABLED;
  const fallbackLayout = defaults.layout || "horizontal";
  const fallbackStyle = defaults.style || "glass";

  const actions = normalizeBubbleMenuActions(
    raw?.bubbleMenuOrder ?? fallbackOrder,
    raw?.bubbleMenuEnabled ?? fallbackEnabled
  );
  return {
    order: actions.order,
    enabled: actions.enabled,
    layout: normalizeBubbleMenuLayout(raw?.bubbleMenuLayout, fallbackLayout),
    style: normalizeBubbleMenuStyle(raw?.bubbleMenuStyle, fallbackStyle)
  };
}
