import React, { useState, useMemo, useEffect } from 'react';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { createModule, updateModule, fetchModules } from '../../../store/slices/moduleSlice';
import toast from 'react-hot-toast';
import type { Module } from '../../../utils/types';

interface ModuleFormProps {
  moduleData?: Module;
  onSuccess?: () => void;
}

// Automatically derive slug code from module name (lowercase and underscore-delimited)
const deriveCode = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const ModuleForm: React.FC<ModuleFormProps> = ({ moduleData, onSuccess }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { data: modules, actionLoading } = useAppSelector((state) => state.modules);

  const isEdit = !!moduleData;

  const [name, setName] = useState(moduleData?.name || '');
  const [description, setDescription] = useState(moduleData?.description || '');
  const [submitting, setSubmitting] = useState(false);

  // Fetch modules if list is empty
  useEffect(() => {
    if (!modules || modules.length === 0) {
      dispatch(fetchModules());
    }
  }, [dispatch, modules]);

  // Suggest the next free slot so new modules land after existing ones
  const nextSortOrder = useMemo(() => {
    const highest = (modules || []).reduce((max, m) => Math.max(max, m.sort_order ?? 0), 0);
    return String(highest + 10);
  }, [modules]);

  const [sortOrder, setSortOrder] = useState(
    moduleData?.sort_order != null ? String(moduleData.sort_order) : nextSortOrder
  );

  useEffect(() => {
    if (!isEdit && (!sortOrder || sortOrder === '10') && nextSortOrder) {
      setSortOrder(nextSortOrder);
    }
  }, [nextSortOrder, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Module name is required');
      return;
    }

    // Automatically derive the module code from the name entered by user
    const autoCode = deriveCode(name);
    if (!autoCode) {
      toast.error('Please enter a valid module name');
      return;
    }

    // Check for duplicate code (exclude current module if editing)
    const isDuplicate = (modules || []).some(
      (m) =>
        m.code?.toLowerCase() === autoCode.toLowerCase() &&
        (!isEdit || m.id !== moduleData?.id)
    );
    if (isDuplicate) {
      toast.error(`A module with code "${autoCode}" already exists. Please choose a different name.`);
      return;
    }

    setSubmitting(true);
    try {
      // Modules are active by default and parent is omitted
      const payload: Module = {
        name: name.trim(),
        code: autoCode,
        module_code: autoCode,
        description: description.trim(),
        sort_order: sortOrder.trim() !== '' ? Number(sortOrder) : 0,
        is_active: true,
      };

      if (isEdit && moduleData?.id != null) {
        await dispatch(updateModule({ id: moduleData.id, payload })).unwrap();
        toast.success('Module updated successfully');
      } else {
        await dispatch(createModule(payload)).unwrap();
        toast.success('Module created successfully');
      }
      dispatch(fetchModules());
      onSuccess?.();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || (isEdit ? 'Failed to update module' : 'Failed to create module'));
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || actionLoading;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 2-Column Grid: Name & Sort Order */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Module Name */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Module Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Leads, Admissions, Academics..."
            required
            autoFocus
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
          />
          {name.trim() && (
            <p className="mt-1.5 text-[11px] text-crmText-tertiary font-mono">
              Auto-generated code: <span className="text-minor font-semibold">{deriveCode(name)}</span>
            </p>
          )}
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Sort Order
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            placeholder="10"
            min={0}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm"
          />
          <p className="mt-1.5 text-[11px] text-crmText-tertiary">
            Determines the ordering of modules in navigation and lists.
          </p>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this module's scope and purpose..."
          rows={3}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-sm text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all shadow-sm resize-y"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end items-center gap-3 pt-3 border-t border-crmBorder">
        <button
          type="button"
          onClick={hideModal}
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl border border-crmBorder bg-major hover:bg-major-tint text-crmText text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-5 py-2.5 rounded-xl bg-minor hover:bg-minor-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>{isEdit ? 'Updating...' : 'Creating...'}</span>
            </>
          ) : (
            isEdit ? 'Update Module' : 'Create Module'
          )}
        </button>
      </div>
    </form>
  );
};

export default ModuleForm;
