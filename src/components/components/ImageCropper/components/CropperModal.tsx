import React, { useRef, useState, useEffect, useCallback } from 'react';
import { CropWorkspace } from './CropWorkspace';
import { CropPreview } from './CropPreview';
import { CropControls } from './CropControls';
import { useCropper } from '../hooks/useCropper';
import { cropImageToFiles } from '../utils/cropCanvas';
import type { CropResult } from '../utils/cropCanvas';
import { calculateDisplaySize } from '../utils/imageMath';
import type { Size2D } from '../utils/imageMath';

interface CropperModalProps {
  imageSrc: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (result: CropResult) => void;
  initialFormat?: 'image/png' | 'image/jpeg';
}

/**
 * Fullscreen Modal container coordinating the workspace, real-time preview,
 * controls, and keyboard short-cuts. Handles high-resolution downscaling for edits.
 */
export const CropperModal: React.FC<CropperModalProps> = ({
  imageSrc,
  isOpen,
  onClose,
  onCropComplete,
  initialFormat = 'image/png',
}) => {
  const [originalSize, setOriginalSize] = useState<Size2D>({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState<Size2D>({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState<Size2D>({ width: 600, height: 400 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Export formats & Quality states
  const [outputFormat, setOutputFormat] = useState<'image/png' | 'image/jpeg'>(initialFormat);
  const [jpegQuality, setJpegQuality] = useState(0.9);

  // Reset outputFormat when initialFormat or imageSrc changes (new image uploaded)
  useEffect(() => {
    if (isOpen) {
      setOutputFormat(initialFormat);
    }
  }, [initialFormat, imageSrc, isOpen]);

  // References
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Read original image dimensions and prepare display downscaling
  useEffect(() => {
    if (!imageSrc || !isOpen) return;

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const orig = { width: img.width, height: img.height };
      setOriginalSize(orig);
      
      // Keep edit image below 2048px for GPU smoothness and avoiding mobile Safari out of memory crashes
      const display = calculateDisplaySize(orig, 2048);
      setDisplaySize(display);
    };
  }, [imageSrc, isOpen]);

  // Hook instantiation
  const cropper = useCropper(imageSrc, containerSize, displaySize);

  // Track workspace size to dynamically constrain crop window
  useEffect(() => {
    if (!isOpen || !cropper.containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width || 600,
          height: entry.contentRect.height || 400,
        });
      }
    });

    resizeObserver.observe(cropper.containerRef.current);
    return () => resizeObserver.disconnect();
  }, [isOpen, cropper.containerRef]);

  // Keyboard events listener
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field somewhere
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        cropper.setScale((s) => Math.min(s + 0.1, cropper.minScale * 8));
        return;
      }
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        cropper.setScale((s) => Math.max(s - 0.1, cropper.minScale));
        return;
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        if (e.shiftKey) {
          cropper.setRotation((cropper.rotation - 90 + 360) % 360);
        } else {
          cropper.setRotation((cropper.rotation + 90) % 360);
        }
        return;
      }

      cropper.handleKeyDown(e);
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [isOpen, onClose, cropper]);

  // Execute Canvas Cropping
  const handleCropSave = useCallback(async () => {
    if (!imageSrc || displaySize.width === 0) return;
    setIsProcessing(true);

    try {
      const result = await cropImageToFiles({
        imageSrc,
        originalSize,
        displaySize,
        cropWidth: cropper.cropWidth,
        cropHeight: cropper.cropHeight,
        position: { x: cropper.position.x - cropper.imagePosition.x, y: cropper.position.y - cropper.imagePosition.y },
        scale: cropper.scale,
        rotation: cropper.rotation,
        format: outputFormat,
        quality: jpegQuality,
      });
      onCropComplete(result);
      onClose();
    } catch (error) {
      console.error('Failed to crop image:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [
    imageSrc,
    originalSize,
    displaySize,
    cropper.cropWidth,
    cropper.cropHeight,
    cropper.position,
    cropper.imagePosition,
    cropper.scale,
    cropper.rotation,
    outputFormat,
    jpegQuality,
    onCropComplete,
    onClose,
  ]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[85vh] md:h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Edit and Crop Image</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Pan: Drag | Zoom: Scroll or Slider | Resize Frame: Drag Corners | Keyboard: Arrows, R to reset
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-50">
          
          {/* Work area container (left) */}
          <div className="flex-1 h-full bg-slate-950 flex items-center justify-center relative select-none overflow-hidden min-h-[300px]">
            <CropWorkspace
              containerRef={cropper.containerRef}
              imageRef={imageRef}
              image={imageSrc}
              imageSize={cropper.imageSize}
              position={cropper.position}
              imagePosition={cropper.imagePosition}
              scale={cropper.scale}
              rotation={cropper.rotation}
              cropWidth={cropper.cropWidth}
              cropHeight={cropper.cropHeight}
              onMouseDown={cropper.handleWorkspaceMouseDown}
              onTouchStart={cropper.handleTouchStart}
              onTouchMove={cropper.handleTouchMove}
              onTouchEnd={cropper.handleTouchEnd}
              onHandleMouseDown={(e, h) => cropper.startResize(e.clientX, e.clientY, h)}
              onHandleTouchStart={(e, h) => {
                const touch = e.touches[0];
                cropper.startResize(touch.clientX, touch.clientY, h);
              }}
            />
          </div>

          {/* Controls & Real-Time Preview (right) */}
          <div className="flex flex-col border-l border-slate-100 bg-white">
            <div className="p-4 border-b border-slate-100 flex justify-center bg-slate-50/50">
              <CropPreview
                image={imageSrc}
                imageSize={cropper.imageSize}
                position={{ x: cropper.position.x - cropper.imagePosition.x, y: cropper.position.y - cropper.imagePosition.y }}
                scale={cropper.scale}
                rotation={cropper.rotation}
                cropWidth={cropper.cropWidth}
                cropHeight={cropper.cropHeight}
              />
            </div>
            
            <CropControls
              scale={cropper.scale}
              minScale={cropper.minScale}
              onScaleChange={cropper.setScale}
              rotation={cropper.rotation}
              onRotationChange={cropper.setRotation}
              aspectRatio={cropper.aspectRatio}
              onAspectRatioChange={cropper.setAspectRatio}
              outputFormat={outputFormat}
              jpegQuality={jpegQuality}
              onReset={cropper.reset}
              onCrop={handleCropSave}
              onCancel={onClose}
              isProcessing={isProcessing}
            />
          </div>
        </div>

      </div>
    </div>
  );
};
