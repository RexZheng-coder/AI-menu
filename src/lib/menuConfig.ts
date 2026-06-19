// Central configuration for thresholds, timeouts, and limits.
// Import from this file instead of hardcoding values in individual modules.

// --- Upload limits ---
export const maxOriginalImageSizeBytes = 25 * 1024 * 1024; // 25 MB per original image
export const maxServerImageSizeBytes = 10 * 1024 * 1024; // 10 MB per server image
export const maxTotalServerUploadBytes = 32 * 1024 * 1024; // 32 MB total request body

// --- Image compression (client-side) ---
export const compressionPreferredBytesPerImage = 900_000; // 900 KB target per image
export const compressionMaxBytesPerImage = 3_300_000; // 3.3 MB hard cap per image
export const compressionMaxBatchBytes = 3_400_000; // 3.4 MB per upload batch
export const compressionBatchSize = 3; // images per batch
export const compressionMaxDimension = 2200; // px, longest side cap
export const compressionMinDimension = 1400; // px, lowest resolution allowed after shrinking
export const compressionQualitySteps = [0.86, 0.82, 0.78, 0.74, 0.7];

// --- Image optimization (server-side via sharp) ---
export const serverOptimizationThresholdBytes = 900_000; // skip sharp for images under this
export const serverImageMaxDimensionPx = 2000; // accurate mode
export const serverImageBalancedMaxDimensionPx = 1800;
export const serverImageFastMaxDimensionPx = 1600;
export const serverImageJpegQualityAccurate = 88;
export const serverImageJpegQualityBalanced = 85;
export const serverImageJpegQualityFast = 82;

// --- Parse batching ---
export const menuImageBatchSize = 3;
export const maxConcurrentParseBatches = 2;

// --- Timeouts ---
export const miMoApiTimeoutMs = 55_000; // single MiMo API call timeout
export const parsePerBatchWaveMs = 65_000; // client timeout per batch wave
export const serverHandlerTimeoutMs = 58_000; // Vercel serverless function timeout
export const serverFormDataTimeoutMs = 10_000; // reading form data timeout
export const ocrExtractionTimeoutMs = 28_000; // OCR step timeout
export const textStructuringTimeoutMs = 24_000; // text-to-JSON step timeout

// --- Throttle / retry ---
export const maxCompletionTokensAccurate = 4200;
export const maxCompletionTokensBalanced = 3800;
export const maxCompletionTokensFast = 3000;
export const denseFallbackMaxTokens = 2200;
export const retryBudgetAccurateMs = 42_000;
export const retryBudgetFastOrBalancedMs = 25_000;

// --- History ---
export const maxSavedMenus = 10;
export const maxSavedCarts = 5;
