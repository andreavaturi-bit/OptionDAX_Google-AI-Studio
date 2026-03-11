
import React, { useState, useEffect, useCallback } from 'react';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    ReferenceLine, Area, ComposedChart, Scatter 
} from 'recharts';
import { ArrowLeftRight, Calculator, RefreshCw, ExternalLink, TrendingUp, Activity, Clock, Percent } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import InputField from './InputField';
import ResultRow from './ResultRow';
import { calculateBlackScholes, calculateImpliedVolatility, Greeks } from '../utils/blackScholes';

// Initialize Gemini API
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const OptionsCalculator: React.FC = () => {
    // State for inputs
    const [optionType, setOptionType] = useState<'Call' | 'Put'>('Call');
    const [spotPrice, setSpotPrice] = useState<number>(24607);
    const [strikePrice, setStrikePrice] = useState<number>(24600);
    const [valuationDate, setValuationDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [expiryDate, setExpiryDate] = useState<string>(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    );
    const [impliedVolatility, setImpliedVolatility] = useState<number>(15.0); // %
    const [optionPrice, setOptionPrice] = useState<number>(0);
    const [riskFreeRate, setRiskFreeRate] = useState<number>(2.0); // %
    const [dividendYield, setDividendYield] = useState<number>(0.0); // %

    // State for results
    const [greeks, setGreeks] = useState<Greeks>({
        delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, price: 0
    });

    // State for chart
    const [selectedMetric, setSelectedMetric] = useState<'delta' | 'gamma' | 'theta' | 'vega'>('delta');
    const [chartData, setChartData] = useState<any[]>([]);

    // State for AI
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiSources, setAiSources] = useState<{ title: string, url: string }[]>([]);

    // Helper to get time to expiry in years
    const getTimeToExpiry = useCallback(() => {
        const start = new Date(valuationDate).getTime();
        const end = new Date(expiryDate).getTime();
        const diffTime = end - start;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return Math.max(0, diffDays / 365.25);
    }, [valuationDate, expiryDate]);

    // Calculation handler
    const calculate = useCallback((
        overrideVol?: number, 
        overridePrice?: number
    ) => {
        const T = getTimeToExpiry();
        const r = riskFreeRate / 100;
        const q = dividendYield / 100;
        const sigma = (overrideVol !== undefined ? overrideVol : impliedVolatility) / 100;

        // If price is overridden, we calculate Volatility
        if (overridePrice !== undefined) {
            const newVol = calculateImpliedVolatility(
                overridePrice, 
                spotPrice, 
                strikePrice, 
                T, 
                r, 
                q, 
                optionType
            );
            setImpliedVolatility(newVol * 100);
            
            // Recalculate Greeks with new Vol
            const newGreeks = calculateBlackScholes(spotPrice, strikePrice, T, r, newVol, q, optionType);
            setGreeks(newGreeks);
            return;
        }

        // Otherwise calculate Price and Greeks from Volatility
        const newGreeks = calculateBlackScholes(spotPrice, strikePrice, T, r, sigma, q, optionType);
        setOptionPrice(newGreeks.price);
        setGreeks(newGreeks);

    }, [spotPrice, strikePrice, getTimeToExpiry, riskFreeRate, dividendYield, optionType, impliedVolatility]);

    // Update chart data
    useEffect(() => {
        const T = getTimeToExpiry();
        const r = riskFreeRate / 100;
        const q = dividendYield / 100;
        const sigma = impliedVolatility / 100;

        if (T <= 0) {
            setChartData([]);
            return;
        }

        const stdDev = spotPrice * sigma * Math.sqrt(T);
        const range = 2.5 * stdDev;
        const startPrice = Math.max(0, strikePrice - range);
        const endPrice = strikePrice + range;
        const steps = 50;
        const stepSize = (endPrice - startPrice) / steps;

        const data = [];
        for (let i = 0; i <= steps; i++) {
            const s = startPrice + i * stepSize;
            const g = calculateBlackScholes(s, strikePrice, T, r, sigma, q, optionType);
            data.push({
                spot: s,
                value: g[selectedMetric],
                currentSpot: Math.abs(s - spotPrice) < stepSize / 2 ? g[selectedMetric] : null // Mark current spot
            });
        }
        setChartData(data);

    }, [spotPrice, strikePrice, getTimeToExpiry, riskFreeRate, dividendYield, optionType, impliedVolatility, selectedMetric]);

    // Initial calculation and update on dependency change (except price/vol circular dependency)
    useEffect(() => {
        calculate();
    }, [spotPrice, strikePrice, getTimeToExpiry, riskFreeRate, dividendYield, optionType]);

    // Handlers
    const handleVolChange = (val: string) => {
        const v = parseFloat(val);
        setImpliedVolatility(v);
        calculate(v, undefined);
    };

    const handlePriceChange = (val: string) => {
        const p = parseFloat(val);
        setOptionPrice(p);
        calculate(undefined, p);
    };

    const fetchEuribor = async () => {
        setIsAiLoading(true);
        setAiSources([]);
        try {
            const prompt = `
            Find the latest 12-month Euribor rate. 
            Return a JSON object with:
            - "rate": number (percentage, e.g. 2.5)
            - "sources": array of objects with "title" and "url"
            `;

            const result = await genAI.models.generateContent({
                model: "gemini-3.1-pro-preview",
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                config: {
                    tools: [{ googleSearch: {} }]
                }
            });
            
            const text = result.text;
            
            if (!text) throw new Error("No response text");

            // Extract JSON from text
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const data = JSON.parse(jsonMatch[0]);
                    if (data.rate && !isNaN(parseFloat(data.rate))) {
                        setRiskFreeRate(parseFloat(data.rate));
                    }
                    if (data.sources && Array.isArray(data.sources)) {
                        setAiSources(data.sources);
                    }
                } catch (e) {
                    console.error("Failed to parse JSON from AI response", e);
                }
            }
            
            // Also check grounding metadata if available
            if (result.candidates?.[0]?.groundingMetadata?.groundingChunks) {
                 const chunks = result.candidates[0].groundingMetadata.groundingChunks;
                 const newSources = chunks
                    .filter((c: any) => c.web?.uri && c.web?.title)
                    .map((c: any) => ({ title: c.web.title, url: c.web.uri }));
                 
                 if (newSources.length > 0) {
                     setAiSources(prev => {
                         const existingUrls = new Set(prev.map(s => s.url));
                         const uniqueNew = newSources.filter((s: any) => !existingUrls.has(s.url));
                         return [...prev, ...uniqueNew];
                     });
                 }
            }

        } catch (error) {
            console.error("Error fetching Euribor:", error);
            alert("Errore durante il recupero del tasso Euribor.");
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-full bg-slate-100 dark:bg-gray-900 overflow-hidden">
            {/* Sidebar / Input Panel */}
            <div className="w-full lg:w-80 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 overflow-y-auto p-4 shadow-lg z-10">
                <div className="mb-6">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Parametri</h2>
                    
                    {/* Option Type */}
                    <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-gray-600 mb-4 h-10">
                        <button 
                            onClick={() => setOptionType('Call')}
                            className={`flex-1 font-bold text-sm transition-colors ${optionType === 'Call' ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-gray-700 text-slate-500'}`}
                        >
                            CALL
                        </button>
                        <button 
                            onClick={() => setOptionType('Put')}
                            className={`flex-1 font-bold text-sm transition-colors ${optionType === 'Put' ? 'bg-orange-500 text-white' : 'bg-slate-50 dark:bg-gray-700 text-slate-500'}`}
                        >
                            PUT
                        </button>
                    </div>

                    <div className="space-y-4">
                        <InputField 
                            label="Prezzo Sottostante (DAX)" 
                            value={spotPrice} 
                            onChange={v => setSpotPrice(parseFloat(v) || 0)} 
                            type="number"
                        />
                        <InputField 
                            label="Strike Price" 
                            value={strikePrice} 
                            onChange={v => setStrikePrice(parseFloat(v) || 0)} 
                            type="number"
                        />
                        <InputField 
                            label="Data Valutazione" 
                            value={valuationDate} 
                            onChange={setValuationDate} 
                            type="date"
                        />
                        <InputField 
                            label="Data Scadenza" 
                            value={expiryDate} 
                            onChange={setExpiryDate} 
                            type="date"
                        />

                        {/* Bidirectional Vol/Price */}
                        <div className="relative p-3 bg-slate-50 dark:bg-gray-700/30 rounded-xl border border-slate-200 dark:border-gray-600">
                            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 p-1 rounded-full border border-slate-200 dark:border-gray-600 z-10">
                                <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="space-y-4">
                                <InputField 
                                    label="Volatilità Implicita (σ)" 
                                    value={impliedVolatility} 
                                    onChange={handleVolChange} 
                                    type="number"
                                    suffix="%"
                                    step="0.1"
                                />
                                <InputField 
                                    label="Prezzo Opzione" 
                                    value={optionPrice} 
                                    onChange={handlePriceChange} 
                                    type="number"
                                    suffix="€"
                                    step="0.1"
                                />
                            </div>
                        </div>

                        {/* Risk Free Rate with AI */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Tasso Risk-Free
                                </label>
                                <button 
                                    onClick={fetchEuribor}
                                    disabled={isAiLoading}
                                    className="text-[10px] flex items-center text-blue-500 hover:text-blue-600 disabled:opacity-50"
                                >
                                    {isAiLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Calculator className="w-3 h-3 mr-1" />}
                                    AI Update
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={riskFreeRate}
                                    onChange={(e) => setRiskFreeRate(parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    step="0.01"
                                />
                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                    <span className="text-slate-400 text-xs">%</span>
                                </div>
                            </div>
                            {aiSources.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {aiSources.slice(0, 2).map((source, i) => (
                                        <a 
                                            key={i} 
                                            href={source.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 truncate max-w-full"
                                        >
                                            <ExternalLink className="w-2 h-2 mr-1 flex-shrink-0" />
                                            <span className="truncate max-w-[150px]">{source.title}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        <InputField 
                            label="Dividend Yield" 
                            value={dividendYield} 
                            onChange={v => setDividendYield(parseFloat(v) || 0)} 
                            type="number"
                            suffix="%"
                            step="0.1"
                        />
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8">
                <div className="max-w-5xl mx-auto space-y-6">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Analisi Prezzo</h1>
                            <p className="text-slate-500 text-sm">Modello Black-Scholes</p>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Prezzo Teorico</span>
                            <div className={`text-3xl font-mono font-bold ${optionType === 'Call' ? 'text-blue-600' : 'text-orange-600'}`}>
                                €{greeks.price.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    {/* Greeks Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <ResultRow label="Delta (Δ)" value={greeks.delta} description="Sensibilità al prezzo del sottostante" />
                        <ResultRow label="Gamma (Γ)" value={greeks.gamma} description="Sensibilità del Delta (x100)" />
                        <ResultRow label="Theta (Θ)" value={greeks.theta} description="Decadimento temporale giornaliero" />
                        <ResultRow label="Vega (ν)" value={greeks.vega} description="Sensibilità alla volatilità (1%)" />
                        <ResultRow label="Rho (ρ)" value={greeks.rho} description="Sensibilità al tasso di interesse (1%)" />
                    </div>

                    {/* Chart Section */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                                <TrendingUp className="w-5 h-5 mr-2 text-blue-500" />
                                Profilo di Sensibilità
                            </h3>
                            <div className="flex bg-slate-100 dark:bg-gray-700 rounded-lg p-1">
                                {[
                                    { id: 'delta', label: 'Delta', icon: Activity },
                                    { id: 'gamma', label: 'Gamma', icon: TrendingUp },
                                    { id: 'theta', label: 'Theta', icon: Clock },
                                    { id: 'vega', label: 'Vega', icon: Percent },
                                ].map((m) => (
                                    <button
                                        key={m.id}
                                        onClick={() => setSelectedMetric(m.id as any)}
                                        className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center transition-all ${selectedMetric === m.id ? 'bg-white dark:bg-gray-600 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900'}`}
                                    >
                                        <m.icon className="w-3 h-3 mr-1.5" />
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={optionType === 'Call' ? '#2563eb' : '#f97316'} stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor={optionType === 'Call' ? '#2563eb' : '#f97316'} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis 
                                        dataKey="spot" 
                                        type="number" 
                                        domain={['auto', 'auto']}
                                        tickFormatter={(val) => val.toFixed(0)}
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis 
                                        stroke="#94a3b8"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(val) => val.toFixed(3)}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
                                        itemStyle={{ color: '#fff' }}
                                        formatter={(value: number) => [value.toFixed(4), selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)]}
                                        labelFormatter={(label) => `Spot: ${Number(label).toFixed(0)}`}
                                    />
                                    <ReferenceLine x={strikePrice} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: 'Strike', position: 'insideTopRight', fill: '#94a3b8', fontSize: 10 }} />
                                    <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke={optionType === 'Call' ? '#2563eb' : '#f97316'} 
                                        fillOpacity={1} 
                                        fill="url(#colorValue)" 
                                        strokeWidth={2}
                                    />
                                    <Scatter dataKey="currentSpot" fill="#fbbf24" stroke="#fff" strokeWidth={2} r={6} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OptionsCalculator;
