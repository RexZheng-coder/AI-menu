# Parsing Benchmarking

Use this checklist when changing prompts, parser strategy, image preprocessing, or model settings.

## Command

```bash
npm run benchmark:mimo:menus
```

The benchmark checks available local files such as:

- `sample menu/menu.jpg`
- `sample menu/english-dense-menu.jpg`
- `sample menu/drinks-menu.jpg`
- `sample menu/chinese-menu.jpg`

Sample images are local test assets and should not be committed unless they are intentionally added as public fixtures.

## Metrics

The table reports:

- `duration_ms`: wall-clock parse time for the file.
- `categories`: parsed category count.
- `items`: parsed item count.
- `prices`: item count with a visible raw price or parsed amount.
- `chinese_names`: item count where the Chinese name differs from English.
- `finish_reason`: provider finish reason when available.
- `recovered_from_truncation`: whether partial JSON recovery was used.
- `retry_used`: whether the completeness retry path ran.
- `error_code`: structured failure code if parsing failed.

## What Good Looks Like

For the main sample menu, accurate mode should stay near the prior completeness benchmark of roughly 7+ categories and 25+ items. Exact counts can vary by model response, but a sudden drop in item count, price count, or Chinese-name coverage should be treated as a regression.

Prioritize item coverage in this order:

1. English item name
2. Raw price
3. Category
4. Chinese item name
5. Descriptions
6. Tags and spicy level
7. Allergens and confidence

If a dense menu is difficult, it is better to preserve more item names and prices with sparse optional fields than to return a rich summary of only a few dishes.

## Regression Workflow

1. Run `npm run benchmark:mimo:menus` before parser changes.
2. Apply the prompt or parser change.
3. Run `npm run typecheck` and `npm run build`.
4. Run `npm run benchmark:mimo:menus` again.
5. Compare item, price, Chinese-name, retry, and truncation metrics.
6. Manually test `http://localhost:3000/` through `vercel dev` for at least the main sample image.

Never print or commit API keys, base64 image data, `.env.local`, `.DS_Store`, or private sample images.
