import type { Cart, CartItem, OrderSummary } from "../types/menu.js";

export type SummaryLanguageMode = "bilingual" | "english" | "chinese";

type CartPanelProps = {
  cart: Cart;
  orderSummary: OrderSummary | null;
  summaryLanguage: SummaryLanguageMode;
  copyStatus: string | null;
  onIncrease: (itemId: string) => void;
  onDecrease: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onNoteChange: (itemId: string, notes: string) => void;
  onGenerateSummary: () => void;
  onSummaryLanguageChange: (mode: SummaryLanguageMode) => void;
  onCopySummary: (text: string) => void;
};

export function renderCartPanel(props: CartPanelProps): HTMLElement {
  const panel = document.createElement("aside");
  panel.id = "cart-panel";
  panel.className = "cart-panel";
  panel.setAttribute("aria-label", "Cart and order summary");

  const header = document.createElement("div");
  header.className = "cart-panel__header";

  const title = document.createElement("h2");
  title.className = "cart-panel__title";
  title.textContent = "Cart";

  const count = document.createElement("span");
  count.className = "cart-panel__count";
  count.textContent = `${getItemCount(props.cart.items)} items`;

  header.append(title, count);
  panel.append(header);

  if (props.cart.items.length === 0) {
    panel.append(renderEmptyCart());
    return panel;
  }

  const list = document.createElement("div");
  list.className = "cart-list";

  for (const item of props.cart.items) {
    list.append(renderCartItem(item, props));
  }

  panel.append(list, renderCartTotal(props.cart), renderSummaryActions(props), renderSummary(props));
  return panel;
}

function renderCartItem(item: CartItem, props: CartPanelProps): HTMLElement {
  const row = document.createElement("article");
  row.className = "cart-item";

  const header = document.createElement("div");
  header.className = "cart-item__header";

  const names = document.createElement("div");
  names.className = "cart-item__names";

  const nameZh = document.createElement("h3");
  nameZh.className = "cart-item__name-zh";
  nameZh.textContent = item.name_zh;

  const nameEn = document.createElement("p");
  nameEn.className = "cart-item__name-en";
  nameEn.textContent = item.name_en;

  names.append(nameZh, nameEn);

  const subtotal = document.createElement("p");
  subtotal.className = "cart-item__subtotal";
  subtotal.textContent = formatNullableCurrency(item.subtotal, "USD");

  header.append(names, subtotal);

  const price = document.createElement("p");
  price.className = "cart-item__price";
  price.textContent = `Unit ${formatNullableCurrency(item.unit_price, "USD")}`;

  const controls = document.createElement("div");
  controls.className = "cart-item__controls";

  controls.append(
    renderQuantityButton("-", `Decrease ${item.name_zh}`, () => props.onDecrease(item.item_id)),
    renderQuantity(item.quantity),
    renderQuantityButton("+", `Increase ${item.name_zh}`, () => props.onIncrease(item.item_id)),
    renderRemoveButton(item, props.onRemove),
  );

  const noteLabel = document.createElement("label");
  noteLabel.className = "cart-item__note-label";
  noteLabel.textContent = "Notes";

  const noteInput = document.createElement("input");
  noteInput.className = "cart-item__note-input";
  noteInput.type = "text";
  noteInput.placeholder = "less spicy, no onion, 少辣";
  noteInput.value = item.notes ?? "";
  noteInput.addEventListener("input", () => props.onNoteChange(item.item_id, noteInput.value));
  noteInput.addEventListener("change", () => props.onNoteChange(item.item_id, noteInput.value));

  noteLabel.append(noteInput);
  row.append(header, price, controls, noteLabel);
  return row;
}

function renderQuantityButton(label: string, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "quantity-button";
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", ariaLabel);
  button.addEventListener("click", onClick);
  return button;
}

function renderQuantity(quantity: number): HTMLElement {
  const value = document.createElement("span");
  value.className = "cart-item__quantity";
  value.textContent = String(quantity);
  return value;
}

function renderRemoveButton(item: CartItem, onRemove: (itemId: string) => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "remove-button";
  button.type = "button";
  button.textContent = "Remove";
  button.addEventListener("click", () => onRemove(item.item_id));
  return button;
}

function renderCartTotal(cart: Cart): HTMLElement {
  const footer = document.createElement("div");
  footer.className = "cart-total";

  const label = document.createElement("span");
  label.textContent = "Estimated total";

  const value = document.createElement("strong");
  value.textContent = formatNullableCurrency(cart.total.estimated_total, cart.total.currency);

  footer.append(label, value);
  return footer;
}

function renderSummaryActions(props: CartPanelProps): HTMLElement {
  const actions = document.createElement("div");
  actions.className = "cart-actions";

  const button = document.createElement("button");
  button.className = "summary-button";
  button.type = "button";
  button.textContent = "Generate Order Summary";
  button.addEventListener("click", props.onGenerateSummary);

  actions.append(button);
  return actions;
}

function renderSummary(props: CartPanelProps): HTMLElement {
  const summary = props.orderSummary;
  const section = document.createElement("section");
  section.className = "order-summary";
  section.setAttribute("aria-label", "Order summary");

  if (!summary) {
    const hint = document.createElement("p");
    hint.className = "order-summary__hint";
    hint.textContent = "Generate a bilingual summary when you are ready to order.";
    section.append(hint);
    return section;
  }

  const title = document.createElement("h3");
  title.className = "order-summary__title";
  title.textContent = "Order Summary";

  const toolbar = document.createElement("div");
  toolbar.className = "order-summary__toolbar";

  const languageGroup = document.createElement("div");
  languageGroup.className = "summary-language";
  languageGroup.setAttribute("aria-label", "Order summary language");

  for (const mode of ["bilingual", "english", "chinese"] as const) {
    const button = document.createElement("button");
    button.className = `summary-language__button${props.summaryLanguage === mode ? " summary-language__button--active" : ""}`;
    button.type = "button";
    button.textContent = mode === "bilingual" ? "Bilingual" : mode === "english" ? "English" : "中文";
    button.setAttribute("aria-pressed", String(props.summaryLanguage === mode));
    button.addEventListener("click", () => props.onSummaryLanguageChange(mode));
    languageGroup.append(button);
  }

  const displayedSummary = formatSummaryDisplay(summary, props.summaryLanguage);
  const copyButton = document.createElement("button");
  copyButton.className = "copy-summary-button";
  copyButton.type = "button";
  copyButton.textContent = props.copyStatus ?? "Copy";
  copyButton.addEventListener("click", () => props.onCopySummary(displayedSummary));

  toolbar.append(languageGroup, copyButton);

  const list = document.createElement("ul");
  list.className = "order-summary__items";

  for (const item of summary.items) {
    const listItem = document.createElement("li");
    const notes = item.notes ? ` · ${item.notes}` : "";
    listItem.textContent = `${item.quantity} x ${item.name_zh} / ${item.name_en}${notes} · ${formatNullableCurrency(item.subtotal, summary.currency)}`;
    list.append(listItem);
  }

  const total = document.createElement("p");
  total.className = "order-summary__total";
  total.textContent = `Estimated total: ${formatNullableCurrency(summary.estimated_total, summary.currency)}`;

  const displayText = document.createElement("pre");
  displayText.className = "order-summary__display";
  displayText.textContent = displayedSummary;

  section.append(title, toolbar, list, total, displayText);
  return section;
}

function renderEmptyCart(): HTMLElement {
  const empty = document.createElement("p");
  empty.className = "cart-empty";
  empty.textContent = "Tap + on a dish to start an order.";
  return empty;
}

function getItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

function formatNullableCurrency(amount: number | null, currency: string): string {
  if (amount === null) {
    return "Market price";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatSummaryDisplay(summary: OrderSummary, mode: SummaryLanguageMode): string {
  const zhItemText = summary.items
    .map((item) => {
      const noteText = item.notes ? `，备注：${item.notes}` : "";
      return `${item.quantity}份${item.name_zh}${noteText}`;
    })
    .join("；");
  const enItemText = summary.items
    .map((item) => {
      const noteText = item.notes ? `, note: ${item.notes}` : "";
      return `${item.quantity} x ${item.name_en}${noteText}`;
    })
    .join("; ");
  const total = formatNullableCurrency(summary.estimated_total, summary.currency);

  if (mode === "chinese") {
    return `中文：我要${zhItemText}。预估总计：${total}。`;
  }

  if (mode === "english") {
    return `English: ${enItemText}. Estimated total: ${total}.`;
  }

  return `中文：我要${zhItemText}。预估总计：${total}。\nEnglish: ${enItemText}. Estimated total: ${total}.`;
}
