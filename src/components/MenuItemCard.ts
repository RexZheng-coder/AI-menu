import { renderTagPill } from "./TagPill.js";
import type { MenuCategory, MenuItem } from "../types/menu.js";

export function renderMenuItemCard(
  item: MenuItem,
  actions: {
    onAddToCart: (item: MenuItem) => void;
    onEditItem: (item: MenuItem) => void;
    onDeleteItem: (itemId: string) => void;
  },
  category: Pick<MenuCategory, "name_en" | "name_zh">,
): HTMLElement {
  const article = document.createElement("article");
  article.className = "item-card";

  const content = document.createElement("div");
  content.className = "item-card__content";

  const header = document.createElement("div");
  header.className = "item-card__header";

  const names = document.createElement("div");
  names.className = "item-card__names";

  const nameZh = document.createElement("h3");
  nameZh.className = "item-card__name-zh";
  nameZh.textContent = item.name_zh;

  const nameEn = document.createElement("p");
  nameEn.className = "item-card__name-en";
  nameEn.textContent = item.name_en;

  names.append(nameZh, nameEn);

  const priceText = formatPrice(item);
  const price = document.createElement("p");
  price.className = "item-card__price";
  price.textContent = priceText;
  price.title = priceText;

  header.append(names, price);

  content.append(header);

  const descriptionText = getDescriptionText(item);
  const hasTags = item.tags_zh.length > 0;

  if (descriptionText) {
    const description = document.createElement("p");
    description.className = "item-card__description";
    description.textContent = descriptionText;
    content.append(description);
  }

  if (hasTags) {
    const tags = document.createElement("div");
    tags.className = "tag-list";

    for (const tag of item.tags_zh) {
      tags.append(renderTagPill(tag));
    }

    content.append(tags);
  }

  const details = renderItemDetails(item, category);

  if (details) {
    content.append(details);
  }

  if (!descriptionText && !hasTags && !details) {
    article.classList.add("item-card--compact");
  }

  const addButton = document.createElement("button");
  addButton.className = "add-button";
  addButton.type = "button";
  addButton.textContent = "+";
  addButton.setAttribute("aria-label", `Add ${item.name_zh}`);
  addButton.addEventListener("click", () => actions.onAddToCart(item));

  const actionColumn = document.createElement("div");
  actionColumn.className = "item-card__actions";

  const editButton = document.createElement("button");
  editButton.className = "item-edit-button";
  editButton.type = "button";
  editButton.textContent = "Edit";
  editButton.setAttribute("aria-label", `Edit ${item.name_zh}`);
  editButton.addEventListener("click", () => actions.onEditItem(item));

  const deleteButton = document.createElement("button");
  deleteButton.className = "item-delete-button";
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.setAttribute("aria-label", `Delete ${item.name_zh}`);
  deleteButton.addEventListener("click", () => actions.onDeleteItem(item.item_id));

  actionColumn.append(addButton, editButton, deleteButton);
  article.append(content, actionColumn);
  return article;
}

function getDescriptionText(item: MenuItem): string | null {
  const description = item.description_zh ?? item.description_en;

  if (!description) {
    return null;
  }

  const trimmedDescription = description.trim();

  if (!trimmedDescription || isPlaceholderDescription(trimmedDescription)) {
    return null;
  }

  return trimmedDescription;
}

function isPlaceholderDescription(description: string): boolean {
  const normalizedDescription = normalizeText(description);

  return (
    normalizedDescription === "暂无描述" ||
    normalizedDescription === "无描述" ||
    normalizedDescription === "无" ||
    normalizedDescription === "n/a" ||
    normalizedDescription === "na" ||
    normalizedDescription === "none" ||
    normalizedDescription === "null"
  );
}

function renderItemDetails(item: MenuItem, category: Pick<MenuCategory, "name_en" | "name_zh">): HTMLElement | null {
  if (isBeverageItem(item, category)) {
    return null;
  }

  const details = document.createElement("div");
  details.className = "item-card__details";

  const spice = document.createElement("span");
  spice.className = `spice-meter spice-meter--level-${item.spicy_level}`;
  spice.textContent = `辣度 ${item.spicy_level}/3`;
  details.append(spice);

  if (typeof item.confidence === "number") {
    const confidence = document.createElement("span");
    confidence.className = "confidence";
    confidence.textContent = `${Math.round(item.confidence * 100)}%`;
    confidence.setAttribute("aria-label", `Extraction confidence ${Math.round(item.confidence * 100)} percent`);
    details.append(confidence);
  }

  return details;
}

function isBeverageItem(item: MenuItem, category: Pick<MenuCategory, "name_en" | "name_zh">): boolean {
  const searchableText = [
    category.name_en,
    category.name_zh,
    item.name_en,
    item.name_zh,
    ...item.tags,
    ...item.tags_zh,
  ]
    .map(normalizeText)
    .join(" ");

  return beverageKeywords.some((keyword) => searchableText.includes(keyword));
}

const beverageKeywords = [
  "饮",
  "饮品",
  "咖啡",
  "茶",
  "酒",
  "cafe",
  "cafes",
  "café",
  "cafés",
  "coffee",
  "drink",
  "drinks",
  "beverage",
  "beverages",
  "tea",
  "juice",
  "smoothie",
  "soda",
  "beer",
  "wine",
  "cocktail",
  "latte",
  "mocha",
  "espresso",
  "cappuccino",
];

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function formatPrice(item: MenuItem): string {
  if (item.price.raw) {
    return item.price.raw;
  }

  if (item.price.amount === null) {
    return "Market price";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: item.price.currency,
  }).format(item.price.amount);
}
