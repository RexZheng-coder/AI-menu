export const MENU_SINGLE_PASS_SYSTEM_PROMPT = `You are a careful restaurant menu understanding assistant.
You read restaurant menu images and convert them into structured bilingual menu data.
Extract only visible menu information from the image.
Do not invent dishes, prices, descriptions, ingredients, restaurant names, or sections.
If a field is unclear, use null, an empty array, or a conservative default.
Return valid JSON only. Do not include markdown, comments, code fences, or explanations.`;

export const MENU_SINGLE_PASS_SCHEMA_TEXT = `{
"restaurant_name": string | null,
"cuisine_type": string | null,
"categories": [
{
"name_en": string,
"name_zh": string,
"items": [
{
"name_en": string,
"name_zh": string,
"description_en": string | null,
"description_zh": string | null,
"price_raw": string | null,
"tags": string[],
"tags_zh": string[],
"spicy_level": 0 | 1 | 2 | 3,
"allergens": string[],
"confidence": number
}
]
}
]
}`;

export const MENU_SINGLE_PASS_USER_PROMPT = `Analyze the uploaded restaurant menu image and return one JSON object.

You must complete all tasks in one pass:

1. Detect the restaurant name if visible.
2. Detect cuisine type if obvious.
3. Preserve visible menu sections/categories in reading order.
4. Extract visible menu items.
5. Extract item descriptions if visible.
6. Extract prices exactly as shown.
7. Translate item names and descriptions into concise, natural Chinese.
8. Generate useful tags only when supported by visible text or obvious item names.
9. Estimate spicy_level:
   0 = not spicy or unknown
   1 = mildly spicy
   2 = spicy
   3 = very spicy
   Use 0 unless spice is clearly suggested.
10. Extract allergens only when visible or strongly implied by the item name/description.
11. Add confidence between 0 and 1 for each item.
12. Do not hallucinate missing prices or invisible dishes.
13. If no category heading is visible, use "Menu" and "菜单".

Allowed English allergen values:
gluten, dairy, egg, peanut, tree_nut, shellfish, fish, soy

Useful English tags examples:
chicken, beef, pork, seafood, vegetarian, vegan, dessert, drink, noodle, rice, fried, soup, salad, spicy, dairy

Useful Chinese tags examples:
鸡肉, 牛肉, 猪肉, 海鲜, 素食, 纯素, 甜品, 饮料, 面食, 米饭, 炸物, 汤, 沙拉, 辣, 奶制品

Return JSON only in this exact shape:
${MENU_SINGLE_PASS_SCHEMA_TEXT}

Rules:

* categories must be an array.
* items must be an array.
* Omit empty categories.
* price_raw must preserve the original visible price text, such as "$12.99".
* If a price is not visible, use null.
* Chinese translation should be concise and natural.
* tags should be short and useful for ordering.
* Do not output full Menu contract.
* Do not output item_id, category_id, menu_id, metadata, or calculated price.amount. Backend will generate those.
* Do not output extra text.
* If nothing can be read, return:
  {
  "restaurant_name": null,
  "cuisine_type": null,
  "categories": []
  }`;

export const MENU_SINGLE_PASS_COMPACT_RETRY_PROMPT = `${MENU_SINGLE_PASS_USER_PROMPT}

Retry instruction:
Return compact minified JSON only. Keep descriptions short. Do not include markdown or prose.`;

export const MENU_SINGLE_PASS_RUNTIME_PROMPT = `Read the menu image and return final minified JSON only. Do not think step by step. Do not explain. Do not use markdown.

Extract visible information only. Do not invent missing dishes, prices, descriptions, ingredients, restaurant names, or sections.
Hard limit: at most 12 total items across all categories. Keep the first readable items in reading order and omit later items so JSON finishes quickly.

For every item include all required keys:
- name_en: visible English item name.
- name_zh: concise natural Chinese translation of name_en.
- description_en: always null in this fast extraction.
- description_zh: always null in this fast extraction.
- price_raw: exact visible price text, or null.
- tags: max 1 useful English tag, or [].
- tags_zh: matching Chinese tag, or [].
- spicy_level: 0 unless spice is clearly suggested.
- allergens: always [] in this fast extraction.
- confidence: one decimal, usually 0.8.

Use name_en "Menu" and name_zh "菜单" if no category heading is visible.
If nothing can be read, return {"restaurant_name":null,"cuisine_type":null,"categories":[]}.
Every item must look like this compact example:
{"name_en":"GARLIC BREAD","name_zh":"蒜香面包","description_en":null,"description_zh":null,"price_raw":"5.0(M) | 8.0(NM)","tags":["vegetarian"],"tags_zh":["素食"],"spicy_level":0,"allergens":[],"confidence":0.8}

Exact JSON shape:
${MENU_SINGLE_PASS_SCHEMA_TEXT}`;
