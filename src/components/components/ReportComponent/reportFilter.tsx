import Select, { type MultiValue } from "react-select";
// ------------------- Reusable Filter Component -------------------
export const Filter = ({ label, options, value, onChange, disabled = false }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
        <Select
            isMulti
            options={options}
            value={value}
            onChange={onChange}
            placeholder={`Select ${label}(s)`}
            isDisabled={disabled}
            menuPortalTarget={document.body}
            className="react-select-container"
            classNamePrefix="react-select"
            styles={{
                container: (base) => ({
                    ...base,
                    width: "100%", // 👈 parent width le lega
                }),
                control: (base) => ({
                    ...base,
                    width: "100%", // 👈 input area bhi full stretch hoga
                }),
                menuPortal: (base) => ({
                    ...base,
                    zIndex: 9999, // 👈 dropdown upar rahe
                }),
            }}
        />
    </div>
);

// ------------------- Date Input Component -------------------
export const DateInput = ({ label, value, onChange }: any) => (
    <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
        <input
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-400 transition"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);