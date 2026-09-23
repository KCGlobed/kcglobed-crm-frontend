import React from 'react';
import { ArrowUpDown, Check } from 'lucide-react';

interface SortDropdownProps {
    showSort: boolean;
    setShowSort: (show: boolean) => void;
    ordering: string;
    onDirectionSort: (direction: 'asc' | 'desc') => void;
    sortRef: React.RefObject<HTMLDivElement | null>;
}

const SortDropdown: React.FC<SortDropdownProps> = ({
    showSort,
    setShowSort,
    ordering,
    onDirectionSort,
    sortRef
}) => {
    return (
        <div className="relative" ref={sortRef}>
            <button
                type="button"
                onClick={() => setShowSort(!showSort)}
                className={`group flex items-center gap-2 px-3.5 py-2 border rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                    showSort
                        ? 'bg-minor-soft border-minor/30 text-minor-contrast'
                        : 'border-crmBorder text-crmText-secondary hover:border-crmBorder-strong hover:bg-major-tint'
                }`}
            >
                <ArrowUpDown size={16} className={showSort ? 'text-minor-contrast' : 'text-crmText-tertiary group-hover:text-minor-contrast'} />
                Sort
            </button>

            {showSort && (
                <div className="absolute top-full left-0 mt-3 w-56 bg-major rounded-2xl shadow-crm-lg border border-crmBorder z-[9999] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="p-2 space-y-1">
                        <div className="px-3 py-2 text-[10px] font-bold text-crmText-tertiary uppercase tracking-widest border-b border-crmBorder mb-1">
                            Sort Direction
                        </div>
                        <button
                            type="button"
                            onClick={() => onDirectionSort('asc')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                !ordering.startsWith('-') && ordering
                                    ? 'bg-minor-soft text-minor-contrast'
                                    : 'text-crmText-secondary hover:bg-major-tint hover:text-crmText'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${!ordering.startsWith('-') && ordering ? 'bg-minor/20 text-minor-contrast' : 'bg-major-tint text-crmText-tertiary'}`}>
                                    <ArrowUpDown size={14} className="rotate-180" />
                                </div>
                                <span>Ascending (ASC)</span>
                            </div>
                            {(!ordering.startsWith('-') && ordering) && <Check size={16} className="text-minor-contrast" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => onDirectionSort('desc')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                                ordering.startsWith('-')
                                    ? 'bg-minor-soft text-minor-contrast'
                                    : 'text-crmText-secondary hover:bg-major-tint hover:text-crmText'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${ordering.startsWith('-') ? 'bg-minor/20 text-minor-contrast' : 'bg-major-tint text-crmText-tertiary'}`}>
                                    <ArrowUpDown size={14} />
                                </div>
                                <span>Descending (DESC)</span>
                            </div>
                            {ordering.startsWith('-') && <Check size={16} className="text-minor-contrast" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SortDropdown;
