
import React, { useState, useEffect } from 'react';
import { formatInputNumber } from '../utils/formatters';

interface InputFieldProps {
    label: string;
    value: number | string;
    onChange: (value: string) => void;
    type?: 'text' | 'number';
    suffix?: string;
    className?: string;
    readOnly?: boolean;
    step?: string;
    min?: string;
    max?: string;
}

const InputField: React.FC<InputFieldProps> = ({
    label,
    value,
    onChange,
    type = 'text',
    suffix,
    className = '',
    readOnly = false,
    step,
    min,
    max
}) => {
    const [localValue, setLocalValue] = useState<string>(
        typeof value === 'number' ? formatInputNumber(value) : value.toString()
    );

    useEffect(() => {
        const formattedValue = typeof value === 'number' ? formatInputNumber(value) : value.toString();
        if (formattedValue !== localValue.replace(',', '.')) {
             setLocalValue(formattedValue);
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalValue(val);
        // Pass the value with period to the parent for parsing
        onChange(val.replace(',', '.'));
    };

    return (
        <div className={`flex flex-col ${className}`}>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                {label}
            </label>
            <div className="relative">
                <input
                    type="text"
                    inputMode="decimal"
                    value={localValue}
                    onChange={handleChange}
                    className={`w-full bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                    readOnly={readOnly}
                />
                {suffix && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-slate-400 text-xs">{suffix}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InputField;
