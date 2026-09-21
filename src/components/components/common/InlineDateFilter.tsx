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
        <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-in slide-in-from-top-4 duration-300 rounded-b-2xl">
            <div className="max-w-2xl">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
                    Select Date Range (Start Date – End Date)
                </label>
                <div className="flex flex-wrap items-center gap-4">
                    <RangePicker
                        className="flex-1 min-w-[300px] premium-range-picker"
                        style={{ borderRadius: '12px', padding: '10px 16px', border: '1px solid #e5e7eb' }}
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
                            onClick={() => onDateChange('', '')}
                            className="px-6 py-2.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-all active:scale-95 bg-white"
                        >
                            Reset
                        </button>
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-gray-900 rounded-xl text-xs font-bold text-white hover:bg-black transition-all active:scale-95 shadow-lg"
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
