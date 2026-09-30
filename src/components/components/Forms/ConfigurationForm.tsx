import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useModal } from '../../../context/ModalContext';
import { useAppDispatch } from '../../../hooks/useAppDispatch';
import { useAppSelector } from '../../../hooks/useRedux';
import { createConfiguration, updateConfiguration, fetchConfigurations } from '../../../store/slices/configurationSlice';
import toast from 'react-hot-toast';
import type { Configuration } from '../../../utils/types';

interface ConfigurationFormProps {
  configurationData?: Configuration;
}

type ConfigurationFormValues = {
  key: string;
  name: string;
  group: string;
  description: string;
  data_type: string;
  value: string;
  default_value: string;
  min_value: string;
  max_value: string;
};

const DATA_TYPES = ['string', 'integer', 'decimal', 'boolean', 'json', 'list'];
const KEY_REGEX = /^[a-z0-9._-]+$/;

// Serialize a stored value into the text input
const toInput = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// Parse the text input back into the payload value for the given data_type
const parseValue = (raw: string, dataType: string): { ok: boolean; value?: any; error?: string } => {
  const trimmed = raw.trim();
  if (trimmed === '') return { ok: true, value: null };
  switch (dataType) {
    case 'integer': {
      if (!/^-?\d+$/.test(trimmed)) return { ok: false, error: 'Use a whole number' };
      return { ok: true, value: parseInt(trimmed, 10) };
    }
    case 'decimal': {
      const num = Number(trimmed);
      if (Number.isNaN(num)) return { ok: false, error: 'Use a number' };
      return { ok: true, value: num };
    }
    case 'boolean':
      return { ok: true, value: trimmed === 'true' };
    case 'json':
    case 'list': {
      try {
        return { ok: true, value: JSON.parse(trimmed) };
      } catch {
        return { ok: false, error: `Enter valid JSON for a ${dataType} value` };
      }
    }
    default:
      return { ok: true, value: trimmed };
  }
};

const ConfigurationForm: React.FC<ConfigurationFormProps> = ({ configurationData }) => {
  const dispatch = useAppDispatch();
  const { hideModal } = useModal();
  const { actionLoading } = useAppSelector((state) => state.configurations);

  const isEdit = !!configurationData;
  const isSystem = !!configurationData?.is_system;
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ConfigurationFormValues>({
    defaultValues: {
      key: configurationData?.key || '',
      name: configurationData?.name || '',
      group: configurationData?.group || '',
      description: configurationData?.description || '',
      data_type: configurationData?.data_type || 'string',
      value: toInput(configurationData?.value),
      default_value: toInput(configurationData?.default_value),
      min_value: configurationData?.min_value != null ? String(configurationData.min_value) : '',
      max_value: configurationData?.max_value != null ? String(configurationData.max_value) : '',
    },
  });

  const watchedType = watch('data_type') || 'string';

  useEffect(() => {
    if (configurationData) {
      reset({
        key: configurationData.key || '',
        name: configurationData.name || '',
        group: configurationData.group || '',
        description: configurationData.description || '',
        data_type: configurationData.data_type || 'string',
        value: toInput(configurationData.value),
        default_value: toInput(configurationData.default_value),
        min_value: configurationData.min_value != null ? String(configurationData.min_value) : '',
        max_value: configurationData.max_value != null ? String(configurationData.max_value) : '',
      });
    }
  }, [configurationData, reset]);

  const onSubmit = async (data: ConfigurationFormValues) => {
    const parsedValue = parseValue(data.value, data.data_type);
    if (!parsedValue.ok) {
      toast.error(`Value: ${parsedValue.error}`);
      return;
    }
    const parsedDefault = parseValue(data.default_value, data.data_type);
    if (!parsedDefault.ok) {
      toast.error(`Default value: ${parsedDefault.error}`);
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && configurationData?.id != null) {
        // System settings keep their key and data_type — only send what may change
        const payload: Configuration = isSystem
          ? {
              name: data.name.trim(),
              description: data.description.trim(),
              value: parsedValue.value,
            }
          : {
              key: data.key.trim(),
              name: data.name.trim(),
              group: data.group.trim(),
              description: data.description.trim(),
              data_type: data.data_type,
              value: parsedValue.value,
              default_value: parsedDefault.value,
              min_value: data.min_value.trim() !== '' ? Number(data.min_value) : null,
              max_value: data.max_value.trim() !== '' ? Number(data.max_value) : null,
            };
        await dispatch(updateConfiguration({ id: configurationData.id, payload })).unwrap();
        toast.success('Configuration updated successfully');
      } else {
        const payload: Configuration = {
          key: data.key.trim(),
          name: data.name.trim(),
          group: data.group.trim(),
          description: data.description.trim(),
          data_type: data.data_type,
          value: parsedValue.value,
          default_value: parsedDefault.value,
          min_value: data.min_value.trim() !== '' ? Number(data.min_value) : null,
          max_value: data.max_value.trim() !== '' ? Number(data.max_value) : null,
        };
        await dispatch(createConfiguration(payload)).unwrap();
        toast.success('Configuration created successfully');
      }
      dispatch(fetchConfigurations());
      reset();
      hideModal();
    } catch (err: any) {
      toast.error(err?.message || err || (isEdit ? 'Failed to update configuration' : 'Failed to create configuration'));
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = submitting || actionLoading;

  const valueInput = (fieldName: 'value' | 'default_value', label: string, required: boolean) => (
    <div>
      <label className="block text-xs font-semibold text-crmText mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {watchedType === 'boolean' ? (
        <select
          {...register(fieldName, required ? { required: `${label} is required` } : {})}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm cursor-pointer"
        >
          <option value="">Select...</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      ) : watchedType === 'json' || watchedType === 'list' ? (
        <textarea
          {...register(fieldName, required ? { required: `${label} is required` } : {})}
          placeholder={watchedType === 'list' ? 'e.g. ["a", "b"]' : 'e.g. {"key": "value"}'}
          rows={2}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm resize-y"
        />
      ) : (
        <input
          type={watchedType === 'integer' || watchedType === 'decimal' ? 'number' : 'text'}
          step={watchedType === 'decimal' ? 'any' : undefined}
          {...register(fieldName, required ? { required: `${label} is required` } : {})}
          placeholder={watchedType === 'integer' ? 'e.g. 50' : 'e.g. some value'}
          className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm"
        />
      )}
      {errors[fieldName] && (
        <p className="mt-1 text-xs text-red-500">{errors[fieldName]?.message}</p>
      )}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Key & Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Key <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('key', {
              required: 'Key is required',
              pattern: {
                value: KEY_REGEX,
                message: "Use lowercase letters, digits, dots, dashes or underscores, e.g. 'masking.enabled'",
              },
            })}
            placeholder="e.g. leads.max_open_per_counsellor"
            autoFocus={!isEdit}
            disabled={isEdit}
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText font-mono outline-none transition-all shadow-sm disabled:opacity-60 ${errors.key
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
              }`}
          />
          {errors.key && (
            <p className="mt-1 text-xs text-red-500">{errors.key.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            {...register('name', {
              required: 'Name is required',
              validate: (val) => val.trim().length > 0 || 'Name cannot be empty or only spaces',
            })}
            placeholder="e.g. Max open leads per counsellor"
            className={`w-full px-3.5 py-2.5 bg-major border rounded-xl text-sm text-crmText outline-none transition-all shadow-sm ${errors.name
                ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                : 'border-crmBorder focus:border-primary focus:ring-2 focus:ring-primary-ring'
              }`}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
          )}
        </div>
      </div>

      {/* Group & Data Type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">Group</label>
          <input
            type="text"
            {...register('group')}
            placeholder="e.g. masking, security, leads..."
            disabled={isEdit && isSystem}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm disabled:opacity-60"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-crmText mb-1.5">
            Data Type <span className="text-red-500">*</span>
          </label>
          <select
            {...register('data_type', { required: 'Data type is required' })}
            disabled={isEdit && isSystem}
            className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm cursor-pointer disabled:opacity-60"
          >
            {DATA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {isEdit && isSystem && (
            <p className="mt-1.5 text-[11px] text-crmText-tertiary">
              System settings keep their key and data type.
            </p>
          )}
        </div>
      </div>

      {/* Value & Default */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {valueInput('value', 'Value', true)}
        {valueInput('default_value', 'Default Value', false)}
      </div>

      {/* Min / Max (numeric types) */}
      {(watchedType === 'integer' || watchedType === 'decimal') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">Min Value</label>
            <input
              type="number"
              step="any"
              {...register('min_value')}
              placeholder="e.g. 1"
              className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-crmText mb-1.5">Max Value</label>
            <input
              type="number"
              step="any"
              {...register('max_value')}
              placeholder="e.g. 500"
              className="w-full px-3.5 py-2.5 bg-major border border-crmBorder rounded-xl text-sm text-crmText outline-none focus:border-primary focus:ring-2 focus:ring-primary-ring transition-all shadow-sm"
            />
          </div>
        </div>
      )}

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-crmText mb-1.5">Description</label>
        <textarea
          {...register('description')}
          placeholder="What does this setting control?"
          rows={2}
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
            isEdit ? 'Update Configuration' : 'Create Configuration'
          )}
        </button>
      </div>
    </form>
  );
};

export default ConfigurationForm;
