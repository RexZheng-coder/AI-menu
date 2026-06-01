export const MENU_PARSE_PROMPT = `
You are parsing restaurant menu photos for an AI Menu Assistant MVP.

Return JSON only. Do not include markdown, explanations, or prose outside JSON.

Extract the visible menu into the existing Menu contract:
- restaurant.name, address if visible, cuisine_type if inferable
- language.source and language.target, using "zh" as target
- categories with category_id, name_en, name_zh, and items
- each item with item_id, name_en, name_zh, descriptions, price, tags, tags_zh, spicy_level, allergens, is_recommended, confidence
- price.amount must be a number or null
- price.raw must be the visible price string or null
- spicy_level must be 0, 1, 2, or 3
- confidence must be 0 to 1

Translate item and category names into Chinese. If text is unclear, make a conservative best effort and lower confidence.
Use empty arrays for missing tags or allergens. Use null for missing descriptions or price fields.
`;

export const MENU_PARSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    menu_id: { type: "string" },
    restaurant: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        address: { type: ["string", "null"] },
        cuisine_type: { type: ["string", "null"] },
      },
      required: ["name"],
    },
    language: {
      type: "object",
      additionalProperties: false,
      properties: {
        source: { type: "string" },
        target: { type: "string" },
      },
      required: ["source", "target"],
    },
    categories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category_id: { type: "string" },
          name_en: { type: "string" },
          name_zh: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                item_id: { type: "string" },
                name_en: { type: "string" },
                name_zh: { type: "string" },
                description_en: { type: ["string", "null"] },
                description_zh: { type: ["string", "null"] },
                price: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    amount: { type: ["number", "null"] },
                    currency: { type: "string" },
                    raw: { type: ["string", "null"] },
                  },
                  required: ["amount", "currency", "raw"],
                },
                tags: { type: "array", items: { type: "string" } },
                tags_zh: { type: "array", items: { type: "string" } },
                spicy_level: { type: "integer", enum: [0, 1, 2, 3] },
                allergens: { type: "array", items: { type: "string" } },
                is_recommended: { type: "boolean" },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["name_en", "name_zh", "price", "tags", "tags_zh", "spicy_level"],
            },
          },
        },
        required: ["name_en", "name_zh", "items"],
      },
    },
  },
  required: ["restaurant", "language", "categories"],
} as const;
