import React from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface InlineDateFilterProps {
    showDate: boolean;
    startDate: string;
    endDate: string;
    onDateChange: (startDate: string, endDate: string) => void;
    onClose: () => void;
}

const InlineDateFilter: React.FC<InlineDateFilterProps> = ({
    showDate,
    startDate,
    endDate,
    onDateChange,
    onClose
}) => {
    if (!showDate) return null;

    // Convert string dates to dayjs objects for the RangePicker
    const dateValue: [dayjs.Dayjs, dayjs.Dayjs] | null = 
        startDate && endDate && dayjs(startDate).isValid() && dayjs(endDate).isValid()
            ? [dayjs(startDate), dayjs(endDate)]
            : null;

    return (
        <div className="border-t border-crmBorder bg-major-tint p-6 animate-in slide-in-from-top-4 duration-300 rounded-b-2xl">
            <div className="max-w-2xl">
                <label className="block text-[10px] font-bold text-crmText-tertiary uppercase tracking-widest mb-3 ml-1">
                    Select Date Range (Start Date – End Date)
                </label>
                <div className="flex flex-wrap items-center gap-4">
                    <RangePicker
                        className="flex-1 min-w-[300px] premium-range-picker"
                        style={{ borderRadius: '12px', padding: '10px 16px' }}
                        value={dateValue}
                        format="YYYY-MM-DD"
                        onChange={(dates, dateStrings) => {
                            if (dates && dates[0] && dates[1]) {
                                onDateChange(dateStrings[0], dateStrings[1]);
                            } else {
                                onDateChange('', '');
                            }
                        }}
                    />
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => onDateChange('', '')}
                            className="px-6 py-2.5 border border-crmBorder rounded-xl text-xs font-bold text-crmText-secondary hover:bg-major-muted transition-all active:scale-95 bg-major"
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 bg-minor rounded-xl text-xs font-bold text-white hover:bg-minor-hover transition-all active:scale-95 shadow-sm cursor-pointer"
                        >
                            Apply Selection
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InlineDateFilter;
