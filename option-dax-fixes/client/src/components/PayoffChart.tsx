import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { MarketData, OptionLeg } from '../types';
import { BlackScholes, getTimeToExpiry } from '../services/blackScholes';
import { useTheme } from '../contexts/ThemeContext';

interface PayoffChartProps {
  legs: OptionLeg[];
  marketData: MarketData;
  multiplier: number;
}

const Diamond = (props: any) => {
    const { cx, cy, fill, stroke, strokeWidth } = props;
    if (cx === undefined || cy === undefined) return null;
    const size = 6;
    return (
        <path
            transform={`translate(${cx}, ${cy})`}
            d={`M 0 -${size} L ${size} 0 L 0 ${size} L -${size} 0 Z`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
        />
    );
};

const ResetIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 4l16 16" />
    </svg>
);

const ZoomInIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
    </svg>
);

const ZoomOutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);

// Theme-aware chart colors
const getChartColors = (isDark: boolean) => ({
    grid: isDark ? '#374151' : '#e5e7eb',
    axis: isDark ? '#9ca3af' : '#6b7280',
    zeroLine: isDark ? '#6b7280' : '#9ca3af',
    tooltipBg: isDark ? '#1f2937' : '#ffffff',
    tooltipBorder: isDark ? '#374151' : '#e5e7eb',
    tooltipText: isDark ? '#f3f4f6' : '#111827',
});

const PayoffChart: React.FC<PayoffChartProps> = ({ legs, marketData, multiplier }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const colors = getChartColors(isDark);

    const legsKey = useMemo(() => {
        return JSON.stringify(legs.map(l => ({
            id: l.id,
            strike: l.strike,
            quantity: l.quantity,
            optionType: l.optionType,
            tradePrice: l.tradePrice,
            expiryDate: l.expiryDate,
            impliedVolatility: l.impliedVolatility
        })));
    }, [legs]);

    const initialXDomain = useMemo((): [number, number] => {
        if (legs.length === 0) {
            const range = marketData.daxSpot * 0.15;
            return [marketData.daxSpot - range, marketData.daxSpot + range];
        }

        const strikes = legs.map(leg => leg.strike);
        const minStrike = Math.min(...strikes);
        const maxStrike = Math.max(...strikes);
        const strategyWidth = maxStrike - minStrike;
        const buffer = Math.max(strategyWidth * 0.5, marketData.daxSpot * 0.05);

        return [minStrike - buffer, maxStrike + buffer];
    }, [legsKey, marketData.daxSpot, legs.length]);

    const [xDomain, setXDomain] = useState<[number, number]>(initialXDomain);

    useEffect(() => {
        setXDomain(initialXDomain);
    }, [initialXDomain]);

    const spotMarkerData = useMemo(() => {
        if (legs.length === 0) return { expiry: [], today: [] };

        const currentSpot = marketData.daxSpot;
        let pnlAtExpiryPoints = 0;
        let pnlTodayPoints = 0;
        let realizedPnlOffset = 0;

        legs.forEach((leg: OptionLeg) => {
            const isClosed = leg.closingPrice !== null && leg.closingPrice !== undefined;

            if (isClosed) {
                let pnlPoints = 0;
                if (leg.quantity > 0) {
                    pnlPoints = (leg.closingPrice! - leg.tradePrice) * leg.quantity;
                } else {
                    pnlPoints = (leg.tradePrice - leg.closingPrice!) * Math.abs(leg.quantity);
                }
                const grossPnl = pnlPoints * multiplier;
                const commissions = 4 * Math.abs(leg.quantity);
                realizedPnlOffset += (grossPnl - commissions);
                return;
            }

            const expiryValue = leg.optionType === 'Call'
                ? Math.max(0, currentSpot - leg.strike)
                : Math.max(0, leg.strike - currentSpot);

            if (leg.quantity > 0) {
                pnlAtExpiryPoints += (expiryValue - leg.tradePrice) * leg.quantity;
            } else {
                pnlAtExpiryPoints += (leg.tradePrice - expiryValue) * Math.abs(leg.quantity);
            }

            const timeToExpiry = getTimeToExpiry(leg.expiryDate);
            if (timeToExpiry > 0) {
                const bs = new BlackScholes(currentSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
                const currentPrice = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();

                if (leg.quantity > 0) {
                    pnlTodayPoints += (currentPrice - leg.tradePrice) * leg.quantity;
                } else {
                    pnlTodayPoints += (leg.tradePrice - currentPrice) * Math.abs(leg.quantity);
                }
            } else {
                if (leg.quantity > 0) {
                    pnlTodayPoints += (expiryValue - leg.tradePrice) * leg.quantity;
                } else {
                    pnlTodayPoints += (leg.tradePrice - expiryValue) * Math.abs(leg.quantity);
                }
            }
        });

        return {
            expiry: [{ x: currentSpot, y: pnlAtExpiryPoints * multiplier + realizedPnlOffset }],
            today: [{ x: currentSpot, y: pnlTodayPoints * multiplier + realizedPnlOffset }]
        };
    }, [legs, marketData, multiplier]);

    const chartData = useMemo(() => {
        if (legs.length === 0) return [];

        const [minPrice, maxPrice] = xDomain;
        const steps = 200;
        const stepSize = (maxPrice - minPrice) / steps;

        let realizedPnlOffset = 0;
        legs.forEach((leg: OptionLeg) => {
            const isClosed = leg.closingPrice !== null && leg.closingPrice !== undefined;
            if (isClosed) {
                let pnlPoints = 0;
                if (leg.quantity > 0) {
                    pnlPoints = (leg.closingPrice! - leg.tradePrice) * leg.quantity;
                } else {
                    pnlPoints = (leg.tradePrice - leg.closingPrice!) * Math.abs(leg.quantity);
                }
                const grossPnl = pnlPoints * multiplier;
                const commissions = 4 * Math.abs(leg.quantity);
                realizedPnlOffset += (grossPnl - commissions);
            }
        });

        const data = [];

        for (let i = 0; i <= steps; i++) {
        const currentSpot = minPrice + i * stepSize;
        let pnlAtExpiryPoints = 0;
        let pnlTodayPoints = 0;

        legs.forEach((leg: OptionLeg) => {
            const isClosed = leg.closingPrice !== null && leg.closingPrice !== undefined;
            if (isClosed) return;

            const expiryValue = leg.optionType === 'Call'
                ? Math.max(0, currentSpot - leg.strike)
                : Math.max(0, leg.strike - currentSpot);

            if (leg.quantity > 0) {
                pnlAtExpiryPoints += (expiryValue - leg.tradePrice) * leg.quantity;
            } else {
                pnlAtExpiryPoints += (leg.tradePrice - expiryValue) * Math.abs(leg.quantity);
            }

            const timeToExpiry = getTimeToExpiry(leg.expiryDate);
            if (timeToExpiry > 0) {
                const bs = new BlackScholes(currentSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
                const currentPrice = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();

                if (leg.quantity > 0) {
                    pnlTodayPoints += (currentPrice - leg.tradePrice) * leg.quantity;
                } else {
                    pnlTodayPoints += (leg.tradePrice - currentPrice) * Math.abs(leg.quantity);
                }

            } else {
                if (leg.quantity > 0) {
                    pnlTodayPoints += (expiryValue - leg.tradePrice) * leg.quantity;
                } else {
                    pnlTodayPoints += (leg.tradePrice - expiryValue) * Math.abs(leg.quantity);
                }
            }
        });

        data.push({
            spot: currentSpot,
            pnlAtExpiry: pnlAtExpiryPoints * multiplier + realizedPnlOffset,
            pnlToday: pnlTodayPoints * multiplier + realizedPnlOffset
            });
        }
        return data;
    }, [legs, marketData, xDomain, multiplier]);

    const handleWheel = useCallback((e: any) => {
        e.preventDefault();
        const { deltaY, chartX } = e;
        const [domainMin, domainMax] = xDomain;
        const range = domainMax - domainMin;

        if (!chartX) return;

        const chartWidth = e.view.width;
        const mouseRatio = (chartX - e.chartLayout.left) / e.chartLayout.width;
        const mouseValue = domainMin + range * mouseRatio;

        const zoomFactor = deltaY > 0 ? 1.1 : 0.9;
        const newRange = range * zoomFactor;

        const newDomainMin = mouseValue - newRange * mouseRatio;
        const newDomainMax = mouseValue + newRange * (1 - mouseRatio);

        const newDomain: [number, number] = [newDomainMin, newDomainMax];
        setXDomain(newDomain);

    }, [xDomain]);

    const handleZoom = useCallback((factor: number) => {
        setXDomain(currentDomain => {
            const [min, max] = currentDomain;
            const range = max - min;
            const mid = min + range / 2;
            const newRange = range * factor;
            return [mid - newRange / 2, mid + newRange / 2];
        });
    }, []);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
        return (
            <div
                className="p-2 rounded-md shadow-lg text-sm"
                style={{
                    backgroundColor: colors.tooltipBg,
                    border: `1px solid ${colors.tooltipBorder}`,
                    color: colors.tooltipText,
                }}
            >
            <p className="font-bold">{`Spot DAX: \u20AC${label.toFixed(2)}`}</p>
            {payload.map((pld: any) => (
                <p key={pld.dataKey} style={{color: pld.stroke}}>
                    {pld.name}: &euro;{pld.value.toFixed(2)}
                </p>
            ))}
            </div>
        );
        }
        return null;
    };

  return (
    <div className="relative w-full h-full">
        <div className="absolute top-0 right-0 z-10 flex flex-col items-end pointer-events-auto">
            <button
                onClick={() => setXDomain(initialXDomain)}
                className="bg-secondary hover:bg-muted text-muted-foreground px-2 py-1 text-xs rounded-bl-md border border-border"
                title="Reset Zoom"
            >
                <ResetIcon />
            </button>
            <div className="flex flex-col mt-1 space-y-1">
                 <button
                    onClick={() => handleZoom(0.8)}
                    className="bg-secondary hover:bg-muted text-muted-foreground p-1 rounded-l-md border border-border"
                    title="Zoom In"
                >
                    <ZoomInIcon />
                </button>
                 <button
                    onClick={() => handleZoom(1.2)}
                    className="bg-secondary hover:bg-muted text-muted-foreground p-1 rounded-l-md border border-border"
                    title="Zoom Out"
                >
                    <ZoomOutIcon />
                </button>
            </div>
        </div>
        <ResponsiveContainer width="100%" height="100%">
        <LineChart
            data={chartData}
            margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
        >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis
                dataKey="spot"
                type="number"
                domain={xDomain}
                allowDataOverflow
                tickFormatter={(value) => `\u20AC${Math.round(value)}`}
                stroke={colors.axis}
                fontSize={12}
            />
            <YAxis
                domain={['auto', 'auto']}
                allowDataOverflow
                tickFormatter={(value) => `\u20AC${value}`}
                stroke={colors.axis}
                fontSize={12}
                width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} iconSize={10}/>
            <ReferenceLine y={0} stroke={colors.zeroLine} strokeDasharray="2 2" />
            <ReferenceLine x={marketData.daxSpot} stroke="#f59e0b" strokeDasharray="4 4" />
            {spotMarkerData.expiry.length > 0 && (
                <ReferenceDot
                    x={spotMarkerData.expiry[0].x}
                    y={spotMarkerData.expiry[0].y}
                    isFront={true}
                    shape={(props) => <Diamond {...props} fill="#3b82f6" stroke={isDark ? '#ffffff' : '#1f2937'} strokeWidth={1} />}
                />
            )}
            {spotMarkerData.today.length > 0 && (
                <ReferenceDot
                    x={spotMarkerData.today[0].x}
                    y={spotMarkerData.today[0].y}
                    isFront={true}
                    shape={(props) => <Diamond {...props} fill="#10b981" stroke={isDark ? '#ffffff' : '#1f2937'} strokeWidth={1} />}
                />
            )}
            <Line type="monotone" dataKey="pnlAtExpiry" name="P&amp;L a Scadenza" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pnlToday" name="P&amp;L Oggi (T+N)" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

export default PayoffChart;
