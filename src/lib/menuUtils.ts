import type { Cart, CartItem, Menu, MenuItem, OrderSummary } from "../types/menu";

export function flattenMenuItems(menu: Menu): MenuItem[] {
  return menu.categories.flatMap((category) => category.items);
}

export function getMenuItemById(menu: Menu, itemId: string): MenuItem | undefined {
  return flattenMenuItems(menu).find((item) => item.item_id === itemId);
}

export function createCartItemFromMenuItem(item: MenuItem, quantity = 1): CartItem {
  const unitPrice = item.price.amount;

  return {
    item_id: item.item_id,
    name_en: item.name_en,
    name_zh: item.name_zh,
    unit_price: unitPrice,
    quantity,
    subtotal: unitPrice === null ? null : roundCurrency(unitPrice * quantity),
  };
}

export function calculateCartTotal(cartItems: CartItem[]): Cart["total"] {
  const subtotal = roundCurrency(
    cartItems.reduce((sum, item) => sum + (item.subtotal ?? 0), 0),
  );

  return {
    subtotal,
    tax: null,
    tip: null,
    estimated_total: subtotal,
    currency: "USD",
  };
}

export function generateOrderSummary(cart: Cart, restaurantName: string): OrderSummary {
  const items = cart.items.map((item) => ({
    name_en: item.name_en,
    name_zh: item.name_zh,
    quantity: item.quantity,
    ...(item.notes ? { notes: item.notes } : {}),
    subtotal: item.subtotal,
  }));

  return {
    order_summary_id: `summary_${cart.cart_id}`,
    restaurant_name: restaurantName,
    items,
    estimated_total: cart.total.estimated_total,
    currency: cart.total.currency,
    display_text: buildDisplayText(items, cart.total.estimated_total, cart.total.currency),
  };
}

function buildDisplayText(
  items: OrderSummary["items"],
  estimatedTotal: number,
  currency: string,
): string {
  const zhItemText = items
    .map((item) => {
      const noteText = item.notes ? `，备注：${item.notes}` : "";
      return `${item.quantity}份${item.name_zh}${noteText}`;
    })
    .join("；");
  const enItemText = items
    .map((item) => {
      const noteText = item.notes ? `, note: ${item.notes}` : "";
      return `${item.quantity} x ${item.name_en}${noteText}`;
    })
    .join("; ");

  return `中文：我要${zhItemText}。预估总计：${formatCurrency(estimatedTotal, currency)}。\nEnglish: ${enItemText}. Estimated total: ${formatCurrency(estimatedTotal, currency)}.`;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
