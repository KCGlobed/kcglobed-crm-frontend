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
                className={`group flex items-center gap-2 px-3.5 py-2 border rounded-xl text-sm font-semibold transition-all active:scale-95 ${showSort ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
            >
                <ArrowUpDown size={16} className={showSort ? 'text-indigo-500' : 'text-gray-400 group-hover:text-indigo-500'} />
                Sort
            </button>

            {showSort && (
                <div className="absolute top-full left-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden animate-in slide-in-from-top-2 duration-200">
                    <div className="p-2 space-y-1">
                        <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">
                            Sort Direction
                        </div>
                        <button
                            type="button"
                            onClick={() => onDirectionSort('asc')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${!ordering.startsWith('-') && ordering
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${!ordering.startsWith('-') && ordering ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                    <ArrowUpDown size={14} className="rotate-180" />
                                </div>
                                <span>Ascending (ASC)</span>
                            </div>
                            {(!ordering.startsWith('-') && ordering) && <Check size={16} className="text-indigo-600" />}
                        </button>
                        <button
                            type="button"
                            onClick={() => onDirectionSort('desc')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${ordering.startsWith('-')
                                ? 'bg-indigo-50 text-indigo-600'
                                : 'text-gray-600 hover:bg-gray-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${ordering.startsWith('-') ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                    <ArrowUpDown size={14} />
                                </div>
                                <span>Descending (DESC)</span>
                            </div>
                            {ordering.startsWith('-') && <Check size={16} className="text-indigo-600" />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SortDropdown;
