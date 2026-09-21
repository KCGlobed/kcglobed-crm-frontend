import React from 'react';
import { CropHandles } from './CropHandles';
import type { CropHandleType } from '../hooks/useResize';
import type { Position2D } from '../utils/imageMath';

interface CropBoxProps {
  width: number;
  height: number;
  position: Position2D;
  onHandleMouseDown: (e: React.MouseEvent, handle: CropHandleType) => void;
  onHandleTouchStart: (e: React.TouchEvent, handle: CropHandleType) => void;
}

/**
 * Renders the movable, resizable crop box boundary.
 * Translates based on the `position` coordinate state relative to the workspace center.
 */
export const CropBox: React.FC<CropBoxProps> = React.memo(({
  width,
  height,
  position,
  onHandleMouseDown,
  onHandleTouchStart,
}) => {
  return (
    <div
      className="absolute left-1/2 top-1/2 border-2 border-white/85 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] pointer-events-auto z-20"
      style={{
        width,
        height,
        transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
        willChange: 'width, height, transform',
      }}
    >
      <CropHandles
        onHandleMouseDown={onHandleMouseDown}
        onHandleTouchStart={onHandleTouchStart}
      />
    </div>
  );
});

CropBox.displayName = 'CropBox';
