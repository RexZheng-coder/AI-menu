import type { Menu, MenuCategory, MenuItem } from "../types/menu.js";

export function mergeParsedMenus(menus: Menu[], imageNames: string[]): Menu {
  if (menus.length === 0) {
    throw new Error("Cannot merge an empty menu list.");
  }

  const mergedCategories: Array<{
    name_en: string;
    name_zh: string;
    items: MenuItem[];
  }> = [];
  const categoryIndexes = new Map<string, number>();

  for (const menu of menus) {
    for (const category of menu.categories) {
      const categoryKey = createCategoryKey(category);
      const existingIndex = categoryIndexes.get(categoryKey);

      if (existingIndex === undefined) {
        categoryIndexes.set(categoryKey, mergedCategories.length);
        mergedCategories.push({
          name_en: category.name_en,
          name_zh: category.name_zh,
          items: category.items.map(cloneMenuItem),
        });
        continue;
      }

      const existingCategory = mergedCategories[existingIndex];

      for (const item of category.items) {
        const itemKey = createItemKey(item);
        const duplicateIndex = existingCategory.items.findIndex(
          (candidate) => createItemKey(candidate) === itemKey,
        );

        if (duplicateIndex === -1) {
          existingCategory.items.push(cloneMenuItem(item));
        } else {
          existingCategory.items[duplicateIndex] = mergeMenuItems(
            existingCategory.items[duplicateIndex],
            item,
          );
        }
      }
    }
  }

  const categories = mergedCategories.map((category, categoryIndex) =>
    createMergedCategory(category, categoryIndex),
  );
  const primaryMenu = selectPrimaryMenu(menus);

  return {
    ...primaryMenu,
    restaurant: {
      ...primaryMenu.restaurant,
      cuisine_type:
        menus.find((menu) => menu.restaurant.cuisine_type)?.restaurant.cuisine_type ??
        primaryMenu.restaurant.cuisine_type,
    },
    categories,
    metadata: {
      ...primaryMenu.metadata,
      image_urls: imageNames,
      created_at: new Date().toISOString(),
      source_type: "image_upload",
      status: "completed",
    },
  };
}

function selectPrimaryMenu(menus: Menu[]): Menu {
  return (
    menus.find((menu) => {
      const name = normalizeText(menu.restaurant.name);
      return name.length > 0 && name !== "parsed menu";
    }) ?? menus[0]
  );
}

function createMergedCategory(
  category: { name_en: string; name_zh: string; items: MenuItem[] },
  categoryIndex: number,
): MenuCategory {
  const categoryId = `cat_${slugify(category.name_en || category.name_zh)}_${categoryIndex + 1}`;

  return {
    category_id: categoryId,
    name_en: category.name_en,
    name_zh: category.name_zh,
    items: category.items.map((item, itemIndex) => ({
      ...cloneMenuItem(item),
      item_id: `${categoryId}_item_${slugify(item.name_en || item.name_zh)}_${itemIndex + 1}`,
    })),
  };
}

function mergeMenuItems(existing: MenuItem, incoming: MenuItem): MenuItem {
  return {
    ...existing,
    name_zh: chooseMoreUsefulText(existing.name_zh, incoming.name_zh),
    description_en: existing.description_en ?? incoming.description_en,
    description_zh: existing.description_zh ?? incoming.description_zh,
    price: existing.price.raw || existing.price.amount !== null ? existing.price : incoming.price,
    tags: uniqueStrings([...existing.tags, ...incoming.tags]),
    tags_zh: uniqueStrings([...existing.tags_zh, ...incoming.tags_zh]),
    allergens: uniqueStrings([...(existing.allergens ?? []), ...(incoming.allergens ?? [])]),
    spicy_level: Math.max(existing.spicy_level, incoming.spicy_level) as MenuItem["spicy_level"],
    is_recommended: existing.is_recommended || incoming.is_recommended,
    confidence: Math.max(existing.confidence ?? 0, incoming.confidence ?? 0) || undefined,
  };
}

function cloneMenuItem(item: MenuItem): MenuItem {
  return {
    ...item,
    price: { ...item.price },
    tags: [...item.tags],
    tags_zh: [...item.tags_zh],
    allergens: item.allergens ? [...item.allergens] : [],
  };
}

function createCategoryKey(category: MenuCategory): string {
  return normalizeText(category.name_en || category.name_zh) || "menu";
}

function createItemKey(item: MenuItem): string {
  return `${normalizeText(item.name_en || item.name_zh)}|${normalizeText(item.price.raw ?? "")}`;
}

function chooseMoreUsefulText(first: string, second: string): string {
  if (!first.trim()) {
    return second;
  }

  return first.length >= second.length ? first : second;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ");
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "menu";
}
