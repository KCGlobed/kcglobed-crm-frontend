import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
    value,
    onChange,
    placeholder = "Search...",
    className = ""
}) => {
    return (
        <div className={`min-w-[12rem] flex-1 sm:max-w-md ${className}`}>
            <div className="relative flex items-center">
                <Search
                    size={15}
                    className="pointer-events-none absolute left-3.5 text-crmText-tertiary"
                />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="h-9 w-full rounded-xl border border-crmBorder bg-major pl-9 pr-9 text-[13px] font-medium text-crmText outline-none transition-all hover:border-crmBorder-strong focus:border-minor focus:ring-2 focus:ring-minor-ring"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange('')}
                        aria-label="Clear search"
                        className="absolute right-2.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-crmText-tertiary transition-colors hover:bg-major-muted hover:text-crmText"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default SearchInput;
