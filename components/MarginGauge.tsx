import React from 'react';
import { formatCurrency } from '../utils/formatters';

interface MarginGaugeProps {
    occupiedMargin: number;
    totalCapital: number;
}

const MarginGauge: React.FC<MarginGaugeProps> = ({ occupiedMargin, totalCapital }) => {
    const percentage = totalCapital > 0 ? (occupiedMargin / totalCapital) * 100 : 0;
    const cappedPercentage = Math.min(100, percentage);
    
    // Determine color based on pressure
    let colorClass = "bg-emerald-500";
    let shadowClass = "shadow-[0_0_15px_rgba(16,185,129,0.4)]";
    let borderClass = "border-emerald-600/20";
    
    if (percentage > 50) {
        colorClass = "bg-amber-500";
        shadowClass = "shadow-[0_0_15px_rgba(245,158,11,0.4)]";
        borderClass = "border-amber-600/20";
    }
    if (percentage > 80) {
        colorClass = "bg-rose-500";
        shadowClass = "shadow-[0_0_15px_rgba(244,63,94,0.4)]";
        borderClass = "border-rose-600/20";
    }

    return (
        <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-2xl border border-slate-200 dark:border-gray-700 shadow-sm h-full group transition-all hover:shadow-md">
            <div className="relative w-20 h-32 bg-slate-100 dark:bg-gray-900 rounded-2xl border-2 border-slate-200 dark:border-gray-700 overflow-hidden flex items-end shadow-inner">
                {/* Liquid fill */}
                <div 
                    className={`w-full transition-all duration-1000 ease-out relative ${colorClass} ${shadowClass}`}
                    style={{ height: `${cappedPercentage}%` }}
                >
                    {/* Surface highlight */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-white/30"></div>
                    
                    {/* Subtle wave animation effect */}
                    <div className="absolute -top-1 left-0 w-full h-2 bg-inherit opacity-50 blur-[2px] animate-pulse"></div>
                </div>
                
                {/* Measurement marks */}
                <div className="absolute inset-0 flex flex-col justify-between py-2 px-1 pointer-events-none opacity-20">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="w-full h-px bg-slate-400"></div>
                    ))}
                </div>

                {/* Percentage Text Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <span className="text-lg font-black font-mono text-slate-900 dark:text-white drop-shadow-[0_2px_2px_rgba(255,255,255,0.5)] dark:drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
                        {Math.round(percentage)}%
                    </span>
                </div>
            </div>
            
            <div className="mt-3 text-center">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Margine Occupato</p>
                <p className={`text-xs font-mono font-bold ${percentage > 90 ? 'text-rose-500' : 'text-slate-600 dark:text-gray-300'}`}>
                    {formatCurrency(occupiedMargin, 0)}
                </p>
                <div className="w-8 h-px bg-slate-200 dark:bg-gray-700 mx-auto my-1"></div>
                <p className="text-[9px] text-slate-400 font-medium">su {formatCurrency(totalCapital, 0)}</p>
            </div>
        </div>
    );
};

export default MarginGauge;
