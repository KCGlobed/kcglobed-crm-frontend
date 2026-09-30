import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { createDepartment, updateDepartment, fetchDepartments } from '../../../store/slices/departmentSlice';
import { fetchReportingManagementOptions } from '../../../store/slices/reportingMangementSlice';
import toast from 'react-hot-toast';
import type { Department, ReportingOption } from '../../../utils/types';

interface DepartmentFormProps {
  departmentData?: Department;
}

type DepartmentFormValues = {
  name: string;
  description: string;
  head_uid: string;
};

const DepartmentForm: React.FC<DepartmentFormProps> = ({ departmentData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { actionLoading } = useAppSelector((state) => state.departments);
  const { data: reportingUsers, loading: reportingLoading } = useAppSelector((state) => state.reportingManagement);

  const isEdit = !!departmentData;
  const [submitting, setSubmitting] = useState(false);

  // People picker for the department head — fetch once when the modal opens
  useEffect(() => {
    dispatch(fetchReportingManagementOptions({ page_size: 1000 }));
  }, [dispatch]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<DepartmentFormValues>({
    defaultValues: {
      name: departmentData?.name || '',
      description: departmentData?.description || '',
      head_uid: departmentData?.head?.uid || '',
    },
  });

  useEffect(() => {
    if (departmentData) {
      reset({
        name: departmentData.name || '',
        description: departmentData.description || '',
        head_uid: departmentData.head?.uid || '',
      });
    }
  }, [departmentData, reset]);

  const onSubmit = async (data: DepartmentFormValues) => {
    setSubmitting(true);
    try {
      const payload: Department = {
        name: data.name.trim(),
        description: data.description.trim(),
        head_uid: data.head_uid || null,
      };

      if (isEdit && departmentData?.id != null) {
        await dispatch(updateDepartment({ id: departmentData.id, payload })).unwrap();
        toast.success('Department updated successfully');
      } else {
        await dispatch(createDepartment(payload)).unwrap();
        toast.success('Department created successfully');
      }
      dispatch(fetchDepartments());
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || (isEdit ? 'Failed to update department' : 'Failed to create department'));
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || actionLoading;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Department Name */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">
          Department Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          {...register('name', {
            required: 'Department name is required',
            minLength: { value: 2, message: 'Department name must be at least 2 characters' },
            validate: (val) => val.trim().length > 0 || 'Department name cannot be empty or only spaces',
          })}
          placeholder="e.g. Sales, Marketing, Operations..."
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

      {/* Head */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Department Head</label>
        <select
          {...register('head_uid')}
          disabled={reportingLoading}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm"
        >
          <option value="">{reportingLoading ? 'Loading users...' : 'Select head (Optional)'}</option>
          {reportingUsers?.map((opt: ReportingOption) => (
            <option key={opt.uid} value={opt.uid}>
              {opt.name || opt.email} ({opt.role})
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Description</label>
        <textarea
          {...register('description')}
          placeholder="Brief description of this department..."
          rows={3}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm resize-y"
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
          className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-60 text-white text-xs font-semibold cursor-pointer transition-all shadow-sm disabled:cursor-not-allowed border-none flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              <span>{isEdit ? 'Updating...' : 'Creating...'}</span>
            </>
          ) : (
            isEdit ? 'Update Department' : 'Create Department'
          )}
        </button>
      </div>
    </form>
  );
};

export default DepartmentForm;
