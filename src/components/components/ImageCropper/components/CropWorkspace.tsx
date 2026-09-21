import React from 'react';
import { CropBox } from './CropBox';
import type { CropHandleType } from '../hooks/useResize';
import type { Position2D, Size2D } from '../utils/imageMath';

interface CropWorkspaceProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  image: string;
  imageSize: Size2D;
  position: Position2D;
  imagePosition: Position2D;
  scale: number;
  rotation: number;
  cropWidth: number;
  cropHeight: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;

  onHandleMouseDown: (e: React.MouseEvent, handle: CropHandleType) => void;
  onHandleTouchStart: (e: React.TouchEvent, handle: CropHandleType) => void;
}

/**
 * Renders the interactive workspace. Keeps the image stable in the center while allowing
 * zoom/rotation, and overlays the translateable CropBox.
 */
export const CropWorkspace: React.FC<CropWorkspaceProps> = React.memo(({
  containerRef,
  imageRef,
  image,
  imageSize,
  position,
  imagePosition,
  scale,
  rotation,
  cropWidth,
  cropHeight,
  onMouseDown,
  onTouchStart,
  onTouchMove,
  onTouchEnd,

  onHandleMouseDown,
  onHandleTouchStart,
}) => {
  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown} // Bind onMouseDown to the workspace background for drag/snip creation
      className="relative w-full h-full bg-slate-950 flex items-center justify-center select-none overflow-hidden cursor-crosshair"
    >
      {/* Target Image (Scales, rotates, and translates on drag) */}
      <img
        ref={imageRef}
        src={image}
        alt="Crop Target"
        draggable={false}
        className="absolute left-1/2 top-1/2 select-none max-w-none origin-center pointer-events-none"
        style={{
          width: imageSize.width,
          height: imageSize.height,
          transform: `translate(calc(-50% + ${imagePosition.x}px), calc(-50% + ${imagePosition.y}px)) scale(${scale}) rotate(${rotation}deg)`,
          willChange: 'transform',
        }}
      />

      {/* Masking overlay and movable crop box */}
      <CropBox
        width={cropWidth}
        height={cropHeight}
        position={position}
        onHandleMouseDown={onHandleMouseDown}
        onHandleTouchStart={onHandleTouchStart}
      />
    </div>
  );
});

CropWorkspace.displayName = 'CropWorkspace';
