import { useState, useCallback } from 'react';
import type { Position2D } from '../utils/imageMath';

export type CropHandleType = 'TL' | 'TR' | 'BL' | 'BR' | 'T' | 'B' | 'L' | 'R';

/**
 * A custom hook to manage crop box resizing gestures (mouse and touch).
 * Tracks the active corner handle and calculates delta distances.
 */
export const useResize = (
  onResize: (handle: CropHandleType, dx: number, dy: number) => void
) => {
  const [activeHandle, setActiveHandle] = useState<CropHandleType | null>(null);
  const [startPoint, setStartPoint] = useState<Position2D>({ x: 0, y: 0 });

  const startResize = useCallback(
    (clientX: number, clientY: number, handle: CropHandleType) => {
      setActiveHandle(handle);
      setStartPoint({ x: clientX, y: clientY });
    },
    []
  );

  const moveResize = useCallback(
    (clientX: number, clientY: number) => {
      if (!activeHandle) return;
      const dx = clientX - startPoint.x;
      const dy = clientY - startPoint.y;
      
      onResize(activeHandle, dx, dy);
    },
    [activeHandle, startPoint, onResize]
  );

  const endResize = useCallback(() => {
    setActiveHandle(null);
  }, []);

  return {
    activeHandle,
    startResize,
    moveResize,
    endResize,
  };
};
