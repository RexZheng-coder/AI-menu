import { renderMenuItemCard } from "./MenuItemCard.js";
import type { MenuCategory, MenuItem } from "../types/menu.js";

export function renderMenuCategory(
  category: MenuCategory,
  actions: {
    onAddToCart: (item: MenuItem) => void;
    onEditItem: (item: MenuItem) => void;
    onDeleteItem: (itemId: string) => void;
    onAddItem: (categoryId: string) => void;
  },
): HTMLElement {
  const section = document.createElement("section");
  section.className = "category-section";
  section.setAttribute("aria-labelledby", `${category.category_id}-title`);

  const headingGroup = document.createElement("div");
  headingGroup.className = "category-section__header";

  const title = document.createElement("h2");
  title.id = `${category.category_id}-title`;
  title.className = "category-section__title";
  title.textContent = category.name_zh;

  const subtitle = document.createElement("p");
  subtitle.className = "category-section__subtitle";
  subtitle.textContent = category.name_en;

  const addItemButton = document.createElement("button");
  addItemButton.className = "category-add-item-button";
  addItemButton.type = "button";
  addItemButton.textContent = "Add item";
  addItemButton.setAttribute("aria-label", `Add item to ${category.name_zh || category.name_en}`);
  addItemButton.addEventListener("click", () => actions.onAddItem(category.category_id));

  headingGroup.append(title, subtitle, addItemButton);
  section.append(headingGroup);

  if (category.items.length === 0) {
    const emptyState = document.createElement("p");
    emptyState.className = "empty-state";
    emptyState.textContent = "No dishes found in this category.";
    section.append(emptyState);
    return section;
  }

  const grid = document.createElement("div");
  grid.className = "menu-grid";

  for (const item of category.items) {
    grid.append(renderMenuItemCard(item, actions, category));
  }

  section.append(grid);
  return section;
}
