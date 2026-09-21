import React from 'react';
import type { CropHandleType } from '../hooks/useResize';

interface CropHandlesProps {
  onHandleMouseDown: (e: React.MouseEvent, handle: CropHandleType) => void;
  onHandleTouchStart: (e: React.TouchEvent, handle: CropHandleType) => void;
}

/**
 * Renders corner handles (L-shaped) and edge handles (invisible grab bars)
 * for resizing the crop box, alongside rule-of-thirds grid lines.
 */
export const CropHandles: React.FC<CropHandlesProps> = React.memo(({
  onHandleMouseDown,
  onHandleTouchStart,
}) => {
  const cornerHandles: { type: CropHandleType; className: string; cursor: string }[] = [
    {
      type: 'TL',
      className: 'top-0 left-0 border-t-[4px] border-l-[4px] -translate-x-[2px] -translate-y-[2px]',
      cursor: 'cursor-nwse-resize',
    },
    {
      type: 'TR',
      className: 'top-0 right-0 border-t-[4px] border-r-[4px] translate-x-[2px] -translate-y-[2px]',
      cursor: 'cursor-nesw-resize',
    },
    {
      type: 'BL',
      className: 'bottom-0 left-0 border-b-[4px] border-l-[4px] -translate-x-[2px] translate-y-[2px]',
      cursor: 'cursor-nesw-resize',
    },
    {
      type: 'BR',
      className: 'bottom-0 right-0 border-b-[4px] border-r-[4px] translate-x-[2px] translate-y-[2px]',
      cursor: 'cursor-nwse-resize',
    },
  ];

  const edgeHandles: { type: CropHandleType; className: string; cursor: string }[] = [
    {
      type: 'T',
      className: 'top-0 left-3 right-3 h-3 -translate-y-[6px]',
      cursor: 'cursor-ns-resize',
    },
    {
      type: 'B',
      className: 'bottom-0 left-3 right-3 h-3 translate-y-[6px]',
      cursor: 'cursor-ns-resize',
    },
    {
      type: 'L',
      className: 'left-0 top-3 bottom-3 w-3 -translate-x-[6px]',
      cursor: 'cursor-ew-resize',
    },
    {
      type: 'R',
      className: 'right-0 top-3 bottom-3 w-3 translate-x-[6px]',
      cursor: 'cursor-ew-resize',
    },
  ];

  return (
    <>
      {/* Rule of Thirds Grid Lines */}
      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
        <div className="border-r border-b border-white/30" />
        <div className="border-r border-b border-white/30" />
        <div className="border-b border-white/30" />
        <div className="border-r border-b border-white/30" />
        <div className="border-r border-b border-white/30" />
        <div className="border-b border-white/30" />
        <div className="border-r border-white/30" />
        <div className="border-r border-white/30" />
        <div />
      </div>

      {/* L-Shaped Corner Handles */}
      {cornerHandles.map((h) => {
        const handleMouseDown = (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          onHandleMouseDown(e, h.type);
        };

        const handleTouchStart = (e: React.TouchEvent) => {
          e.stopPropagation();
          onHandleTouchStart(e, h.type);
        };

        return (
          <div
            key={h.type}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`absolute w-5 h-5 border-blue-500 hover:border-blue-400 bg-transparent pointer-events-auto transition-colors z-30 ${h.className} ${h.cursor}`}
            style={{ willChange: 'transform' }}
          />
        );
      })}

      {/* Edge Resizing Handles (invisible grab zones along the edges) */}
      {edgeHandles.map((h) => {
        const handleMouseDown = (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          onHandleMouseDown(e, h.type);
        };

        const handleTouchStart = (e: React.TouchEvent) => {
          e.stopPropagation();
          onHandleTouchStart(e, h.type);
        };

        return (
          <div
            key={h.type}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={`absolute pointer-events-auto bg-transparent hover:bg-blue-500/10 z-20 transition-colors ${h.className} ${h.cursor}`}
          />
        );
      })}

      {/* Visual Edge Indicators (Static Alignment Guides) */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-[1px] w-[2px] h-6 bg-blue-500/80 pointer-events-none rounded" />
      <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-[1px] w-[2px] h-6 bg-blue-500/80 pointer-events-none rounded" />
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[1px] w-6 h-[2px] bg-blue-500/80 pointer-events-none rounded" />
      <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-[1px] w-6 h-[2px] bg-blue-500/80 pointer-events-none rounded" />
    </>
  );
});

CropHandles.displayName = 'CropHandles';
