
/**
 * Formats a number to Italian style (comma as decimal separator, dot as thousands separator)
 */
export const formatNumber = (value: number | undefined | null, decimals: number = 2): string => {
    if (value === undefined || value === null || isNaN(value)) {
        if (decimals === 0) return '0';
        return '0,' + '0'.repeat(decimals);
    }
    
    // Manual formatting to ensure consistency across all environments
    const parts = Math.abs(value).toFixed(decimals).split('.');
    
    // Thousands separator (dot)
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    
    const formatted = parts.join(',');
    return value < 0 ? `-${formatted}` : formatted;
};

/**
 * Formats a currency value in Euro with Italian style
 */
export const formatCurrency = (value: number | undefined | null, decimals: number = 2): string => {
    if (value === undefined || value === null || isNaN(value)) return '€ 0,00';
    
    const numPart = formatNumber(value, decimals);
    // Format: € 1.234,56 or € -1.234,56
    if (value < 0) {
        return `€ -${numPart.substring(1)}`;
    }
    return `€ ${numPart}`;
};

/**
 * Formats a percentage value with Italian style
 */
export const formatPercent = (value: number | undefined | null, decimals: number = 2): string => {
    if (value === undefined || value === null || isNaN(value)) {
        if (decimals === 0) return '0%';
        return '0,' + '0'.repeat(decimals) + '%';
    }
    
    const formatted = formatNumber(value, decimals);
    return `${formatted}%`;
};

/**
 * Formats a number for input fields (comma as decimal, no thousands separator)
 */
export const formatInputNumber = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) return '';
    // Use toFixed(2) to ensure we always have 2 decimal places
    return value.toFixed(2).replace('.', ',');
};
