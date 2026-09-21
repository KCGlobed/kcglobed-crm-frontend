import React from "react";

export type TabItem = {
    key: string;
    label: string;
    icon?: React.ReactNode;
    component?: React.ReactNode; // Dynamic renderable component
};

type TabBarProps = {
    tabs: TabItem[];
    activeKey: string;
    onTabChange: (key: string) => void;
    className?: string;
};

const TabBar: React.FC<TabBarProps> = ({
    tabs,
    activeKey,
    onTabChange,
    className = "",
}) => {
    return (
        <div>
            {/* Tab Buttons */}
            <div className={`flex items-center space-x-2 bg-white p-2 rounded-xl shadow-md ${className}`}>
                {tabs.map((tab) => {
                    const isActive = tab.key === activeKey;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => onTabChange(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-300 text-sm font-medium
                            ${isActive
                                    ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow"
                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                             }`}
                         >
                            {tab.icon && <span>{tab.icon}</span>}
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Render Active Tab Component */}
            <div className="mt-4">
                {tabs.find((tab) => tab.key === activeKey)?.component || null}
            </div>
        </div>
    );
};

export default TabBar;
