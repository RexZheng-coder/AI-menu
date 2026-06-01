import type { SavedMenuRecord } from "../lib/menuHistory.js";

type HistoryPanelProps = {
  savedMenus: SavedMenuRecord[];
  onLoadMenu: (menuId: string) => void;
  onRemoveMenu: (menuId: string) => void;
  onClearMenus: () => void;
};

export function renderHistoryPanel(props: HistoryPanelProps): HTMLElement {
  const section = document.createElement("section");
  section.className = "history-panel";
  section.setAttribute("aria-label", "Recent menus");

  const header = document.createElement("div");
  header.className = "history-panel__header";

  const title = document.createElement("h2");
  title.className = "history-panel__title";
  title.textContent = "Recent Menus";

  const clearButton = document.createElement("button");
  clearButton.className = "history-clear-button";
  clearButton.type = "button";
  clearButton.disabled = props.savedMenus.length === 0;
  clearButton.textContent = "Clear All";
  clearButton.addEventListener("click", props.onClearMenus);

  header.append(title, clearButton);
  section.append(header);

  if (props.savedMenus.length === 0) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "No saved menus yet.";
    section.append(empty);
    return section;
  }

  const list = document.createElement("div");
  list.className = "history-list";

  for (const savedMenu of props.savedMenus) {
    list.append(renderSavedMenu(savedMenu, props));
  }

  section.append(list);
  return section;
}

function renderSavedMenu(record: SavedMenuRecord, props: HistoryPanelProps): HTMLElement {
  const item = document.createElement("article");
  item.className = "history-item";

  const button = document.createElement("button");
  button.className = "history-item__load";
  button.type = "button";
  button.addEventListener("click", () => props.onLoadMenu(record.menu_id));

  const name = document.createElement("span");
  name.className = "history-item__name";
  name.textContent = record.restaurant_name;

  const meta = document.createElement("span");
  meta.className = "history-item__meta";
  meta.textContent = [
    record.cuisine_type,
    `${record.item_count} items`,
    formatDate(record.created_at),
    record.source_type,
  ]
    .filter(Boolean)
    .join(" · ");

  button.append(name, meta);

  const removeButton = document.createElement("button");
  removeButton.className = "history-item__remove";
  removeButton.type = "button";
  removeButton.textContent = "Delete";
  removeButton.addEventListener("click", () => props.onRemoveMenu(record.menu_id));

  item.append(button, removeButton);
  return item;
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
