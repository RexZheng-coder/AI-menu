import { sanitizeMenu } from "../lib/menuValidation.js";
import type { Menu } from "../types/menu.js";

export type LightweightMenuExtraction = {
  restaurant_name: string | null;
  cuisine_type: string | null;
  categories: LightweightMenuCategory[];
};

export type LightweightMenuCategory = {
  name_en: string;
  items: LightweightMenuItem[];
};

export type LightweightMenuItem = {
  name_en: string;
  description_en: string | null;
  price_raw: string | null;
};

export function parseLightweightExtractionFromText(text: string): LightweightMenuExtraction {
  return sanitizeLightweightExtraction(parseJsonFromText(text));
}

export function sanitizeLightweightExtraction(input: unknown): LightweightMenuExtraction {
  const source = asRecord(input);

  return {
    restaurant_name: asNullableString(source.restaurant_name),
    cuisine_type: asNullableString(source.cuisine_type),
    categories: asArray(source.categories)
      .map((categoryInput, categoryIndex) => sanitizeLightweightCategory(categoryInput, categoryIndex))
      .filter((category) => category.items.length > 0),
  };
}

export function buildMenuFromLightweightExtraction(
  extraction: LightweightMenuExtraction,
  options: {
    imageUrls: string[];
    model: string;
    now: string;
  },
): Menu {
  const menuInput = createMenuFromLightweightExtraction(extraction, options);
  const menu = sanitizeMenu(menuInput, {
    imageUrls: options.imageUrls,
    now: options.now,
  });

  return {
    ...menu,
    metadata: {
      ...menu.metadata,
      ai_model: options.model,
      source_type: "image_upload",
      status: "completed",
    },
  };
}

function sanitizeLightweightCategory(input: unknown, index: number): LightweightMenuCategory {
  const source = asRecord(input);
  const nameEn = asString(source.name_en) ?? `Menu ${index + 1}`;

  return {
    name_en: nameEn,
    items: asArray(source.items)
      .map((itemInput, itemIndex) => sanitizeLightweightItem(itemInput, itemIndex))
      .filter((item) => item.name_en.length > 0),
  };
}

function sanitizeLightweightItem(input: unknown, index: number): LightweightMenuItem {
  const source = asRecord(input);

  return {
    name_en: asString(source.name_en) ?? `Item ${index + 1}`,
    description_en: asNullableString(source.description_en),
    price_raw: asNullableString(source.price_raw),
  };
}

function createMenuFromLightweightExtraction(
  extraction: LightweightMenuExtraction,
  options: {
    imageUrls: string[];
    model: string;
    now: string;
  },
): Record<string, unknown> {
  const restaurantName = extraction.restaurant_name ?? "Parsed Menu";
  const menuSlug = extraction.restaurant_name
    ? slugify(extraction.restaurant_name)
    : slugify(options.imageUrls[0] ?? "parsed_menu");

  return {
    menu_id: `menu_${menuSlug}`,
    restaurant: {
      name: restaurantName,
      address: null,
      cuisine_type: extraction.cuisine_type,
    },
    language: {
      source: "en",
      target: "zh",
    },
    categories: extraction.categories.map((category, categoryIndex) =>
      createMenuCategory(category, categoryIndex),
    ),
    metadata: {
      source_type: "image_upload",
      image_urls: options.imageUrls,
      ai_model: options.model,
      created_at: options.now,
      status: "completed",
    },
  };
}

function createMenuCategory(category: LightweightMenuCategory, index: number): Record<string, unknown> {
  const categoryId = `cat_${slugify(category.name_en)}_${index + 1}`;

  return {
    category_id: categoryId,
    name_en: category.name_en,
    name_zh: category.name_en,
    items: category.items.map((item, itemIndex) => createMenuItem(item, categoryId, itemIndex)),
  };
}

function createMenuItem(item: LightweightMenuItem, categoryId: string, index: number): Record<string, unknown> {
  const itemName = item.name_en || `Item ${index + 1}`;

  return {
    item_id: `${categoryId}_item_${slugify(itemName)}_${index + 1}`,
    name_en: itemName,
    name_zh: itemName,
    description_en: item.description_en,
    description_zh: item.description_en,
    price: {
      amount: parsePriceAmount(item.price_raw),
      currency: "USD",
      raw: item.price_raw,
    },
    tags: [],
    tags_zh: [],
    spicy_level: 0,
    allergens: [],
    is_recommended: false,
    confidence: 0.8,
  };
}

function parseJsonFromText(text: string): unknown {
  const trimmedText = stripCodeFence(text.trim());

  try {
    return JSON.parse(trimmedText) as unknown;
  } catch {
    const start = trimmedText.indexOf("{");
    const end = trimmedText.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return JSON.parse(trimmedText.slice(start, end + 1)) as unknown;
    }

    throw new Error("MiMo menu output was not valid JSON.");
  }
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
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

function parsePriceAmount(raw: string | null): number | null {
  if (!raw) {
    return null;
  }

  const match = raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "menu";
}
