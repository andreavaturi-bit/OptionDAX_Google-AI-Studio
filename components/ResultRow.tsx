
import React from 'react';
import { formatNumber } from '../utils/formatters';

interface ResultRowProps {
    label: string;
    value: string | number;
    className?: string;
    description?: string;
}

const ResultRow: React.FC<ResultRowProps> = ({ label, value, className = '', description }) => {
    return (
        <div className={`p-4 bg-slate-50 dark:bg-gray-700/50 rounded-xl border border-slate-200 dark:border-gray-600 flex flex-col items-center justify-center text-center ${className}`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1" title={description}>
                {label}
            </span>
            <span className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                {typeof value === 'number' ? formatNumber(value, 4) : value}
            </span>
        </div>
    );
};

export default ResultRow;
