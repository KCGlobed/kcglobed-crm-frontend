import React, { useState } from 'react';
import { CropperModal } from '../components/CropperModal';
import type { CropResult } from '../utils/cropCanvas';

const ImageCropper: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [croppedResult, setCroppedResult] = useState<CropResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setCroppedResult(null); // Clear previous crop
      setIsModalOpen(true); // Open modal
    };
    reader.readAsDataURL(file);
    
    // Clear value to allow re-uploading the same file
    e.target.value = '';
  };

  const handleCropComplete = (result: CropResult) => {
    setCroppedResult(result);
    
    // Log the output objects as requested
    console.log('--- Crop Generation Complete ---');
    console.log('1. File Object:', result.file);
    console.log('2. Blob Object:', result.blob);
    console.log('3. DataURL:', result.dataUrl.slice(0, 50) + '...');
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10">
          <span className="text-blue-600 text-xs font-bold tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            TypeScript + Canvas API
          </span>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mt-3">
            Production-Grade Image Cropper
          </h1>
          <p className="mt-2 text-md text-slate-600 max-w-xl mx-auto">
            A performant, gesture-supported, resizable image cropper utilizing custom hooks and canvas optimizations.
          </p>
        </div>

        {/* Upload Card / Workspace */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-8 flex flex-col items-center justify-center min-h-[400px]">
          {!croppedResult ? (
            <div className="w-full max-w-md text-center">
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400 cursor-pointer transition-all group flex flex-col items-center">
                <svg className="w-16 h-16 text-slate-400 group-hover:text-blue-500 transition-colors mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-slate-700 font-semibold text-lg block mb-1">Select an image</span>
                <span className="text-slate-400 text-sm block mb-6">Supports PNG, JPG, WebP up to 25MB</span>
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-md transition-colors inline-block pointer-events-auto">
                  Browse Files
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <span className="text-green-600 text-xs font-bold uppercase bg-green-50 px-3 py-1 rounded-full border border-green-100 mb-2">
                Successfully Cropped
              </span>
              <h2 className="text-2xl font-bold text-slate-800 mb-6">Result Output</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full items-center">
                
                {/* Result Preview */}
                <div className="w-full rounded-xl overflow-hidden border border-slate-200 shadow-md bg-slate-100 p-4 flex justify-center h-72">
                  <img
                    src={croppedResult.dataUrl}
                    alt="Cropped output"
                    className="max-h-full object-contain rounded-lg shadow-sm"
                  />
                </div>

                {/* Result Metadata / Objects */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Export Details
                  </h3>
                  
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-slate-400 block">File Name</span>
                      <span className="font-semibold text-slate-800 break-all">{croppedResult.file.name}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">MIME Type</span>
                      <span className="font-semibold text-slate-800">{croppedResult.file.type}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">File Size</span>
                      <span className="font-mono text-slate-800 font-bold">
                        {(croppedResult.file.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 block">Export Format</span>
                      <span className="text-xs font-mono text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 inline-block font-semibold">
                        File & Blob Objects generated successfully
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="flex gap-4 w-full max-w-md mt-10">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex-1 bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 border border-slate-300 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Re-edit Crop
                </button>
                
                <a
                  href={croppedResult.dataUrl}
                  download={croppedResult.file.name}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg shadow-md transition-colors text-center flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </a>

                <button
                  onClick={() => {
                    setCroppedResult(null);
                    setImage(null);
                  }}
                  className="p-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg border border-red-200 transition-colors"
                  title="Discard Image"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Editor Modal */}
      <CropperModal
        imageSrc={image}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};

export default ImageCropper;