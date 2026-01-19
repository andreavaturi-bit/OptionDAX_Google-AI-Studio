
import React, { useState, useEffect, useMemo } from 'react';
import { OptionLeg, MarketData, Structure, CalculatedGreeks } from '../types';
import { BlackScholes, getTimeToExpiry, calculateImpliedVolatility } from '../services/blackScholes';
import usePortfolioStore from '../store/portfolioStore';
import useSettingsStore from '../store/settingsStore';
import PayoffChart from './PayoffChart';
import { PlusIcon, TrashIcon, CalculatorIcon, CloudDownloadIcon } from './icons';
import ExpiryDateSelector, { findThirdFridayOfMonth } from './ExpiryDateSelector';
import QuantitySelector from './QuantitySelector';
import StrikeSelector from './StrikeSelector';

const CheckCircleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
)

const ReopenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
);


interface StructureDetailViewProps {
    structureId: number | 'new' | null;
}

const StructureDetailView: React.FC<StructureDetailViewProps> = ({ structureId }) => {
    const { structures, marketData, setMarketData, addStructure, updateStructure, deleteStructure, closeStructure, reopenStructure, setCurrentView, refreshDaxSpot, isLoadingSpot } = usePortfolioStore();
    const { settings } = useSettingsStore();
    const [localStructure, setLocalStructure] = useState<Omit<Structure, 'id' | 'status'> | Structure | null>(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [localInputValues, setLocalInputValues] = useState<Record<string, string>>({});


    useEffect(() => {
        if (structureId === 'new') {
            setLocalStructure({
                tag: '',
                legs: [],
                multiplier: settings.defaultMultiplier,
            });
            setIsReadOnly(false);
        } else {
            const structure = structures.find(s => s.id === structureId);
            setLocalStructure(structure || null);
            setIsReadOnly(structure?.status === 'Closed');
        }
        setLocalInputValues({}); // Reset local string inputs on structure change
    }, [structureId, structures, settings.defaultMultiplier]);
    
    const handleLegChange = (id: number, field: keyof Omit<OptionLeg, 'id'>, value: string | number | null) => {
        if (!localStructure || isReadOnly) return;
        
        let updatedLegs = localStructure.legs.map(leg => {
            if (leg.id === id) {
                 let newLeg = { ...leg, [field]: value };
                
                // Auto-set closingDate when closingPrice is entered
                if (field === 'closingPrice') {
                    const hasClosingPrice = newLeg.closingPrice !== null && newLeg.closingPrice !== undefined && value !== null && value !== '';
                    if (hasClosingPrice && !newLeg.closingDate) {
                        newLeg.closingDate = new Date().toISOString().split('T')[0];
                    } else if (!hasClosingPrice) {
                        newLeg.closingDate = null;
                    }
                }

                return newLeg;
            }
            return leg;
        });

        setLocalStructure({ ...localStructure, legs: updatedLegs });
    };

    // FIX: Changed 'field' type from 'keyof OptionLeg' to 'keyof Omit<OptionLeg, 'id'>' to prevent passing 'id' to handleLegChange.
    const handleNumericInputChange = (id: number, field: keyof Omit<OptionLeg, 'id'>, value: string) => {
        const key = `${id}-${String(field)}`;
        const sanitizedValue = value.replace(',', '.');

        if (/^-?\d*\.?\d*$/.test(sanitizedValue) || sanitizedValue === '') {
            setLocalInputValues(prev => ({ ...prev, [key]: sanitizedValue }));
            
            const parsed = parseFloat(sanitizedValue);
            if (!isNaN(parsed) && isFinite(parsed)) {
                handleLegChange(id, field, parsed);
            } else if (sanitizedValue === '') {
                 handleLegChange(id, field, null);
            }
        }
    };

    // FIX: Changed 'field' type from 'keyof OptionLeg' to 'keyof Omit<OptionLeg, 'id'>' to prevent passing 'id' to handleLegChange.
    const handleNumericInputBlur = (id: number, field: keyof Omit<OptionLeg, 'id'>) => {
        const key = `${id}-${String(field)}`;
        const localValue = localInputValues[key];

        if (localValue !== undefined) {
             const sanitizedValue = localValue.replace(',', '.');
             const parsed = parseFloat(sanitizedValue);
             const finalValue = !isNaN(parsed) && isFinite(parsed) ? parsed : null;

             handleLegChange(id, field, finalValue);
             
             // Auto-Calculate Implied Volatility if Trade Price changes
             if (field === 'tradePrice' && finalValue !== null && localStructure && !isReadOnly) {
                 const leg = localStructure.legs.find(l => l.id === id);
                 if (leg) {
                     const timeToExpiry = getTimeToExpiry(leg.expiryDate);
                     if (timeToExpiry > 0) {
                         const calculatedIV = calculateImpliedVolatility(
                             finalValue,
                             marketData.daxSpot,
                             leg.strike,
                             timeToExpiry,
                             marketData.riskFreeRate,
                             leg.optionType
                         );
                         if (calculatedIV !== null && !isNaN(calculatedIV)) {
                             // Update the leg with the new IV
                             handleLegChange(id, 'impliedVolatility', parseFloat(calculatedIV.toFixed(2)));
                         }
                     }
                 }
             }

             setLocalInputValues(prev => {
                const newValues = { ...prev };
                delete newValues[key];
                return newValues;
            });
        }
    };


    const addLeg = () => {
        if (!localStructure || isReadOnly) return;
        const newId = localStructure.legs.length > 0 ? Math.max(...localStructure.legs.map(l => l.id)) + 1 : 1;
        
        // Calcola la scadenza predefinita: 3° venerdì del mese successivo
        const nextMonthDate = new Date();
        nextMonthDate.setDate(1); // Evita problemi con le date di fine mese
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const defaultExpiryDate = findThirdFridayOfMonth(nextMonthDate.getFullYear(), nextMonthDate.getMonth());
        const defaultExpiryString = defaultExpiryDate.toISOString().split('T')[0];

        const newLeg: OptionLeg = {
            id: newId,
            optionType: 'Call',
            strike: Math.round(marketData.daxSpot / 100) * 100,
            expiryDate: defaultExpiryString,
            openingDate: new Date().toISOString().split('T')[0],
            quantity: 1,
            tradePrice: 100,
            closingPrice: null,
            closingDate: null,
            impliedVolatility: 15,
            openingCommission: settings.defaultOpeningCommission,
            closingCommission: settings.defaultClosingCommission,
        };
        setLocalStructure({ ...localStructure, legs: [...localStructure.legs, newLeg] });
    };
    
    const removeLeg = (id: number) => {
        if (!localStructure || isReadOnly) return;
        const updatedLegs = localStructure.legs.filter(leg => leg.id !== id);
        setLocalStructure({ ...localStructure, legs: updatedLegs });
    };

    const handleSave = () => {
        if (!localStructure || isReadOnly) return;
        if ('id' in localStructure) {
            updateStructure(localStructure as Structure);
        } else {
            addStructure(localStructure);
        }
        setCurrentView('list');
    };
    
    const handleClose = () => {
        if (!localStructure || !('id' in localStructure) || isReadOnly) return;
        closeStructure(localStructure.id);
        setCurrentView('list');
    };

    const handleDelete = () => {
        if (!localStructure || !('id' in localStructure)) return;
        if (window.confirm(`Sei sicuro di voler eliminare permanentemente la struttura "${localStructure.tag}"? Questa azione è irreversibile.`)) {
            deleteStructure(localStructure.id);
            setCurrentView('list');
        }
    };
    
    const handleReopen = () => {
        if (!localStructure || !('id' in localStructure)) return;
        reopenStructure(localStructure.id);
    };

    const calculatedGreeks = useMemo<{ legGreeks: (CalculatedGreeks & {id: number})[], totalGreeks: CalculatedGreeks }>(() => {
        const initialGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };
        if (!localStructure) return { legGreeks: [], totalGreeks: initialGreeks };

        const openLegs = localStructure.legs.filter(leg => leg.closingPrice === null || leg.closingPrice === undefined);

        const legGreeks = openLegs.map(leg => {
            const timeToExpiry = getTimeToExpiry(leg.expiryDate);
            const bs = new BlackScholes(marketData.daxSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
            const greeks = leg.optionType === 'Call' ? bs.callGreeks() : bs.putGreeks();
            
            // FIX: Greeks are calculated purely in points here. Monetization is handled in the render.
            return {
                id: leg.id,
                delta: greeks.delta * leg.quantity,
                gamma: greeks.gamma * leg.quantity,
                theta: greeks.theta * leg.quantity,
                vega: greeks.vega * leg.quantity
            };
        });

        const totalGreeks = legGreeks.reduce((acc, greeks) => {
            acc.delta += greeks.delta;
            acc.gamma += greeks.gamma;
            acc.theta += greeks.theta;
            acc.vega += greeks.vega;
            return acc;
        }, { ...initialGreeks });

        return { legGreeks, totalGreeks };
    }, [localStructure, marketData]);

    const calculatedPnl = useMemo(() => {
        if (!localStructure) return { legPnl: [], totalRealizedNet: 0, totalUnrealizedNet: 0, grandTotalNet: 0, totalRealizedGross: 0, totalUnrealizedGross: 0, grandTotalGross: 0, totalRealizedCommission: 0, totalUnrealizedCommission: 0, grandTotalCommission: 0 };

        let totalRealizedGross = 0;
        let totalRealizedCommission = 0;
        let totalRealizedNet = 0;
        let totalUnrealizedGross = 0;
        let totalUnrealizedCommission = 0;
        let totalUnrealizedNet = 0;


        const legPnl = localStructure.legs.map(leg => {
            const isClosed = leg.closingPrice !== null && leg.closingPrice !== undefined;
            let pnlPoints = 0;
            let currentPriceForLeg: number | null = null;
            
            if (isClosed) {
                // Calculation for a closed leg based on trade and closing prices.
                if (leg.quantity > 0) { // Long position
                    pnlPoints = (leg.closingPrice! - leg.tradePrice) * leg.quantity;
                } else { // Short position
                    pnlPoints = (leg.tradePrice - leg.closingPrice!) * Math.abs(leg.quantity);
                }
            } else { // Calculation for an open leg based on current market price.
                const timeToExpiry = getTimeToExpiry(leg.expiryDate);
                let currentPrice = 0;
                if (timeToExpiry > 0) {
                     const bs = new BlackScholes(marketData.daxSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
                     currentPrice = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
                } else { // If expired, value is intrinsic value.
                     currentPrice = leg.optionType === 'Call' ? Math.max(0, marketData.daxSpot - leg.strike) : Math.max(0, leg.strike - marketData.daxSpot);
                }
                currentPriceForLeg = currentPrice;
                
                if (leg.quantity > 0) { // Long position
                    pnlPoints = (currentPrice - leg.tradePrice) * leg.quantity;
                } else { // Short position
                    pnlPoints = (leg.tradePrice - currentPrice) * Math.abs(leg.quantity);
                }
            }
            
            const grossPnlEuro = pnlPoints * localStructure.multiplier;
            const openingCommissionCost = (leg.openingCommission ?? settings.defaultOpeningCommission) * Math.abs(leg.quantity);
            const closingCommissionCost = (leg.closingCommission ?? settings.defaultClosingCommission) * Math.abs(leg.quantity);
            
            // Full commission cost is accounted for both realized and unrealized P&L for a more accurate net equity view.
            const commissionCost = openingCommissionCost + closingCommissionCost;
            const netPnlEuro = grossPnlEuro - commissionCost;

            if (isClosed) {
                totalRealizedGross += grossPnlEuro;
                totalRealizedCommission += commissionCost;
                totalRealizedNet += netPnlEuro;
            } else {
                totalUnrealizedGross += grossPnlEuro;
                totalUnrealizedCommission += commissionCost;
                totalUnrealizedNet += netPnlEuro;
            }
            
            return {
                id: leg.id,
                pnlPoints,
                grossPnlEuro,
                commissionCost,
                netPnlEuro,
                isClosed,
                currentPrice: currentPriceForLeg
            };
        });
        
        const grandTotalGross = totalRealizedGross + totalUnrealizedGross;
        const grandTotalCommission = totalRealizedCommission + totalUnrealizedCommission;
        const grandTotalNet = totalRealizedNet + totalUnrealizedNet;

        return { legPnl, totalRealizedNet, totalUnrealizedNet, grandTotalNet, totalRealizedGross, totalUnrealizedGross, grandTotalGross, totalRealizedCommission, totalUnrealizedCommission, grandTotalCommission };

    }, [localStructure, marketData, settings]);

    const handleSpotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMarketData({ daxSpot: value === '' ? 0 : parseFloat(value) });
    };

    const handleSpotStep = (amount: number) => {
        setMarketData({ daxSpot: parseFloat((marketData.daxSpot + amount).toFixed(2)) });
    };

    if (!localStructure) return <div className="text-center text-gray-400">Caricamento struttura...</div>;

    const disabledClass = "disabled:opacity-50 disabled:cursor-not-allowed";
    
    const calculateTheoreticalPrice = (leg: OptionLeg): number => {
        const timeToExpiry = getTimeToExpiry(leg.expiryDate);
        if (timeToExpiry <= 0) {
            return leg.optionType === 'Call' 
                ? Math.max(0, marketData.daxSpot - leg.strike) 
                : Math.max(0, leg.strike - marketData.daxSpot);
        }
        const bs = new BlackScholes(marketData.daxSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
        return leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <button onClick={() => setCurrentView('list')} className="text-accent hover:underline">
                    &larr; Torna alla Lista
                </button>
                 <div className="flex items-center space-x-2">
                    <div className="text-sm font-medium text-gray-400 flex items-center">
                        <span className="relative flex h-2 w-2 mr-2">
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Spot DAX:
                    </div>
                    <div className="flex items-center bg-gray-700 border border-gray-600 rounded-md text-sm">
                        <button onClick={() => handleSpotStep(-10)} className="px-2 py-1 text-gray-300 hover:bg-gray-600 rounded-l-md font-mono">-10</button>
                        <button onClick={() => handleSpotStep(-1)} className="px-2 py-1 text-gray-300 hover:bg-gray-600 border-l border-r border-gray-600 font-mono">-1</button>
                        <input
                            type="number"
                            value={marketData.daxSpot}
                            onChange={handleSpotChange}
                            className="bg-transparent w-24 text-center text-white font-mono focus:outline-none"
                            step="0.01"
                        />
                        <button onClick={() => handleSpotStep(1)} className="px-2 py-1 text-gray-300 hover:bg-gray-600 border-l border-r border-gray-600 font-mono">+1</button>
                        <button onClick={() => handleSpotStep(10)} className="px-2 py-1 text-gray-300 hover:bg-gray-600 border-r border-gray-600 font-mono">+10</button>
                        <button 
                            onClick={refreshDaxSpot} 
                            disabled={isLoadingSpot}
                            className="px-2 py-1 text-accent hover:text-white hover:bg-gray-600 rounded-r-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Aggiorna Prezzo Live (Yahoo Finance)"
                        >
                            <div className={isLoadingSpot ? "animate-spin" : ""}>
                                <CloudDownloadIcon />
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-1 bg-gray-800 rounded-lg p-4 flex flex-col space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="structure-tag" className="text-sm font-medium text-gray-400">Tag Struttura</label>
                            <input
                                id="structure-tag"
                                type="text"
                                value={localStructure.tag}
                                onChange={(e) => setLocalStructure({...localStructure, tag: e.target.value})}
                                className={`mt-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 w-full text-white font-bold text-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none ${disabledClass}`}
                                disabled={isReadOnly}
                            />
                        </div>
                        <div>
                            <label htmlFor="structure-multiplier" className="text-sm font-medium text-gray-400">Moltiplicatore</label>
                            <select
                                id="structure-multiplier"
                                value={localStructure.multiplier}
                                onChange={(e) => setLocalStructure({...localStructure, multiplier: parseInt(e.target.value) as 1 | 5 | 25})}
                                className={`mt-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 w-full text-white font-bold text-lg focus:ring-2 focus:ring-accent focus:border-accent outline-none ${disabledClass}`}
                                disabled={isReadOnly}
                            >
                                <option value="5">Indice (5€/punto)</option>
                                <option value="1">CFD (1€/punto)</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex-grow overflow-y-auto pr-2 space-y-3 max-h-[55vh]">
                        {localStructure.legs.map((leg, index) => {
                             const theoreticalPrice = calculateTheoreticalPrice(leg);
                             const tradePriceKey = `${leg.id}-tradePrice`;
                             const closingPriceKey = `${leg.id}-closingPrice`;
                             const ivKey = `${leg.id}-impliedVolatility`;
                             const openCommKey = `${leg.id}-openingCommission`;
                             const closeCommKey = `${leg.id}-closingCommission`;
                             
                             const intrinsicValue = leg.optionType === 'Call' 
                                ? Math.max(0, marketData.daxSpot - leg.strike) 
                                : Math.max(0, leg.strike - marketData.daxSpot);
                             const extrinsicValue = (leg.tradePrice ?? 0) - intrinsicValue;

                             return (
                             <div key={leg.id} className={`bg-gray-700 p-3 rounded-md space-y-2 ${isReadOnly ? 'opacity-60' : ''}`}>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-white">Gamba {index + 1}</span>
                                    {!isReadOnly && (
                                        <button onClick={() => removeLeg(leg.id)} className="text-gray-400 hover:text-loss p-1 rounded-full">
                                            <TrashIcon />
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                     <div className="flex rounded-md overflow-hidden h-full">
                                        <button
                                            type="button"
                                            onClick={() => handleLegChange(leg.id, 'optionType', 'Call')}
                                            className={`w-1/2 py-1 text-sm font-semibold transition ${leg.optionType === 'Call' ? 'bg-accent text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'} ${disabledClass}`}
                                            disabled={isReadOnly}
                                        >
                                            Call
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleLegChange(leg.id, 'optionType', 'Put')}
                                            className={`w-1/2 py-1 text-sm font-semibold transition ${leg.optionType === 'Put' ? 'bg-warning text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'} ${disabledClass}`}
                                            disabled={isReadOnly}
                                        >
                                            Put
                                        </button>
                                    </div>
                                    <QuantitySelector
                                        value={leg.quantity}
                                        onChange={newValue => handleLegChange(leg.id, 'quantity', newValue)}
                                        disabled={isReadOnly}
                                        className={`bg-gray-600 rounded p-1 text-sm w-full ${disabledClass}`}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                     <StrikeSelector
                                        value={leg.strike}
                                        onChange={newValue => handleLegChange(leg.id, 'strike', newValue)}
                                        spotPrice={marketData.daxSpot}
                                        optionType={leg.optionType}
                                        disabled={isReadOnly}
                                        className={`bg-gray-600 rounded p-1 text-sm w-full ${disabledClass}`}
                                    />
                                    <ExpiryDateSelector
                                        value={leg.expiryDate}
                                        onChange={newValue => handleLegChange(leg.id, 'expiryDate', newValue)}
                                        disabled={isReadOnly}
                                        className={`bg-gray-600 rounded p-1 text-sm w-full ${disabledClass}`}
                                    />
                                </div>
                                 <div className="grid grid-cols-2 gap-2">
                                    <input type="date" placeholder="Data Ap." value={leg.openingDate} onChange={e => handleLegChange(leg.id, 'openingDate', e.target.value)} className={`bg-gray-600 rounded p-1 text-sm w-full text-gray-300 ${disabledClass}`} title="Data di Apertura" disabled={isReadOnly} />
                                    <input type="date" placeholder="Data Ch." value={leg.closingDate ?? ''} onChange={e => handleLegChange(leg.id, 'closingDate', e.target.value)} className={`bg-gray-600 rounded p-1 text-sm w-full text-gray-300 ${disabledClass}`} title="Data di Chiusura" disabled={isReadOnly || !leg.closingPrice} />
                                </div>
                                <div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="text" placeholder="Prezzo Ap." value={tradePriceKey in localInputValues ? localInputValues[tradePriceKey] : (leg.tradePrice ?? '')} onChange={e => handleNumericInputChange(leg.id, 'tradePrice', e.target.value)} onBlur={() => handleNumericInputBlur(leg.id, 'tradePrice')} className={`bg-gray-600 rounded p-1 text-sm w-full ${disabledClass}`} title="Prezzo di Apertura" disabled={isReadOnly}/>
                                        <input type="text" placeholder="Prezzo Ch." value={closingPriceKey in localInputValues ? localInputValues[closingPriceKey] : (leg.closingPrice ?? '')} onChange={e => handleNumericInputChange(leg.id, 'closingPrice', e.target.value)} onBlur={() => handleNumericInputBlur(leg.id, 'closingPrice')} className={`bg-gray-600 rounded p-1 text-sm w-full ${disabledClass}`} title="Prezzo di Chiusura (lasciare vuoto se aperta)" disabled={isReadOnly}/>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1 flex items-center justify-between">
                                        <div>
                                            {leg.tradePrice && leg.tradePrice > 0 && (
                                                <span title="Ripartizione del premio di apertura (Prezzo Ap.) in base allo spot attuale">
                                                    Intr: <span className="font-mono">{intrinsicValue.toFixed(2)}</span> / Estr: <span className="font-mono">{extrinsicValue.toFixed(2)}</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center">
                                            <span>Teorico: ~{theoreticalPrice.toFixed(2)}</span>
                                            <button 
                                                onClick={() => handleLegChange(leg.id, 'tradePrice', parseFloat(theoreticalPrice.toFixed(2)))}
                                                disabled={isReadOnly}
                                                className={`ml-2 text-gray-400 hover:text-accent ${disabledClass}`} 
                                                title="Usa prezzo teorico"
                                            >
                                                <CalculatorIcon />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-400" htmlFor={`vi-slider-${leg.id}`}>Volatilità Implicita (%)</label>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <input
                                            type="text"
                                            id={`vi-input-${leg.id}`}
                                            value={ivKey in localInputValues ? localInputValues[ivKey] : (leg.impliedVolatility ?? '')}
                                            onChange={e => handleNumericInputChange(leg.id, 'impliedVolatility', e.target.value)}
                                            onBlur={() => handleNumericInputBlur(leg.id, 'impliedVolatility')}
                                            className={`bg-gray-600 border-gray-500 rounded p-1 text-sm w-20 text-center ${disabledClass}`}
                                            disabled={isReadOnly}
                                        />
                                        <input
                                            type="range"
                                            id={`vi-slider-${leg.id}`}
                                            min="5"
                                            max="60"
                                            step="0.1"
                                            value={leg.impliedVolatility}
                                            onChange={e => handleLegChange(leg.id, 'impliedVolatility', parseFloat(e.target.value))}
                                            className={`w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-accent ${disabledClass}`}
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Comm. Ap." value={openCommKey in localInputValues ? localInputValues[openCommKey] : (leg.openingCommission ?? '')} onChange={e => handleNumericInputChange(leg.id, 'openingCommission', e.target.value)} onBlur={() => handleNumericInputBlur(leg.id, 'openingCommission')} className={`bg-gray-600 rounded p-1 text-sm w-full ${disabledClass}`} title="Commissione di Apertura (per contratto)" disabled={isReadOnly}/>
                                    <input type="text" placeholder="Comm. Ch." value={closeCommKey in localInputValues ? localInputValues[closeCommKey] : (leg.closingCommission ?? '')} onChange={e => handleNumericInputChange(leg.id, 'closingCommission', e.target.value)} onBlur={() => handleNumericInputBlur(leg.id, 'closingCommission')} className={`bg-gray-600 rounded p-1 text-sm w-full ${disabledClass}`} title="Commissione di Chiusura (per contratto)" disabled={isReadOnly}/>
                                </div>
                            </div>
                            )
                        })}
                    </div>
                     {isReadOnly ? (
                         <div className="text-center p-4 bg-gray-700 rounded-md space-y-3">
                            <p className="font-bold text-white">Struttura Chiusa</p>
                            <p className="text-sm text-gray-400">Questa struttura non può essere modificata. Riaprila per apportare modifiche.</p>
                            <button
                                onClick={handleReopen}
                                className="w-full bg-accent/80 hover:bg-accent text-white font-bold py-2 rounded-md transition flex items-center justify-center space-x-2"
                            >
                                <ReopenIcon />
                                <span>Riapri per Modificare</span>
                            </button>
                         </div>
                     ) : (
                        <div className='space-y-2'>
                            <button onClick={addLeg} className="w-full flex items-center justify-center space-x-2 bg-accent/80 hover:bg-accent text-white font-semibold py-2 rounded-md transition">
                                <PlusIcon />
                                <span>Aggiungi Gamba</span>
                            </button>
                            <button onClick={handleSave} className="w-full bg-profit/80 hover:bg-profit text-white font-bold py-2 rounded-md transition">
                                Salva Modifiche
                            </button>
                             <div className="flex space-x-2">
                                <button onClick={handleClose} disabled={!('id' in localStructure)} className={`w-full bg-warning/80 hover:bg-warning text-white font-bold py-2 rounded-md transition flex items-center justify-center ${disabledClass}`}>
                                    <CheckCircleIcon />
                                    Chiudi Struttura
                                </button>
                                <button onClick={handleDelete} disabled={!('id' in localStructure)} className={`w-full bg-loss/80 hover:bg-loss text-white font-bold py-2 rounded-md transition flex items-center justify-center ${disabledClass}`}>
                                    <TrashIcon />
                                    Elimina
                                </button>
                            </div>
                        </div>
                     )}
                </div>
                <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4 flex flex-col space-y-4">
                    <div className="flex-grow h-[500px]">
                        <PayoffChart legs={localStructure.legs} marketData={marketData} multiplier={localStructure.multiplier} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="overflow-x-auto">
                            <h3 className="text-lg font-bold mb-2">Analisi P&L</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                                    <tr>
                                        <th className="px-2 py-2">Gamba</th>
                                        <th className="px-2 py-2 text-right">P&L Punti</th>
                                        <th className="px-2 py-2 text-right">P&L Lordo</th>
                                        <th className="px-2 py-2 text-right">Comm.</th>
                                        <th className="px-2 py-2 text-right">P&L Netto</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono">
                                    {calculatedPnl.legPnl.map((pnl, index) => {
                                        const netPnlClass = pnl.netPnlEuro >= 0 ? 'text-profit' : 'text-loss';
                                        const grossPnlClass = pnl.grossPnlEuro >= 0 ? 'text-profit' : 'text-loss';
                                        return (
                                            <tr key={pnl.id} className={`border-b border-gray-700 hover:bg-gray-700/50 ${pnl.isClosed ? 'opacity-60' : ''}`}>
                                                <td className="px-2 py-1 font-sans font-medium text-white">#{index + 1} {pnl.isClosed ? '(Chiusa)' : ''}</td>
                                                <td className={`px-2 py-1 text-right ${pnl.pnlPoints >= 0 ? 'text-profit' : 'text-loss'}`}>{pnl.pnlPoints.toFixed(2)}</td>
                                                <td className={`px-2 py-1 text-right ${grossPnlClass}`}>€{pnl.grossPnlEuro.toFixed(2)}</td>
                                                <td className="px-2 py-1 text-right text-warning">-€{pnl.commissionCost.toFixed(2)}</td>
                                                <td className={`px-2 py-1 text-right font-bold ${netPnlClass}`}>€{pnl.netPnlEuro.toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="font-mono font-bold text-white">
                                    <tr className="bg-gray-700/50">
                                        <td className="px-2 py-1 font-sans text-white" colSpan={2}>Realizzato</td>
                                        <td className={`px-2 py-1 text-right ${calculatedPnl.totalRealizedGross >= 0 ? 'text-profit' : 'text-loss'}`}>
                                            €{calculatedPnl.totalRealizedGross.toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-right text-warning">
                                            -€{calculatedPnl.totalRealizedCommission.toFixed(2)}
                                        </td>
                                        <td className={`px-2 py-1 text-right ${calculatedPnl.totalRealizedNet >= 0 ? 'text-profit' : 'text-loss'}`}>
                                            €{calculatedPnl.totalRealizedNet.toFixed(2)}
                                        </td>
                                    </tr>
                                     <tr className="bg-gray-700/50">
                                        <td className="px-2 py-1 font-sans text-white" colSpan={2}>Non Realizzato</td>
                                        <td className={`px-2 py-1 text-right ${calculatedPnl.totalUnrealizedGross >= 0 ? 'text-profit' : 'text-loss'}`}>
                                            €{calculatedPnl.totalUnrealizedGross.toFixed(2)}
                                        </td>
                                        <td className="px-2 py-1 text-right text-warning">
                                            -€{calculatedPnl.totalUnrealizedCommission.toFixed(2)}
                                        </td>
                                        <td className={`px-2 py-1 text-right ${calculatedPnl.totalUnrealizedNet >= 0 ? 'text-profit' : 'text-loss'}`}>
                                            €{calculatedPnl.totalUnrealizedNet.toFixed(2)}
                                        </td>
                                    </tr>
                                    <tr className="bg-gray-900">
                                        <td className="px-2 py-2 font-sans text-white" colSpan={2}>TOTALE</td>
                                        <td className={`px-2 py-2 text-right text-lg ${calculatedPnl.grandTotalGross >= 0 ? 'text-profit' : 'text-loss'}`}>
                                            €{calculatedPnl.grandTotalGross.toFixed(2)}
                                        </td>
                                        <td className="px-2 py-2 text-right text-lg text-warning">
                                            -€{calculatedPnl.grandTotalCommission.toFixed(2)}
                                        </td>
                                        <td className={`px-2 py-2 text-right text-lg ${calculatedPnl.grandTotalNet >= 0 ? 'text-profit' : 'text-loss'}`}>
                                            €{calculatedPnl.grandTotalNet.toFixed(2)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="overflow-x-auto">
                            <h3 className="text-lg font-bold mb-2">Analisi Greche (Gambe Aperte)</h3>
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-2">Gamba</th>
                                        <th className="px-4 py-2 text-right">Delta</th>
                                        <th className="px-4 py-2 text-right">Gamma</th>
                                        <th className="px-4 py-2 text-right">Theta</th>
                                        <th className="px-4 py-2 text-right">Vega</th>
                                    </tr>
                                </thead>
                                <tbody className="font-mono">
                                    {localStructure.legs.filter(l => l.closingPrice === null || l.closingPrice === undefined).map((leg) => {
                                        const greeks = calculatedGreeks.legGreeks.find(g => g.id === leg.id);
                                        return (
                                            <tr key={leg.id} className="border-b border-gray-700 hover:bg-gray-700/50">
                                                <td className="px-4 py-1 font-sans font-medium text-white">#{leg.id} {leg.quantity > 0 ? 'L' : 'S'} {leg.optionType.slice(0,1)} @{leg.strike}</td>
                                                <td className="px-4 py-1 text-right text-white">{greeks?.delta.toFixed(2)}</td>
                                                <td className="px-4 py-1 text-right text-white">{greeks?.gamma.toFixed(3)}</td>
                                                <td className="px-4 py-1 text-right text-white">€{((greeks?.theta ?? 0) * localStructure.multiplier).toFixed(2)}</td>
                                                <td className="px-4 py-1 text-right text-white">€{((greeks?.vega ?? 0) * localStructure.multiplier).toFixed(2)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="font-mono font-bold text-white">
                                    <tr className="bg-gray-700">
                                        <td className="px-4 py-2 font-sans text-white">TOTALI</td>
                                        <td className="px-4 py-2 text-right text-white">{calculatedGreeks.totalGreeks.delta.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right text-white">{calculatedGreeks.totalGreeks.gamma.toFixed(3)}</td>
                                        <td className="px-4 py-2 text-right text-white">€{(calculatedGreeks.totalGreeks.theta * localStructure.multiplier).toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right text-white">€{(calculatedGreeks.totalGreeks.vega * localStructure.multiplier).toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StructureDetailView;
