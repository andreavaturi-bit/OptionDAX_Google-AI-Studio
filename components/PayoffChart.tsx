import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { MarketData, OptionLeg } from '../types';
import { BlackScholes, getTimeToExpiry } from '../services/blackScholes';

interface PayoffChartProps {
  legs: OptionLeg[];
  marketData: MarketData;
  multiplier: number;
}

const Diamond = (props: any) => {
    const { cx, cy, fill, stroke, strokeWidth } = props;
    if (cx === undefined || cy === undefined) return null;
    const size = 6; // half-width/height of the diamond
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


const PayoffChart: React.FC<PayoffChartProps> = ({ legs, marketData, multiplier }) => {
    const initialXDomain = useMemo((): [number, number] => {
        if (legs.length === 0) {
            const range = marketData.daxSpot * 0.15;
            return [marketData.daxSpot - range, marketData.daxSpot + range];
        }

        const strikes = legs.map(leg => leg.strike);
        const minStrike = Math.min(...strikes);
        const maxStrike = Math.max(...strikes);
        // FIX: Aumentato il buffer per una migliore visualizzazione iniziale, garantendo che i breakeven siano probabilmente inclusi.
        const strategyWidth = maxStrike - minStrike;
        const buffer = Math.max(strategyWidth * 0.5, marketData.daxSpot * 0.05); 

        return [minStrike - buffer, maxStrike + buffer];
    }, [legs, marketData.daxSpot]);

    const [xDomain, setXDomain] = useState<[number, number]>(initialXDomain);

    useEffect(() => {
        setXDomain(initialXDomain);
    }, [initialXDomain]);

    const spotMarkerData = useMemo(() => {
        if (legs.length === 0) return { expiry: [], today: [] };

        const currentSpot = marketData.daxSpot;
        let pnlAtExpiryPoints = 0;
        let pnlTodayPoints = 0;

        legs.forEach((leg: OptionLeg) => {
            const expiryValue = leg.optionType === 'Call'
                ? Math.max(0, currentSpot - leg.strike)
                : Math.max(0, leg.strike - currentSpot);

            if (leg.quantity > 0) { // Long
                pnlAtExpiryPoints += (expiryValue - leg.tradePrice) * leg.quantity;
            } else { // Short
                pnlAtExpiryPoints += (leg.tradePrice - expiryValue) * Math.abs(leg.quantity);
            }

            const timeToExpiry = getTimeToExpiry(leg.expiryDate);
            if (timeToExpiry > 0) {
                const bs = new BlackScholes(currentSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
                const currentPrice = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
                
                if (leg.quantity > 0) { // Long
                    pnlTodayPoints += (currentPrice - leg.tradePrice) * leg.quantity;
                } else { // Short
                    pnlTodayPoints += (leg.tradePrice - currentPrice) * Math.abs(leg.quantity);
                }
            } else { 
                if (leg.quantity > 0) { // Long
                    pnlTodayPoints += (expiryValue - leg.tradePrice) * leg.quantity;
                } else { // Short
                    pnlTodayPoints += (leg.tradePrice - expiryValue) * Math.abs(leg.quantity);
                }
            }
        });

        return {
            expiry: [{ x: currentSpot, y: pnlAtExpiryPoints * multiplier }],
            today: [{ x: currentSpot, y: pnlTodayPoints * multiplier }]
        };
    }, [legs, marketData, multiplier]);

    const chartData = useMemo(() => {
        if (legs.length === 0) return [];

        const [minPrice, maxPrice] = xDomain; // Usa il dominio zoomabile
        const steps = 200;
        const stepSize = (maxPrice - minPrice) / steps;
        
        const data = [];

        for (let i = 0; i <= steps; i++) {
        const currentSpot = minPrice + i * stepSize;
        let pnlAtExpiryPoints = 0;
        let pnlTodayPoints = 0;

        legs.forEach((leg: OptionLeg) => {
            const expiryValue = leg.optionType === 'Call'
                ? Math.max(0, currentSpot - leg.strike)
                : Math.max(0, leg.strike - currentSpot);

            if (leg.quantity > 0) { // Long
                pnlAtExpiryPoints += (expiryValue - leg.tradePrice) * leg.quantity;
            } else { // Short
                pnlAtExpiryPoints += (leg.tradePrice - expiryValue) * Math.abs(leg.quantity);
            }

            const timeToExpiry = getTimeToExpiry(leg.expiryDate);
            if (timeToExpiry > 0) {
                const bs = new BlackScholes(currentSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
                const currentPrice = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
                
                if (leg.quantity > 0) { // Long
                    pnlTodayPoints += (currentPrice - leg.tradePrice) * leg.quantity;
                } else { // Short
                    pnlTodayPoints += (leg.tradePrice - currentPrice) * Math.abs(leg.quantity);
                }

            } else { 
                if (leg.quantity > 0) { // Long
                    pnlTodayPoints += (expiryValue - leg.tradePrice) * leg.quantity;
                } else { // Short
                    pnlTodayPoints += (leg.tradePrice - expiryValue) * Math.abs(leg.quantity);
                }
            }
        });
        
        data.push({ 
            spot: currentSpot, 
            pnlAtExpiry: pnlAtExpiryPoints * multiplier,
            pnlToday: pnlTodayPoints * multiplier 
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
            <div className="bg-gray-900/80 p-2 border border-gray-600 rounded-md shadow-lg text-sm">
            <p className="font-bold text-gray-200">{`Spot DAX: €${label.toFixed(2)}`}</p>
            {payload.map((pld: any) => (
                <p key={pld.dataKey} style={{color: pld.stroke}}>
                    {pld.name}: €{pld.value.toFixed(2)}
                </p>
            ))}
            </div>
        );
        }
        return null;
    };

  return (
    <div className="relative w-full h-full">
        <div className="absolute top-0 right-0 z-10 flex flex-col items-end">
            <button
                onClick={() => setXDomain(initialXDomain)}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 text-xs rounded-bl-md"
                title="Reset Zoom"
            >
                <ResetIcon />
            </button>
            <div className="flex flex-col mt-1 space-y-1">
                 <button
                    onClick={() => handleZoom(0.8)}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-1 rounded-l-md"
                    title="Zoom In"
                >
                    <ZoomInIcon />
                </button>
                 <button
                    onClick={() => handleZoom(1.2)}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-1 rounded-l-md"
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
            onWheel={handleWheel}
        >
            <CartesianGrid strokeDasharray="3 3" stroke="#444444" />
            <XAxis 
                dataKey="spot" 
                type="number" 
                domain={xDomain}
                allowDataOverflow
                tickFormatter={(value) => `€${Math.round(value)}`}
                stroke="#a0a0a0"
                fontSize={12}
            />
            <YAxis 
                domain={['auto', 'auto']}
                allowDataOverflow
                tickFormatter={(value) => `€${value}`}
                stroke="#a0a0a0"
                fontSize={12}
                width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={36} iconSize={10}/>
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="2 2" />
            <ReferenceLine x={marketData.daxSpot} stroke="#f59e0b" strokeDasharray="4 4" />
            {spotMarkerData.expiry.length > 0 && (
                <ReferenceDot
                    x={spotMarkerData.expiry[0].x}
                    y={spotMarkerData.expiry[0].y}
                    isFront={true}
                    shape={(props) => <Diamond {...props} fill="#3b82f6" stroke="#ffffff" strokeWidth={1} />}
                />
            )}
            {spotMarkerData.today.length > 0 && (
                <ReferenceDot
                    x={spotMarkerData.today[0].x}
                    y={spotMarkerData.today[0].y}
                    isFront={true}
                    shape={(props) => <Diamond {...props} fill="#10b981" stroke="#ffffff" strokeWidth={1} />}
                />
            )}
            <Line type="monotone" dataKey="pnlAtExpiry" name="P&L a Scadenza" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="pnlToday" name="P&L Oggi (T+N)" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="5 5" />
        </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

export default PayoffChart;