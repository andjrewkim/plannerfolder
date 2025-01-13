import React from 'react';

interface CheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const Checkbox: React.FC<CheckboxProps> = ({
  id,
  label,
  checked,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-5 w-5 border-gray-300 rounded-md focus:ring-blue-500 disabled:opacity-50"
      />
      <label
        htmlFor={id}
        className={`text-sm ${
          disabled ? 'text-gray-400' : 'text-gray-800'
        }`}
      >
        {label}
      </label>
    </div>
  );
};

export default Checkbox;
