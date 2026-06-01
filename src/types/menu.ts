export type Price = {
  amount: number | null;
  currency: string;
  raw: string | null;
};

export type RestaurantInfo = {
  name: string;
  address?: string | null;
  cuisine_type?: string | null;
};

export type SpicyLevel = 0 | 1 | 2 | 3;

export type MenuItem = {
  item_id: string;
  name_en: string;
  name_zh: string;
  description_en?: string | null;
  description_zh?: string | null;
  price: Price;
  tags: string[];
  tags_zh: string[];
  spicy_level: SpicyLevel;
  allergens?: string[];
  is_recommended?: boolean;
  confidence?: number;
};

export type MenuCategory = {
  category_id: string;
  name_en: string;
  name_zh: string;
  items: MenuItem[];
};

export type MenuMetadata = {
  source_type: "image_upload" | "mock" | "manual";
  image_urls: string[];
  ai_model?: string | null;
  created_at: string;
  status: "pending" | "processing" | "completed" | "failed";
};

export type Menu = {
  menu_id: string;
  restaurant: RestaurantInfo;
  language: {
    source: string;
    target: string;
  };
  categories: MenuCategory[];
  metadata: MenuMetadata;
};

export type CartItem = {
  item_id: string;
  name_en: string;
  name_zh: string;
  unit_price: number | null;
  quantity: number;
  notes?: string;
  subtotal: number | null;
};

export type CartTotal = {
  subtotal: number;
  tax: number | null;
  tip: number | null;
  estimated_total: number;
  currency: string;
};

export type Cart = {
  cart_id: string;
  menu_id: string;
  items: CartItem[];
  total: CartTotal;
};

export type OrderSummary = {
  order_summary_id: string;
  restaurant_name: string;
  items: {
    name_en: string;
    name_zh: string;
    quantity: number;
    notes?: string;
    subtotal: number | null;
  }[];
  estimated_total: number;
  currency: string;
  display_text: string;
};
