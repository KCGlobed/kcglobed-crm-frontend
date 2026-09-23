import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
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

type ModuleFormValues = {
  name: string;
  sort_order: string;
  description: string;
};

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

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<ModuleFormValues>({
    defaultValues: {
      name: moduleData?.name || '',
      sort_order: moduleData?.sort_order != null ? String(moduleData.sort_order) : nextSortOrder,
      description: moduleData?.description || '',
    },
  });

  const watchedName = watch('name') || '';

  // Synchronize form on edit or when nextSortOrder becomes available
  useEffect(() => {
    if (moduleData) {
      reset({
        name: moduleData.name || '',
        sort_order: moduleData.sort_order != null ? String(moduleData.sort_order) : nextSortOrder,
        description: moduleData.description || '',
      });
    } else if (nextSortOrder) {
      setValue('sort_order', nextSortOrder);
    }
  }, [moduleData, nextSortOrder, reset, setValue]);

  const onSubmit = async (data: ModuleFormValues) => {
    const autoCode = deriveCode(data.name);

    setSubmitting(true);
    try {
      const payload: Module = {
        name: data.name.trim(),
        code: autoCode,
        module_code: autoCode,
        description: data.description.trim(),
        sort_order: data.sort_order.trim() !== '' ? Number(data.sort_order) : 0,
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
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || (isEdit ? 'Failed to update module' : 'Failed to create module'));
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || actionLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* 2-Column Grid: Name & Sort Order */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Module Name */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Module Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name', {
              required: 'Module name is required',
              minLength: { value: 2, message: 'Module name must be at least 2 characters' },
              validate: {
                notEmpty: (val) => val.trim().length > 0 || 'Module name cannot be empty or only spaces',
                validCode: (val) => {
                  const code = deriveCode(val);
                  if (!code) return 'Please enter a valid module name';
                  const isDuplicate = (modules || []).some(
                    (m) =>
                      m.code?.toLowerCase() === code.toLowerCase() &&
                      (!isEdit || m.id !== moduleData?.id)
                  );
                  if (isDuplicate) {
                    return `A module with code "${code}" already exists`;
                  }
                  return true;
                },
              },
            })}
            placeholder="e.g. Leads, Admissions, Academics..."
            autoFocus
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
              errors.name
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          />
          {errors.name ? (
            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
          ) : (
            watchedName.trim() && (
              <p className="mt-1.5 text-[11px] text-crmText-tertiary font-mono">
                Auto-generated code: <span className="text-secondary font-semibold">{deriveCode(watchedName)}</span>
              </p>
            )
          )}
        </div>

        {/* Sort Order */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Sort Order
          </label>
          <input
            type="number"
            {...register('sort_order', {
              min: { value: 0, message: 'Sort order must be 0 or greater' },
            })}
            placeholder="10"
            min={0}
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${
              errors.sort_order
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
            }`}
          />
          {errors.sort_order ? (
            <p className="mt-1 text-xs text-red-500">{errors.sort_order.message}</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-crmText-tertiary">
              Determines the ordering of modules in navigation and lists.
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          {...register('description', {
            required: 'Description is required',
            minLength: { value: 2, message: 'Description must be at least 2 characters' },
            validate: (val) => val.trim().length > 0 || 'Description cannot be empty or only spaces',
          })}
          placeholder="Brief description of this module's scope and purpose..."
          rows={3}
          className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm resize-y ${
            errors.description
              ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
              : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
          }`}
        />
        {errors.description && (
          <p className="mt-1 text-xs text-red-500">{errors.description.message}</p>
        )}
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
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
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
