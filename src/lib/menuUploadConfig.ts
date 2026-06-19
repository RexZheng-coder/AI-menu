// Re-exports from the central config for backward compatibility.
export {
  compressionBatchSize as menuImageBatchSize,
  maxConcurrentParseBatches,
  compressionMaxBatchBytes as maxUploadBatchBytes,
} from "./menuConfig.js";
