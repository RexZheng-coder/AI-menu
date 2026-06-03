export type ServerMenuImage = {
  name: string;
  mimeType: string;
  dataUrl: string;
};

export type ServerUploadedImageFile = {
  name: string;
  type: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

export async function createServerMenuImage(file: ServerUploadedImageFile): Promise<ServerMenuImage> {
  return {
    name: file.name,
    mimeType: file.type || inferMimeType(file.name),
    dataUrl: `data:${file.type || inferMimeType(file.name)};base64,${arrayBufferToBase64(
      await file.arrayBuffer(),
    )}`,
  };
}

export async function createServerMenuImages(files: ServerUploadedImageFile[]): Promise<ServerMenuImage[]> {
  return Promise.all(files.map((file) => createServerMenuImage(file)));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
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
