import { useState, useEffect, useCallback, useRef } from 'react';

import { useZoom } from './useZoom';
import { useDrag } from './useDrag';
import { useResize } from './useResize';
import type { CropHandleType } from './useResize';
import {
  clampImagePosition,
  getMinScale,
  getCropBoxExtents,
} from '../utils/imageMath';
import type { Size2D, Position2D } from '../utils/imageMath';
import { clamp } from '../utils/clamp';



export const useCropper = (
  image: string | null,
  containerSize: Size2D,
  originalSize: Size2D
) => {
  const [imageSize, setImageSize] = useState<Size2D>({ width: 0, height: 0 });
  const [position, setPosition] = useState<Position2D>({ x: 0, y: 0 }); 
  const [imagePosition, setImagePositionState] = useState<Position2D>({ x: 0, y: 0 }); 
  const imagePositionRef = useRef<Position2D>({ x: 0, y: 0 });

  // Wrapper to keep ref in sync with state
  const setImagePosition = useCallback((updater: Position2D | ((prev: Position2D) => Position2D)) => {
    setImagePositionState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      imagePositionRef.current = next;
      return next;
    });
  }, []);
  const [rotation, setRotationState] = useState(0); // degrees
  const [cropWidth, setCropWidth] = useState(500);
  const [cropHeight, setCropHeight] = useState(500);
  const [aspectRatio, setAspectRatioState] = useState<number | 'free'>('free');

  // Zoom hook
  const { scale, setScale, minScale, setMinScale } = useZoom(1, 0.1, 4);

  // Keep minScale in sync with cropBox dimensions and rotation to prevent zooming out too far
  useEffect(() => {
    if (imageSize.width === 0) return;
    const newMinScale = getMinScale(imageSize, cropWidth, cropHeight, rotation);
    setMinScale(newMinScale);
  }, [imageSize, cropWidth, cropHeight, rotation, setMinScale]);

  // References for touch pinch-to-zoom
  const startPinchDistRef = useRef<number | null>(null);
  const startPinchScaleRef = useRef<number>(1);
  const isPinchZooming = useRef<boolean>(false);

  // Tracks the dimensions of the crop box at the start of a resize gesture
  const [startCropBox, setStartCropBox] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Refs for tracking container
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Stable refs for action-only functions so that the init effect doesn't
  // re-run when their identity changes (setScale changes when minScale changes).
  const setScaleRef = useRef(setScale);
  const setMinScaleRef = useRef(setMinScale);
  useEffect(() => { setScaleRef.current = setScale; }, [setScale]);
  useEffect(() => { setMinScaleRef.current = setMinScale; }, [setMinScale]);

  // Initialize crop workspace parameters when image is loaded
  useEffect(() => {
    if (!image || originalSize.width === 0 || originalSize.height === 0) return;

    // Fit the image entirely within 80% of the workspace container (zoomed out view)
    const containerFitScale = Math.min(
      (containerSize.width - 80) / originalSize.width,
      (containerSize.height - 80) / originalSize.height
    );
    const startScale = Math.min(1, containerFitScale);

    
    let baseScale = startScale;
    let initialW = originalSize.width * baseScale;
    let initialH = originalSize.height * baseScale;
    
    // Max constraints
    const maxW = Math.min(500, containerSize.width - 80);
    const maxH = Math.min(500, containerSize.height - 80);
    const fitMax = Math.min(1, maxW / initialW, maxH / initialH);
    initialW *= fitMax;
    initialH *= fitMax;
    baseScale *= fitMax;

    // Min constraints
    if (initialW < 60 || initialH < 60) {
      const fitMin = Math.max(60 / initialW, 60 / initialH);
      initialW *= fitMin;
      initialH *= fitMin;
      baseScale *= fitMin;
    }

    const initialMinScale = getMinScale(originalSize, initialW, initialH, 0);

    setImageSize({ width: originalSize.width, height: originalSize.height });
    setPosition({ x: 0, y: 0 });
    setImagePosition({ x: 0, y: 0 });
    setRotationState(0);
    setMinScaleRef.current(initialMinScale);
    setScaleRef.current(Math.max(baseScale, initialMinScale));
    setCropWidth(initialW);
    setCropHeight(initialH);
    setAspectRatioState('free');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image, originalSize, containerSize.width, containerSize.height]);

  // Clamp position when scale or rotation changes
  const adjustCropBoxOnZoom = useCallback((newScale: number, newRotation: number) => {
    
    const imgPos = imagePositionRef.current;
    setPosition((prev) => {
      const relPos = { x: prev.x - imgPos.x, y: prev.y - imgPos.y };
      const clampedRelPos = clampImagePosition(relPos, newScale, imageSize, cropWidth, cropHeight, newRotation);
      return { x: clampedRelPos.x + imgPos.x, y: clampedRelPos.y + imgPos.y };
    });
  }, [cropWidth, cropHeight, imageSize]);

  // Wrapped setter for scale to enforce cropping constraints.
  // Also adjusts imagePosition proportionally so the viewport center stays
  // fixed on the same image point (prevents drift when zoomed and panned).
  const updateScale = useCallback((s: number | ((prev: number) => number)) => {
    setScale((prev) => {
      let next = typeof s === 'function' ? s(prev) : s;
      next = Math.max(next, minScale); // Strictly enforce minScale

      if (next !== prev) {
        const ratio = next / prev;
        const curIP = imagePositionRef.current;
        const newIP = { x: curIP.x * ratio, y: curIP.y * ratio };
        setImagePosition(newIP);

        // Clamp crop box relative to the adjusted image position
        setPosition((prevPos) => {
          const relPos = { x: prevPos.x - newIP.x, y: prevPos.y - newIP.y };
          const clampedRelPos = clampImagePosition(relPos, next, imageSize, cropWidth, cropHeight, rotation);
          return { x: clampedRelPos.x + newIP.x, y: clampedRelPos.y + newIP.y };
        });
      }

      return next;
    });
  }, [setScale, rotation, minScale, imageSize, cropWidth, cropHeight]);

  // Set rotation
  const setRotation = useCallback((deg: number) => {
    const nextDeg = ((deg % 360) + 360) % 360;
    const deltaDeg = nextDeg - rotation;
    const is90DegShift = Math.abs(deltaDeg) === 90 || Math.abs(deltaDeg) === 270;
    
    setRotationState(nextDeg);
    
    if (is90DegShift) {
      let newCropW = cropHeight;
      let newCropH = cropWidth;
      
      const maxW = containerSize.width - 80;
      const maxH = containerSize.height - 80;
      
      const fitRatio = Math.min(1, maxW / newCropW, maxH / newCropH);
      
      newCropW = Math.round(newCropW * fitRatio);
      newCropH = Math.round(newCropH * fitRatio);
      
      setCropWidth(newCropW);
      setCropHeight(newCropH);
      
      if (aspectRatio !== 'free') {
        setAspectRatioState(1 / aspectRatio);
      }
      
      const newMinScale = getMinScale(imageSize, newCropW, newCropH, nextDeg);
      setMinScale(newMinScale);
      
      setScale((prevScale) => {
        let nextScale = prevScale * fitRatio;
        nextScale = Math.max(nextScale, newMinScale);
        
        let finalImgPos = imagePositionRef.current;
        const actualRatio = nextScale / prevScale;
        finalImgPos = { x: finalImgPos.x * actualRatio, y: finalImgPos.y * actualRatio };
        setImagePosition(finalImgPos);
        
        setPosition((prevPos) => {
          const oldRel = { x: prevPos.x - imagePositionRef.current.x, y: prevPos.y - imagePositionRef.current.y };
          const theta = (deltaDeg * Math.PI) / 180;
          const cos = Math.round(Math.cos(theta));
          const sin = Math.round(Math.sin(theta));
          
          const rotX = oldRel.x * cos - oldRel.y * sin;
          const rotY = oldRel.x * sin + oldRel.y * cos;
          
          const scaledRel = { x: rotX * actualRatio, y: rotY * actualRatio };
          const clamped = clampImagePosition(scaledRel, nextScale, imageSize, newCropW, newCropH, nextDeg);
          
          return { x: clamped.x + finalImgPos.x, y: clamped.y + finalImgPos.y };
        });
        
        return nextScale;
      });
      
    } else {
      const newMinScale = getMinScale(imageSize, cropWidth, cropHeight, nextDeg);
      setMinScale(newMinScale);
      
      setScale((prev) => {
        const nextScale = Math.max(prev, newMinScale);
        
        let finalImgPos = imagePositionRef.current;
        if (nextScale !== prev) {
           const ratio = nextScale / prev;
           finalImgPos = { x: finalImgPos.x * ratio, y: finalImgPos.y * ratio };
           setImagePosition(finalImgPos);
        }

        setPosition((prevPos) => {
          const relPos = { x: prevPos.x - imagePositionRef.current.x, y: prevPos.y - imagePositionRef.current.y };
          const clampedRelPos = clampImagePosition(relPos, nextScale, imageSize, cropWidth, cropHeight, nextDeg);
          return { x: clampedRelPos.x + finalImgPos.x, y: clampedRelPos.y + finalImgPos.y };
        });

        return nextScale;
      });
    }
  }, [rotation, cropWidth, cropHeight, containerSize, aspectRatio, imageSize, setMinScale, setScale]);

  // Reset
  const reset = useCallback(() => {
    if (imageSize.width === 0) return;

    const containerFitScale = Math.min(
      (containerSize.width - 80) / imageSize.width,
      (containerSize.height - 80) / imageSize.height
    );
    const startScale = Math.min(1, containerFitScale);

    
    let baseScale = startScale;
    let initialW = imageSize.width * baseScale;
    let initialH = imageSize.height * baseScale;
    
    // Max constraints
    const maxW = Math.min(500, containerSize.width - 80);
    const maxH = Math.min(500, containerSize.height - 80);
    const fitMax = Math.min(1, maxW / initialW, maxH / initialH);
    initialW *= fitMax;
    initialH *= fitMax;
    baseScale *= fitMax;

    // Min constraints
    if (initialW < 60 || initialH < 60) {
      const fitMin = Math.max(60 / initialW, 60 / initialH);
      initialW *= fitMin;
      initialH *= fitMin;
      baseScale *= fitMin;
    }

    const initialMinScale = getMinScale(imageSize, initialW, initialH, 0);

    setPosition({ x: 0, y: 0 });
    setImagePosition({ x: 0, y: 0 });
    setRotationState(0);
    setMinScaleRef.current(initialMinScale);
    setScaleRef.current(Math.max(baseScale, initialMinScale));
    setCropWidth(initialW);
    setCropHeight(initialH);
    setAspectRatioState('free');
  }, [imageSize, containerSize]);

  // Set aspect ratio
  const setAspectRatio = useCallback((ratio: number | 'free') => {
    setAspectRatioState(ratio);
    if (ratio === 'free') return;

    let newWidth = cropWidth;
    let newHeight = newWidth / ratio;

    const maxW = Math.min(containerSize.width - 40, imageSize.width * scale);
    const maxH = Math.min(containerSize.height - 40, imageSize.height * scale);

    if (newHeight > maxH) {
      newHeight = maxH;
      newWidth = newHeight * ratio;
    }
    if (newWidth > maxW) {
      newWidth = maxW;
      newHeight = newWidth / ratio;
    }

    setCropWidth(Math.round(newWidth));
    setCropHeight(Math.round(newHeight));
    setPosition((prev) => {
      const relPos = { x: prev.x - imagePosition.x, y: prev.y - imagePosition.y };
      const clampedRelPos = clampImagePosition(relPos, scale, imageSize, newWidth, newHeight, rotation);
      return { x: clampedRelPos.x + imagePosition.x, y: clampedRelPos.y + imagePosition.y };
    });
  }, [cropWidth, scale, imageSize, containerSize, rotation, imagePosition]);

  // Drag callback for the crop box
  const handleCropDrag = useCallback((dx: number, dy: number) => {
    setPosition((prevCropPos) => {
      const targetCropPos = { x: prevCropPos.x + dx, y: prevCropPos.y + dy };
      const targetRelPos = { x: targetCropPos.x - imagePosition.x, y: targetCropPos.y - imagePosition.y };
      const clampedRelPos = clampImagePosition(
        targetRelPos,
        scale,
        imageSize,
        cropWidth,
        cropHeight,
        rotation
      );
      return { x: clampedRelPos.x + imagePosition.x, y: clampedRelPos.y + imagePosition.y };
    });
  }, [scale, imageSize, cropWidth, cropHeight, rotation, imagePosition]);

  // Drag callback for the image (pan)
  const handleImageDrag = useCallback((dx: number, dy: number) => {
    setImagePosition((prevImagePos) => {
      const targetImagePos = { x: prevImagePos.x + dx, y: prevImagePos.y + dy };
      const targetRelPos = { x: position.x - targetImagePos.x, y: position.y - targetImagePos.y };
      const clampedRelPos = clampImagePosition(
        targetRelPos,
        scale,
        imageSize,
        cropWidth,
        cropHeight,
        rotation
      );
      return { x: position.x - clampedRelPos.x, y: position.y - clampedRelPos.y };
    });
  }, [scale, imageSize, cropWidth, cropHeight, rotation, position]);

  const cropDrag = useDrag(handleCropDrag);
  const imageDrag = useDrag(handleImageDrag);

  // Resize handler (handles edge and corner resizes non-symmetrically)
  const handleResize = useCallback((handle: CropHandleType, dx: number, dy: number) => {
    let newWidth = startCropBox.width;
    let newHeight = startCropBox.height;
    let newX = startCropBox.x;
    let newY = startCropBox.y;

    // 1. Calculate width/height adjustments
    if (handle === 'R' || handle === 'BR' || handle === 'TR') {
      newWidth = startCropBox.width + dx;
    } else if (handle === 'L' || handle === 'BL' || handle === 'TL') {
      newWidth = startCropBox.width - dx;
    }

    if (handle === 'B' || handle === 'BR' || handle === 'BL') {
      newHeight = startCropBox.height + dy;
    } else if (handle === 'T' || handle === 'TR' || handle === 'TL') {
      newHeight = startCropBox.height - dy;
    }

    // 2. Enforce aspect ratio constraints
    if (aspectRatio !== 'free') {
      if (handle === 'L' || handle === 'R') {
        newHeight = newWidth / aspectRatio;
      } else if (handle === 'T' || handle === 'B') {
        newWidth = newHeight * aspectRatio;
      } else {
        newHeight = newWidth / aspectRatio;
      }
    }

    // 3. Minimum constraints (60px)
    const MIN_SIZE = 60;
    if (newWidth < MIN_SIZE) {
      newWidth = MIN_SIZE;
      if (aspectRatio !== 'free') newHeight = newWidth / aspectRatio;
    }
    if (newHeight < MIN_SIZE) {
      newHeight = MIN_SIZE;
      if (aspectRatio !== 'free') newWidth = newHeight * aspectRatio;
    }

    // Maximum constraints (500px)
    const MAX_SIZE = 500;
    if (newWidth > MAX_SIZE) {
      newWidth = MAX_SIZE;
      if (aspectRatio !== 'free') newHeight = newWidth / aspectRatio;
    }
    if (newHeight > MAX_SIZE) {
      newHeight = MAX_SIZE;
      if (aspectRatio !== 'free') newWidth = newHeight * aspectRatio;
    }

    // 4. Center position shifts
    const dw = newWidth - startCropBox.width;
    const dh = newHeight - startCropBox.height;

    if (handle === 'R' || handle === 'BR' || handle === 'TR') {
      newX = startCropBox.x + dw / 2;
    } else if (handle === 'L' || handle === 'BL' || handle === 'TL') {
      newX = startCropBox.x - dw / 2;
    }

    if (handle === 'B' || handle === 'BR' || handle === 'BL') {
      newY = startCropBox.y + dh / 2;
    } else if (handle === 'T' || handle === 'TR' || handle === 'TL') {
      newY = startCropBox.y - dh / 2;
    }

    // 5. Clamp to image & container bounds
    const maxImgW = imageSize.width * scale;
    const maxImgH = imageSize.height * scale;
    const maxViewportW = containerSize.width - 40;
    const maxViewportH = containerSize.height - 40;

    let maxAllowedW = maxViewportW;
    let maxAllowedH = maxViewportH;

    const theta = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.round(Math.cos(theta))); // 1 for 0/180, 0 for 90/270
    const sin = Math.abs(Math.round(Math.sin(theta))); // 0 for 0/180, 1 for 90/270

    if (aspectRatio !== 'free') {
      const ratio = aspectRatio;
      const effectiveCos = cos + sin / ratio;
      const effectiveSin = sin + cos * ratio;
      
      maxAllowedW = Math.min(maxAllowedW, maxImgW / effectiveCos);
      maxAllowedH = Math.min(maxAllowedH, maxImgH / effectiveSin);
      
      // Keep them tied to the aspect ratio
      maxAllowedW = Math.min(maxAllowedW, maxAllowedH * ratio);
      maxAllowedH = maxAllowedW / ratio;
    } else {
      if (cos === 1) {
        maxAllowedW = Math.min(maxAllowedW, maxImgW);
        maxAllowedH = Math.min(maxAllowedH, maxImgH);
      } else {
        maxAllowedW = Math.min(maxAllowedW, maxImgH);
        maxAllowedH = Math.min(maxAllowedH, maxImgW);
      }
    }

    if (newWidth > maxAllowedW) {
      newWidth = maxAllowedW;
      if (aspectRatio !== 'free') newHeight = newWidth / aspectRatio;
    }
    if (newHeight > maxAllowedH) {
      newHeight = maxAllowedH;
      if (aspectRatio !== 'free') newWidth = newHeight * aspectRatio;
    }

    const finalExt = getCropBoxExtents(newWidth, newHeight, rotation);
    const maxX = Math.max(0, maxImgW / 2 - finalExt.extX);
    const maxY = Math.max(0, maxImgH / 2 - finalExt.extY);

    // Target position relative to image center
    const targetRelX = newX - imagePosition.x;
    const targetRelY = newY - imagePosition.y;

    const clampedRelX = Math.min(Math.max(targetRelX, -maxX), maxX);
    const clampedRelY = Math.min(Math.max(targetRelY, -maxY), maxY);

    const finalX = clampedRelX + imagePosition.x;
    const finalY = clampedRelY + imagePosition.y;

    setCropWidth(Math.round(newWidth));
    setCropHeight(Math.round(newHeight));
    setPosition({ x: Math.round(finalX), y: Math.round(finalY) });
  }, [startCropBox, aspectRatio, rotation, imageSize, scale, containerSize, imagePosition]);

  const { activeHandle, startResize, moveResize, endResize } = useResize(handleResize);

  const startResizeGesture = useCallback((clientX: number, clientY: number, handle: CropHandleType) => {
    startResize(clientX, clientY, handle);
    setStartCropBox({
      x: position.x,
      y: position.y,
      width: cropWidth,
      height: cropHeight,
    });
  }, [startResize, position, cropWidth, cropHeight]);

  // Mouse interaction down: inside cropbox drags cropbox, outside pans image
  const handleWorkspaceMouseDown = useCallback((e: React.MouseEvent<any>) => {
    if (imageSize.width === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cursorX = e.clientX - (rect.left + rect.width / 2);
    const cursorY = e.clientY - (rect.top + rect.height / 2);

    const clickInside =
      Math.abs(cursorX - position.x) <= cropWidth / 2 &&
      Math.abs(cursorY - position.y) <= cropHeight / 2;

    if (clickInside) {
      cropDrag.startDrag(e.clientX, e.clientY);
    } else {
      imageDrag.startDrag(e.clientX, e.clientY);
    }
  }, [imageSize, position, cropWidth, cropHeight, cropDrag.startDrag, imageDrag.startDrag]);

  // Wheel zoom handler – attached natively with { passive: false } so
  // preventDefault() works and the page doesn't scroll while zooming.
  const handleWheelRef = useRef<(e: WheelEvent) => void>(() => {});
  handleWheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    if (imageSize.width === 0) return;

    const zoomStep = 0.02;
    const direction = -e.deltaY > 0 ? 1 : -1;
    const newScale = clamp(scale + direction * zoomStep * scale, minScale, minScale * 4);

    if (newScale === scale) return;

    // Scale imagePosition to keep the viewport center stable on the same image point
    const ratio = newScale / scale;
    const curIP = imagePositionRef.current;
    const newIP = { x: curIP.x * ratio, y: curIP.y * ratio };
    setImagePosition(newIP);

    // Clamp crop box relative to the adjusted image position
    setPosition((prev) => {
      const relPos = { x: prev.x - newIP.x, y: prev.y - newIP.y };
      const clampedRelPos = clampImagePosition(relPos, newScale, imageSize, cropWidth, cropHeight, rotation);
      return { x: clampedRelPos.x + newIP.x, y: clampedRelPos.y + newIP.y };
    });

    setScale(newScale);
  };

  // Attach/detach the native wheel listener on the container element
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: WheelEvent) => handleWheelRef.current(e);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [containerRef]);

  const getTouchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<any>) => {
    if (imageSize.width === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const cursorX = touch.clientX - (rect.left + rect.width / 2);
      const cursorY = touch.clientY - (rect.top + rect.height / 2);

      const clickInside =
        Math.abs(cursorX - position.x) <= cropWidth / 2 &&
        Math.abs(cursorY - position.y) <= cropHeight / 2;

      if (clickInside) {
        cropDrag.startDrag(touch.clientX, touch.clientY);
      } else {
        imageDrag.startDrag(touch.clientX, touch.clientY);
      }
    } else if (e.touches.length === 2) {
      cropDrag.endDrag();
      imageDrag.endDrag();
      isPinchZooming.current = true;
      startPinchDistRef.current = getTouchDistance(e.touches);
      startPinchScaleRef.current = scale;
    }
  }, [imageSize, position, cropWidth, cropHeight, cropDrag.startDrag, imageDrag.startDrag, scale]);

  const handleTouchMove = useCallback((e: React.TouchEvent<any>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (cropDrag.isDragging) {
        cropDrag.moveDrag(touch.clientX, touch.clientY);
      } else if (imageDrag.isDragging) {
        imageDrag.moveDrag(touch.clientX, touch.clientY);
      }
    } else if (e.touches.length === 2 && isPinchZooming.current && startPinchDistRef.current) {
      const currentDist = getTouchDistance(e.touches);
      const zoomRatio = currentDist / startPinchDistRef.current;
      const targetScale = startPinchScaleRef.current * zoomRatio;
      
      updateScale(targetScale);
    }
  }, [cropDrag.isDragging, cropDrag.moveDrag, imageDrag.isDragging, imageDrag.moveDrag, updateScale]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent<any>) => {
    cropDrag.endDrag();
    imageDrag.endDrag();
    startPinchDistRef.current = null;
    isPinchZooming.current = false;
  }, [cropDrag.endDrag, imageDrag.endDrag]);

  // Bind window mouse listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (cropDrag.isDragging) {
        cropDrag.moveDrag(e.clientX, e.clientY);
      } else if (imageDrag.isDragging) {
        imageDrag.moveDrag(e.clientX, e.clientY);
      } else if (activeHandle) {
        moveResize(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      cropDrag.endDrag();
      imageDrag.endDrag();
      endResize();
    };

    if (cropDrag.isDragging || imageDrag.isDragging || activeHandle) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    cropDrag.isDragging,
    cropDrag.moveDrag,
    cropDrag.endDrag,
    imageDrag.isDragging,
    imageDrag.moveDrag,
    imageDrag.endDrag,
    activeHandle,
    moveResize,
    endResize,
  ]);

  // Keyboard Shortcuts (Arrow keys move crop box, ESC cancels, +/- zoom, R resets)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const moveStep = 10;
    const zoomStep = 0.05;

    switch (e.key) {
      case 'ArrowLeft': {
        e.preventDefault();
        setPosition((prev) => {
          const targetCropPos = { x: prev.x - moveStep, y: prev.y };
          const targetRelPos = { x: targetCropPos.x - imagePosition.x, y: targetCropPos.y - imagePosition.y };
          const clampedRelPos = clampImagePosition(
            targetRelPos,
            scale,
            imageSize,
            cropWidth,
            cropHeight,
            rotation
          );
          return { x: clampedRelPos.x + imagePosition.x, y: clampedRelPos.y + imagePosition.y };
        });
        break;
      }
      case 'ArrowRight': {
        e.preventDefault();
        setPosition((prev) => {
          const targetCropPos = { x: prev.x + moveStep, y: prev.y };
          const targetRelPos = { x: targetCropPos.x - imagePosition.x, y: targetCropPos.y - imagePosition.y };
          const clampedRelPos = clampImagePosition(
            targetRelPos,
            scale,
            imageSize,
            cropWidth,
            cropHeight,
            rotation
          );
          return { x: clampedRelPos.x + imagePosition.x, y: clampedRelPos.y + imagePosition.y };
        });
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        setPosition((prev) => {
          const targetCropPos = { x: prev.x, y: prev.y - moveStep };
          const targetRelPos = { x: targetCropPos.x - imagePosition.x, y: targetCropPos.y - imagePosition.y };
          const clampedRelPos = clampImagePosition(
            targetRelPos,
            scale,
            imageSize,
            cropWidth,
            cropHeight,
            rotation
          );
          return { x: clampedRelPos.x + imagePosition.x, y: clampedRelPos.y + imagePosition.y };
        });
        break;
      }
      case 'ArrowDown': {
        e.preventDefault();
        setPosition((prev) => {
          const targetCropPos = { x: prev.x, y: prev.y + moveStep };
          const targetRelPos = { x: targetCropPos.x - imagePosition.x, y: targetCropPos.y - imagePosition.y };
          const clampedRelPos = clampImagePosition(
            targetRelPos,
            scale,
            imageSize,
            cropWidth,
            cropHeight,
            rotation
          );
          return { x: clampedRelPos.x + imagePosition.x, y: clampedRelPos.y + imagePosition.y };
        });
        break;
      }
      case '+':
      case '=':
        e.preventDefault();
        updateScale((prev) => prev * (1 + zoomStep));
        break;
      case '-':
      case '_':
        e.preventDefault();
        updateScale((prev) => prev * (1 - zoomStep));
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        reset();
        break;
      default:
        break;
    }
  }, [scale, imageSize, cropWidth, cropHeight, rotation, updateScale, reset, imagePosition]);

  return {
    containerRef,
    imageSize,
    position,
    imagePosition,
    setPosition,
    scale,
    setScale: updateScale,
    minScale,
    rotation,
    setRotation,
    cropWidth,
    cropHeight,
    aspectRatio,
    setAspectRatio,
    reset,
    
    // Drag states & actions
    isDragging: cropDrag.isDragging || imageDrag.isDragging,
    startDrag: cropDrag.startDrag,

    // Resize states & actions
    activeHandle,
    startResize: startResizeGesture,

    // Gesture Handlers
    handleWorkspaceMouseDown,

    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleKeyDown,
  };
};
