import React, { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { createStage, updateStage, fetchStages } from '../../../store/slices/stageSlice';
import toast from 'react-hot-toast';
import type { Stage } from '../../../utils/types';

interface StageFormProps {
  stageData?: Stage;
}

type StageFormValues = {
  name: string;
  kind: string;
  color: string;
  sort_order: string;
};

const KIND_OPTIONS = [
  { label: 'Open', value: 'open' },
  { label: 'Won', value: 'won' },
  { label: 'Lost', value: 'lost' },
];

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

const StageForm: React.FC<StageFormProps> = ({ stageData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { data: stages, actionLoading } = useAppSelector((state) => state.stages);

  const isEdit = !!stageData;
  const [submitting, setSubmitting] = useState(false);

  // Suggest the next free slot so new stages land after existing ones
  const nextSortOrder = useMemo(() => {
    const highest = (stages || []).reduce((max, s) => Math.max(max, s.sort_order ?? 0), 0);
    return String(highest + 10);
  }, [stages]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<StageFormValues>({
    defaultValues: {
      name: stageData?.name || '',
      kind: stageData?.kind || 'open',
      color: stageData?.color || '#2563eb',
      sort_order: stageData?.sort_order != null ? String(stageData.sort_order) : nextSortOrder,
    },
  });

  const watchedColor = watch('color') || '';

  // Synchronize form on edit or when nextSortOrder becomes available
  useEffect(() => {
    if (stageData) {
      reset({
        name: stageData.name || '',
        kind: stageData.kind || 'open',
        color: stageData.color || '#2563eb',
        sort_order: stageData.sort_order != null ? String(stageData.sort_order) : nextSortOrder,
      });
    } else if (nextSortOrder) {
      setValue('sort_order', nextSortOrder);
    }
  }, [stageData, nextSortOrder, reset, setValue]);

  const onSubmit = async (data: StageFormValues) => {
    setSubmitting(true);
    try {
      const payload: Stage = {
        name: data.name.trim(),
        kind: data.kind,
        color: data.color.trim(),
        sort_order: data.sort_order.trim() !== '' ? Number(data.sort_order) : 0,
      };

      if (isEdit && stageData?.id != null) {
        await dispatch(updateStage({ id: stageData.id, payload })).unwrap();
        toast.success('Stage updated successfully');
      } else {
        await dispatch(createStage(payload)).unwrap();
        toast.success('Stage created successfully');
      }
      dispatch(fetchStages());
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || (isEdit ? 'Failed to update stage' : 'Failed to create stage'));
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || actionLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* 2-Column Grid: Name & Kind */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Stage Name */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Stage Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name', {
              required: 'Stage name is required',
              minLength: { value: 2, message: 'Stage name must be at least 2 characters' },
              validate: (val) => val.trim().length > 0 || 'Stage name cannot be empty or only spaces',
            })}
            placeholder="e.g. New, Contacted, Converted..."
            autoFocus
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${errors.name
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
              }`}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>

        {/* Kind */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Kind <span className="text-red-500">*</span>
          </label>
          <select
            {...register('kind', { required: 'Kind is required' })}
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${errors.kind
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
              }`}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          {errors.kind ? (
            <p className="mt-1 text-xs text-red-500">{errors.kind.message}</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-crmText-tertiary">
              Won and Lost stages close the lead; Open stages keep it in the pipeline.
            </p>
          )}
        </div>
      </div>

      {/* 2-Column Grid: Color & Sort Order */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Color */}
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Color <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={HEX_COLOR_REGEX.test(watchedColor) ? watchedColor : '#2563eb'}
              onChange={(e) => setValue('color', e.target.value, { shouldValidate: true })}
              className="h-10 w-12 shrink-0 rounded-lg border border-crmBorder bg-major cursor-pointer p-1"
            />
            <input
              type="text"
              {...register('color', {
                required: 'Color is required',
                pattern: { value: HEX_COLOR_REGEX, message: 'Enter a valid hex color (e.g. #2563eb)' },
              })}
              placeholder="#2563eb"
              className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText font-mono outline-none transition-all shadow-sm ${errors.color
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                  : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
                }`}
            />
          </div>
          {errors.color && (
            <p className="mt-1 text-xs text-red-500">{errors.color.message}</p>
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
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${errors.sort_order
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
              }`}
          />
          {errors.sort_order ? (
            <p className="mt-1 text-xs text-red-500">{errors.sort_order.message}</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-crmText-tertiary">
              Determines the ordering of stages in the pipeline.
            </p>
          )}
        </div>
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
            isEdit ? 'Update Stage' : 'Create Stage'
          )}
        </button>
      </div>
    </form>
  );
};

export default StageForm;
