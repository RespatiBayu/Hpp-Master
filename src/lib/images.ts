export const resizeImageToDataUrl = async (
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    type?: "image/jpeg" | "image/webp" | "image/png";
  } = {}
) => {
  const { maxWidth = 1400, maxHeight = 1400, quality = 0.82, type = "image/jpeg" } = options;

  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / imageBitmap.width, maxHeight / imageBitmap.height);
  const targetWidth = Math.max(1, Math.round(imageBitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas browser tidak tersedia untuk memproses gambar.");
  }

  context.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight);
  imageBitmap.close();

  return canvas.toDataURL(type, quality);
};
