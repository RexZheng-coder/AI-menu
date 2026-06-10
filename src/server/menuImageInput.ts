import { preprocessServerImage } from "./imagePreprocessor.js";

export type ServerMenuImage = {
  name: string;
  mimeType: string;
  dataUrl: string;
  originalByteLength: number;
  optimizedByteLength: number;
  sha256: string;
  optimization: "sharp" | "noop";
};

export type ServerUploadedImageFile = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export async function createServerMenuImage(file: ServerUploadedImageFile): Promise<ServerMenuImage> {
  const mimeType = file.type || inferMimeType(file.name);
  const originalBytes = new Uint8Array(await file.arrayBuffer());
  const preprocessed = await preprocessServerImage({
    name: file.name,
    mimeType,
    bytes: originalBytes,
  });

  return {
    name: file.name,
    mimeType: preprocessed.mimeType,
    dataUrl: `data:${preprocessed.mimeType};base64,${arrayBufferToBase64(preprocessed.bytes)}`,
    originalByteLength: preprocessed.originalByteLength,
    optimizedByteLength: preprocessed.optimizedByteLength,
    sha256: preprocessed.sha256,
    optimization: preprocessed.optimization,
  };
}

export async function createServerMenuImages(files: ServerUploadedImageFile[]): Promise<ServerMenuImage[]> {
  return Promise.all(files.map((file) => createServerMenuImage(file)));
}

function arrayBufferToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function inferMimeType(fileName: string): string {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }

  if (lowerName.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/png";
}
