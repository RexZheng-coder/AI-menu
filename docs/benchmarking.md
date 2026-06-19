# Parser Benchmarking

Use this checklist when changing prompts, parser strategy, image preprocessing, or model settings to catch regressions before shipping.

## Command

```bash
npm run benchmark:mimo:menus
```

The benchmark processes local test files such as `sample menu/menu.jpg`, `drinks-menu.jpg`, and other images in the `sample menu/` directory. Sample images are local test assets and should not be committed unless intentionally added as public fixtures.

## Metrics

The benchmark table reports:

| Metric | Description |
|---|---|
| `duration_ms` | Wall-clock parse time for the file |
| `categories` | Parsed category count |
| `items` | Parsed item count |
| `prices` | Items with a visible raw price or parsed amount |
| `chinese_names` | Items where the Chinese name differs from English |
| `finish_reason` | Provider finish reason when available |
| `recovered_from_truncation` | Whether partial JSON recovery was used |
| `retry_used` | Whether the completeness retry path ran |
| `dense_fallback_used` | Whether dense-menu compact fallback returned core fields only |
| `error_code` | Structured failure code if parsing failed |

## Quality Baseline

For the main sample menu, accurate mode should stay near 7+ categories and 25+ items. Exact counts vary by model response, but a sudden drop in item count, price coverage, or Chinese-name coverage should be treated as a regression.

## Regression Workflow

1. Run `npm run benchmark:mimo:menus` before parser changes.
2. Apply the prompt or parser change.
3. Run `npm run typecheck` and `npm run build`.
4. Run `npm run benchmark:mimo:menus` again.
5. Compare item, price, Chinese-name, retry, and truncation metrics.
6. Manually test through the deployed app for at least the main sample image.
