
import React, { useMemo, CSSProperties, useState, useRef, useEffect } from 'react';

interface StrikeSelectorProps {
    value: number;
    onChange: (value: number) => void;
    spotPrice: number;
    optionType: 'Call' | 'Put';
    disabled: boolean;
    className?: string;
}

const ChevronDownIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
);


const getStrikeStyle = (strike: number, spotPrice: number, optionType: 'Call' | 'Put'): CSSProperties => {
    const moneyness = strike - spotPrice;
    const colorRange = 500; 

    let intensity = 0;
    let baseColor = '';

    if (optionType === 'Call') {
        baseColor = '59, 130, 246'; // Blu (accent)
        if (moneyness <= 0) { // ITM or ATM for a Call
            const normalizedMoneyness = Math.min(1, -moneyness / colorRange);
            intensity = 0.2 + normalizedMoneyness * 0.8;
        }
    } else { // Put
        baseColor = '245, 158, 11'; // Arancione (warning)
        if (moneyness >= 0) { // ITM or ATM for a Put
            const normalizedMoneyness = Math.min(1, moneyness / colorRange);
            intensity = 0.2 + normalizedMoneyness * 0.8;
        }
    }
    
    const alpha = intensity * 0.6; 

    return {
        backgroundColor: `rgba(${baseColor}, ${alpha})`,
    };
};

const StrikeSelector: React.FC<StrikeSelectorProps> = ({ value, onChange, spotPrice, optionType, disabled, className }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [inputValue, setInputValue] = useState(value.toString());

    useEffect(() => {
        setInputValue(value.toString());
    }, [value]);

    const strikeOptions = useMemo(() => {
        const atmStrike = Math.round(spotPrice / 25) * 25;
        const range = 4000; 
        const step = 25;
        const options: number[] = [];

        for (let i = atmStrike + range; i >= atmStrike - range; i -= step) {
            options.push(i);
        }

        if (!options.includes(value)) {
            options.push(value);
            options.sort((a, b) => b - a);
        }

        return options;
    }, [spotPrice, value]);
    
    // Improved scrolling logic to center the selected option
    useEffect(() => {
        if (isOpen && listRef.current) {
            // Slight delay to ensure the DOM is fully rendered and layout is calculated
            const timer = setTimeout(() => {
                const list = listRef.current;
                if (!list) return;

                // Find the element with the matching data-strike attribute
                const selectedOption = list.querySelector(`[data-strike="${value}"]`) as HTMLElement;
                
                if (selectedOption) {
                    // Calculate scroll position to center the element
                    const listHeight = list.clientHeight;
                    const optionTop = selectedOption.offsetTop;
                    const optionHeight = selectedOption.clientHeight;
                    
                    list.scrollTop = optionTop - listHeight / 2 + optionHeight / 2;
                }
            }, 10); // Increased from 0 to 10ms to be more reliable
            return () => clearTimeout(timer);
        }
    }, [isOpen, value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [wrapperRef]);
    
    const handleSelect = (strike: number) => {
        onChange(strike);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
        const parsed = parseInt(e.target.value, 10);
        if (!isNaN(parsed)) {
            onChange(parsed);
        }
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="flex items-center w-full h-full">
                <input 
                    type="number"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => !disabled && setIsOpen(true)}
                    className="w-full bg-transparent outline-none text-white px-2 appearance-none"
                    disabled={disabled}
                />
                 <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className="px-2 h-full flex items-center justify-center text-gray-400 hover:text-white border-l border-gray-500/30"
                    tabIndex={-1}
                >
                    <ChevronDownIcon />
                </button>
            </div>

            {isOpen && (
                <ul
                    ref={listRef}
                    className="absolute z-50 mt-1 w-full bg-gray-600 border border-gray-500 rounded-md shadow-lg max-h-60 overflow-y-auto left-0"
                    role="listbox"
                >
                    {strikeOptions.map(strike => (
                        <li
                            key={strike}
                            data-strike={strike} // Added for querySelector
                            style={getStrikeStyle(strike, spotPrice, optionType)}
                            className={`px-3 py-2 cursor-pointer hover:bg-accent/50 ${value === strike ? 'bg-accent/70' : ''}`}
                            onClick={() => handleSelect(strike)}
                            role="option"
                            aria-selected={value === strike}
                        >
                            {strike}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default StrikeSelector;
