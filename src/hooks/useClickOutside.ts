import { useEffect, useRef } from "react";

/**
 * Closes a floating element (dropdown, popover, drawer) when the user clicks
 * outside of it or presses Escape. Returns the ref to attach to the wrapper.
 */
export const useClickOutside = <T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose: () => void
) => {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return ref;
};

export default useClickOutside;
