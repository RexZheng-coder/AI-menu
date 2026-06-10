export type ImagePreprocessInput = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
};

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
const maxImageDimensionPx = 1800;
const jpegQuality = 82;

export async function preprocessServerImage(input: ImagePreprocessInput): Promise<ImagePreprocessResult> {
  const originalByteLength = input.bytes.byteLength;
  const sha256 = await createSha256(input.bytes);
  const sharp = await loadOptionalSharp();

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
        width: maxImageDimensionPx,
        height: maxImageDimensionPx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: jpegQuality,
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
