import { renderTagPill } from "./TagPill.js";
import { getAllergenLabelZh, normalizeAllergens } from "../lib/allergenUtils.js";
import { formatMenuPrice } from "../lib/priceUtils.js";
import type { MenuCategory, MenuItem } from "../types/menu.js";

export function renderMenuItemCard(
  item: MenuItem,
  actions: {
    onAddToCart: (item: MenuItem) => void;
    onDecreaseCartItem: (itemId: string) => void;
    getCartQuantity: (itemId: string) => number;
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

  const priceText = formatMenuPrice(item.price);
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

  const allergens = renderAllergenList(item);

  if (allergens) {
    content.append(allergens);
  }

  const details = renderItemDetails(item, category);

  if (details) {
    content.append(details);
  }

  if (!descriptionText && !hasTags && !allergens && !details) {
    article.classList.add("item-card--compact");
  }

  const actionColumn = document.createElement("div");
  actionColumn.className = "item-card__actions";
  actionColumn.append(renderOrderControl(item, actions));

  const moreButton = document.createElement("button");
  moreButton.className = "item-more-button";
  moreButton.type = "button";
  moreButton.textContent = "⋯";
  moreButton.title = "Menu item actions";
  moreButton.setAttribute("aria-label", `Show actions for ${item.name_zh}`);
  moreButton.setAttribute("aria-expanded", "false");
  moreButton.addEventListener("click", () => {
    const isOpen = article.classList.toggle("item-card--utilities-open");
    moreButton.setAttribute("aria-expanded", String(isOpen));
  });
  actionColumn.append(moreButton);

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

  const utilityActions = document.createElement("div");
  utilityActions.className = "item-card__utility-actions";
  utilityActions.append(editButton, deleteButton);
  content.append(utilityActions);

  article.append(content, actionColumn);
  return article;
}

function renderOrderControl(
  item: MenuItem,
  actions: {
    onAddToCart: (item: MenuItem) => void;
    onDecreaseCartItem: (itemId: string) => void;
    getCartQuantity: (itemId: string) => number;
  },
): HTMLElement {
  const control = document.createElement("div");
  control.className = "item-order-control";
  control.setAttribute("aria-live", "polite");

  const pulse = (): void => {
    control.classList.remove("item-order-control--pulse");
    window.requestAnimationFrame(() => control.classList.add("item-order-control--pulse"));
  };

  const refresh = (): void => {
    const quantity = actions.getCartQuantity(item.item_id);
    control.classList.toggle("item-order-control--selected", quantity > 0);

    if (quantity === 0) {
      const addButton = document.createElement("button");
      addButton.className = "add-button";
      addButton.type = "button";
      addButton.textContent = "+";
      addButton.setAttribute("aria-label", `Add ${item.name_zh}`);
      addButton.addEventListener("click", () => {
        actions.onAddToCart(item);
        refresh();
        pulse();
      });
      control.replaceChildren(addButton);
      return;
    }

    const decreaseButton = renderQuantityButton("-", `Decrease ${item.name_zh}`, () => {
      actions.onDecreaseCartItem(item.item_id);
      refresh();
      pulse();
    });
    const quantityLabel = document.createElement("span");
    quantityLabel.className = "item-order-control__quantity";
    quantityLabel.textContent = String(quantity);
    quantityLabel.setAttribute("aria-label", `${quantity} selected`);
    const increaseButton = renderQuantityButton("+", `Add another ${item.name_zh}`, () => {
      actions.onAddToCart(item);
      refresh();
      pulse();
    });

    control.replaceChildren(decreaseButton, quantityLabel, increaseButton);
  };

  control.addEventListener("cart-sync", refresh);
  refresh();
  return control;
}

function renderQuantityButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "item-order-control__button";
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", onClick);
  return button;
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
  if (isBeverageItem(item, category) || item.spicy_level === 0) {
    return null;
  }

  const details = document.createElement("div");
  details.className = "item-card__details";

  const spice = document.createElement("span");
  spice.className = `spice-meter spice-meter--level-${item.spicy_level}`;
  spice.setAttribute("aria-label", `辣度 ${item.spicy_level}，最高 5`);

  const spiceLabel = document.createElement("span");
  spiceLabel.className = "spice-meter__label";
  spiceLabel.textContent = "辣度";

  const peppers = document.createElement("span");
  peppers.className = "spice-meter__peppers";
  peppers.setAttribute("aria-hidden", "true");
  peppers.textContent = "🌶️".repeat(item.spicy_level);

  spice.append(spiceLabel, peppers);
  details.append(spice);

  return details;
}

function renderAllergenList(item: MenuItem): HTMLElement | null {
  const allergens = normalizeAllergens(item.allergens ?? []);

  if (allergens.length === 0) {
    return null;
  }

  const section = document.createElement("div");
  section.className = "allergen-list";
  section.setAttribute("aria-label", "AI allergen indicators");

  const label = document.createElement("span");
  label.className = "allergen-list__label";
  label.textContent = "过敏原";
  label.title = "AI 推测，请向餐厅确认";
  section.append(label);

  for (const allergen of allergens) {
    const pill = document.createElement("span");
    pill.className = "allergen-pill";
    pill.textContent = getAllergenLabelZh(allergen);
    pill.title = `${allergen} · AI 推测，请向餐厅确认`;
    section.append(pill);
  }

  return section;
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
