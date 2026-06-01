import { renderTagPill } from "./TagPill.js";
import type { MenuItem } from "../types/menu.js";

export function renderMenuItemCard(item: MenuItem, onAddToCart: (item: MenuItem) => void): HTMLElement {
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

  const price = document.createElement("p");
  price.className = "item-card__price";
  price.textContent = formatPrice(item);

  header.append(names, price);

  const description = document.createElement("p");
  description.className = "item-card__description";
  description.textContent = item.description_zh ?? item.description_en ?? "暂无描述";

  const tags = document.createElement("div");
  tags.className = "tag-list";

  for (const tag of item.tags_zh) {
    tags.append(renderTagPill(tag));
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

  content.append(header, description, tags, details);

  const addButton = document.createElement("button");
  addButton.className = "add-button";
  addButton.type = "button";
  addButton.textContent = "+";
  addButton.setAttribute("aria-label", `Add ${item.name_zh}`);
  addButton.addEventListener("click", () => onAddToCart(item));

  article.append(content, addButton);
  return article;
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
