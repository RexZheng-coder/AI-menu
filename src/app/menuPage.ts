import { renderMenuCategory } from "../components/MenuCategory.js";
import { renderCartPanel } from "../components/CartPanel.js";
import type { SummaryLanguageMode } from "../components/CartPanel.js";
import { renderHistoryPanel } from "../components/HistoryPanel.js";
import { renderUploadPanel } from "../components/UploadPanel.js";
import {
  calculateCartTotal,
  createCartItemFromMenuItem,
  generateOrderSummary,
} from "../lib/menuUtils.js";
import { getMenuItemCount } from "../lib/menuValidation.js";
import {
  clearSavedMenus,
  getSavedMenuById,
  getSavedMenus,
  loadCartFromStorage,
  removeSavedMenu,
  saveCartToStorage,
  saveMenuToHistory,
  type SavedMenuRecord,
} from "../lib/menuHistory.js";
import { ParseMenuError, toParseMenuError } from "../lib/parseMenuErrors.js";
import {
  getLastClientParseMetadata,
  parseMenuImages,
  type ClientParseMetadata,
} from "../lib/parseMenuImages.js";
import { inferCurrencyFromPriceText, parsePriceAmount } from "../lib/priceUtils.js";
import { normalizeAllergens } from "../lib/allergenUtils.js";
import {
  maxConcurrentParseBatches,
  maxUploadBatchBytes,
  menuImageBatchSize,
} from "../lib/menuUploadConfig.js";
import { maxOriginalImageSizeBytes, parsePerBatchWaveMs } from "../lib/menuConfig.js";
import {
  prepareMenuImages,
  revokePreparedMenuImages,
  type PreparedMenuImage,
} from "../lib/clientImageCompression.js";
import { mockMenu } from "../mock/menuMock.js";
import type { Cart, CartItem, Menu, MenuItem, OrderSummary, SpicyLevel } from "../types/menu.js";

const appRoot = document.querySelector<HTMLElement>("#app");

if (!appRoot) {
  throw new Error("App root element was not found.");
}

const appRootElement = appRoot;
const cartId = "cart_lantern_house_001";
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const acceptedImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];

type OriginalImagePreview = {
  file: File;
  previewUrl: string;
};

type ParseState = "idle" | "validating_files" | "uploading" | "parsing" | "success" | "error";

let currentMenu: Menu | null = null;
let uploadFiles: PreparedMenuImage[] = [];
let uploadError: ParseMenuError | null = null;
let parseState: ParseState = "idle";
let savedMenus: SavedMenuRecord[] = getSavedMenus();
let cartItems: CartItem[] = [];
let orderSummary: OrderSummary | null = null;
let cartPanelRoot: HTMLElement | null = null;
let isCartOpen = false;
let parseQuality: ClientParseMetadata | null = null;
let currentOriginalImages: OriginalImagePreview[] = [];
let isOriginalImageOpen = false;
let editingItemId: string | null = null;
let editingCategoryId: string | null = null;
let isAddingItem = false;
let summaryLanguage: SummaryLanguageMode = "bilingual";
let copyStatus: string | null = null;
let disposeMenuNavigation: (() => void) | null = null;

renderApp(appRootElement);

function renderApp(root: HTMLElement): void {
  disposeMenuNavigation?.();
  disposeMenuNavigation = null;
  root.replaceChildren(renderUpload());
  cartPanelRoot = null;

  if (currentMenu) {
    root.append(renderMenuPage(currentMenu));
    renderCart();
  } else {
    root.append(renderHistory());
  }
}

function renderHistory(): HTMLElement {
  return renderHistoryPanel({
    savedMenus,
    onLoadMenu: loadSavedMenu,
    onRemoveMenu: deleteSavedMenu,
    onClearMenus: clearMenuHistory,
  });
}

function renderUpload(): HTMLElement {
  return renderUploadPanel({
    files: uploadFiles,
    error: uploadError?.userMessage ?? null,
    parseState,
    hasMenu: currentMenu !== null,
    isRealMode: isRealParseMode(),
    batchSize: menuImageBatchSize,
    maxConcurrentBatches: maxConcurrentParseBatches,
    onFilesSelected: selectUploadFiles,
    onRemoveFile: removeUploadFile,
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
  menuColumn.append(
    renderHeader(menu),
    renderQualityAndSourcePanel(menu),
    renderMenuBrowser(menu),
  );

  cartPanelRoot = document.createElement("div");
  cartPanelRoot.className = "cart-column";

  shell.append(menuColumn, cartPanelRoot);

  window.requestAnimationFrame(() => {
    disposeMenuNavigation = initializeMenuNavigation(shell, menu);
  });

  if (editingItemId || isAddingItem) {
    shell.append(renderEditDialog(menu));
  }

  if (isOriginalImageOpen) {
    shell.append(renderOriginalImageDialog());
  }

  return shell;
}

function renderHeader(menu: Menu): HTMLElement {
  const header = document.createElement("header");
  header.className = "menu-header";

  const eyebrow = document.createElement("p");
  eyebrow.className = "menu-header__eyebrow";
  eyebrow.textContent = menu.restaurant.cuisine_type ?? "Restaurant menu";

  const titleRow = document.createElement("div");
  titleRow.className = "menu-header__title-row";

  const title = document.createElement("h1");
  title.className = "menu-header__title";
  title.textContent = menu.restaurant.name;

  const backButton = document.createElement("button");
  backButton.className = "menu-header__back-button";
  backButton.type = "button";
  backButton.textContent = "Back to menus";
  backButton.addEventListener("click", () => {
    currentMenu = null;
    cartItems = [];
    orderSummary = null;
    isCartOpen = false;
    editingItemId = null;
    editingCategoryId = null;
    isAddingItem = false;
    renderApp(appRootElement);
  });

  titleRow.append(title, backButton);

  const meta = document.createElement("p");
  meta.className = "menu-header__meta";
  meta.textContent = menu.restaurant.address ?? `${menu.language.source.toUpperCase()} to ${menu.language.target.toUpperCase()}`;

  const stats = document.createElement("div");
  stats.className = "menu-header__stats";
  stats.append(
    renderStat(`${menu.categories.length}`, menu.categories.length === 1 ? "category" : "categories"),
    renderStat(`${getMenuItemCount(menu)}`, "items"),
    renderStat(menu.metadata.source_type === "image_upload" ? "AI parsed" : "Demo menu", "source"),
  );

  header.append(eyebrow, titleRow, meta, stats);
  return header;
}

function renderQualityAndSourcePanel(menu: Menu): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "quality-panel";
  panel.setAttribute("aria-label", "AI parsing quality");

  const copy = document.createElement("div");
  copy.className = "quality-panel__copy";

  const metadata = parseQuality ?? {
    item_count: getMenuItemCount(menu),
    category_count: menu.categories.length,
    parse_detail: menu.metadata.source_type === "mock" ? "mock" : "accurate",
    provider: menu.metadata.source_type === "mock" ? "mock" : "mimo",
    recovered_from_truncation: false,
    retry_used: false,
    dense_fallback_used: false,
    duration_ms: null,
  };

  const title = document.createElement("p");
  title.className = "quality-panel__title";
  title.textContent = `AI parsed ${metadata.item_count} items across ${metadata.category_count} categories.`;

  const detail = document.createElement("p");
  detail.className = "quality-panel__detail";
  const durationText = metadata.duration_ms ? ` · ${(metadata.duration_ms / 1000).toFixed(1)}s` : "";
  detail.textContent = `${metadata.provider} · ${metadata.parse_detail}${durationText}. Please double-check the original menu before ordering.`;

  const safetyNote = document.createElement("p");
  safetyNote.className = "quality-panel__safety";
  safetyNote.textContent = "辣度与过敏原为 AI 提示，请向餐厅确认。";

  copy.append(title, detail, safetyNote);

  if (metadata.recovered_from_truncation || metadata.retry_used) {
    const warning = document.createElement("p");
    warning.className = "quality-panel__warning";
    warning.textContent = "Some items may be missing or inaccurate. Try uploading a clearer or cropped image if anything looks off.";
    copy.append(warning);
  }

  if (metadata.dense_fallback_used) {
    const denseNote = document.createElement("p");
    denseNote.className = "quality-panel__warning";
    denseNote.textContent = "Dense menu detected. Parsed core item information only.";
    copy.append(denseNote);
  }

  const compareButton = document.createElement("button");
  compareButton.className = "compare-image-button";
  compareButton.type = "button";
  compareButton.textContent = "Compare with original";
  compareButton.addEventListener("click", () => {
    isOriginalImageOpen = true;
    renderApp(appRootElement);
  });

  panel.append(copy, compareButton);
  return panel;
}

function renderStat(value: string, label: string): HTMLElement {
  const stat = document.createElement("span");
  stat.className = "menu-header__stat";

  const valueElement = document.createElement("strong");
  valueElement.textContent = value;

  const labelElement = document.createElement("span");
  labelElement.textContent = label;

  stat.append(valueElement, labelElement);
  return stat;
}

function renderMenuBrowser(menu: Menu): HTMLElement {
  const browser = document.createElement("div");
  browser.className = "menu-browser";
  browser.append(renderCategoryNav(menu), renderCategoryList(menu));
  return browser;
}

function renderCategoryNav(menu: Menu): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "category-nav";
  nav.setAttribute("aria-label", "Menu categories");

  for (const [index, category] of menu.categories.entries()) {
    const button = document.createElement("button");
    button.className = `category-nav__link${index === 0 ? " category-nav__link--active" : ""}`;
    button.type = "button";
    button.dataset.categoryId = category.category_id;
    button.setAttribute("aria-current", index === 0 ? "true" : "false");

    const nameZh = document.createElement("span");
    nameZh.className = "category-nav__name-zh";
    nameZh.textContent = category.name_zh || category.name_en;

    const nameEn = document.createElement("span");
    nameEn.className = "category-nav__name-en";
    nameEn.textContent = category.name_en;

    const itemCount = document.createElement("span");
    itemCount.className = "category-nav__count";
    itemCount.textContent = String(category.items.length);

    button.append(nameZh, nameEn, itemCount);
    nav.append(button);
  }

  return nav;
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
    container.append(
      renderMenuCategory(category, {
        onAddToCart: addToCart,
        onDecreaseCartItem: decreaseCartItem,
        getCartQuantity,
        onEditItem: startEditingItem,
        onDeleteItem: deleteMenuItem,
        onAddItem: startAddingItem,
      }),
    );
  }

  return container;
}

function initializeMenuNavigation(shell: HTMLElement, menu: Menu): () => void {
  const navButtons = Array.from(shell.querySelectorAll<HTMLButtonElement>(".category-nav__link"));
  const sections = Array.from(shell.querySelectorAll<HTMLElement>(".category-section"));
  const menuPage = shell.querySelector<HTMLElement>(".menu-page");
  const itemCards = Array.from(shell.querySelectorAll<HTMLElement>(".item-card"));

  if (navButtons.length === 0 || sections.length === 0 || !menuPage) {
    return () => undefined;
  }

  let activeCategoryId = menu.categories[0]?.category_id ?? "";
  let scrollFrame = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let revealObserver: IntersectionObserver | null = null;

  const setActiveCategory = (categoryId: string): void => {
    if (!categoryId || activeCategoryId === categoryId) {
      return;
    }

    activeCategoryId = categoryId;

    for (const button of navButtons) {
      const isActive = button.dataset.categoryId === categoryId;
      button.classList.toggle("category-nav__link--active", isActive);
      button.setAttribute("aria-current", String(isActive));

      if (isActive) {
        button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }
  };

  const scrollToCategory = (categoryId: string): void => {
    const section = sections.find((candidate) => candidate.dataset.categoryId === categoryId);

    if (!section) {
      return;
    }

    setActiveCategory(categoryId);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const updateActiveCategory = (): void => {
    scrollFrame = 0;
    const activationLine = Math.min(window.innerHeight * 0.45, 320);
    let closestSection = sections[0];

    for (const section of sections) {
      if (section.getBoundingClientRect().top <= activationLine) {
        closestSection = section;
      } else {
        break;
      }
    }

    setActiveCategory(closestSection.dataset.categoryId ?? "");
  };

  const onScroll = (): void => {
    if (scrollFrame === 0) {
      scrollFrame = window.requestAnimationFrame(updateActiveCategory);
    }
  };

  const onTouchStart = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  };

  const onTouchEnd = (event: TouchEvent): void => {
    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    if (Math.abs(deltaX) < 72 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.35) {
      return;
    }

    const currentIndex = menu.categories.findIndex((category) => category.category_id === activeCategoryId);
    const nextIndex = Math.max(
      0,
      Math.min(menu.categories.length - 1, currentIndex + (deltaX < 0 ? 1 : -1)),
    );
    const nextCategory = menu.categories[nextIndex];

    if (nextCategory && nextIndex !== currentIndex) {
      scrollToCategory(nextCategory.category_id);
    }
  };

  const buttonHandlers = navButtons.map((button) => {
    const handler = (): void => scrollToCategory(button.dataset.categoryId ?? "");
    button.addEventListener("click", handler);
    return { button, handler };
  });

  window.addEventListener("scroll", onScroll, { passive: true });
  menuPage.addEventListener("touchstart", onTouchStart, { passive: true });
  menuPage.addEventListener("touchend", onTouchEnd, { passive: true });
  shell.classList.add("menu-animations-ready");

  if ("IntersectionObserver" in window) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("item-card--revealed");
            revealObserver?.unobserve(entry.target);
          }
        }
      },
      {
        rootMargin: "0px 0px -6% 0px",
        threshold: 0.08,
      },
    );
    itemCards.forEach((card) => revealObserver?.observe(card));
  } else {
    itemCards.forEach((card) => card.classList.add("item-card--revealed"));
  }

  updateActiveCategory();

  return () => {
    window.removeEventListener("scroll", onScroll);
    menuPage.removeEventListener("touchstart", onTouchStart);
    menuPage.removeEventListener("touchend", onTouchEnd);
    buttonHandlers.forEach(({ button, handler }) => button.removeEventListener("click", handler));
    revealObserver?.disconnect();

    if (scrollFrame !== 0) {
      window.cancelAnimationFrame(scrollFrame);
    }
  };
}

function renderOriginalImageDialog(): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Original menu images");

  const dialog = document.createElement("div");
  dialog.className = "image-dialog";

  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("h2");
  title.textContent = "Original menu image";

  const closeButton = document.createElement("button");
  closeButton.className = "modal-close-button";
  closeButton.type = "button";
  closeButton.textContent = "Close";
  closeButton.addEventListener("click", () => {
    isOriginalImageOpen = false;
    renderApp(appRootElement);
  });

  header.append(title, closeButton);
  dialog.append(header);

  if (currentOriginalImages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "image-dialog__empty";
    empty.textContent = "Original image is only available for the current upload session.";
    dialog.append(empty);
  } else {
    const gallery = document.createElement("div");
    gallery.className = "image-dialog__gallery";

    for (const imagePreview of currentOriginalImages) {
      const figure = document.createElement("figure");
      figure.className = "image-dialog__figure";

      const image = document.createElement("img");
      image.src = imagePreview.previewUrl;
      image.alt = imagePreview.file.name;

      const caption = document.createElement("figcaption");
      caption.textContent = imagePreview.file.name;

      figure.append(image, caption);
      gallery.append(figure);
    }

    dialog.append(gallery);
  }

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      isOriginalImageOpen = false;
      renderApp(appRootElement);
    }
  });
  overlay.append(dialog);
  return overlay;
}

function renderEditDialog(menu: Menu): HTMLElement {
  const editingItem = editingItemId ? findMenuItem(menu, editingItemId)?.item : null;
  const categoryId = editingItem ? findCategoryIdForItem(menu, editingItem.item_id) : editingCategoryId;

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", isAddingItem ? "Add menu item" : "Edit menu item");

  const dialog = document.createElement("form");
  dialog.className = "edit-dialog";
  dialog.addEventListener("submit", (event) => {
    event.preventDefault();
    saveEditedItem(new FormData(dialog));
  });

  const header = document.createElement("div");
  header.className = "modal-header";

  const title = document.createElement("h2");
  title.textContent = isAddingItem ? "Add missing item" : "Edit parsed item";

  const closeButton = document.createElement("button");
  closeButton.className = "modal-close-button";
  closeButton.type = "button";
  closeButton.textContent = "Cancel";
  closeButton.addEventListener("click", closeEditDialog);

  header.append(title, closeButton);

  const categoryInput = document.createElement("input");
  categoryInput.type = "hidden";
  categoryInput.name = "category_id";
  categoryInput.value = categoryId ?? "";

  dialog.append(
    header,
    categoryInput,
    renderEditField("English name", "name_en", editingItem?.name_en ?? ""),
    renderEditField("Chinese name", "name_zh", editingItem?.name_zh ?? ""),
    renderEditField("Price text", "price_raw", editingItem?.price.raw ?? ""),
    renderEditField("English description", "description_en", editingItem?.description_en ?? ""),
    renderEditField("Chinese description", "description_zh", editingItem?.description_zh ?? ""),
    renderSpicyLevelField(editingItem?.spicy_level ?? 0),
    renderEditField(
      "Allergens (comma separated)",
      "allergens",
      (editingItem?.allergens ?? []).join(", "),
      "e.g. dairy, egg, gluten, shellfish",
    ),
    renderEditActions(),
  );

  overlay.append(dialog);
  return overlay;
}

function renderEditField(labelText: string, name: string, value: string, placeholder = ""): HTMLElement {
  const label = document.createElement("label");
  label.className = "edit-field";

  const span = document.createElement("span");
  span.textContent = labelText;

  const input = document.createElement("input");
  input.name = name;
  input.value = value;
  input.placeholder = placeholder;
  input.required = name === "name_en" || name === "name_zh";

  label.append(span, input);
  return label;
}

function renderSpicyLevelField(value: SpicyLevel): HTMLElement {
  const label = document.createElement("label");
  label.className = "edit-field";

  const span = document.createElement("span");
  span.textContent = "Spice level";

  const select = document.createElement("select");
  select.name = "spicy_level";

  for (let level = 0; level <= 5; level += 1) {
    const option = document.createElement("option");
    option.value = String(level);
    option.textContent = level === 0 ? "None / unknown" : `${"🌶️".repeat(level)} (${level}/5)`;
    option.selected = level === value;
    select.append(option);
  }

  label.append(span, select);
  return label;
}

function renderEditActions(): HTMLElement {
  const actions = document.createElement("div");
  actions.className = "edit-actions";

  const saveButton = document.createElement("button");
  saveButton.className = "edit-save-button";
  saveButton.type = "submit";
  saveButton.textContent = "Save";

  const cancelButton = document.createElement("button");
  cancelButton.className = "edit-cancel-button";
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("click", closeEditDialog);

  actions.append(saveButton, cancelButton);
  return actions;
}

function renderEmptyState(message: string): HTMLElement {
  const emptyState = document.createElement("p");
  emptyState.className = "empty-state";
  emptyState.textContent = message;
  return emptyState;
}

async function selectUploadFiles(files: File[]): Promise<void> {
  parseState = "validating_files";
  uploadError = null;
  renderApp(appRootElement);

  const newFiles = getUniqueNewFiles(
    uploadFiles.map((image) => image.originalFile),
    files,
  );

  if (newFiles.length === 0) {
    parseState = "idle";
    renderApp(appRootElement);
    return;
  }

  const validation = validateUploadFiles(newFiles);

  if (validation.error || validation.validFiles.length === 0) {
    uploadError = validation.error;
    parseState = "error";
    renderApp(appRootElement);
    return;
  }

  try {
    const preparedImages = await prepareMenuImages(validation.validFiles, {
      batchSize: menuImageBatchSize,
      maxBatchBytes: maxUploadBatchBytes,
    });
    uploadFiles = [...uploadFiles, ...preparedImages];
    uploadError = null;
    parseState = "idle";
  } catch (error) {
    uploadError = new ParseMenuError(
      "file_too_large",
      error instanceof Error
        ? error.message
        : "The selected images could not be optimized for upload.",
      { cause: error },
    );
    parseState = "error";
  } finally {
    renderApp(appRootElement);
  }
}

function removeUploadFile(index: number): void {
  const removedImage = uploadFiles[index];

  if (!removedImage) {
    return;
  }

  URL.revokeObjectURL(removedImage.previewUrl);
  uploadFiles = uploadFiles.filter((_, imageIndex) => imageIndex !== index);
  uploadError = null;
  parseState = "idle";
  renderApp(appRootElement);
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
    const parsedMenu = await withParseTimeout(
      parseMenuImages(uploadFiles.map((filePreview) => filePreview.uploadFile)),
      getParseTimeoutMs(uploadFiles.length),
    );
    setCurrentMenu(parsedMenu, {
      quality: getLastClientParseMetadata(),
      originalImages: cloneUploadPreviews(uploadFiles),
    });
    savedMenus = saveMenuToHistory(parsedMenu);
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
  setCurrentMenu(mockMenu, {
    quality: createMockQuality(mockMenu),
    originalImages: [],
  });
  renderApp(appRootElement);
}

function loadSavedMenu(menuId: string): void {
  const savedMenu = getSavedMenuById(menuId);

  if (!savedMenu) {
    savedMenus = getSavedMenus();
    renderApp(appRootElement);
    return;
  }

  uploadError = null;
  parseState = "success";
  setCurrentMenu(savedMenu.menu, {
    quality: createMockQuality(savedMenu.menu),
    originalImages: [],
  });
  renderApp(appRootElement);
}

function deleteSavedMenu(menuId: string): void {
  savedMenus = removeSavedMenu(menuId);
  renderApp(appRootElement);
}

function clearMenuHistory(): void {
  clearSavedMenus();
  savedMenus = [];
  renderApp(appRootElement);
}

function startEditingItem(item: MenuItem): void {
  editingItemId = item.item_id;
  editingCategoryId = findCategoryIdForItem(currentMenu, item.item_id);
  isAddingItem = false;
  renderApp(appRootElement);
}

function startAddingItem(categoryId: string): void {
  editingItemId = null;
  editingCategoryId = categoryId;
  isAddingItem = true;
  renderApp(appRootElement);
}

function closeEditDialog(): void {
  editingItemId = null;
  editingCategoryId = null;
  isAddingItem = false;
  renderApp(appRootElement);
}

function saveEditedItem(formData: FormData): void {
  if (!currentMenu) {
    return;
  }

  const categoryId = readFormString(formData, "category_id");
  const nameEn = readFormString(formData, "name_en");
  const nameZh = readFormString(formData, "name_zh");

  if (!categoryId || !nameEn || !nameZh) {
    return;
  }

  const priceRaw = readOptionalFormString(formData, "price_raw");
  const item: MenuItem = {
    item_id: editingItemId ?? createItemId(categoryId, nameEn),
    name_en: nameEn,
    name_zh: nameZh,
    description_en: readOptionalFormString(formData, "description_en"),
    description_zh: readOptionalFormString(formData, "description_zh"),
    price: {
      amount: parsePriceAmount(priceRaw),
      currency: inferCurrencyFromPriceText(priceRaw, findMenuItem(currentMenu, editingItemId ?? "")?.item.price.currency ?? inferMenuCurrency(currentMenu)),
      raw: priceRaw,
    },
    tags: editingItemId ? findMenuItem(currentMenu, editingItemId)?.item.tags ?? [] : [],
    tags_zh: editingItemId ? findMenuItem(currentMenu, editingItemId)?.item.tags_zh ?? [] : [],
    spicy_level: readSpicyLevel(formData),
    allergens: normalizeAllergens(
      readFormString(formData, "allergens")
        .split(/[,，]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
    is_recommended: editingItemId ? findMenuItem(currentMenu, editingItemId)?.item.is_recommended : false,
    confidence: editingItemId ? findMenuItem(currentMenu, editingItemId)?.item.confidence ?? 1 : 1,
  };

  currentMenu = {
    ...currentMenu,
    categories: currentMenu.categories.map((category) => {
      if (category.category_id !== categoryId) {
        return category;
      }

      return {
        ...category,
        items: editingItemId
          ? category.items.map((existingItem) => (existingItem.item_id === editingItemId ? item : existingItem))
          : [...category.items, item],
      };
    }),
  };
  updateParseQualityCounts(currentMenu);
  syncCartItem(item);
  orderSummary = null;
  persistCart();
  savedMenus = saveMenuToHistory(currentMenu);
  closeEditDialog();
}

function deleteMenuItem(itemId: string): void {
  if (!currentMenu || !window.confirm("Delete this parsed item?")) {
    return;
  }

  currentMenu = {
    ...currentMenu,
    categories: currentMenu.categories.map((category) => ({
      ...category,
      items: category.items.filter((item) => item.item_id !== itemId),
    })),
  };
  cartItems = cartItems.filter((item) => item.item_id !== itemId);
  updateParseQualityCounts(currentMenu);
  orderSummary = null;
  persistCart();
  savedMenus = saveMenuToHistory(currentMenu);
  renderApp(appRootElement);
}

function syncCartItem(item: MenuItem): void {
  cartItems = cartItems.map((cartItem) => {
    if (cartItem.item_id !== item.item_id) {
      return cartItem;
    }

    return updateCartItemQuantity(
      {
        ...cartItem,
        name_en: item.name_en,
        name_zh: item.name_zh,
        unit_price: item.price.amount,
      },
      cartItem.quantity,
    );
  });
}

function setCurrentMenu(
  menu: Menu,
  options: {
    quality?: ClientParseMetadata | null;
    originalImages?: OriginalImagePreview[];
  } = {},
): void {
  revokeOriginalPreviews();
  currentMenu = menu;
  cartItems = loadCartFromStorage(menu.menu_id) ?? [];
  orderSummary = null;
  isCartOpen = false;
  parseQuality = options.quality ?? null;
  currentOriginalImages = options.originalImages ?? [];
  isOriginalImageOpen = false;
  editingItemId = null;
  editingCategoryId = null;
  isAddingItem = false;
  summaryLanguage = "bilingual";
  copyStatus = null;
}

function replaceUploadFiles(files: PreparedMenuImage[]): void {
  revokeUploadPreviews();
  uploadFiles = files;
}

function revokeUploadPreviews(): void {
  revokePreparedMenuImages(uploadFiles);
}

function validateUploadFiles(files: File[]): { validFiles: File[]; error: ParseMenuError | null } {
  if (files.length === 0) {
    return {
      validFiles: [],
      error: new ParseMenuError("no_files", "Please choose at least one menu image before scanning."),
    };
  }

  const invalidFiles = files.filter((file) => !isAcceptedImageFile(file));
  const oversizedFiles = files.filter((file) => file.size > maxOriginalImageSizeBytes);
  const validFiles = files.filter(
    (file) => isAcceptedImageFile(file) && file.size <= maxOriginalImageSizeBytes,
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
        `Each original image must be 25MB or smaller. Rejected: ${formatFileNames(oversizedFiles)}.`,
      ),
    };
  }

  return {
    validFiles,
    error: null,
  };
}

function getUniqueNewFiles(existingFiles: File[], newFiles: File[]): File[] {
  const existingFingerprints = new Set(existingFiles.map(createFileFingerprint));
  const newFilesByFingerprint = new Map<string, File>();

  for (const file of newFiles) {
    const fingerprint = createFileFingerprint(file);

    if (!existingFingerprints.has(fingerprint)) {
      newFilesByFingerprint.set(fingerprint, file);
    }
  }

  return Array.from(newFilesByFingerprint.values());
}

function createFileFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
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
  persistCart();
  renderCart();
}

function getCartQuantity(itemId: string): number {
  return cartItems.find((item) => item.item_id === itemId)?.quantity ?? 0;
}

function increaseCartItem(itemId: string): void {
  cartItems = cartItems.map((item) =>
    item.item_id === itemId ? updateCartItemQuantity(item, item.quantity + 1) : item,
  );
  orderSummary = null;
  persistCart();
  renderCart();
}

function decreaseCartItem(itemId: string): void {
  cartItems = cartItems
    .map((item) => (item.item_id === itemId ? updateCartItemQuantity(item, item.quantity - 1) : item))
    .filter((item) => item.quantity > 0);
  orderSummary = null;
  persistCart();
  renderCart();
}

function removeCartItem(itemId: string): void {
  cartItems = cartItems.filter((item) => item.item_id !== itemId);
  orderSummary = null;
  persistCart();
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
  persistCart();
  window.setTimeout(renderCart, 0);
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

  const cart = createCart();
  cartPanelRoot.className = `cart-column${isCartOpen ? " cart-column--open" : ""}`;
  cartPanelRoot.replaceChildren(
    renderMobileCartToggle(cart),
    renderCartPanel({
      cart,
      orderSummary,
      summaryLanguage,
      copyStatus,
      onIncrease: increaseCartItem,
      onDecrease: decreaseCartItem,
      onRemove: removeCartItem,
      onNoteChange: updateCartItemNotes,
      onGenerateSummary: createOrderSummary,
      onSummaryLanguageChange: changeSummaryLanguage,
      onCopySummary: copySummaryText,
    }),
  );
  syncMenuCardQuantities();
}

function syncMenuCardQuantities(): void {
  for (const control of appRootElement.querySelectorAll<HTMLElement>(".item-order-control")) {
    control.dispatchEvent(new Event("cart-sync"));
  }
}

function changeSummaryLanguage(mode: SummaryLanguageMode): void {
  summaryLanguage = mode;
  copyStatus = null;
  renderCart();
}

async function copySummaryText(text: string): Promise<void> {
  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard API is not available.");
    }

    await navigator.clipboard.writeText(text);
    copyStatus = "Copied";
  } catch {
    copyStatus = "Copy failed";
  }

  renderCart();
  window.setTimeout(() => {
    copyStatus = null;
    renderCart();
  }, 1800);
}

function renderMobileCartToggle(cart: Cart): HTMLElement {
  const button = document.createElement("button");
  button.className = "mobile-cart-toggle";
  button.type = "button";
  button.setAttribute("aria-expanded", String(isCartOpen));
  button.setAttribute("aria-controls", "cart-panel");
  button.addEventListener("click", () => {
    isCartOpen = !isCartOpen;
    renderCart();
  });

  const count = document.createElement("span");
  count.className = "mobile-cart-toggle__count";
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  count.textContent = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;

  const label = document.createElement("span");
  label.className = "mobile-cart-toggle__label";
  label.textContent = isCartOpen ? "Hide cart" : "View cart";

  const total = document.createElement("strong");
  total.className = "mobile-cart-toggle__total";
  total.textContent = formatCartTotal(cart);

  button.append(count, label, total);
  return button;
}

function formatCartTotal(cart: Cart): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: cart.total.currency,
  }).format(cart.total.estimated_total);
}

function createCart(): Cart {
  if (!currentMenu) {
    throw new Error("Cannot create a cart before a menu has been parsed.");
  }

  return {
    cart_id: cartId,
    menu_id: currentMenu.menu_id,
    items: cartItems,
    total: calculateCartTotal(cartItems, inferMenuCurrency(currentMenu)),
  };
}

function inferMenuCurrency(menu: Menu): string {
  for (const category of menu.categories) {
    for (const item of category.items) {
      if (item.price.currency) {
        return item.price.currency;
      }
    }
  }

  return "USD";
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

function getParseTimeoutMs(imageCount: number): number {
  const params = new URLSearchParams(window.location.search);
  const timeoutMs = Number(params.get("parseTimeoutMs"));

  if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return timeoutMs;
  }

  const batchCount = Math.max(1, Math.ceil(imageCount / menuImageBatchSize));
  const batchWaves = Math.ceil(batchCount / maxConcurrentParseBatches);
  return batchWaves * parsePerBatchWaveMs;
}

function isRealParseMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("parse") !== "mock";
}

function logParseError(error: ParseMenuError): void {
  console.error(`[menu-parse:${error.code}] ${error.userMessage}`, error.cause ?? error);
}

function cloneUploadPreviews(files: PreparedMenuImage[]): OriginalImagePreview[] {
  return files.map((filePreview) => ({
    file: filePreview.originalFile,
    previewUrl: URL.createObjectURL(filePreview.originalFile),
  }));
}

function revokeOriginalPreviews(): void {
  for (const filePreview of currentOriginalImages) {
    URL.revokeObjectURL(filePreview.previewUrl);
  }
}

function createMockQuality(menu: Menu): ClientParseMetadata {
  return {
    item_count: getMenuItemCount(menu),
    category_count: menu.categories.length,
    parse_detail: menu.metadata.source_type === "mock" ? "mock" : "saved",
    provider: menu.metadata.source_type === "mock" ? "mock" : "local",
    recovered_from_truncation: false,
    retry_used: false,
    dense_fallback_used: false,
    duration_ms: null,
  };
}

function updateParseQualityCounts(menu: Menu): void {
  if (!parseQuality) {
    return;
  }

  parseQuality = {
    ...parseQuality,
    item_count: getMenuItemCount(menu),
    category_count: menu.categories.length,
  };
}

function findMenuItem(menu: Menu | null, itemId: string): { categoryIndex: number; item: MenuItem } | null {
  if (!menu) {
    return null;
  }

  for (let categoryIndex = 0; categoryIndex < menu.categories.length; categoryIndex += 1) {
    const item = menu.categories[categoryIndex].items.find((menuItem) => menuItem.item_id === itemId);

    if (item) {
      return { categoryIndex, item };
    }
  }

  return null;
}

function findCategoryIdForItem(menu: Menu | null, itemId: string): string | null {
  if (!menu) {
    return null;
  }

  return menu.categories.find((category) =>
    category.items.some((item) => item.item_id === itemId),
  )?.category_id ?? null;
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalFormString(formData: FormData, name: string): string | null {
  const value = readFormString(formData, name);
  return value.length > 0 ? value : null;
}

function readSpicyLevel(formData: FormData): SpicyLevel {
  const value = Number(readFormString(formData, "spicy_level"));
  return Math.max(0, Math.min(5, Number.isFinite(value) ? Math.round(value) : 0)) as SpicyLevel;
}

function createItemId(categoryId: string, nameEn: string): string {
  return `${categoryId}_item_${slugify(nameEn)}_${Date.now().toString(36)}`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return slug || "item";
}

function persistCart(): void {
  if (currentMenu) {
    saveCartToStorage(currentMenu.menu_id, cartItems);
  }
}
