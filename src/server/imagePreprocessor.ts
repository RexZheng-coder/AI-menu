export type ImagePreprocessInput = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export type ImagePreprocessResult = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  originalByteLength: number;
  optimizedByteLength: number;
  sha256: string;
  optimization: "sharp" | "noop";
};

type SharpImage = {
  rotate: () => SharpImage;
  resize: (options: {
    width: number;
    height: number;
    fit: "inside";
    withoutEnlargement: boolean;
  }) => SharpImage;
  jpeg: (options: { quality: number; mozjpeg: boolean }) => SharpImage;
  toBuffer: () => Promise<Uint8Array>;
};

type SharpFactory = (input: Uint8Array) => SharpImage;

const optimizationThresholdBytes = 900_000;
export async function preprocessServerImage(input: ImagePreprocessInput): Promise<ImagePreprocessResult> {
  const originalByteLength = input.bytes.byteLength;
  const sha256 = await createSha256(input.bytes);
  const sharp = await loadOptionalSharp();
  const optimizationConfig = readOptimizationConfig();

  if (!sharp || originalByteLength < optimizationThresholdBytes) {
    return {
      name: input.name,
      mimeType: input.mimeType,
      bytes: input.bytes,
      originalByteLength,
      optimizedByteLength: input.bytes.byteLength,
      sha256,
      optimization: "noop",
    };
  }

  try {
    const optimizedBytes = await sharp(input.bytes)
      .rotate()
      .resize({
        width: optimizationConfig.maxImageDimensionPx,
        height: optimizationConfig.maxImageDimensionPx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: optimizationConfig.jpegQuality,
        mozjpeg: true,
      })
      .toBuffer();

    if (optimizedBytes.byteLength >= originalByteLength) {
      return {
        name: input.name,
        mimeType: input.mimeType,
        bytes: input.bytes,
        originalByteLength,
        optimizedByteLength: input.bytes.byteLength,
        sha256,
        optimization: "noop",
      };
    }

    return {
      name: input.name,
      mimeType: "image/jpeg",
      bytes: optimizedBytes,
      originalByteLength,
      optimizedByteLength: optimizedBytes.byteLength,
      sha256: await createSha256(optimizedBytes),
      optimization: "sharp",
    };
  } catch {
    return {
      name: input.name,
      mimeType: input.mimeType,
      bytes: input.bytes,
      originalByteLength,
      optimizedByteLength: input.bytes.byteLength,
      sha256,
      optimization: "noop",
    };
  }
}

function readOptimizationConfig(): { maxImageDimensionPx: number; jpegQuality: number } {
  const detail = readEnv("MENU_PARSE_DETAIL");

  if (detail === "fast") {
    return {
      maxImageDimensionPx: 1600,
      jpegQuality: 82,
    };
  }

  if (detail === "balanced") {
    return {
      maxImageDimensionPx: 1800,
      jpegQuality: 85,
    };
  }

  return {
    maxImageDimensionPx: 2000,
    jpegQuality: 88,
  };
}

async function loadOptionalSharp(): Promise<SharpFactory | null> {
  try {
    const dynamicImport = new Function("specifier", "return import(specifier)") as (
      specifier: string,
    ) => Promise<unknown>;
    const module = asRecord(await dynamicImport("sharp"));
    const sharp = module.default;

    return typeof sharp === "function" ? (sharp as SharpFactory) : null;
  } catch {
    return null;
  }
}

async function createSha256(bytes: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    return "sha256_unavailable";
  }

  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", copy.buffer);
  return arrayBufferToHex(digest);
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function asRecord(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return {};
}

function readEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env?.[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
