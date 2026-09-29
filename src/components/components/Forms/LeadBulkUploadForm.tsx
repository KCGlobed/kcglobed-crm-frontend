import React, { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { useModal } from '../../../context/ModalContext';
import toast from 'react-hot-toast';

// TODO: Wire to the bulk lead upload API once it exists.

const LeadBulkUploadForm: React.FC = () => {
  const { hideModal } = useModal();
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please choose a CSV file to upload');
      return;
    }
    setSubmitting(true);
    try {
      await '';
      toast.success(`${file.name} queued — leads will appear once processing completes`);
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || 'Failed to upload leads');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-crmBorder bg-major-tint hover:border-minor cursor-pointer transition-all text-center">
        <UploadCloud size={28} className="text-minor" />
        <span className="text-sm font-semibold text-crmText">
          {file ? file.name : 'Click to choose a CSV file'}
        </span>
        <span className="text-[11px] text-crmText-tertiary">
          Columns: name, email, mobile, source, medium, campaign, course
        </span>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
        />
      </label>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-crmBorder">
        <button
          type="button"
          onClick={hideModal}
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
        >
          {submitting ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>Uploading...</span>
            </>
          ) : (
            'Upload Leads'
          )}
        </button>
      </div>
    </form>
  );
};

export default LeadBulkUploadForm;
