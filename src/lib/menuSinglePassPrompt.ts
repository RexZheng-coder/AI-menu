export const MENU_SINGLE_PASS_SYSTEM_PROMPT = `You are a careful restaurant menu extraction assistant.
Your highest priority is complete and accurate extraction of visible menu items.
Extract only visible information from the image.
Do not invent dishes, prices, descriptions, ingredients, sections, or restaurant names.
If optional fields are unclear, use null, empty arrays, or conservative defaults.
Menu text may be English, Italian, French, Spanish, Chinese, Japanese, or another language. Understand culinary terms across languages instead of assuming the source text is English.
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
"allergens": string[]
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
5. Put the original visible item name in name_en exactly as shown when possible, even if it is not English.
6. Extract prices exactly as shown in price_raw. If the menu clearly uses one currency symbol, include that symbol with every price when it is visible or clearly implied by the menu.
7. If a price is unclear or not visible, use null.
8. Translate item names into concise, natural, easy-to-understand Chinese. Prefer meaning-based culinary translation over phonetic transliteration.
9. Translate descriptions only if visible and short enough. Otherwise use null.
10. Generate short useful tags only when supported by the item name or visible description.
11. Estimate spicy_level from the item name and visible description. Use 0 for not spicy or unknown, 1 for mildly spicy, 2 for spicy, and 3 for very spicy.
12. Extract allergens only when visible or strongly implied.
13. If output space is limited, keep more items and omit optional descriptions/tags instead of skipping items.
14. Return JSON only.

Translation guidance:
- Do not leave common food terms as obscure sound-alike Chinese transliterations when a useful Chinese explanation is possible.
- For example, translate "NDUJA, SPIANATA & GORGONZOLA" as "意式辣肉酱香肠、意式萨拉米、戈贡佐拉蓝纹奶酪", not as opaque phonetic names.
- For Italian cured meats, cheeses, sauces, pasta shapes, French sauces, Spanish dishes, or Japanese/Korean/Chinese terms, explain the ingredient or dish type in natural Chinese.

Priority order if the menu is dense:
1. item name_en
2. price_raw
3. category
4. name_zh
5. description_en / description_zh
6. tags / tags_zh
7. spicy_level
8. allergens

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
- If item names include Italian, French, Spanish, Japanese, Korean, Chinese, or other culinary terms, translate by meaning for Chinese diners instead of using opaque phonetic transliteration.
- Example: "NDUJA, SPIANATA & GORGONZOLA" -> "意式辣肉酱香肠、意式萨拉米、戈贡佐拉蓝纹奶酪".
- Preserve visible or clearly implied currency symbols in price_raw when the menu uses one currency.
- Guess spicy_level from the item name when obvious, such as nduja, spicy, hot, arrabbiata, jalapeño, chili, pepper, buffalo, mala, curry, or similar terms.
- Each item only needs name_en, name_zh, price_raw, and spicy_level. Omit other optional fields so more items fit.
- Backend will default descriptions, tags, and allergens.
- Use name_en "Menu" and name_zh "菜单" if no category heading is visible.
- If nothing can be read, return {"restaurant_name":null,"cuisine_type":null,"categories":[]}.

Compact shape:
{"restaurant_name":string|null,"cuisine_type":string|null,"categories":[{"name_en":string,"name_zh":string,"items":[{"name_en":string,"name_zh":string,"price_raw":string|null,"spicy_level":0|1|2|3}]}]}`;

export const MENU_SINGLE_PASS_FAST_PROMPT = `Read the menu image and return final minified JSON only. Do not think step by step. Do not explain. Do not use markdown.

Extract all readable visible menu items in reading order. Do not summarize, sample, or intentionally skip clearly visible items.
To stay compact, each item only needs name_en, name_zh, price_raw, and spicy_level. Omit optional item fields so more items fit.
Keep item names, prices, categories, Chinese item names, and spice estimates. Preserve visible or clearly implied currency symbols in price_raw. Translate non-English culinary terms by meaning for Chinese diners instead of opaque phonetic transliteration. Backend will default missing optional fields.

Use name_en "Menu" and name_zh "菜单" if no category heading is visible.
If nothing can be read, return {"restaurant_name":null,"cuisine_type":null,"categories":[]}.

Compact shape:
{"restaurant_name":string|null,"cuisine_type":string|null,"categories":[{"name_en":string,"name_zh":string,"items":[{"name_en":string,"name_zh":string,"price_raw":string|null,"spicy_level":0|1|2|3}]}]}`;

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
- For each item include only name_en, name_zh, price_raw, and spicy_level.
- Preserve price_raw exactly as shown. If the menu clearly uses one currency symbol, include that symbol with every price when visible or clearly implied.
- Translate item names into concise, natural Chinese. Translate non-English culinary terms by meaning, not opaque phonetic transliteration.
- Use null for unclear or missing prices.
- Do not include descriptions, tags, allergens, confidence, markdown, comments, or explanations.
- If no category heading is visible, use "Menu" and "菜单".
- If nothing can be read, return {"restaurant_name":null,"cuisine_type":null,"categories":[]}.

Compact shape:
{"restaurant_name":string|null,"cuisine_type":string|null,"categories":[{"name_en":string,"name_zh":string,"items":[{"name_en":string,"name_zh":string,"price_raw":string|null,"spicy_level":0|1|2|3}]}]}`;
