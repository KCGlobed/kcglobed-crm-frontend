import React from 'react';
import type { Position2D, Size2D } from '../utils/imageMath';

interface CropPreviewProps {
  image: string;
  imageSize: Size2D;
  position: Position2D;
  scale: number;
  rotation: number;
  cropWidth: number;
  cropHeight: number;
}

/**
 * Renders a CSS-based real-time cropped preview of the image.
 * This runs at 60fps without lag because it clones the workspace transform
 * and scales it down, avoiding expensive canvas draws on every mouse movement.
 */
export const CropPreview: React.FC<CropPreviewProps> = React.memo(({
  image,
  imageSize,
  position,
  scale,
  rotation,
  cropWidth,
  cropHeight,
}) => {
  // Max constraints for preview box
  const MAX_PREVIEW_W = 260;
  const MAX_PREVIEW_H = 180;

  const cropRatio = cropWidth / cropHeight;
  
  // Fit crop aspect ratio inside maximum preview boundary
  let previewW = MAX_PREVIEW_W;
  let previewH = Math.round(MAX_PREVIEW_W / cropRatio);

  if (previewH > MAX_PREVIEW_H) {
    previewH = MAX_PREVIEW_H;
    previewW = Math.round(MAX_PREVIEW_H * cropRatio);
  }

  const previewScale = previewW / cropWidth;

  return (
    <div className="flex flex-col items-center select-none">
      <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
        Live Preview
      </h4>
      
      {/* Container wrapper representing the crop window boundary */}
      <div
        className="relative overflow-hidden bg-slate-900 border border-slate-200 rounded-lg shadow-sm"
        style={{
          width: previewW,
          height: previewH,
          willChange: 'width, height',
        }}
      >
        {image && imageSize.width > 0 && (
          <img
            src={image}
            alt="Real-time crop preview"
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none origin-center pointer-events-none"
            style={{
              width: imageSize.width,
              height: imageSize.height,
              transform: `translate(calc(-50% - ${position.x * previewScale}px), calc(-50% - ${position.y * previewScale}px)) scale(${scale * previewScale}) rotate(${rotation}deg)`,
              willChange: 'transform',
            }}
          />
        )}
      </div>
      
      <span className="text-[10px] font-medium text-slate-400 mt-2">
        {Math.round(cropWidth)} × {Math.round(cropHeight)} px ({cropRatio.toFixed(2)}:1)
      </span>
    </div>
  );
});

CropPreview.displayName = 'CropPreview';
