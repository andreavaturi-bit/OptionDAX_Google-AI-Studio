import React, { useMemo } from 'react';

interface ExpiryDateSelectorProps {
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
    className?: string;
}

interface ExpiryOption {
    label: string;
    value: string; // YYYY-MM-DD
}

interface ExpiryGroup {
    monthLabel: string; // e.g., "Maggio 2024"
    options: ExpiryOption[];
}

// BUG FIX: Standardize all date functions to use UTC to prevent timezone errors.

// Formats a UTC date object to a 'YYYY-MM-DD' string.
const formatDate = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Formats a UTC date object to a locale string for display.
const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};

// Finds the third Friday of a given UTC year and month.
export const findThirdFridayOfMonth = (year: number, month: number): Date => {
    const fridays: Date[] = [];
    const tempDate = new Date(Date.UTC(year, month, 1));
    while (tempDate.getUTCMonth() === month) {
        if (tempDate.getUTCDay() === 5) { // 5 = Friday
            fridays.push(new Date(tempDate.getTime()));
        }
        tempDate.setUTCDate(tempDate.getUTCDate() + 1);
    }
    return fridays[2] || fridays[fridays.length - 1];
};

// Generates a list of expiry dates grouped by month, all in UTC.
const generateExpiryDates = (): ExpiryGroup[] => {
    const groups: ExpiryGroup[] = [];
    const now = new Date();
    // Start from 36 months in the past, using UTC.
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 36, 1));

    // Generate for 6 years total (72 months).
    for (let i = 0; i < 72; i++) {
        const year = startDate.getUTCFullYear();
        const month = startDate.getUTCMonth();
        const monthLabel = startDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        
        const fridays: Date[] = [];
        const tempDate = new Date(Date.UTC(year, month, 1));

        // Find all Fridays of the month in UTC.
        while (tempDate.getUTCMonth() === month) {
            if (tempDate.getUTCDay() === 5) { // 5 = Friday
                fridays.push(new Date(tempDate.getTime()));
            }
            tempDate.setUTCDate(tempDate.getUTCDate() + 1);
        }

        if (fridays.length > 0) {
            const options: ExpiryOption[] = fridays.map((friday, index) => {
                let labelPrefix = '';
                // BUG FIX: Use the month from the 'friday' date, not the 'startDate' iterator.
                const correctMonthName = friday.toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' });
                
                switch (index) {
                    case 0: labelPrefix = '1W'; break;
                    case 1: labelPrefix = '2W'; break;
                    case 2: labelPrefix = correctMonthName; break; // Use correct month name for the 3rd Friday (standard expiry)
                    case 3: labelPrefix = '4W'; break;
                    case 4: labelPrefix = '5W'; break;
                    default: labelPrefix = `${index + 1}W`;
                }
                
                const displayDate = formatDisplayDate(friday);
                const capitalizedLabel = labelPrefix.charAt(0).toUpperCase() + labelPrefix.slice(1);

                return {
                    label: `${capitalizedLabel} (${displayDate})`,
                    value: formatDate(friday),
                };
            });
            
            if (options.length > 0) {
                 groups.push({
                    monthLabel: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
                    options,
                });
            }
        }

        startDate.setUTCMonth(startDate.getUTCMonth() + 1);
    }
    
    return groups;
};


const ExpiryDateSelector: React.FC<ExpiryDateSelectorProps> = ({ value, onChange, disabled, className }) => {
    const expiryGroups = useMemo(() => generateExpiryDates(), []);
    
    const allOptions = useMemo(() => expiryGroups.flatMap(g => g.options), [expiryGroups]);
    const valueExists = useMemo(() => allOptions.some(opt => opt.value === value), [allOptions, value]);

    const displayGroups = useMemo(() => {
        if (!value || valueExists) {
            return expiryGroups;
        }

        // The current value isn't in our generated list (e.g., a very old date).
        // We add it as a special "past" option to ensure it's displayed correctly.
        try {
            // Parse the YYYY-MM-DD string as UTC to avoid timezone shifts.
            const parts = value.split('-').map(p => parseInt(p, 10));
            if (parts.length !== 3) throw new Error("Invalid date format");
            const dateValue = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
            if (isNaN(dateValue.getTime())) throw new Error("Invalid date");

            const pastOption: ExpiryOption = {
                label: `Scadenza passata (${formatDisplayDate(dateValue)})`,
                value: value,
            };
            const pastGroup: ExpiryGroup = {
                monthLabel: 'Scadenze Molto Passate',
                options: [pastOption],
            };
            
            // Return the special past group along with the standard list.
            return [pastGroup, ...expiryGroups];
        } catch (e) {
            console.error("Could not parse custom expiry date:", value, e);
            return expiryGroups; // Fallback to standard list on error
        }
    }, [expiryGroups, value, valueExists]);


    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={className}
        >
            {displayGroups.map(group => (
                <optgroup key={group.monthLabel} label={group.monthLabel}>
                    {group.options.map(option => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </optgroup>
            ))}
        </select>
    );
};

export default ExpiryDateSelector;