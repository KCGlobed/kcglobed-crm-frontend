import React from 'react';

interface CropControlsProps {
  scale: number;
  minScale: number;
  onScaleChange: (scale: number) => void;
  rotation: number;
  onRotationChange: (deg: number) => void;
  aspectRatio: number | 'free';
  onAspectRatioChange: (ratio: number | 'free') => void;
  outputFormat: 'image/png' | 'image/jpeg';
  jpegQuality: number;
  onReset: () => void;
  onCrop: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}


export const CropControls: React.FC<CropControlsProps> = React.memo(({
  scale,
  minScale,
  onScaleChange,
  rotation,
  onRotationChange,
  aspectRatio,
  onAspectRatioChange,
  onReset,
  onCrop,
  onCancel,
  isProcessing,
}) => {
  return (
    <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-100 bg-white p-6 flex flex-col justify-between overflow-y-auto gap-6 select-none">
      <div className="space-y-6">
        


        {/* Zoom Slider */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Zoom
            </h4>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
              {scale.toFixed(2)}x
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onScaleChange(Math.max(scale - 0.1, minScale))}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
              </svg>
            </button>
            <input
              type="range"
              min={minScale}
              max={minScale * 4}
              step={0.01}
              value={scale}
              onChange={(e) => onScaleChange(Number(e.target.value))}
              className="flex-1 accent-slate-950 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
            />
            <button
              type="button"
              onClick={() => onScaleChange(Math.min(scale + 0.1, minScale * 8))}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Rotation Controls */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Rotation
          </h4>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onRotationChange((rotation - 90 + 360) % 360)}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">↺</span>
              Rotate Left
            </button>
            <button
              type="button"
              onClick={() => onRotationChange((rotation + 90) % 360)}
              className="flex-1 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
            >
              <span className="text-lg leading-none">↻</span>
              Rotate Right
            </button>
          </div>
        </div>



      </div>

      {/* Control Actions */}
      <div className="border-t border-slate-100 pt-4 space-y-2">
        <button
          type="button"
          onClick={onReset}
          className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold py-2.5 rounded-lg border border-slate-200 transition-colors text-sm flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89" />
          </svg>
          Reset View
        </button>
        
        <button
          type="button"
          onClick={onCrop}
          disabled={isProcessing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-lg shadow-md transition-colors text-sm flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Crop & Apply
            </>
          )}
        </button>
        
        <button
          type="button"
          onClick={onCancel}
          className="w-full bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 font-semibold py-2.5 rounded-lg border border-slate-200 transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
});

CropControls.displayName = 'CropControls';
