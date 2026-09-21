import React, { useState, useEffect } from 'react';
import { ArrowUpDown, Filter } from 'lucide-react';

export type FilterField = {
    type: 'text' | 'select' | 'status';
    label: string;
    name: string;
    placeholder?: string;
    options?: { label: string; value: any }[];
    getOptions?: () => Promise<{ label: string; value: any }[]>;
    gridCols?: string;
};

export interface DynamicFilterProps {
    show: boolean;
    config: FilterField[];
    values: Record<string, any>;
    onChange: (name: string, value: any) => void;
    onClear: () => void;
    onClose: () => void;

    // Optional Sort integration
    ordering?: string;
    onDirectionSort?: (direction: 'asc' | 'desc') => void;
}

const fieldClass =
    'w-full h-9 px-3.5 bg-major border border-crmBorder focus:border-minor rounded-xl text-[13px] font-medium text-crmText outline-none focus:ring-2 focus:ring-minor-ring transition-all';

const labelClass =
    'block text-[10px] font-bold text-crmText-tertiary uppercase tracking-wider mb-2 ml-1';

const DynamicFilter: React.FC<DynamicFilterProps> = ({
    show,
    config,
    values,
    onChange,
    onClear,
    onClose,
    ordering,
    onDirectionSort,
}) => {
    const [asyncOptions, setAsyncOptions] = useState<Record<string, { label: string; value: any }[]>>({});

    useEffect(() => {
        if (!show) return;
        config.forEach((field) => {
            if (field.getOptions && !asyncOptions[field.name]) {
                field.getOptions().then((options) => {
                    setAsyncOptions((prev) => ({ ...prev, [field.name]: options }));
                }).catch((err) => console.error("Failed to fetch options for", field.name, err));
            }
        });
    }, [show, config]);

    if (!show) return null;

    return (
        <div className="animate-slide-down rounded-b-2xl border-t border-crmBorder bg-major-tint p-4 sm:p-6">
            {/* Header */}
            <div className="mb-5 flex items-center justify-between border-b border-crmBorder pb-3">
                <div className="flex items-center gap-2">
                    <Filter size={15} className="text-minor-contrast" />
                    <h4 className="m-0 text-[10px] font-bold uppercase tracking-wider text-crmText">
                        Filter
                    </h4>
                </div>
            </div>

            {/* Main Config Fields */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] items-end gap-5">
                {config.map((field) => {
                    const fieldOptions = asyncOptions[field.name] || field.options;
                    return (
                        <div key={field.name}>
                            <label className={labelClass}>
                                {field.label}
                            </label>
                            {field.type === 'text' && (
                                <input
                                    type="text"
                                    value={values[field.name] || ''}
                                    onChange={(e) => onChange(field.name, e.target.value)}
                                    placeholder={field.placeholder || `Filter by ${field.label.toLowerCase()}...`}
                                    className={fieldClass}
                                />
                            )}
                            {field.type === 'status' && (
                                <div
                                    className="grid gap-1 overflow-hidden rounded-xl border border-crmBorder bg-major p-1"
                                    style={{
                                        gridTemplateColumns: `repeat(${fieldOptions?.length || 3}, 1fr)`,
                                    }}
                                >
                                    {fieldOptions?.map((option) => (
                                        <button
                                            type="button"
                                            key={option.value.toString()}
                                            onClick={() => onChange(field.name, option.value)}
                                            className={`cursor-pointer rounded-lg border-none px-2 py-1.5 text-[11px] font-bold capitalize transition-all ${
                                                values[field.name] === option.value
                                                    ? 'bg-minor text-white shadow-crm-sm'
                                                    : 'bg-transparent text-crmText-secondary hover:bg-major-muted hover:text-crmText'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {field.type === 'select' && (
                                <select
                                    value={values[field.name] || ''}
                                    onChange={(e) => onChange(field.name, e.target.value)}
                                    className={`${fieldClass} cursor-pointer appearance-none`}
                                >
                                    <option value="">Select {field.label}</option>
                                    {fieldOptions?.map((option) => (
                                        <option key={option.value.toString()} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Sort Direction Section */}
            {onDirectionSort && (
                <div className="mt-6 max-w-sm border-t border-crmBorder pt-5">
                    <label className={labelClass}>
                        Sort Direction
                    </label>
                    <div className="flex items-center gap-1 rounded-xl border border-crmBorder bg-major p-1">
                        <button
                            type="button"
                            onClick={() => onDirectionSort('asc')}
                            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-3 py-2 text-xs font-bold transition-all ${
                                !ordering?.startsWith('-') && ordering
                                    ? 'bg-minor text-white shadow-crm-sm'
                                    : 'bg-transparent text-crmText-secondary hover:bg-major-muted'
                            }`}
                        >
                            <ArrowUpDown size={14} className="rotate-180" />
                            <span>Ascending</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onDirectionSort('desc')}
                            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-3 py-2 text-xs font-bold transition-all ${
                                ordering?.startsWith('-')
                                    ? 'bg-minor text-white shadow-crm-sm'
                                    : 'bg-transparent text-crmText-secondary hover:bg-major-muted'
                            }`}
                        >
                            <ArrowUpDown size={14} />
                            <span>Descending</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Bottom Actions */}
            <div className="mt-6 flex justify-end gap-3 border-t border-crmBorder pt-4">
                <button
                    type="button"
                    onClick={onClear}
                    className="cursor-pointer rounded-xl border border-crmBorder bg-major px-5 py-2 text-xs font-bold text-crmText-secondary transition-all hover:bg-major-muted hover:text-crmText"
                >
                    Clear All Filters
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="cursor-pointer rounded-xl border-none bg-minor px-5 py-2 text-xs font-bold text-white shadow-crm-accent transition-all hover:bg-minor-hover"
                >
                    Close Section
                </button>
            </div>
        </div>
    );
};

export default DynamicFilter;
