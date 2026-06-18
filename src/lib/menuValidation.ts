import type { Menu, MenuCategory, MenuItem, Price, SpicyLevel } from "../types/menu.js";
import { normalizeAllergens } from "./allergenUtils.js";
import { inferCurrencyFromPriceText, parsePriceAmount } from "./priceUtils.js";

type SanitizedMenuOptions = {
  imageUrls?: string[];
  now?: string;
};

export function sanitizeMenu(input: unknown, options: SanitizedMenuOptions = {}): Menu {
  const source = asRecord(input);
  const restaurantSource = asRecord(source.restaurant);
  const languageSource = asRecord(source.language);
  const menuId = asString(source.menu_id) ?? `menu_${slugify(asString(restaurantSource.name) ?? "parsed")}`;
  const restaurantName =
    asString(restaurantSource.name) ??
    asString(source.restaurant_name) ??
    "Parsed Menu";

  return {
    menu_id: menuId,
    restaurant: {
      name: restaurantName,
      address: asNullableString(restaurantSource.address),
      cuisine_type: asNullableString(restaurantSource.cuisine_type),
    },
    language: {
      source: asString(languageSource.source) ?? "auto",
      target: asString(languageSource.target) ?? "zh",
    },
    categories: sanitizeCategories(source.categories),
    metadata: {
      source_type: "image_upload",
      image_urls: options.imageUrls ?? [],
      ai_model: asNullableString(asRecord(source.metadata).ai_model),
      created_at: options.now ?? new Date().toISOString(),
      status: "completed",
    },
  };
}

export function getMenuItemCount(menu: Menu): number {
  return menu.categories.reduce((sum, category) => sum + category.items.length, 0);
}

export function validateMenuHasItems(menu: Menu): string | null {
  if (menu.categories.length === 0 || getMenuItemCount(menu) === 0) {
    return "We could not find any dishes in that menu image. Please try a clearer photo or another page.";
  }

  return null;
}

function sanitizeCategories(input: unknown): MenuCategory[] {
  return asArray(input).map((categoryInput, index) => sanitizeCategory(categoryInput, index));
}

function sanitizeCategory(input: unknown, index: number): MenuCategory {
  const source = asRecord(input);
  const nameEn = asString(source.name_en) ?? `Category ${index + 1}`;
  const nameZh = asString(source.name_zh) ?? nameEn;
  const categoryId = asString(source.category_id) ?? `cat_${slugify(nameEn)}_${index + 1}`;

  return {
    category_id: categoryId,
    name_en: nameEn,
    name_zh: nameZh,
    items: asArray(source.items).map((itemInput, itemIndex) =>
      sanitizeItem(itemInput, categoryId, itemIndex),
    ),
  };
}

function sanitizeItem(input: unknown, categoryId: string, index: number): MenuItem {
  const source = asRecord(input);
  const nameEn = asString(source.name_en) ?? `Item ${index + 1}`;
  const nameZh = asString(source.name_zh) ?? nameEn;

  return {
    item_id: asString(source.item_id) ?? `${categoryId}_item_${slugify(nameEn)}_${index + 1}`,
    name_en: nameEn,
    name_zh: nameZh,
    description_en: asNullableString(source.description_en),
    description_zh: asNullableString(source.description_zh),
    price: sanitizePrice(source.price),
    tags: asStringArray(source.tags),
    tags_zh: asStringArray(source.tags_zh),
    spicy_level: sanitizeSpicyLevel(source.spicy_level),
    allergens: normalizeAllergens(asStringArray(source.allergens)),
    is_recommended: asBoolean(source.is_recommended),
    confidence: clampConfidence(source.confidence),
  };
}

function sanitizePrice(input: unknown): Price {
  const source = asRecord(input);
  const raw = asNullableString(source.raw);

  return {
    amount: asNullableNumber(source.amount) ?? parsePriceAmount(raw),
    currency: asString(source.currency) ?? inferCurrencyFromPriceText(raw),
    raw,
  };
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return {};
}

function asArray(input: unknown): unknown[] {
  return Array.isArray(input) ? input : [];
}

function asString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined;
}

function asNullableString(input: unknown): string | null {
  return asString(input) ?? null;
}

function asNullableNumber(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

function asBoolean(input: unknown): boolean | undefined {
  return typeof input === "boolean" ? input : undefined;
}

function asStringArray(input: unknown): string[] {
  return asArray(input).flatMap((value) => {
    const stringValue = asString(value);
    return stringValue ? [stringValue] : [];
  });
}

function sanitizeSpicyLevel(input: unknown): SpicyLevel {
  if (input === 0 || input === 1 || input === 2 || input === 3 || input === 4 || input === 5) {
    return input;
  }

  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.max(0, Math.min(5, Math.round(input))) as SpicyLevel;
  }

  return 0;
}

function clampConfidence(input: unknown): number | undefined {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    return undefined;
  }

  return Math.max(0, Math.min(1, input));
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "menu";
}
