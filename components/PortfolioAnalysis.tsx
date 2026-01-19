
import React, { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import usePortfolioStore from '../store/portfolioStore';
import useSettingsStore from '../store/settingsStore';
import { TrendingUpIcon, TrendingDownIcon, ScaleIcon, CheckBadgeIcon, PlusCircleIcon, MinusCircleIcon } from './icons';

// Custom Tooltip for Equity Chart
const CustomEquityTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-gray-900/80 p-2 border border-gray-600 rounded-md shadow-lg text-sm">
                <p className="font-bold text-gray-200">{data.tag}</p>
                <p className="text-accent">Equity: {data.equity.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p>
                <p className="text-loss">Drawdown: {data.drawdown.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p>
            </div>
        );
    }
    return null;
};

// Custom Tooltip for Bar Charts
const CustomPnlTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-gray-900/80 p-2 border border-gray-600 rounded-md shadow-lg text-sm">
                <p className="font-bold text-gray-200">{label}</p>
                <p className={payload[0].value >= 0 ? 'text-profit' : 'text-loss'}>
                    P&L Netto: {payload[0].value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
                </p>
            </div>
        );
    }
    return null;
};

// Helper to extract strategy type from tag
const extractStrategyType = (tag: string): string => {
    const lowerTag = tag.toLowerCase();
    if (lowerTag.includes('iron condor')) return 'Iron Condor';
    if (lowerTag.includes('double diagonal')) return 'Double Diagonal';
    if (lowerTag.includes('strangle')) return 'Strangle';
    if (lowerTag.includes('calendar')) return 'Calendar Spread';
    if (lowerTag.includes('ratio spread')) return 'Ratio Spread';
    if (lowerTag.includes('bear call') || lowerTag.includes('bull put')) return 'Credit Spread';
    if (lowerTag.includes('bull call') || lowerTag.includes('bear put')) return 'Debit Spread';
    if (lowerTag.includes('short put')) return 'Short Put';
    if (lowerTag.includes('short call')) return 'Short Call';
    if (lowerTag.includes('long put')) return 'Long Put';
    if (lowerTag.includes('long call')) return 'Long Call';
    return 'Altro';
};

const MetricCard = ({ icon, title, value, colorClass = 'text-white' }: { icon: React.ReactNode, title: string, value: string, colorClass?: string }) => (
    <div className="bg-gray-700/50 p-4 rounded-lg flex items-start">
        <div className="p-2 bg-gray-600/50 rounded-md mr-4 text-gray-400">{icon}</div>
        <div>
            <p className="text-sm text-gray-400 font-medium">{title}</p>
            <p className={`text-xl font-bold font-mono ${colorClass}`}>{value}</p>
        </div>
    </div>
);

const PortfolioAnalysis: React.FC = () => {
    const { structures, setCurrentView } = usePortfolioStore();
    const closedStructures = structures.filter(s => s.status === 'Closed');
    const { initialCapital } = useSettingsStore(state => state.settings);

    const equityChartData = useMemo(() => {
        if (closedStructures.length === 0) return [];
        const sortedStructures = [...closedStructures].sort((a, b) => new Date(a.closingDate!).getTime() - new Date(b.closingDate!).getTime());
        let cumulativePnl = 0;
        let peakEquity = initialCapital;
        const data = sortedStructures.map(structure => {
            cumulativePnl += structure.realizedPnl || 0;
            const currentEquity = initialCapital + cumulativePnl;
            peakEquity = Math.max(peakEquity, currentEquity);
            const drawdown = currentEquity - peakEquity;
            return {
                name: new Date(structure.closingDate!).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
                tag: structure.tag,
                equity: currentEquity,
                drawdown: drawdown,
            };
        });
        return [{ name: 'Inizio', tag: 'Capitale Iniziale', equity: initialCapital, drawdown: 0 }, ...data];
    }, [closedStructures, initialCapital]);
    
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
            const closingDate = new Date(structure.closingDate!);
            const monthKey = `${closingDate.getFullYear()}-${String(closingDate.getMonth() + 1).padStart(2, '0')}`;
            pnlByMonth[monthKey] = (pnlByMonth[monthKey] || 0) + (structure.realizedPnl || 0);
        });
        return Object.entries(pnlByMonth).sort(([keyA], [keyB]) => keyA.localeCompare(keyB)).map(([key, pnl]) => ({
            name: new Date(key + '-02').toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }),
            pnl
        }));
    }, [closedStructures]);
    
    const individualPnlData = useMemo(() => {
         return [...closedStructures].sort((a, b) => new Date(a.closingDate!).getTime() - new Date(b.closingDate!).getTime()).map(structure => ({
            name: structure.tag,
            pnl: structure.realizedPnl || 0
        }));
    }, [closedStructures]);

    if (closedStructures.length === 0) {
        return (
             <div className="max-w-4xl mx-auto text-center py-10">
                <h1 className="text-3xl font-bold text-white mb-4">Analisi di Portafoglio</h1>
                <p className="text-gray-400">Nessuna struttura chiusa trovata per generare le analisi.</p>
                 <button onClick={() => setCurrentView('list')} className="mt-6 bg-accent hover:bg-accent/80 text-white font-semibold py-2 px-4 rounded-md transition">
                    &larr; Torna alla Lista
                </button>
            </div>
        );
    }
    
    const currencyFormatter = (value: number) => `€${Math.round(value / 1000)}k`;
    const barWidth = 80;

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Dashboard di Performance</h1>
                <button onClick={() => setCurrentView('list')} className="text-accent hover:underline">
                    &larr; Torna alla Lista
                </button>
            </div>
            <div className="space-y-8">
                 <div className="bg-gray-800 rounded-lg p-4">
                    <h2 className="text-xl font-bold text-white mb-4">Metriche Chiave</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <MetricCard icon={<TrendingUpIcon />} title="P&L Netto Totale" value={keyMetrics.totalNetPnl.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} colorClass={keyMetrics.totalNetPnl >= 0 ? 'text-profit' : 'text-loss'} />
                        <MetricCard icon={<ScaleIcon />} title="Profit Factor" value={isFinite(keyMetrics.profitFactor) ? keyMetrics.profitFactor.toFixed(2) : '∞'} colorClass={keyMetrics.profitFactor >= 1 ? 'text-profit' : 'text-loss'} />
                        <MetricCard icon={<CheckBadgeIcon />} title="Win Rate" value={`${keyMetrics.winRate.toFixed(1)}%`} colorClass="text-accent"/>
                        <MetricCard icon={<PlusCircleIcon />} title="Vincita Media" value={keyMetrics.avgWin.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} colorClass="text-profit"/>
                        <MetricCard icon={<MinusCircleIcon />} title="Perdita Media" value={keyMetrics.avgLoss.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} colorClass="text-loss"/>
                        <MetricCard icon={<TrendingDownIcon />} title="Max Drawdown" value={keyMetrics.maxDrawdown.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} colorClass="text-loss"/>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Equity Line & Drawdown</h2>
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={equityChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#444444" />
                            <XAxis dataKey="name" stroke="#a0a0a0" fontSize={12} />
                            <YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={currencyFormatter} width={50} />
                            <Tooltip content={<CustomEquityTooltip />} />
                            <Legend wrapperStyle={{paddingTop: '20px'}}/>
                            <ReferenceLine y={initialCapital} label={{ value: 'Cap. Iniziale', position: 'insideTopLeft', fill: '#a0a0a0', fontSize: 10 }} stroke="#a0a0a0" strokeDasharray="2 2" />
                            <Line type="monotone" dataKey="equity" name="Equity" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="drawdown" name="Drawdown" stroke="#ef4444" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                
                <div className="bg-gray-800 rounded-lg p-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Analisi Temporale (P&L per Mese)</h2>
                    <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={monthlyPnlData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#444444" vertical={false} />
                            <XAxis dataKey="name" stroke="#a0a0a0" fontSize={12} />
                            <YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={currencyFormatter} width={50} />
                            <Tooltip content={<CustomPnlTooltip />} cursor={{ fill: 'rgba(107, 114, 128, 0.2)' }}/>
                            <ReferenceLine y={0} stroke="#6b7280" />
                            <Bar dataKey="pnl" maxBarSize={50}>
                                {monthlyPnlData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#3b82f6' : '#ef4444'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                    <h2 className="text-2xl font-bold text-white mb-4">Distribuzione P&L per Operazione</h2>
                    <div className="w-full overflow-x-auto">
                        <ResponsiveContainer width={Math.max(individualPnlData.length * barWidth, 400)} height={350}>
                            <BarChart data={individualPnlData} margin={{ top: 5, right: 20, left: 0, bottom: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#444444" vertical={false} />
                                <XAxis dataKey="name" stroke="#a0a0a0" fontSize={12} interval={0} angle={-45} textAnchor="end" />
                                <YAxis stroke="#a0a0a0" fontSize={12} tickFormatter={currencyFormatter} width={50} />
                                <Tooltip content={<CustomPnlTooltip />} cursor={{ fill: 'rgba(107, 114, 128, 0.2)' }}/>
                                <ReferenceLine y={0} stroke="#6b7280" />
                                <Bar dataKey="pnl" maxBarSize={50}>
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
    );
};

export default PortfolioAnalysis;
