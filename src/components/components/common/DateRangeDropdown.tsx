import React, { useState, useEffect, useMemo } from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import { ChevronDown } from 'lucide-react';

const { RangePicker } = DatePicker;

export interface DateRangeDropdownProps {
    startDate: string;
    endDate: string;
    onDateChange: (startDate: string, endDate: string) => void;
    defaultPreset?: 'this_month' | 'last_month' | 'this_week' | 'last_week' | 'today' | 'all';
    className?: string;
}

export const DateRangeDropdown: React.FC<DateRangeDropdownProps> = ({
    startDate,
    endDate,
    onDateChange,
    defaultPreset = 'this_month',
    className = '',
}) => {
    const [selectedPreset, setSelectedPreset] = useState<string>(() => {
        if (startDate || endDate) return 'custom';
        return defaultPreset;
    });

    // Detect preset when startDate & endDate change externally
    useEffect(() => {
        if (!startDate && !endDate) {
            setSelectedPreset('all');
            return;
        }
        
        const today = dayjs().format('YYYY-MM-DD');
        const nextDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
        if (startDate === today && (endDate === today || endDate === nextDate)) {
            setSelectedPreset('today');
            return;
        }

        const thisWeekStart = dayjs().startOf('week').format('YYYY-MM-DD');
        const thisWeekEnd = dayjs().endOf('week').format('YYYY-MM-DD');
        if (startDate === thisWeekStart && endDate === thisWeekEnd) {
            setSelectedPreset('this_week');
            return;
        }

        const lastWeekStart = dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD');
        const lastWeekEnd = dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD');
        if (startDate === lastWeekStart && endDate === lastWeekEnd) {
            setSelectedPreset('last_week');
            return;
        }

        const thisMonthStart = dayjs().startOf('month').format('YYYY-MM-DD');
        const thisMonthEnd = dayjs().endOf('month').format('YYYY-MM-DD');
        if (startDate === thisMonthStart && endDate === thisMonthEnd) {
            setSelectedPreset('this_month');
            return;
        }

        const lastMonthStart = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        const lastMonthEnd = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
        if (startDate === lastMonthStart && endDate === lastMonthEnd) {
            setSelectedPreset('last_month');
            return;
        }

        setSelectedPreset('custom');
    }, [startDate, endDate]);

    const handlePresetChange = (preset: string) => {
        setSelectedPreset(preset);

        if (preset === 'all') {
            onDateChange('', '');
        } else if (preset === 'today') {
            const today = dayjs().format('YYYY-MM-DD');
            const nextDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
            onDateChange(today, nextDate);
        } else if (preset === 'this_week') {
            onDateChange(
                dayjs().startOf('week').format('YYYY-MM-DD'),
                dayjs().endOf('week').format('YYYY-MM-DD')
            );
        } else if (preset === 'last_week') {
            onDateChange(
                dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD'),
                dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD')
            );
        } else if (preset === 'this_month') {
            onDateChange(
                dayjs().startOf('month').format('YYYY-MM-DD'),
                dayjs().endOf('month').format('YYYY-MM-DD')
            );
        } else if (preset === 'last_month') {
            onDateChange(
                dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
                dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD')
            );
        }
    };

    // Formatted date string beside dropdown: e.g. (01 Aug - 31 Aug) or (11 Sep) for today
    const formattedDateRange = useMemo(() => {
        if (!startDate || !endDate) return null;
        const startObj = dayjs(startDate);
        const endObj = dayjs(endDate);
        if (!startObj.isValid() || !endObj.isValid()) return null;

        // If today or single day, display as single day
        const today = dayjs().format('YYYY-MM-DD');
        const nextDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
        if (selectedPreset === 'today' || (startDate === today && (endDate === today || endDate === nextDate))) {
            return `(${startObj.format('DD MMM')})`;
        }

        if (startObj.isSame(endObj, 'day')) {
            return `(${startObj.format('DD MMM')})`;
        }

        return `(${startObj.format('DD MMM')} - ${endObj.format('DD MMM')})`;
    }, [startDate, endDate, selectedPreset]);

    return (
        <div className={`flex flex-wrap items-center gap-2.5 ${className}`}>
            {/* Dropdown Styled with Clean Border and Chevron */}
            <div className="relative inline-block">
                <select
                    value={selectedPreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="appearance-none bg-major border border-crmBorder hover:border-crmBorder-strong hover:bg-major-tint rounded-xl px-3.5 py-2 pr-8 text-sm font-semibold text-crmText-secondary focus:outline-none focus:ring-2 focus:ring-minor-ring transition-all cursor-pointer"
                >
                    <option value="all" className="bg-major text-crmText">All Time</option>
                    <option value="this_month" className="bg-major text-crmText">This Month</option>
                    <option value="last_month" className="bg-major text-crmText">Last Month</option>
                    <option value="this_week" className="bg-major text-crmText">This Week</option>
                    <option value="last_week" className="bg-major text-crmText">Last Week</option>
                    <option value="today" className="bg-major text-crmText">Today</option>
                    <option value="custom" className="bg-major text-crmText">Custom Date</option>
                </select>
                <ChevronDown
                    size={14}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-crmText-secondary pointer-events-none"
                />
            </div>

            {/* Formatted Date Range beside the dropdown (without any X button) */}
            {formattedDateRange && selectedPreset !== 'custom' && (
                <span className="text-xs font-semibold text-crmText-secondary select-none">
                    {formattedDateRange}
                </span>
            )}

            {/* Custom RangePicker if 'Custom Date' selected */}
            {selectedPreset === 'custom' && (
                <div className="flex items-center gap-2">
                    <RangePicker
                        value={
                            startDate && endDate && dayjs(startDate).isValid() && dayjs(endDate).isValid()
                                ? [dayjs(startDate), dayjs(endDate)]
                                : null
                        }
                        format="YYYY-MM-DD"
                        style={{ borderRadius: '8px', padding: '6px 10px', border: '1px solid #d1d5db' }}
                        onChange={(dates, dateStrings) => {
                            if (dates && dates[0] && dates[1]) {
                                onDateChange(dateStrings[0], dateStrings[1]);
                            } else {
                                onDateChange('', '');
                            }
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default DateRangeDropdown;
