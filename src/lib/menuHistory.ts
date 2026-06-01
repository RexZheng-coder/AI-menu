import { getMenuItemCount, sanitizeMenu } from "./menuValidation.js";
import type { Menu, MenuMetadata } from "../types/menu.js";

export type SavedMenuRecord = {
  menu_id: string;
  restaurant_name: string;
  cuisine_type: string | null;
  created_at: string;
  item_count: number;
  source_type: MenuMetadata["source_type"];
  menu: Menu;
};

const historyStorageKey = "ai_menu_assistant.saved_menus";
const maxSavedMenus = 10;

export function getSavedMenus(): SavedMenuRecord[] {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  const rawValue = storage.getItem(historyStorageKey);

  if (!rawValue) {
    return [];
  }

  try {
    return sanitizeSavedMenuRecords(JSON.parse(rawValue));
  } catch {
    storage.removeItem(historyStorageKey);
    return [];
  }
}

export function saveMenuToHistory(menu: Menu): SavedMenuRecord[] {
  const record = createSavedMenuRecord(menu);
  const nextRecords = [
    record,
    ...getSavedMenus().filter((savedMenu) => savedMenu.menu_id !== record.menu_id),
  ].slice(0, maxSavedMenus);

  writeSavedMenus(nextRecords);
  return nextRecords;
}

export function removeSavedMenu(menuId: string): SavedMenuRecord[] {
  const nextRecords = getSavedMenus().filter((savedMenu) => savedMenu.menu_id !== menuId);
  writeSavedMenus(nextRecords);
  return nextRecords;
}

export function clearSavedMenus(): void {
  getStorage()?.removeItem(historyStorageKey);
}

export function getSavedMenuById(menuId: string): SavedMenuRecord | undefined {
  return getSavedMenus().find((savedMenu) => savedMenu.menu_id === menuId);
}

function createSavedMenuRecord(menu: Menu): SavedMenuRecord {
  return {
    menu_id: menu.menu_id,
    restaurant_name: menu.restaurant.name,
    cuisine_type: menu.restaurant.cuisine_type ?? null,
    created_at: menu.metadata.created_at,
    item_count: getMenuItemCount(menu),
    source_type: menu.metadata.source_type,
    menu,
  };
}

function sanitizeSavedMenuRecords(input: unknown): SavedMenuRecord[] {
  if (!Array.isArray(input)) {
    throw new Error("Saved menu history is not an array.");
  }

  return input
    .flatMap((recordInput) => {
      const record = asRecord(recordInput);
      const rawMenu = record.menu;

      if (!rawMenu) {
        return [];
      }

      const menuMetadata = asRecord(asRecord(rawMenu).metadata);
      const menu = sanitizeMenu(rawMenu, {
        imageUrls: asStringArray(menuMetadata, "image_urls"),
        now: asString(menuMetadata.created_at) ?? undefined,
      });

      return [createSavedMenuRecord(menu)];
    })
    .slice(0, maxSavedMenus);
}

function writeSavedMenus(records: SavedMenuRecord[]): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(historyStorageKey, JSON.stringify(records));
}

function getStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return {};
}

function asString(input: unknown): string | undefined {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : undefined;
}

function asStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
  const value = record[key];

  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.flatMap((item) => (typeof item === "string" ? [item] : []));
}
