import { useState, useCallback, useRef } from 'react';
import type { Position2D } from '../utils/imageMath';


export const useDrag = (onDrag: (dx: number, dy: number) => void) => {
  const [isDragging, setIsDragging] = useState(false);
  const lastPointRef = useRef<Position2D>({ x: 0, y: 0 });

  const startDrag = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    lastPointRef.current = { x: clientX, y: clientY };
  }, []);

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    const dx = clientX - lastPointRef.current.x;
    const dy = clientY - lastPointRef.current.y;
    
    lastPointRef.current = { x: clientX, y: clientY };

    onDrag(dx, dy);
  }, [onDrag]);

  const endDrag = useCallback(() => {
    setIsDragging(false);
  }, []);

  return {
    isDragging,
    startDrag,
    moveDrag,
    endDrag,
  };
};
