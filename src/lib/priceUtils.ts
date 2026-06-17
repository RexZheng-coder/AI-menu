import type { Price } from "../types/menu.js";

const currencySymbols: Record<string, string> = {
  AUD: "$",
  CAD: "$",
  CNY: "¥",
  EUR: "€",
  GBP: "£",
  HKD: "$",
  INR: "₹",
  JPY: "¥",
  KRW: "₩",
  MXN: "$",
  NZD: "$",
  SGD: "$",
  USD: "$",
};

const currencyMarkerPattern = /[$£€¥₹₩₺₽฿₫₱₪₦₴₡₲₵₭₮₸₼₾₿]|(?:\b(?:usd|cad|aud|nzd|sgd|hkd|gbp|eur|jpy|cny|rmb|inr|krw|mxn)\b)/i;
const measurementUnitPattern = /^(?:ml|mL|l|L|cl|oz|g|kg|lb|lbs)\b/i;

export function parsePriceAmount(raw: string | null): number | null {
  if (!raw) {
    return null;
  }

  const normalizedText = raw.replace(/,/g, "");

  for (const match of normalizedText.matchAll(/\d+(?:\.\d+)?/g)) {
    const valueText = match[0];
    const endIndex = match.index + valueText.length;
    const followingText = normalizedText.slice(endIndex).trimStart();

    if (measurementUnitPattern.test(followingText)) {
      continue;
    }

    const value = Number(valueText);

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export function inferCurrencyFromPriceText(raw: string | null, fallbackCurrency = "USD"): string {
  if (!raw) {
    return fallbackCurrency;
  }

  const normalizedText = raw.trim().toUpperCase();

  if (normalizedText.includes("£") || /\bGBP\b/.test(normalizedText)) {
    return "GBP";
  }

  if (normalizedText.includes("€") || /\bEUR\b/.test(normalizedText)) {
    return "EUR";
  }

  if (normalizedText.includes("¥") || /\b(?:JPY|CNY|RMB)\b|円|元/.test(normalizedText)) {
    return "CNY";
  }

  if (normalizedText.includes("₹") || /\bINR\b/.test(normalizedText)) {
    return "INR";
  }

  if (normalizedText.includes("₩") || /\bKRW\b/.test(normalizedText)) {
    return "KRW";
  }

  if (normalizedText.includes("$")) {
    if (/\bCAD\b/.test(normalizedText)) {
      return "CAD";
    }

    if (/\bAUD\b/.test(normalizedText)) {
      return "AUD";
    }

    return "USD";
  }

  return fallbackCurrency;
}

export function formatMenuPrice(price: Price): string {
  const raw = price.raw?.trim();

  if (raw) {
    if (currencyMarkerPattern.test(raw)) {
      return raw;
    }

    if (isSingleNumericPrice(raw) && price.amount !== null) {
      return formatCurrencyAmount(price.amount, price.currency);
    }

    return addCurrencySymbolsToBarePriceText(raw, price.currency);
  }

  if (price.amount === null) {
    return "Market price";
  }

  return formatCurrencyAmount(price.amount, price.currency);
}

function isSingleNumericPrice(raw: string): boolean {
  return /^\d+(?:\.\d+)?$/.test(raw.replace(/,/g, "").trim());
}

function addCurrencySymbolsToBarePriceText(raw: string, currency: string): string {
  const symbol = currencySymbols[currency.toUpperCase()];

  if (!symbol || !/\d/.test(raw)) {
    return raw;
  }

  return raw.replace(/(^|[^\p{L}\d$£€¥₹₩])(\d+(?:\.\d+)?)/gu, (match, prefix: string, valueText: string, offset: number) => {
    const valueEndIndex = offset + match.length;
    const followingText = raw.slice(valueEndIndex).trimStart();

    if (measurementUnitPattern.test(followingText)) {
      return match;
    }

    return `${prefix}${symbol}${valueText}`;
  });
}

function formatCurrencyAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    const symbol = currencySymbols[currency.toUpperCase()] ?? "";
    return `${symbol}${amount.toFixed(2)}`;
  }
}
