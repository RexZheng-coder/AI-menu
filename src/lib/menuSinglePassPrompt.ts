export const MENU_SINGLE_PASS_SYSTEM_PROMPT = `You are a careful restaurant menu extraction assistant.
Your highest priority is complete and accurate extraction of visible menu items.
Extract only visible information from the image.
Do not invent dishes, prices, descriptions, ingredients, sections, or restaurant names.
If optional fields are unclear, use null, empty arrays, or conservative defaults.
Return valid JSON only. Do not include markdown, code fences, comments, or explanations.`;

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

export const MENU_SINGLE_PASS_ACCURATE_PROMPT = `Analyze the uploaded restaurant menu image and return one JSON object.

Accuracy-first rules:

1. Extract all visible menu sections and all readable menu items.
2. Do not summarize, sample, or intentionally skip visible menu items.
3. Preserve reading order from top to bottom and left to right.
4. If a category heading is visible, use it. If not, use "Menu" / "菜单".
5. Extract item names exactly as shown when possible.
6. Extract prices exactly as shown in price_raw.
7. If a price is unclear or not visible, use null.
8. Translate item names into concise natural Chinese.
9. Translate descriptions only if visible and short enough. Otherwise use null.
10. Generate short useful tags only when supported by the item name or visible description.
11. Estimate spicy_level conservatively. Use 0 unless spice is clearly suggested.
12. Extract allergens only when visible or strongly implied.
13. Add confidence between 0 and 1.
14. If output space is limited, keep more items and omit optional descriptions/tags instead of skipping items.
15. Return JSON only.

Priority order if the menu is dense:
1. item name_en
2. price_raw
3. category
4. name_zh
5. description_en / description_zh
6. tags / tags_zh
7. spicy_level
8. allergens
9. confidence

Allowed English allergen values:
gluten, dairy, egg, peanut, tree_nut, shellfish, fish, soy

Useful English tag examples:
chicken, beef, pork, seafood, vegetarian, vegan, dessert, drink, noodle, rice, fried, soup, salad, spicy, dairy

Useful Chinese tag examples:
鸡肉, 牛肉, 猪肉, 海鲜, 素食, 纯素, 甜品, 饮料, 面食, 米饭, 炸物, 汤, 沙拉, 辣, 奶制品

Output shape:
${MENU_SINGLE_PASS_SCHEMA_TEXT}

If nothing can be read:
{
"restaurant_name": null,
"cuisine_type": null,
"categories": []
}`;

export const MENU_SINGLE_PASS_BALANCED_PROMPT = `${MENU_SINGLE_PASS_ACCURATE_PROMPT}

Balanced mode:
Prefer complete item coverage. Keep descriptions null unless they are very short. Use at most one tag per item. Do not omit readable item names or prices to save space.`;

export const MENU_SINGLE_PASS_ACCURATE_RUNTIME_PROMPT = `Read the menu image and return final minified JSON only. Do not think step by step. Do not explain. Do not use markdown.

Accuracy-first means complete item coverage:
- Extract every readable visible menu item in reading order.
- Do not summarize, sample, or intentionally skip visible items.
- Preserve categories, item names, and price_raw exactly when possible.
- Translate every item name into concise natural Chinese.
- Each item only needs name_en, name_zh, and price_raw. Omit optional fields so more items fit.
- Backend will default descriptions, tags, allergens, spicy_level, and confidence.
- Use name_en "Menu" and name_zh "菜单" if no category heading is visible.
- If nothing can be read, return {"restaurant_name":null,"cuisine_type":null,"categories":[]}.

Compact shape:
{"restaurant_name":string|null,"cuisine_type":string|null,"categories":[{"name_en":string,"name_zh":string,"items":[{"name_en":string,"name_zh":string,"price_raw":string|null}]}]}`;

export const MENU_SINGLE_PASS_FAST_PROMPT = `Read the menu image and return final minified JSON only. Do not think step by step. Do not explain. Do not use markdown.

Extract all readable visible menu items in reading order. Do not summarize, sample, or intentionally skip clearly visible items.
To stay compact, each item only needs name_en, name_zh, and price_raw. Omit optional item fields so more items fit.
Keep item names, prices, categories, and Chinese item names. Backend will default missing optional fields.

Use name_en "Menu" and name_zh "菜单" if no category heading is visible.
If nothing can be read, return {"restaurant_name":null,"cuisine_type":null,"categories":[]}.

Compact shape:
{"restaurant_name":string|null,"cuisine_type":string|null,"categories":[{"name_en":string,"name_zh":string,"items":[{"name_en":string,"name_zh":string,"price_raw":string|null}]}]}`;

export const MENU_SINGLE_PASS_COMPACT_RETRY_PROMPT = `${MENU_SINGLE_PASS_ACCURATE_PROMPT}

Retry instruction:
Return compact minified JSON only. Do not include markdown or prose. Preserve all readable item names and prices. Use null descriptions and empty optional arrays if needed, but do not skip visible items.`;

export const MENU_SINGLE_PASS_LOW_COUNT_RETRY_PROMPT = `${MENU_SINGLE_PASS_COMPACT_RETRY_PROMPT}

The previous response returned too few items. Re-scan the whole image and include all readable sections/items, especially later sections near the bottom/right side.`;

export const MENU_SINGLE_PASS_DENSE_FALLBACK_PROMPT = `Analyze the uploaded restaurant menu image and return compact minified JSON only.
This is a dense menu fallback. Prioritize core item coverage over rich metadata.

Rules:
- Extract all readable visible categories and menu items in reading order.
- Do not summarize or sample items.
- For each category include only name_en, name_zh, and items.
- For each item include only name_en, name_zh, and price_raw.
- Preserve price_raw exactly as shown.
- Translate item names into concise natural Chinese.
- Use null for unclear or missing prices.
- Do not include descriptions, tags, allergens, spicy_level, confidence, markdown, comments, or explanations.
- If no category heading is visible, use "Menu" and "菜单".
- If nothing can be read, return {"restaurant_name":null,"cuisine_type":null,"categories":[]}.

Compact shape:
{"restaurant_name":string|null,"cuisine_type":string|null,"categories":[{"name_en":string,"name_zh":string,"items":[{"name_en":string,"name_zh":string,"price_raw":string|null}]}]}`;
