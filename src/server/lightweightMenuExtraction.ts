import { sanitizeMenu } from "../lib/menuValidation.js";
import type { Menu } from "../types/menu.js";

export type LightweightMenuExtraction = {
  restaurant_name: string | null;
  cuisine_type: string | null;
  categories: LightweightMenuCategory[];
};

export type LightweightMenuParseResult = {
  extraction: LightweightMenuExtraction;
  recoveredFromTruncation: boolean;
};

export type LightweightMenuCategory = {
  name_en: string;
  name_zh: string;
  items: LightweightMenuItem[];
};

export type LightweightMenuItem = {
  name_en: string;
  name_zh: string;
  description_en: string | null;
  description_zh: string | null;
  price_raw: string | null;
  tags: string[];
  tags_zh: string[];
  spicy_level: 0 | 1 | 2 | 3;
  allergens: string[];
  confidence: number;
};

export function parseLightweightExtractionFromText(text: string): LightweightMenuExtraction {
  return parseLightweightExtractionWithMetadata(text).extraction;
}

export function parseLightweightExtractionWithMetadata(text: string): LightweightMenuParseResult {
  try {
    return {
      extraction: sanitizeLightweightExtraction(parseJsonFromText(text)),
      recoveredFromTruncation: false,
    };
  } catch {
    // Fall through to the partial parser below. Vision models sometimes hit
    // max tokens after several complete categories; those complete objects are
    // still safe to display.
  }

  const partialExtraction = parsePartialExtractionFromText(text);

  if (partialExtraction.categories.length > 0) {
    return {
      extraction: partialExtraction,
      recoveredFromTruncation: true,
    };
  }

  throw new Error("MiMo menu output was not valid JSON.");
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
    name_zh: asString(source.name_zh) ?? nameEn,
    items: asArray(source.items)
      .map((itemInput, itemIndex) => sanitizeLightweightItem(itemInput, itemIndex))
      .filter((item) => item.name_en.length > 0),
  };
}

function sanitizeLightweightItem(input: unknown, index: number): LightweightMenuItem {
  const source = asRecord(input);

  return {
    name_en: asString(source.name_en) ?? `Item ${index + 1}`,
    name_zh: asString(source.name_zh) ?? asString(source.name_en) ?? `Item ${index + 1}`,
    description_en: asNullableString(source.description_en),
    description_zh: asNullableString(source.description_zh) ?? asNullableString(source.description_en),
    price_raw: asNullableString(source.price_raw),
    tags: asStringArray(source.tags),
    tags_zh: asStringArray(source.tags_zh),
    spicy_level: sanitizeSpicyLevel(source.spicy_level),
    allergens: asStringArray(source.allergens),
    confidence: sanitizeConfidence(source.confidence),
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
    name_zh: category.name_zh,
    items: category.items.map((item, itemIndex) => createMenuItem(item, categoryId, itemIndex)),
  };
}

function createMenuItem(item: LightweightMenuItem, categoryId: string, index: number): Record<string, unknown> {
  const itemName = item.name_en || `Item ${index + 1}`;

  return {
    item_id: `${categoryId}_item_${slugify(itemName)}_${index + 1}`,
    name_en: itemName,
    name_zh: item.name_zh || itemName,
    description_en: item.description_en,
    description_zh: item.description_zh,
    price: {
      amount: parsePriceAmount(item.price_raw),
      currency: "USD",
      raw: item.price_raw,
    },
    tags: item.tags,
    tags_zh: item.tags_zh,
    spicy_level: item.spicy_level,
    allergens: item.allergens,
    is_recommended: false,
    confidence: item.confidence,
  };
}

function parseJsonFromText(text: string): unknown {
  const trimmedText = stripCodeFence(text.trim());

  try {
    return JSON.parse(trimmedText) as unknown;
  } catch {
    const jsonObjectText = findTopLevelJsonObject(trimmedText);

    if (jsonObjectText) {
      return JSON.parse(jsonObjectText) as unknown;
    }

    throw new Error("MiMo menu output was not valid JSON.");
  }
}

function parsePartialExtractionFromText(text: string): LightweightMenuExtraction {
  const trimmedText = stripCodeFence(text.trim());
  const categoriesStart = trimmedText.indexOf("\"categories\"");

  if (categoriesStart < 0) {
    return sanitizeLightweightExtraction({});
  }

  const categoriesArrayStart = trimmedText.indexOf("[", categoriesStart);

  if (categoriesArrayStart < 0) {
    return sanitizeLightweightExtraction({});
  }

  const categories: unknown[] = [];
  let cursor = categoriesArrayStart + 1;

  while (cursor < trimmedText.length) {
    const categoryStart = trimmedText.indexOf("{", cursor);

    if (categoryStart < 0) {
      break;
    }

    const categoryJson = readCompleteJsonObjectAt(trimmedText, categoryStart);

    if (!categoryJson) {
      const partialCategory = readPartialCategoryAt(trimmedText, categoryStart);

      if (partialCategory) {
        categories.push(partialCategory);
      }

      break;
    }

    try {
      categories.push(JSON.parse(categoryJson.text) as unknown);
    } catch {
      break;
    }

    cursor = categoryJson.endIndex + 1;
  }

  return sanitizeLightweightExtraction({
    restaurant_name: readNullableJsonStringField(trimmedText, "restaurant_name"),
    cuisine_type: readNullableJsonStringField(trimmedText, "cuisine_type"),
    categories,
  });
}

function readPartialCategoryAt(text: string, start: number): Record<string, unknown> | null {
  const remainingText = text.slice(start);
  const itemsFieldIndex = remainingText.indexOf("\"items\"");

  if (itemsFieldIndex < 0) {
    return null;
  }

  const categoryHeaderText = remainingText.slice(0, itemsFieldIndex);
  const itemsArrayStart = remainingText.indexOf("[", itemsFieldIndex);

  if (itemsArrayStart < 0) {
    return null;
  }

  const items: unknown[] = [];
  let cursor = itemsArrayStart + 1;

  while (cursor < remainingText.length) {
    const itemStart = remainingText.indexOf("{", cursor);

    if (itemStart < 0) {
      break;
    }

    const itemJson = readCompleteJsonObjectAt(remainingText, itemStart);

    if (!itemJson) {
      break;
    }

    try {
      items.push(JSON.parse(itemJson.text) as unknown);
    } catch {
      break;
    }

    cursor = itemJson.endIndex + 1;
  }

  if (items.length === 0) {
    return null;
  }

  const nameEn = readNullableJsonStringField(categoryHeaderText, "name_en") ?? "Menu";

  return {
    name_en: nameEn,
    name_zh: readNullableJsonStringField(categoryHeaderText, "name_zh") ?? nameEn,
    items,
  };
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

function asStringArray(input: unknown): string[] {
  return asArray(input).flatMap((value) => {
    const stringValue = asString(value);
    return stringValue ? [stringValue] : [];
  });
}

function sanitizeSpicyLevel(input: unknown): 0 | 1 | 2 | 3 {
  if (input === 0 || input === 1 || input === 2 || input === 3) {
    return input;
  }

  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.max(0, Math.min(3, Math.round(input))) as 0 | 1 | 2 | 3;
  }

  return 0;
}

function sanitizeConfidence(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.max(0, Math.min(1, input));
  }

  return 0.8;
}

function parsePriceAmount(raw: string | null): number | null {
  if (!raw) {
    return null;
  }

  const match = raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function findTopLevelJsonObject(text: string): string | null {
  const start = text.indexOf("{");

  if (start < 0) {
    return null;
  }

  return readCompleteJsonObjectAt(text, start)?.text ?? null;
}

function readCompleteJsonObjectAt(text: string, start: number): { text: string; endIndex: number } | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = inString;
      continue;
    }

    if (character === "\"") {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return {
          text: text.slice(start, index + 1),
          endIndex: index,
        };
      }
    }
  }

  return null;
}

function readNullableJsonStringField(text: string, fieldName: string): string | null {
  const fieldIndex = text.indexOf(`"${fieldName}"`);

  if (fieldIndex < 0) {
    return null;
  }

  const colonIndex = text.indexOf(":", fieldIndex);

  if (colonIndex < 0) {
    return null;
  }

  const valueStart = text.slice(colonIndex + 1).search(/\S/);

  if (valueStart < 0) {
    return null;
  }

  const absoluteValueStart = colonIndex + 1 + valueStart;

  if (text.startsWith("null", absoluteValueStart)) {
    return null;
  }

  if (text[absoluteValueStart] !== "\"") {
    return null;
  }

  let escaped = false;

  for (let index = absoluteValueStart + 1; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === "\"") {
      try {
        return JSON.parse(text.slice(absoluteValueStart, index + 1)) as string;
      } catch {
        return null;
      }
    }
  }

  return null;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "menu";
}
