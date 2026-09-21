export interface Size2D {
  width: number;
  height: number;
}

export interface Position2D {
  x: number;
  y: number;
}

/**
 * Calculates the half-extents (half-width, half-height) of the axis-aligned
 * bounding box of a rotated crop box of dimensions (width, height) at an angle (rotation).
 */
export const getCropBoxExtents = (width: number, height: number, rotation: number) => {
  const theta = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.abs(Math.sin(theta));
  
  const extX = (width * cos + height * sin) / 2;
  const extY = (width * sin + height * cos) / 2;
  
  return { extX, extY };
};

/**
 * Calculates the minimum scale factor required for the image to completely
 * cover the rotated crop box.
 */
export const getMinScale = (
  imageSize: Size2D,
  cropWidth: number,
  cropHeight: number,
  rotation: number
): number => {
  if (imageSize.width === 0 || imageSize.height === 0) return 1;
  const { extX, extY } = getCropBoxExtents(cropWidth, cropHeight, rotation);
  
  // To cover the extents, the scaled half-dimensions of the image must be >= extents.
  // (imageSize.width * scale) / 2 >= extX  => scale >= (extX * 2) / imageSize.width
  const minScaleX = (extX * 2) / imageSize.width;
  const minScaleY = (extY * 2) / imageSize.height;
  
  return Math.max(minScaleX, minScaleY);
};

/**
 * Clamps the translation position of the image to ensure the crop area
 * remains entirely within the image boundary, accounting for scale and rotation.
 */
export const clampImagePosition = (
  position: Position2D,
  scale: number,
  imageSize: Size2D,
  cropWidth: number,
  cropHeight: number,
  rotation: number
): Position2D => {
  if (imageSize.width === 0 || imageSize.height === 0) return position;
  const { extX, extY } = getCropBoxExtents(cropWidth, cropHeight, rotation);

  const maxPosX = Math.max(0, (imageSize.width * scale) / 2 - extX);
  const maxPosY = Math.max(0, (imageSize.height * scale) / 2 - extY);

  // Transform screen position to un-rotated image coordinate space
  const theta = (rotation * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // R(-theta)
  const unrotX = position.x * cos + position.y * sin;
  const unrotY = -position.x * sin + position.y * cos;

  // Clamp in un-rotated space
  const clampedUnrotX = Math.max(-maxPosX, Math.min(maxPosX, unrotX));
  const clampedUnrotY = Math.max(-maxPosY, Math.min(maxPosY, unrotY));

  // Transform clamped position back to screen space (R(theta))
  return {
    x: clampedUnrotX * cos - clampedUnrotY * sin,
    y: clampedUnrotX * sin + clampedUnrotY * cos,
  };
};

/**
 * Calculates a downscaled image dimension for editing high-resolution (5000px+) images.
 */
export const calculateDisplaySize = (originalSize: Size2D, maxSide = 2048): Size2D => {
  const { width, height } = originalSize;
  if (width <= maxSide && height <= maxSide) {
    return { width, height };
  }
  
  const ratio = width / height;
  if (width > height) {
    return { width: maxSide, height: Math.round(maxSide / ratio) };
  } else {
    return { width: Math.round(maxSide * ratio), height: maxSide };
  }
};
