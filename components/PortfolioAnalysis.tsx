
import React, { useMemo, useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, ComposedChart
} from 'recharts';
import usePortfolioStore from '../store/portfolioStore';
import useSettingsStore from '../store/settingsStore';
import { TrendingUpIcon, TrendingDownIcon, ScaleIcon, CheckBadgeIcon, PlusCircleIcon, MinusCircleIcon } from './icons';

// Custom Tooltip for Equity Chart
const CustomEquityTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white dark:bg-gray-900/90 p-3 border border-slate-200 dark:border-gray-600 rounded-xl shadow-xl text-sm backdrop-blur-sm">
                <p className="font-bold text-slate-900 dark:text-gray-200 mb-1">{data.tag}</p>
                <div className="space-y-1">
                    <p className="text-accent font-semibold flex justify-between gap-4">
                        <span>Equity:</span>
                        <span className="font-mono">{data.equity.toLocaleString('it-IT', { minimumFractionDigits: 2 })}€</span>
                    </p>
                    <p className="text-loss flex justify-between gap-4">
                        <span>Drawdown:</span>
                        <span className="font-mono">{data.drawdown.toLocaleString('it-IT', { minimumFractionDigits: 2 })}€</span>
                    </p>
                </div>
            </div>
        );
    }
    return null;
};

// Custom Tooltip for Bar Charts
const CustomPnlTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-gray-900/90 p-3 border border-slate-200 dark:border-gray-600 rounded-xl shadow-xl text-sm backdrop-blur-sm">
                <p className="font-bold text-slate-900 dark:text-gray-200 mb-1">{label}</p>
                <p className={`font-semibold ${payload[0].value >= 0 ? 'text-profit' : 'text-loss'}`}>
                    P&L Netto: {payload[0].value.toLocaleString('it-IT', { minimumFractionDigits: 2 })}€
                </p>
            </div>
        );
    }
    return null;
};

const MetricCard = ({ icon, title, value, colorClass = 'text-slate-900 dark:text-white' }: { icon: React.ReactNode, title: string, value: string, colorClass?: string }) => (
    <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex items-center gap-3 transition-all hover:shadow-md">
        <div className="p-1.5 bg-slate-50 dark:bg-gray-700/50 rounded-lg text-slate-400 dark:text-gray-400 shrink-0">
            {React.cloneElement(icon as React.ReactElement, { className: "w-4 h-4" })}
        </div>
        <div className="min-w-0">
            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-bold uppercase tracking-wider truncate">{title}</p>
            <p className={`text-base font-bold font-mono ${colorClass}`}>{value}</p>
        </div>
    </div>
);

// Helper to get the effective closing date (latest of legs or structure closing date)
const getEffectiveClosingDate = (structure: any) => {
    if (structure.legs && structure.legs.length > 0) {
        const legClosingDates = structure.legs
            .map((l: any) => l.closingDate)
            .filter((d: any) => d)
            .map((d: any) => new Date(d).getTime());
        
        if (legClosingDates.length > 0) {
            return Math.max(...legClosingDates);
        }
    }
    return structure.closingDate ? new Date(structure.closingDate).getTime() : 0;
};

// Helper to get serial number from tag
const getSerial = (tag: string) => {
    const match = tag.match(/(\d+)$/);
    return match ? parseInt(match[1]) : -1;
};

const PortfolioAnalysis: React.FC = () => {
    const { structures, setCurrentView } = usePortfolioStore();
    const closedStructures = structures.filter(s => s.status === 'Closed');
    const { initialCapital } = useSettingsStore(state => state.settings);
    const [isDarkMode, setIsDarkMode] = useState(false);

    // Ensure initialCapital is a number
    const safeInitialCapital = useMemo(() => Number(initialCapital) || 0, [initialCapital]);

    useEffect(() => {
        const checkTheme = () => {
            setIsDarkMode(document.documentElement.classList.contains('dark'));
        };
        checkTheme();
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const equityChartData = useMemo(() => {
        if (closedStructures.length === 0) return [];
        
        // Sort by serial number, fallback to effective closing date
        const sortedStructures = [...closedStructures].sort((a, b) => {
            const serialA = getSerial(a.tag);
            const serialB = getSerial(b.tag);
            
            if (serialA !== -1 && serialB !== -1) {
                return serialA - serialB;
            }
            return getEffectiveClosingDate(a) - getEffectiveClosingDate(b);
        });

        let cumulativePnl = 0;
        
        // Start with initial capital point
        const dataPoints = [{
            uniqueId: 'start',
            name: 'Inizio',
            tag: 'Capitale Iniziale',
            equity: safeInitialCapital,
            drawdown: 0,
            date: 0
        }];

        sortedStructures.forEach((structure, index) => {
            cumulativePnl += (structure.realizedPnl || 0);
            const currentEquity = safeInitialCapital + cumulativePnl;
            
            // Calculate drawdown based on peak equity up to this point
            const peakEquity = Math.max(safeInitialCapital, ...dataPoints.map(d => d.equity), currentEquity);
            const drawdown = currentEquity - peakEquity;

            const effectiveDateTimestamp = getEffectiveClosingDate(structure);
            const effectiveDate = new Date(effectiveDateTimestamp);

            // Create a unique name if dates are identical to avoid chart merging issues, 
            // though Recharts handles duplicates fine usually. 
            // We'll stick to the date string.
            dataPoints.push({
                uniqueId: `${index}-${structure.id}`,
                name: effectiveDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }),
                tag: structure.tag,
                equity: currentEquity,
                drawdown: drawdown,
                date: effectiveDateTimestamp
            });
        });

        return dataPoints;
    }, [closedStructures, safeInitialCapital]);
    
    // Calculate min and max equity from the generated data
    const minEquity = useMemo(() => {
        if (equityChartData.length === 0) return safeInitialCapital;
        return Math.min(...equityChartData.map(d => d.equity));
    }, [equityChartData, safeInitialCapital]);

    const maxEquity = useMemo(() => {
        if (equityChartData.length === 0) return safeInitialCapital;
        return Math.max(...equityChartData.map(d => d.equity));
    }, [equityChartData, safeInitialCapital]);

    // Calculate dynamic domain for equity chart with padding
    // We want the chart to focus on the movement, so we exclude 0 unless equity drops near 0.
    const domainPadding = (maxEquity - minEquity) * 0.1;
    const effectivePadding = domainPadding === 0 ? safeInitialCapital * 0.01 : domainPadding;
    
    const yAxisMin = Math.floor(minEquity - effectivePadding);
    const yAxisMax = Math.ceil(maxEquity + effectivePadding);

    // Ensure we don't go below 0 if equity is positive
    const finalYMin = Math.max(0, yAxisMin);

    const keyMetrics = useMemo(() => {
        const totalNetPnl = closedStructures.reduce((acc, s) => acc + (s.realizedPnl || 0), 0);
        const winningTrades = closedStructures.filter(s => (s.realizedPnl || 0) > 0);
        const losingTrades = closedStructures.filter(s => (s.realizedPnl || 0) < 0);
        const grossProfit = winningTrades.reduce((acc, s) => acc + (s.realizedPnl || 0), 0);
        const grossLoss = Math.abs(losingTrades.reduce((acc, s) => acc + (s.realizedPnl || 0), 0));
        const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : Infinity;
        const winRate = closedStructures.length > 0 ? (winningTrades.length / closedStructures.length) * 100 : 0;
        const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
        const maxDrawdown = equityChartData.length > 1 ? Math.min(0, ...equityChartData.map(d => d.drawdown)) : 0;

        return { totalNetPnl, profitFactor, winRate, avgWin, avgLoss, maxDrawdown };
    }, [closedStructures, equityChartData]);

    const monthlyPnlData = useMemo(() => {
        const pnlByMonth: { [key: string]: number } = {};
        closedStructures.forEach(structure => {
            const closingDate = new Date(getEffectiveClosingDate(structure));
            const monthKey = `${closingDate.getFullYear()}-${String(closingDate.getMonth() + 1).padStart(2, '0')}`;
            pnlByMonth[monthKey] = (pnlByMonth[monthKey] || 0) + (structure.realizedPnl || 0);
        });
        return Object.entries(pnlByMonth).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([key, pnl]) => ({
            name: new Date(key + '-02').toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
            pnl
        }));
    }, [closedStructures]);
    
    const individualPnlData = useMemo(() => {
         return [...closedStructures].sort((a, b) => {
            const serialA = getSerial(a.tag);
            const serialB = getSerial(b.tag);
            
            if (serialA !== -1 && serialB !== -1) {
                return serialA - serialB;
            }
            return getEffectiveClosingDate(a) - getEffectiveClosingDate(b);
         }).map(structure => ({
            name: structure.tag,
            pnl: structure.realizedPnl || 0
        }));
    }, [closedStructures]);

    if (closedStructures.length === 0) {
        return (
             <div className="max-w-4xl mx-auto text-center py-10">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Analisi di Portafoglio</h1>
                <p className="text-slate-500 dark:text-gray-400">Nessuna struttura chiusa trovata per generare le analisi.</p>
                 <button onClick={() => setCurrentView('list')} className="mt-6 bg-accent hover:bg-accent/80 text-white font-semibold py-2 px-6 rounded-md transition shadow-lg shadow-accent/20">
                    &larr; Torna alla Lista
                </button>
            </div>
        );
    }
    
    const currencyFormatter = (value: number) => {
        if (Math.abs(value) >= 1000) {
            return `€${(value / 1000).toFixed(1)}k`;
        }
        return `€${Math.round(value)}`;
    };
    const formatEuro = (val: number) => val.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';
    
    const gridColor = isDarkMode ? "#374151" : "#f1f5f9";
    const axisColor = isDarkMode ? "#9ca3af" : "#94a3b8";

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard di Performance</h1>
                <button onClick={() => setCurrentView('list')} className="text-accent hover:underline font-semibold">
                    &larr; Torna alla Lista
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <MetricCard icon={<TrendingUpIcon />} title="P&L Netto Totale" value={formatEuro(keyMetrics.totalNetPnl)} colorClass={keyMetrics.totalNetPnl >= 0 ? 'text-profit' : 'text-loss'} />
                <MetricCard icon={<ScaleIcon />} title="Profit Factor" value={isFinite(keyMetrics.profitFactor) ? keyMetrics.profitFactor.toFixed(2) : '∞'} colorClass={keyMetrics.profitFactor >= 1 ? 'text-profit' : 'text-loss'} />
                <MetricCard icon={<CheckBadgeIcon />} title="Win Rate" value={`${keyMetrics.winRate.toFixed(1)}%`} colorClass="text-accent"/>
                <MetricCard icon={<PlusCircleIcon />} title="Vincita Media" value={formatEuro(keyMetrics.avgWin)} colorClass="text-profit"/>
                <MetricCard icon={<MinusCircleIcon />} title="Perdita Media" value={formatEuro(keyMetrics.avgLoss)} colorClass="text-loss"/>
                <MetricCard icon={<TrendingDownIcon />} title="Max Drawdown" value={formatEuro(keyMetrics.maxDrawdown)} colorClass="text-loss"/>
            </div>

            <div className="grid grid-cols-1 gap-8">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Equity Line & Drawdown</h2>
                        <div className="flex items-center gap-4 text-xs font-medium">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-accent"></div>
                                <span className="text-slate-500 dark:text-gray-400">Equity</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-loss/50"></div>
                                <span className="text-slate-500 dark:text-gray-400">Drawdown</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[450px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={equityChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                <XAxis 
                                    dataKey="uniqueId" 
                                    stroke={axisColor} 
                                    fontSize={12} 
                                    tickLine={false}
                                    axisLine={false}
                                    dy={10}
                                    tickFormatter={(value) => {
                                        const item = equityChartData.find(d => d.uniqueId === value);
                                        return item ? item.name : '';
                                    }}
                                />
                                <YAxis 
                                    stroke={axisColor} 
                                    fontSize={12} 
                                    tickFormatter={currencyFormatter} 
                                    width={60}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={[finalYMin, yAxisMax]}
                                    allowDataOverflow={true}
                                />
                                <Tooltip content={<CustomEquityTooltip />} cursor={{ stroke: axisColor, strokeWidth: 1, strokeDasharray: '4 4' }} />
                                <ReferenceLine y={initialCapital} stroke={axisColor} strokeDasharray="3 3" opacity={0.5} />
                                <Bar dataKey="drawdown" fill="#ef4444" opacity={0.2} barSize={40} radius={[4, 4, 0, 0]} />
                                <Area 
                                    type="monotone" 
                                    dataKey="equity" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3} 
                                    fillOpacity={1} 
                                    fill="url(#colorEquity)" 
                                    dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
                                    activeDot={{ r: 6 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">P&L per Mese</h2>
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyPnlData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                    <XAxis dataKey="name" stroke={axisColor} fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke={axisColor} fontSize={12} tickFormatter={currencyFormatter} width={60} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomPnlTooltip />} cursor={{ fill: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(241, 245, 249, 0.8)' }}/>
                                    <ReferenceLine y={0} stroke={axisColor} />
                                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                        {monthlyPnlData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#3b82f6' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Distribuzione per Operazione</h2>
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={individualPnlData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                    <XAxis dataKey="name" stroke={axisColor} fontSize={10} interval={0} hide={individualPnlData.length > 15} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke={axisColor} fontSize={12} tickFormatter={currencyFormatter} width={60} tickLine={false} axisLine={false} />
                                    <Tooltip content={<CustomPnlTooltip />} cursor={{ fill: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(241, 245, 249, 0.8)' }}/>
                                    <ReferenceLine y={0} stroke={axisColor} />
                                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                        {individualPnlData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PortfolioAnalysis;
