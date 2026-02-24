
import React, { useMemo, useState, useEffect } from 'react';
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
    ResponsiveContainer, ReferenceLine, ReferenceDot 
} from 'recharts';
import { MarketData, OptionLeg } from '../types';
import { BlackScholes, getYearFraction } from '../services/blackScholes';

interface PayoffChartProps {
  legs: OptionLeg[];
  marketData: MarketData;
  multiplier: number;
  structureStatus?: 'Active' | 'Closed';
  realizedPnl?: number;
}

const PayoffChart: React.FC<PayoffChartProps> = ({ legs, marketData, multiplier, structureStatus, realizedPnl }) => {
    const [viewRange, setViewRange] = useState<number>(20); 
    const [simTimePercent, setSimTimePercent] = useState<number>(0); 
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        const checkTheme = () => setIsDarkMode(document.documentElement.classList.contains('dark'));
        checkTheme();
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const earliestExpiryDate = useMemo(() => {
        if (legs.length === 0) return new Date();
        const dates = legs.map(l => new Date(l.expiryDate).getTime());
        return new Date(Math.min(...dates));
    }, [legs]);

    const chartPoints = useMemo(() => {
        if (legs.length === 0) return [];

        const currentSpot = marketData.daxSpot;
        const strikes = legs.map(l => l.strike);
        
        const minStrike = Math.min(...strikes, currentSpot);
        const maxStrike = Math.max(...strikes, currentSpot);
        
        let spread = maxStrike - minStrike;
        if (spread < currentSpot * 0.01) spread = currentSpot * 0.01;

        const expansionFactor = viewRange / 100;
        const minPadding = spread * 0.1;
        const maxPadding = Math.max(spread * 5, currentSpot * 0.3);
        
        const padding = minPadding + (maxPadding - minPadding) * expansionFactor;

        const xMin = Math.floor(minStrike - padding);
        const xMax = Math.ceil(maxStrike + padding);

        const pointCount = 150;
        const step = (xMax - xMin) / pointCount;
        const basePoints = Array.from({ length: pointCount + 1 }, (_, i) => xMin + i * step);

        const criticalPoints: number[] = [currentSpot];
        strikes.forEach(s => {
            criticalPoints.push(s);
            criticalPoints.push(s - 0.5);
            criticalPoints.push(s + 0.5);
        });

        const allPoints = [...basePoints, ...criticalPoints]
            .filter(p => p >= xMin && p <= xMax)
            .sort((a, b) => a - b);
        
        const uniquePoints: number[] = [];
        if (allPoints.length > 0) uniquePoints.push(allPoints[0]);
        for (let i = 1; i < allPoints.length; i++) {
            if (allPoints[i] - allPoints[i-1] > 0.1) {
                uniquePoints.push(allPoints[i]);
            }
        }

        return uniquePoints;
    }, [legs, marketData.daxSpot, viewRange]);


    const data = useMemo(() => {
        if (!chartPoints.length) return [];
        
        // If closed, return a flat line at realized PnL
        if (structureStatus === 'Closed' && realizedPnl !== undefined) {
            return chartPoints.map(spot => ({
                spot,
                pnlExpiry: realizedPnl,
                pnlSim: realizedPnl
            }));
        }

        const now = new Date();
        const t_now_to_expiry = getYearFraction(now.toISOString(), earliestExpiryDate.toISOString());
        
        const t_elapsed = t_now_to_expiry * (simTimePercent / 100);

        return chartPoints.map(spot => {
            let pnlAtFirstExpiry = 0;
            let pnlSimulated = 0;

            legs.forEach(leg => {
                const legExpiry = new Date(leg.expiryDate);
                const isExpiringLeg = Math.abs(legExpiry.getTime() - earliestExpiryDate.getTime()) < 24 * 3600 * 1000;

                let valAtExpiry = 0;
                if (isExpiringLeg) {
                    valAtExpiry = leg.optionType === 'Call'
                        ? Math.max(0, spot - leg.strike)
                        : Math.max(0, leg.strike - spot);
                } else {
                    const t_remaining = getYearFraction(earliestExpiryDate.toISOString(), leg.expiryDate);
                    const bs = new BlackScholes(spot, leg.strike, t_remaining, marketData.riskFreeRate, leg.impliedVolatility);
                    valAtExpiry = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
                }

                const t_total_leg = getYearFraction(now.toISOString(), leg.expiryDate);
                const t_remaining_sim = Math.max(0, t_total_leg - t_elapsed);

                let valSimulated = 0;
                if (t_remaining_sim < 0.001) {
                     valSimulated = leg.optionType === 'Call'
                        ? Math.max(0, spot - leg.strike)
                        : Math.max(0, leg.strike - spot);
                } else {
                    const bsSim = new BlackScholes(spot, leg.strike, t_remaining_sim, marketData.riskFreeRate, leg.impliedVolatility);
                    valSimulated = leg.optionType === 'Call' ? bsSim.callPrice() : bsSim.putPrice();
                }

                if (leg.quantity > 0) {
                    pnlAtFirstExpiry += (valAtExpiry - leg.tradePrice) * leg.quantity;
                    pnlSimulated += (valSimulated - leg.tradePrice) * leg.quantity;
                } else {
                    pnlAtFirstExpiry += (leg.tradePrice - valAtExpiry) * Math.abs(leg.quantity);
                    pnlSimulated += (leg.tradePrice - valSimulated) * Math.abs(leg.quantity);
                }
            });

            return {
                spot,
                pnlExpiry: pnlAtFirstExpiry * multiplier,
                pnlSim: pnlSimulated * multiplier
            };
        });
    }, [chartPoints, legs, earliestExpiryDate, marketData, simTimePercent, multiplier, structureStatus, realizedPnl]);

    // Calculate gradients based on the Simulation PnL (Dashed line)
    const gradientOffsetSim = useMemo(() => {
        if (data.length === 0) return 0;
        const values = data.map(d => d.pnlSim);
        const max = Math.max(...values);
        const min = Math.min(...values);
        if (max <= 0) return 0;
        if (min >= 0) return 1;
        return max / (max - min);
    }, [data]);

    // Calculate gradients based on the Expiry PnL (Blue line)
    const gradientOffsetExp = useMemo(() => {
        if (data.length === 0) return 0;
        const values = data.map(d => d.pnlExpiry);
        const max = Math.max(...values);
        const min = Math.min(...values);
        if (max <= 0) return 0;
        if (min >= 0) return 1;
        return max / (max - min);
    }, [data]);

    const currentValues = useMemo(() => {
        if (!data.length) return { exp: 0, sim: 0 };
        const closest = data.reduce((prev, curr) => 
            Math.abs(curr.spot - marketData.daxSpot) < Math.abs(prev.spot - marketData.daxSpot) ? curr : prev
        );
        return { exp: closest.pnlExpiry, sim: closest.pnlSim };
    }, [data, marketData.daxSpot]);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900/95 backdrop-blur border border-slate-700 p-3 rounded-lg shadow-xl text-xs z-50 min-w-[150px]">
                    <p className="text-gray-400 mb-2 border-b border-gray-700 pb-1 flex justify-between">
                        <span>Strike:</span>
                        <span className="font-mono text-white font-bold">{Math.round(label)}</span>
                    </p>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-[#3b82f6] font-semibold">
                                {structureStatus === 'Closed' ? 'P&L Realizzato:' : 'A Scadenza:'}
                            </span>
                            <span className={`font-mono font-bold ${payload[0].value >= 0 ? 'text-profit' : 'text-loss'}`}>
                                {payload[0].value > 0 ? '+' : ''}{Math.round(payload[0].value)} €
                            </span>
                        </div>
                         {structureStatus !== 'Closed' && (
                         <div className="flex justify-between items-center">
                            <span className="text-emerald-400 font-semibold">Stimato (T+{Math.round((simTimePercent/100)*30)}d):</span>
                            <span className={`font-mono font-bold ${payload[1].value >= 0 ? 'text-profit' : 'text-loss'}`}>
                                {payload[1].value > 0 ? '+' : ''}{Math.round(payload[1].value)} €
                            </span>
                        </div>
                        )}
                    </div>
                </div>
            );
        }
        return null;
    };
    
    const gradientIdSim = `splitColorSim-${gradientOffsetSim.toFixed(4)}`;
    const gradientIdExp = `splitColorExp-${gradientOffsetExp.toFixed(4)}`;

    return (
        <div className="relative w-full h-full flex flex-col bg-slate-50 dark:bg-gray-800 rounded-xl overflow-hidden">
            {/* Header Controls */}
            {structureStatus !== 'Closed' && (
            <div className="flex flex-wrap items-center justify-between p-2 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
                 <div className="flex items-center space-x-3 flex-1 min-w-[200px] mr-4">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider w-14">Time</span>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={simTimePercent} 
                        onChange={(e) => setSimTimePercent(parseInt(e.target.value))}
                        className="flex-1 h-1.5 bg-slate-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                    />
                     <span className="text-[10px] font-mono font-bold text-[#3b82f6] w-8 text-right">
                        {simTimePercent === 0 ? 'T+0' : simTimePercent === 100 ? 'Exp' : `${simTimePercent}%`}
                    </span>
                 </div>
                 
                 <div className="flex items-center space-x-3 text-[10px]">
                    <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-profit mr-1"></span> Profit</div>
                    <div className="flex items-center"><span className="w-2 h-2 rounded-full bg-loss mr-1"></span> Loss</div>
                 </div>
            </div>
            )}
            
            {structureStatus === 'Closed' && (
                <div className="flex items-center justify-center p-2 border-b border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Payoff Realizzato</span>
                </div>
            )}

            {/* Chart Area */}
            <div className="flex-1 relative min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart 
                        data={data} 
                        margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                    >
                        <defs>
                            {/* Gradient for Simulation Line (Green/Red) */}
                            <linearGradient id={`${gradientIdSim}-fill`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset={gradientOffsetSim} stopColor="#10b981" stopOpacity={0.2} />
                                <stop offset={gradientOffsetSim} stopColor="#ef4444" stopOpacity={0.2} />
                            </linearGradient>
                             <linearGradient id={`${gradientIdSim}-stroke`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset={gradientOffsetSim} stopColor="#10b981" stopOpacity={1} />
                                <stop offset={gradientOffsetSim} stopColor="#ef4444" stopOpacity={1} />
                            </linearGradient>

                            {/* Gradient for Expiry Line (Blue/Red but lighter) */}
                             <linearGradient id={`${gradientIdExp}-fill-expiry`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset={gradientOffsetExp} stopColor="#3b82f6" stopOpacity={0.1} /> {/* Blue for profit */}
                                <stop offset={gradientOffsetExp} stopColor="#ef4444" stopOpacity={0.3} /> {/* Red for loss */}
                            </linearGradient>
                        </defs>
                        
                        <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#334155" : "#e2e8f0"} vertical={false} />
                        
                        <XAxis 
                            dataKey="spot" 
                            type="number" 
                            domain={['dataMin', 'dataMax']}
                            allowDataOverflow={false}
                            tickFormatter={(value) => `${Math.round(value)}`}
                            stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={40}
                        />
                        <YAxis 
                            tickFormatter={(value) => `€${value}`}
                            stroke={isDarkMode ? "#94a3b8" : "#64748b"}
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            width={50}
                        />
                        
                        <Tooltip content={<CustomTooltip />} cursor={{stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4'}}/>
                        
                        <ReferenceLine y={0} stroke={isDarkMode ? "#475569" : "#cbd5e1"} />
                        <ReferenceLine x={marketData.daxSpot} stroke="#fbbf24" strokeDasharray="3 3" />
                        
                        <ReferenceDot x={marketData.daxSpot} y={currentValues.exp} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                        {structureStatus !== 'Closed' && (
                             <ReferenceDot x={marketData.daxSpot} y={currentValues.sim} r={4} fill={currentValues.sim >= 0 ? "#10b981" : "#ef4444"} stroke="#fff" strokeWidth={2} />
                        )}

                        {/* Linea Scadenza (Blu) - Added FILL to show Red zone */}
                        <Area 
                            type="monotone" 
                            dataKey="pnlExpiry" 
                            stroke="#3b82f6" 
                            strokeWidth={structureStatus === 'Closed' ? 3 : 2} 
                            fill={structureStatus === 'Closed' ? "none" : `url(#${gradientIdExp}-fill-expiry)`} 
                            isAnimationActive={false}
                        />

                        {/* Linea Simulazione (Verde/Rossa) */}
                        {structureStatus !== 'Closed' && (
                        <Area 
                            type="monotone" 
                            dataKey="pnlSim" 
                            stroke={`url(#${gradientIdSim}-stroke)`} 
                            strokeWidth={2}
                            strokeDasharray={simTimePercent > 0 ? "0" : "5 5"} 
                            fill={`url(#${gradientIdSim}-fill)`} 
                            baseValue={0} 
                            isAnimationActive={false}
                        />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {/* Bottom Controls */}
            {structureStatus !== 'Closed' && (
            <div className="h-10 border-t border-slate-200 dark:border-gray-700 flex items-center justify-between px-4 bg-slate-50 dark:bg-gray-800/50">
                 <div className="flex items-center flex-1">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mr-3 whitespace-nowrap flex items-center gap-2">
                        Zoom Range <span className="text-accent bg-accent/10 px-1.5 py-0.5 rounded text-[9px]">{viewRange}%</span>
                    </span>
                    <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        step="1"
                        value={viewRange} 
                        onChange={(e) => setViewRange(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-slate-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-slate-500 hover:accent-accent transition-colors"
                    />
                 </div>
                 
                 <button 
                    onClick={() => setViewRange(20)}
                    className="ml-4 text-[10px] font-bold uppercase text-slate-500 hover:text-white hover:bg-slate-500 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 rounded transition-all"
                 >
                    RESET
                 </button>
            </div>
            )}
        </div>
    );
};

export default PayoffChart;
