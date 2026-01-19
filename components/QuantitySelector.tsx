import React from 'react';

interface QuantitySelectorProps {
    value: number;
    onChange: (value: number) => void;
    disabled: boolean;
    className?: string;
}

const QuantitySelector: React.FC<QuantitySelectorProps> = ({ value, onChange, disabled, className }) => {
    // Genera numeri da 1 a 10 per le opzioni di acquisto
    const buyOptions = Array.from({ length: 10 }, (_, i) => i + 1);
    // Genera numeri da -1 a -10 per le opzioni di vendita
    const sellOptions = Array.from({ length: 10 }, (_, i) => -(i + 1));

    const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        onChange(parseInt(event.target.value, 10));
    };
    
    return (
        <select
            value={value}
            onChange={handleChange}
            disabled={disabled}
            className={className}
        >
            <optgroup label="Acquisto (Long)">
                {buyOptions.map(qty => (
                    <option key={qty} value={qty}>+{qty}</option>
                ))}
            </optgroup>
            <optgroup label="Vendita (Short)">
                {sellOptions.map(qty => (
                    <option key={qty} value={qty}>{qty}</option>
                ))}
            </optgroup>
        </select>
    );
};

export default QuantitySelector;