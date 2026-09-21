export interface CropResult {
  blob: Blob;
  file: File;
  dataUrl: string;
}

export interface CropOptions {
  imageSrc: string;
  originalSize: { width: number; height: number };
  displaySize: { width: number; height: number };
  cropWidth: number;
  cropHeight: number;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  format?: 'image/png' | 'image/jpeg';
  quality?: number;
}

/**
 * Renders the cropped portion of the image onto a high-quality canvas and
 * exports it as a Blob, File, and DataURL.
 * It uses the original dimensions to preserve 100% of the source image's resolution.
 */
export const cropImageToFiles = async (options: CropOptions): Promise<CropResult> => {
  const {
    imageSrc,
    originalSize,
    displaySize,
    cropWidth,
    cropHeight,
    position,
    scale,
    rotation,
    format = 'image/png',
    quality = 0.92,
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Prevent canvas tainted security errors
    img.src = imageSrc;

    img.onload = () => {
      const renderScale = originalSize.width / displaySize.width;
      
      
      const exportWidth = Math.round((cropWidth * renderScale) / scale);
      const exportHeight = Math.round((cropHeight * renderScale) / scale);

      const canvas = document.createElement('canvas');
      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to acquire 2D canvas context.'));
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.translate(exportWidth / 2, exportHeight / 2);
      
      ctx.translate(-position.x * (renderScale / scale), -position.y * (renderScale / scale));
      
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(
        img,
        -originalSize.width / 2,
        -originalSize.height / 2,
        originalSize.width,
        originalSize.height
      );

      const dataUrl = canvas.toDataURL(format, format === 'image/jpeg' ? quality : undefined);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob export failed.'));
            return;
          }

          const ext = format === 'image/png' ? 'png' : 'jpg';
          const file = new File([blob], `cropped-image.${ext}`, {
            type: format,
            lastModified: Date.now(),
          });

          resolve({
            blob,
            file,
            dataUrl,
          });
        },
        format,
        format === 'image/jpeg' ? quality : undefined
      );
    };

    img.onerror = (err) => {
      reject(new Error('Failed to load image for canvas cropping: ' + err));
    };
  });
};
