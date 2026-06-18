export type PreparedMenuImage = {
  originalFile: File;
  uploadFile: File;
  previewUrl: string;
  originalByteLength: number;
  uploadByteLength: number;
  wasCompressed: boolean;
};

type CompressionOptions = {
  preferredBytesPerImage?: number;
  maxBytesPerImage?: number;
  maxTotalBytes?: number;
  maxDimension?: number;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

const defaultPreferredBytesPerImage = 900_000;
const defaultMaxBytesPerImage = 3_300_000;
const defaultMaxTotalBytes = 3_400_000;
const defaultMaxDimension = 2200;
const minimumDimension = 1400;
const qualitySteps = [0.86, 0.82, 0.78, 0.74, 0.7];

export async function prepareMenuImages(
  files: File[],
  options: CompressionOptions = {},
): Promise<PreparedMenuImage[]> {
  const maxTotalBytes = options.maxTotalBytes ?? defaultMaxTotalBytes;
  const maxBytesPerImage = Math.min(
    options.maxBytesPerImage ?? defaultMaxBytesPerImage,
    Math.floor(maxTotalBytes / Math.max(1, files.length)),
  );
  const preferredBytesPerImage = Math.min(
    options.preferredBytesPerImage ?? defaultPreferredBytesPerImage,
    maxBytesPerImage,
  );

  const preparedImages: PreparedMenuImage[] = [];

  try {
    for (const file of files) {
      const uploadFile = await compressMenuImage(file, {
        preferredBytes: preferredBytesPerImage,
        maxBytes: maxBytesPerImage,
        maxDimension: options.maxDimension ?? defaultMaxDimension,
      });

      preparedImages.push({
        originalFile: file,
        uploadFile,
        previewUrl: URL.createObjectURL(file),
        originalByteLength: file.size,
        uploadByteLength: uploadFile.size,
        wasCompressed: uploadFile !== file,
      });
    }
  } catch (error) {
    revokePreparedMenuImages(preparedImages);
    throw error;
  }

  const totalUploadBytes = preparedImages.reduce(
    (sum, image) => sum + image.uploadByteLength,
    0,
  );

  if (totalUploadBytes > maxTotalBytes) {
    revokePreparedMenuImages(preparedImages);
    throw new Error(
      `The optimized images are still ${formatMegabytes(totalUploadBytes)}. Please upload fewer images or crop them more tightly.`,
    );
  }

  return preparedImages;
}

export function revokePreparedMenuImages(images: PreparedMenuImage[]): void {
  for (const image of images) {
    URL.revokeObjectURL(image.previewUrl);
  }
}

async function compressMenuImage(
  file: File,
  options: {
    preferredBytes: number;
    maxBytes: number;
    maxDimension: number;
  },
): Promise<File> {
  if (file.size <= options.preferredBytes) {
    return file;
  }

  const decoded = await decodeImage(file);

  try {
    let dimension = Math.min(options.maxDimension, Math.max(decoded.width, decoded.height));
    const smallestAllowedDimension = Math.min(minimumDimension, dimension);
    let smallestBlob: Blob | null = null;

    while (dimension >= smallestAllowedDimension) {
      const { width, height } = fitWithinDimension(decoded.width, decoded.height, dimension);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });

      if (!context) {
        throw new Error("This browser could not prepare the image for upload.");
      }

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(decoded.source, 0, 0, width, height);

      for (const quality of qualitySteps) {
        const blob = await canvasToJpegBlob(canvas, quality);

        if (!smallestBlob || blob.size < smallestBlob.size) {
          smallestBlob = blob;
        }

        if (blob.size <= options.preferredBytes) {
          return createCompressedFile(file, blob);
        }
      }

      dimension -= 200;
    }

    if (smallestBlob && smallestBlob.size <= options.maxBytes) {
      return createCompressedFile(file, smallestBlob);
    }

    throw new Error(
      `Could not reduce ${file.name} below ${formatMegabytes(options.maxBytes)} without making the menu text too small.`,
    );
  } finally {
    decoded.close();
  }
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Fall through to the image element path for browser compatibility.
    }
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(objectUrl);
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

function loadImageElement(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image could not be decoded in this browser."));
    image.src = source;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("This browser could not compress the selected image."));
        }
      },
      "image/jpeg",
      quality,
    );
  });
}

function fitWithinDimension(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function createCompressedFile(originalFile: File, blob: Blob): File {
  const baseName = originalFile.name.replace(/\.[^.]+$/, "") || "menu";
  return new File([blob], `${baseName}-optimized.jpg`, {
    type: "image/jpeg",
    lastModified: originalFile.lastModified,
  });
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
