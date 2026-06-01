import { renderMenuCategory } from "../components/MenuCategory.js";
import { renderCartPanel } from "../components/CartPanel.js";
import { renderUploadPanel } from "../components/UploadPanel.js";
import {
  calculateCartTotal,
  createCartItemFromMenuItem,
  generateOrderSummary,
} from "../lib/menuUtils.js";
import { ParseMenuError, toParseMenuError } from "../lib/parseMenuErrors.js";
import { parseMenuImages } from "../lib/parseMenuImages.js";
import { mockMenu } from "../mock/menuMock.js";
import type { Cart, CartItem, Menu, MenuItem, OrderSummary } from "../types/menu.js";

const appRoot = document.querySelector<HTMLElement>("#app");

if (!appRoot) {
  throw new Error("App root element was not found.");
}

const appRootElement = appRoot;
const cartId = "cart_lantern_house_001";
const maxUploadSizeBytes = 10 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const acceptedImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
const defaultParseTimeoutMs = 30_000;

type UploadPreview = {
  file: File;
  previewUrl: string;
};

type ParseState = "idle" | "validating_files" | "uploading" | "parsing" | "success" | "error";

let currentMenu: Menu | null = null;
let uploadFiles: UploadPreview[] = [];
let uploadError: ParseMenuError | null = null;
let parseState: ParseState = "idle";
let cartItems: CartItem[] = [];
let orderSummary: OrderSummary | null = null;
let cartPanelRoot: HTMLElement | null = null;

renderApp(appRootElement);

function renderApp(root: HTMLElement): void {
  root.replaceChildren(renderUpload());
  cartPanelRoot = null;

  if (currentMenu) {
    root.append(renderMenuPage(currentMenu));
    renderCart();
  }
}

function renderUpload(): HTMLElement {
  return renderUploadPanel({
    files: uploadFiles,
    error: uploadError?.userMessage ?? null,
    parseState,
    hasMenu: currentMenu !== null,
    onFilesSelected: selectUploadFiles,
    onClearFiles: clearUploadFiles,
    onAnalyze: analyzeUploadedMenu,
    onRetry: retryUploadedMenu,
    onUseSampleMenu: useSampleMenu,
  });
}

function renderMenuPage(menu: Menu): HTMLElement {
  const shell = document.createElement("div");
  shell.className = "app-shell";

  const menuColumn = document.createElement("div");
  menuColumn.className = "menu-column";
  menuColumn.append(renderHeader(menu), renderCategoryList(menu));

  cartPanelRoot = document.createElement("div");
  cartPanelRoot.className = "cart-column";

  shell.append(menuColumn, cartPanelRoot);

  return shell;
}

function renderHeader(menu: Menu): HTMLElement {
  const header = document.createElement("header");
  header.className = "menu-header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "menu-header__eyebrow";
  eyebrow.textContent = menu.restaurant.cuisine_type ?? "Restaurant menu";

  const title = document.createElement("h1");
  title.className = "menu-header__title";
  title.textContent = menu.restaurant.name;

  const meta = document.createElement("p");
  meta.className = "menu-header__meta";
  meta.textContent = menu.restaurant.address ?? `${menu.language.source.toUpperCase()} to ${menu.language.target.toUpperCase()}`;

  header.append(eyebrow, title, meta);
  return header;
}

function renderCategoryList(menu: Menu): HTMLElement {
  const container = document.createElement("section");
  container.className = "menu-page";
  container.setAttribute("aria-label", "Restaurant menu");

  if (menu.categories.length === 0) {
    container.append(renderEmptyState("No menu categories are available yet."));
    return container;
  }

  for (const category of menu.categories) {
    container.append(renderMenuCategory(category, addToCart));
  }

  return container;
}

function renderEmptyState(message: string): HTMLElement {
  const emptyState = document.createElement("p");
  emptyState.className = "empty-state";
  emptyState.textContent = message;
  return emptyState;
}

function selectUploadFiles(files: File[]): void {
  parseState = "validating_files";
  uploadError = null;
  renderApp(appRootElement);

  window.setTimeout(() => {
    const validation = validateUploadFiles(files);

    if (validation.validFiles.length > 0) {
      replaceUploadFiles(validation.validFiles);
    }

    uploadError = validation.error;
    parseState = validation.error ? "error" : "idle";
    renderApp(appRootElement);
  }, 0);
}

function clearUploadFiles(): void {
  replaceUploadFiles([]);
  uploadError = null;
  parseState = "idle";
  renderApp(appRootElement);
}

async function analyzeUploadedMenu(): Promise<void> {
  if (isBusyParseState(parseState)) {
    return;
  }

  if (uploadFiles.length === 0) {
    uploadError = new ParseMenuError("no_files", "Please choose at least one menu image before scanning.");
    parseState = "error";
    renderApp(appRootElement);
    return;
  }

  parseState = "uploading";
  uploadError = null;
  renderApp(appRootElement);

  try {
    await delay(150);
    parseState = "parsing";
    renderApp(appRootElement);
    setCurrentMenu(
      await withParseTimeout(
        parseMenuImages(uploadFiles.map((filePreview) => filePreview.file)),
        getParseTimeoutMs(),
      ),
    );
    parseState = "success";
  } catch (error) {
    const parseError = toParseMenuError(error);
    uploadError = parseError;
    parseState = "error";
    logParseError(parseError);
  } finally {
    renderApp(appRootElement);
  }
}

function retryUploadedMenu(): void {
  void analyzeUploadedMenu();
}

function useSampleMenu(): void {
  uploadError = null;
  parseState = "success";
  setCurrentMenu(mockMenu);
  renderApp(appRootElement);
}

function setCurrentMenu(menu: Menu): void {
  currentMenu = menu;
  cartItems = [];
  orderSummary = null;
}

function replaceUploadFiles(files: File[]): void {
  revokeUploadPreviews();
  uploadFiles = files.map((file) => ({
    file,
    previewUrl: URL.createObjectURL(file),
  }));
}

function revokeUploadPreviews(): void {
  for (const filePreview of uploadFiles) {
    URL.revokeObjectURL(filePreview.previewUrl);
  }
}

function validateUploadFiles(files: File[]): { validFiles: File[]; error: ParseMenuError | null } {
  if (files.length === 0) {
    return {
      validFiles: [],
      error: new ParseMenuError("no_files", "Please choose at least one menu image before scanning."),
    };
  }

  const invalidFiles = files.filter((file) => !isAcceptedImageFile(file));
  const oversizedFiles = files.filter((file) => file.size > maxUploadSizeBytes);
  const validFiles = files.filter(
    (file) => isAcceptedImageFile(file) && file.size <= maxUploadSizeBytes,
  );

  if (invalidFiles.length > 0) {
    return {
      validFiles,
      error: new ParseMenuError(
        "unsupported_file_type",
        `Only JPG, PNG, and WebP images are supported. Rejected: ${formatFileNames(invalidFiles)}.`,
      ),
    };
  }

  if (oversizedFiles.length > 0) {
    return {
      validFiles,
      error: new ParseMenuError(
        "file_too_large",
        `Each image must be 10MB or smaller. Rejected: ${formatFileNames(oversizedFiles)}.`,
      ),
    };
  }

  return {
    validFiles,
    error: null,
  };
}

function isAcceptedImageFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();

  return (
    acceptedImageTypes.has(file.type) ||
    acceptedImageExtensions.some((extension) => lowerName.endsWith(extension))
  );
}

function formatFileNames(files: File[]): string {
  return files.map((file) => file.name).join(", ");
}

function addToCart(item: MenuItem): void {
  const existingItem = cartItems.find((cartItem) => cartItem.item_id === item.item_id);

  if (existingItem) {
    cartItems = cartItems.map((cartItem) =>
      cartItem.item_id === item.item_id ? updateCartItemQuantity(cartItem, cartItem.quantity + 1) : cartItem,
    );
  } else {
    cartItems = [...cartItems, createCartItemFromMenuItem(item)];
  }

  orderSummary = null;
  renderCart();
}

function increaseCartItem(itemId: string): void {
  cartItems = cartItems.map((item) =>
    item.item_id === itemId ? updateCartItemQuantity(item, item.quantity + 1) : item,
  );
  orderSummary = null;
  renderCart();
}

function decreaseCartItem(itemId: string): void {
  cartItems = cartItems
    .map((item) => (item.item_id === itemId ? updateCartItemQuantity(item, item.quantity - 1) : item))
    .filter((item) => item.quantity > 0);
  orderSummary = null;
  renderCart();
}

function removeCartItem(itemId: string): void {
  cartItems = cartItems.filter((item) => item.item_id !== itemId);
  orderSummary = null;
  renderCart();
}

function updateCartItemNotes(itemId: string, notes: string): void {
  const trimmedNotes = notes.trim();
  cartItems = cartItems.map((item) =>
    item.item_id === itemId
      ? {
          ...item,
          ...(trimmedNotes ? { notes: trimmedNotes } : { notes: undefined }),
        }
      : item,
  );
  orderSummary = null;
  renderCart();
}

function createOrderSummary(): void {
  if (cartItems.length === 0 || !currentMenu) {
    return;
  }

  orderSummary = generateOrderSummary(createCart(), currentMenu.restaurant.name);
  renderCart();
}

function renderCart(): void {
  if (!cartPanelRoot || !currentMenu) {
    return;
  }

  cartPanelRoot.replaceChildren(
    renderCartPanel({
      cart: createCart(),
      orderSummary,
      onIncrease: increaseCartItem,
      onDecrease: decreaseCartItem,
      onRemove: removeCartItem,
      onNoteChange: updateCartItemNotes,
      onGenerateSummary: createOrderSummary,
    }),
  );
}

function createCart(): Cart {
  if (!currentMenu) {
    throw new Error("Cannot create a cart before a menu has been parsed.");
  }

  return {
    cart_id: cartId,
    menu_id: currentMenu.menu_id,
    items: cartItems,
    total: calculateCartTotal(cartItems),
  };
}

function updateCartItemQuantity(item: CartItem, quantity: number): CartItem {
  return {
    ...item,
    quantity,
    subtotal: item.unit_price === null ? null : roundCurrency(item.unit_price * quantity),
  };
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function isBusyParseState(state: ParseState): boolean {
  return state === "validating_files" || state === "uploading" || state === "parsing";
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function withParseTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(
        new ParseMenuError(
          "parse_timeout",
          "Menu parsing took too long. Please retry or upload a clearer image.",
        ),
      );
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function getParseTimeoutMs(): number {
  const params = new URLSearchParams(window.location.search);
  const timeoutMs = Number(params.get("parseTimeoutMs"));

  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : defaultParseTimeoutMs;
}

function logParseError(error: ParseMenuError): void {
  console.error(`[menu-parse:${error.code}] ${error.userMessage}`, error.cause ?? error);
}
