import { useRef, useMemo, useEffect } from 'react';

type DebouncedFunction<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void;
};

export function useDebounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
  maxWait?: number
): DebouncedFunction<T> {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCallTimeRef = useRef<number>(Date.now());
  const funcRef = useRef(fn);

  funcRef.current = fn;

  const debounced = useMemo(() => {
    const debouncedFn = (...args: Parameters<T>) => {
      const now = Date.now();

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (maxWait && now - lastCallTimeRef.current >= maxWait) {
        lastCallTimeRef.current = now;
        funcRef.current(...args);
        return;
      }

      timeoutRef.current = setTimeout(() => {
        lastCallTimeRef.current = Date.now();
        funcRef.current(...args);
      }, delay);

      if (maxWait && !maxWaitRef.current) {
        maxWaitRef.current = setTimeout(() => {
          lastCallTimeRef.current = Date.now();
          funcRef.current(...args);
          maxWaitRef.current = null;
        }, maxWait);
      }
    };

    // Add cancel method
    (debouncedFn as DebouncedFunction<T>).cancel = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
      timeoutRef.current = null;
      maxWaitRef.current = null;
    };

    return debouncedFn as DebouncedFunction<T>;
  }, [delay, maxWait]);

  // Optional cleanup on unmount
  useEffect(() => {
    return () => debounced.cancel();
  }, [debounced]);

  return debounced;
}
