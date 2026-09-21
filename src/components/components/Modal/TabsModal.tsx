import React, { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TabItem {
    key: string;
    label: string;
    component: React.ReactNode;
    icon?: React.ReactNode;
    disabled?: boolean;
}

export interface TabsModalProps {
    tabs: TabItem[];
    defaultActiveKey?: string;
    onTabChange?: (key: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const TabsModal: React.FC<TabsModalProps> = ({
    tabs,
    defaultActiveKey,
    onTabChange,
}) => {
    const [activeKey, setActiveKey] = useState<string>(
        defaultActiveKey ?? tabs[0]?.key ?? ''
    );
    const [animating, setAnimating] = useState(false);

    const handleTabClick = (key: string, disabled?: boolean) => {
        if (disabled || key === activeKey) return;
        setAnimating(true);
        setTimeout(() => {
            setActiveKey(key);
            setAnimating(false);
            onTabChange?.(key);
        }, 150);
    };

    const activeTab = tabs.find((t) => t.key === activeKey);

    return (
        <div className="w-full flex flex-col">
            {/* ── Tab Header ── */}
            <div className="flex items-end gap-0 border-b border-gray-200 overflow-x-auto no-scrollbar">
                {tabs.map((tab) => {
                    const isActive = tab.key === activeKey;
                    const isDisabled = tab.disabled;

                    return (
                        <button
                            key={tab.key}
                            onClick={() => handleTabClick(tab.key, tab.disabled)}
                            disabled={isDisabled}
                            title={isDisabled ? 'This tab is disabled' : tab.label}
                            className={`
                                relative flex items-center gap-2 px-5 py-3 text-sm font-semibold
                                whitespace-nowrap transition-all duration-200 select-none
                                focus:outline-none rounded-t-lg
                                ${isActive
                                    ? 'text-indigo-600 bg-indigo-50/60 border-b-2 border-indigo-600'
                                    : isDisabled
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-gray-500 hover:text-indigo-500 hover:bg-gray-50 cursor-pointer border-b-2 border-transparent'
                                }
                            `}
                        >
                            {tab.icon && (
                                <span className={`text-base ${isActive ? 'text-indigo-500' : isDisabled ? 'text-gray-300' : 'text-gray-400'}`}>
                                    {tab.icon}
                                </span>
                            )}
                            {tab.label}

                            {/* Active indicator dot */}
                            {isActive && (
                                <span className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
                            )}

                            {/* Disabled badge */}
                            {isDisabled && (
                                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-gray-100 text-gray-400 rounded uppercase tracking-wide">
                                    Soon
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ── Tab Content ── */}
            <div
                className={`w-full pt-5 transition-all duration-150 ${animating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}
                style={{ willChange: 'opacity, transform' }}
            >
                {activeTab ? activeTab.component : (
                    <div className="py-10 text-center text-gray-400 text-sm">
                        No content available.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TabsModal;
