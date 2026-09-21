import { useState, useCallback } from 'react';
import { clamp } from '../utils/clamp';

/**
 * A custom hook to manage image zoom levels and bounds constraints.
 */
export const useZoom = (initialScale = 1, minScale = 0.1, maxScale = 10) => {
  const [scale, setScaleState] = useState(initialScale);
  const [minScaleState, setMinScaleState] = useState(minScale);

  const setScale = useCallback(
    (s: number | ((prev: number) => number)) => {
      setScaleState((prev) => {
        const next = typeof s === 'function' ? s(prev) : s;
        return clamp(next, minScaleState, maxScale);
      });
    },
    [minScaleState, maxScale]
  );

  const setMinScale = useCallback((min: number) => {
    setMinScaleState(min);
    setScaleState((prev) => Math.max(prev, min));
  }, []);

  return {
    scale,
    setScale,
    minScale: minScaleState,
    setMinScale,
  };
};
