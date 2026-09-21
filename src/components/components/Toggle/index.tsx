import React from 'react';

type ToggleProps = {
  enabled: number;
  // onToggle: (value: boolean) => void;
  label?: string;
};

const Toggle: React.FC<ToggleProps> = ({ enabled,  label }) => {
  return (
    <div className="flex items-center space-x-3 ">
      {label && <span className="text-sm font-medium">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={enabled ? true :false}
        // onClick={() => onToggle(!enabled)}
        className={`relative cursor-pointer inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none ${
          enabled ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
};

export default Toggle;
