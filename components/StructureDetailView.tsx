
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { OptionLeg, MarketData, Structure, CalculatedGreeks } from '../types';
import { BlackScholes, getTimeToExpiry } from '../services/blackScholes';
import usePortfolioStore from '../store/portfolioStore';
import useSettingsStore from '../store/settingsStore';
import PayoffChart from './PayoffChart';
import { PlusIcon, TrashIcon, CloudDownloadIcon, CalculatorIcon, ArchiveIcon } from './icons';
import ExpiryDateSelector, { findThirdFridayOfMonth } from './ExpiryDateSelector';
import QuantitySelector from './QuantitySelector';
import StrikeSelector from './StrikeSelector';

const ReopenIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
    </svg>
);

const MagicWandIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
    </svg>
);

interface StructureDetailViewProps {
    structureId: string | 'new' | null;
}

const StructureDetailView: React.FC<StructureDetailViewProps> = ({ structureId }) => {
    const { structures, marketData, setMarketData, addStructure, updateStructure, deleteStructure, closeStructure, reopenStructure, setCurrentView, refreshDaxSpot, isLoadingSpot } = usePortfolioStore();
    const { settings } = useSettingsStore();
    const [localStructure, setLocalStructure] = useState<Omit<Structure, 'id' | 'status'> | Structure | null>(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [validationMessage, setValidationMessage] = useState<{title: string, message: string} | null>(null);
    
    // Local Spot Price for Simulation
    const [simulatedSpot, setSimulatedSpot] = useState<number>(marketData.daxSpot);
    const [isLiveMode, setIsLiveMode] = useState(true);

    // Sync simulated spot with market data when market data changes if in Live Mode
    useEffect(() => {
        if (isLiveMode) {
            setSimulatedSpot(marketData.daxSpot);
        }
    }, [marketData.daxSpot, isLiveMode]);

    // Update simulated spot if user refreshes manually via the button
    const handleRefreshSpot = async () => {
        await refreshDaxSpot();
        // Effect will handle update if isLiveMode is true
    };

    const handleSpotChange = (val: number) => {
        setSimulatedSpot(val);
        setIsLiveMode(false);
    };

    const resetToLive = () => {
        setIsLiveMode(true);
        setSimulatedSpot(marketData.daxSpot);
    };

    // Stati per la conferma in due step
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);

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
            if (structure) {
                setLocalStructure(JSON.parse(JSON.stringify(structure)));
                setIsReadOnly(structure.status === 'Closed');
            }
        }
    }, [structureId]);
    
    // Reset confirmation states when structure changes
    useEffect(() => {
        setConfirmDelete(false);
        setConfirmClose(false);
        setValidationMessage(null);
    }, [structureId]);

    const calculateLegFairValue = (leg: OptionLeg): number => {
        const timeToExpiry = getTimeToExpiry(leg.expiryDate);
        const bs = new BlackScholes(simulatedSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
        const price = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
        return parseFloat(price.toFixed(2));
    };

    const handleLegChange = useCallback((id: string, field: keyof Omit<OptionLeg, 'id'>, value: any) => {
        if (!localStructure || isReadOnly) return;
        
        setLocalStructure(prev => {
            if (!prev) return null;
            const updatedLegs = prev.legs.map(leg => {
                if (leg.id === id) {
                    const newLeg = { ...leg, [field]: value };
                    
                    // Automazione: Se inserisco prezzo chiusura e la data è vuota, metti oggi
                    if (field === 'closingPrice' && value !== '' && value !== null) {
                        if (!newLeg.closingDate) {
                            newLeg.closingDate = new Date().toISOString().split('T')[0];
                        }
                    }
                    return newLeg;
                }
                return leg;
            });
            return { ...prev, legs: updatedLegs };
        });
    }, [localStructure, isReadOnly]);

    const setFairValueAsTradePrice = (id: string) => {
        if (!localStructure) return;
        const leg = localStructure.legs.find(l => l.id === id);
        if (leg) {
            const fairValue = calculateLegFairValue(leg);
            handleLegChange(id, 'tradePrice', fairValue);
        }
    };

    const addLeg = () => {
        if (!localStructure || isReadOnly) return;
        const nextMonthDate = new Date();
        nextMonthDate.setUTCDate(1); 
        nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
        const defaultExpiry = findThirdFridayOfMonth(nextMonthDate.getUTCFullYear(), nextMonthDate.getUTCMonth()).toISOString().split('T')[0];

        // Creazione temporanea per calcolo Fair Value iniziale
        const tempLeg: OptionLeg = {
            id: 'temp',
            optionType: 'Call',
            strike: Math.round(simulatedSpot / 25) * 25,
            expiryDate: defaultExpiry,
            openingDate: new Date().toISOString().split('T')[0],
            quantity: 1,
            tradePrice: 0,
            impliedVolatility: 15,
        };
        const initialFairValue = calculateLegFairValue(tempLeg);

        const newLeg: OptionLeg = {
            id: Math.random().toString(36).substring(2) + Date.now().toString(36),
            optionType: 'Call',
            strike: Math.round(simulatedSpot / 25) * 25,
            expiryDate: defaultExpiry,
            openingDate: new Date().toISOString().split('T')[0],
            quantity: 1,
            tradePrice: initialFairValue, // Default al Fair Value
            closingPrice: null,
            closingDate: null,
            impliedVolatility: 15,
            openingCommission: settings.defaultOpeningCommission,
            closingCommission: settings.defaultClosingCommission,
            enabled: true,
        };
        setLocalStructure({ ...localStructure, legs: [...localStructure.legs, newLeg] });
    };

    const handleSaveAction = async () => {
        if (!localStructure || isReadOnly || isSaving) return;
        
        if (!localStructure.tag.trim()) { 
            setValidationMessage({
                title: "Nome Mancante",
                message: "Per favore, assegna un nome alla strategia (Tag) prima di salvare."
            });
            return; 
        }
        
        if (localStructure.legs.length === 0) { 
            setValidationMessage({
                title: "Nessuna Gamba",
                message: "La strategia deve contenere almeno una gamba per essere salvata."
            });
            return; 
        }

        setIsSaving(true);
        try {
            if ('id' in localStructure && localStructure.id) {
                await updateStructure(localStructure as Structure);
            } else {
                await addStructure(localStructure);
            }
            setCurrentView('list');
        } catch (error) {
            console.error("Save error:", error);
            setValidationMessage({
                title: "Errore Salvataggio",
                message: "Si è verificato un errore durante il salvataggio. Riprova."
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseAction = async () => {
        if (!confirmClose) {
            setConfirmClose(true);
            setTimeout(() => setConfirmClose(false), 3000); // Reset dopo 3 secondi
            return;
        }

        if (!localStructure || !('id' in localStructure) || isSaving) return;

        const missingPrice = localStructure.legs.some(l => 
            l.closingPrice === null || l.closingPrice === undefined || Number(l.closingPrice) === 0
        );
        
        if (missingPrice) {
            setValidationMessage({
                title: "Dati Mancanti",
                message: "Per archiviare la strategia, è necessario inserire il prezzo di chiusura per tutte le gambe."
            });
            setConfirmClose(false);
            return;
        }

        setIsSaving(true);
        try {
            // CRITICAL FIX: Save the structure (and leg closing prices) BEFORE closing it.
            // This ensures the DB has the latest closing prices entered in the UI.
            await updateStructure(localStructure as Structure);

            // Re-calculate analysis based on the latest localStructure state to get the correct PnL
            // We use the same logic as the useMemo below, but imperatively here to ensure we capture current state
            const finalPnl = analysis?.totals.pnl || 0;
            
            await closeStructure(localStructure.id, finalPnl);
            setCurrentView('list');
        } catch (error) {
            console.error("Close error:", error);
            setValidationMessage({
                title: "Errore Chiusura",
                message: "Si è verificato un errore durante la chiusura della strategia."
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteAction = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
            return;
        }

        if (!localStructure || !('id' in localStructure) || isSaving) return;
        
        setIsSaving(true);
        try {
            await deleteStructure(localStructure.id);
            setCurrentView('list'); 
        } catch (error) {
            console.error("Delete error:", error);
            alert("Errore critico durante l'eliminazione.");
        } finally {
            setIsSaving(false);
        }
    };

    const analysis = useMemo(() => {
        if (!localStructure) return null;
        
        const legAnalysis = localStructure.legs.map(leg => {
            // Get live data from store if available
            const storeStructure = structures.find(s => s.id === (localStructure as any).id);
            const storeLeg = storeStructure?.legs.find(l => l.id === leg.id);
            
            const timeToExpiry = getTimeToExpiry(leg.expiryDate);
            
            // Use Live IV if in Live Mode, otherwise use Trade IV (or simulated IV if we had that control)
            const volatilityToUse = isLiveMode && storeLeg?.currentIv ? storeLeg.currentIv : leg.impliedVolatility;
            
            const bs = new BlackScholes(simulatedSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, volatilityToUse);
            const fairValue = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
            const greeks = leg.optionType === 'Call' ? bs.callGreeks() : bs.putGreeks();
            
            // Check if specifically this leg is closed (has closing price)
            const isLegClosed = leg.closingPrice !== null && leg.closingPrice !== undefined && Number(leg.closingPrice) !== 0;
            const currentPrice = isLegClosed ? Number(leg.closingPrice) : fairValue;
            
            // P&L calculation: (Exit - Entry) * Qty. 
            // If Long (Qty > 0): (Current - Trade) * Qty.
            // If Short (Qty < 0): (Trade - Current) * abs(Qty)  ==> (Current - Trade) * Qty works for both algebraicaly.
            
            const priceDiff = currentPrice - leg.tradePrice;
            const pnlPoints = priceDiff * leg.quantity;
            
            const grossPnl = pnlPoints * localStructure.multiplier;
            const commissions = ((leg.openingCommission || 0) + (leg.closingCommission || 0)) * Math.abs(leg.quantity);
            const netPnl = grossPnl - commissions;

            const thetaPoints = greeks.theta * leg.quantity;
            const vegaPoints = greeks.vega * leg.quantity;

            return {
                id: leg.id,
                fairValue,
                currentPrice, // Add this for display
                pnlPoints,
                grossPnl,
                commissions,
                netPnl,
                isClosed: isLegClosed,
                delta: greeks.delta * leg.quantity * 100, // Scaled by 100
                gamma: greeks.gamma * leg.quantity,
                theta: thetaPoints * localStructure.multiplier, // Euro
                vega: vegaPoints * localStructure.multiplier,   // Euro
                thetaPoints,
                vegaPoints,
                volatilityUsed: volatilityToUse // For debug/display
            };
        });

        const totals = legAnalysis.reduce((acc, curr) => {
            const leg = localStructure.legs.find(l => l.id === curr.id);
            if (leg?.enabled === false) return acc;

            acc.pnl += curr.netPnl;
            acc.pnlPoints += curr.pnlPoints;
            acc.gross += curr.grossPnl;
            acc.comm += curr.commissions;
            
            if (!curr.isClosed) {
                acc.delta += curr.delta;
                acc.gamma += curr.gamma;
                acc.theta += curr.theta;
                acc.vega += curr.vega;
                acc.thetaPoints += curr.thetaPoints;
                acc.vegaPoints += curr.vegaPoints;
            }
            return acc;
        }, { pnl: 0, pnlPoints: 0, gross: 0, comm: 0, delta: 0, gamma: 0, theta: 0, vega: 0, thetaPoints: 0, vegaPoints: 0 });

        const realizedPnl = legAnalysis.filter(l => {
            const leg = localStructure.legs.find(sl => sl.id === l.id);
            return l.isClosed && leg?.enabled !== false;
        }).reduce((acc, l) => acc + l.netPnl, 0);
        
        const realizedPoints = legAnalysis.filter(l => {
            const leg = localStructure.legs.find(sl => sl.id === l.id);
            return l.isClosed && leg?.enabled !== false;
        }).reduce((acc, l) => acc + l.pnlPoints, 0);
        
        const unrealizedPnl = legAnalysis.filter(l => {
            const leg = localStructure.legs.find(sl => sl.id === l.id);
            return !l.isClosed && leg?.enabled !== false;
        }).reduce((acc, l) => acc + l.netPnl, 0);
        
        const unrealizedPoints = legAnalysis.filter(l => {
            const leg = localStructure.legs.find(sl => sl.id === l.id);
            return !l.isClosed && leg?.enabled !== false;
        }).reduce((acc, l) => acc + l.pnlPoints, 0);

        return { legAnalysis, totals, realizedPnl, realizedPoints, unrealizedPnl, unrealizedPoints };
    }, [localStructure, simulatedSpot, marketData.riskFreeRate, isLiveMode, structures, marketData.daxVolatility]); // Use simulatedSpot

    if (!localStructure) return null;

    const inputBaseClass = "bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs w-full outline-none focus:ring-1 focus:ring-accent disabled:opacity-60";
    const labelClass = "text-[9px] font-bold text-slate-400 uppercase block mb-1 tracking-wider";

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-wrap gap-4 justify-between items-center">
                <div className="flex items-center space-x-4">
                    <button onClick={() => setCurrentView('list')} className="p-2 hover:bg-slate-200 dark:hover:bg-gray-700 rounded-full transition-colors">&larr;</button>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {structureId === 'new' ? 'Nuova Strategia' : localStructure.tag}
                    </h1>
                </div>
                
                <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 p-2 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm">
                    <button 
                        onClick={() => isLiveMode ? setIsLiveMode(false) : resetToLive()}
                        className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${isLiveMode ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-500'}`}
                    >
                        {isLiveMode ? 'LIVE' : 'SIM'}
                    </button>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-2">Spot</span>
                    <input 
                        type="number" 
                        value={simulatedSpot} 
                        onChange={e => handleSpotChange(parseFloat(e.target.value) || 0)} 
                        className={`bg-transparent w-24 text-center font-mono font-bold outline-none ${isLiveMode ? 'text-slate-400' : 'text-accent'}`}
                        readOnly={isLiveMode}
                    />
                    
                    {/* Divider */}
                    <div className="w-px h-4 bg-slate-200 dark:bg-gray-700 mx-2"></div>

                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VDAX</span>
                    <span className={`font-mono font-bold text-sm ${isLiveMode ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                        {marketData.daxVolatility ? marketData.daxVolatility.toFixed(1) : '-'}%
                    </span>

                    {!isLiveMode && (
                        <button onClick={handleRefreshSpot} disabled={isLoadingSpot} className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-gray-700 text-accent ${isLoadingSpot ? 'animate-spin' : ''}`}>
                            <CloudDownloadIcon />
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Inputs */}
                <div className="lg:col-span-5 space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-slate-200 dark:border-gray-700 shadow-sm space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Nome Tag</label>
                                <input type="text" value={localStructure.tag} onChange={e => setLocalStructure({...localStructure, tag: e.target.value})} className={inputBaseClass} placeholder="Es. Iron Condor" disabled={isReadOnly} />
                            </div>
                            <div>
                                <label className={labelClass}>Moltiplicatore</label>
                                <select value={localStructure.multiplier} onChange={e => setLocalStructure({...localStructure, multiplier: parseInt(e.target.value) as 1 | 5 | 25})} className={inputBaseClass} disabled={isReadOnly}>
                                    <option value="5">Indice (5€)</option>
                                    <option value="1">CFD (1€)</option>
                                    <option value="25">Future (25€)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            {localStructure.legs.map((leg, idx) => (
                                <div key={leg.id} className="p-4 rounded-xl border bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-600 shadow-sm relative group">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center space-x-2">
                                            <input 
                                                type="checkbox" 
                                                checked={leg.enabled !== false} 
                                                onChange={(e) => handleLegChange(leg.id, 'enabled', e.target.checked)}
                                                className="w-4 h-4 text-accent rounded focus:ring-accent cursor-pointer"
                                                disabled={isReadOnly}
                                                title={leg.enabled !== false ? "Disabilita Gamba" : "Abilita Gamba"}
                                            />
                                            <span className={`text-xs font-bold uppercase tracking-widest ${leg.enabled !== false ? 'text-slate-500' : 'text-slate-300 dark:text-gray-600'}`}>Gamba {idx + 1}</span>
                                        </div>
                                        {!isReadOnly && (
                                            <button onClick={() => setLocalStructure({...localStructure, legs: localStructure.legs.filter(l => l.id !== leg.id)})} className="text-loss opacity-0 group-hover:opacity-100 transition-opacity p-1"><TrashIcon /></button>
                                        )}
                                    </div>

                                    {/* Row 1: Basic Info */}
                                    <div className={`grid grid-cols-10 gap-2 mb-3 ${leg.enabled === false ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <div className="col-span-3 flex rounded overflow-hidden border border-slate-200 dark:border-gray-600 h-[30px]">
                                            <button onClick={() => handleLegChange(leg.id, 'optionType', 'Call')} className={`flex-1 text-[10px] font-bold uppercase ${leg.optionType === 'Call' ? 'bg-accent text-white' : 'bg-slate-50 dark:bg-gray-700 text-slate-500'}`} disabled={isReadOnly}>Call</button>
                                            <button onClick={() => handleLegChange(leg.id, 'optionType', 'Put')} className={`flex-1 text-[10px] font-bold uppercase ${leg.optionType === 'Put' ? 'bg-warning text-white' : 'bg-slate-50 dark:bg-gray-700 text-slate-500'}`} disabled={isReadOnly}>Put</button>
                                        </div>
                                        <div className="col-span-2">
                                            <QuantitySelector value={leg.quantity} onChange={v => handleLegChange(leg.id, 'quantity', v)} disabled={isReadOnly} className={`${inputBaseClass} h-[30px]`} />
                                        </div>
                                        <div className="col-span-2">
                                            <StrikeSelector value={leg.strike} onChange={v => handleLegChange(leg.id, 'strike', v)} spotPrice={simulatedSpot} optionType={leg.optionType} disabled={isReadOnly} className={`${inputBaseClass} h-[30px]`} />
                                        </div>
                                        <div className="col-span-3">
                                            <ExpiryDateSelector value={leg.expiryDate} onChange={v => handleLegChange(leg.id, 'expiryDate', v)} disabled={isReadOnly} className={`${inputBaseClass} h-[30px]`} />
                                        </div>
                                    </div>

                                    {/* Row 2: Advanced Inputs grouped */}
                                    <div className="bg-slate-50 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-100 dark:border-gray-700 space-y-6">
                                        <div className="flex flex-col md:flex-row gap-8">
                                            {/* Apertura */}
                                            <div className="flex-1 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Apertura</span>
                                                    {!isReadOnly && (
                                                        <button onClick={() => setFairValueAsTradePrice(leg.id)} title="Imposta Fair Value" className="text-accent hover:scale-110 transition-transform active:scale-95">
                                                            <MagicWandIcon />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className={labelClass}>Prezzo Apertura</label>
                                                        <input type="number" step="0.01" value={leg.tradePrice} onChange={e => handleLegChange(leg.id, 'tradePrice', parseFloat(e.target.value))} className={`${inputBaseClass} font-mono border-accent/20`} disabled={isReadOnly} />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="min-w-0">
                                                            <label className={`${labelClass} truncate`}>Data Apertura</label>
                                                            <input type="date" value={leg.openingDate} onChange={e => handleLegChange(leg.id, 'openingDate', e.target.value)} className={inputBaseClass} disabled={isReadOnly} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <label className={`${labelClass} truncate`}>Comm. Ape.</label>
                                                            <input type="number" step="0.01" value={leg.openingCommission || 0} onChange={e => handleLegChange(leg.id, 'openingCommission', parseFloat(e.target.value) || 0)} className={`${inputBaseClass} font-mono text-center`} disabled={isReadOnly} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Vertical Divider */}
                                            <div className="hidden md:block w-px bg-slate-200 dark:bg-gray-700 self-stretch"></div>

                                            {/* Chiusura */}
                                            <div className="flex-1 space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chiusura</span>
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className={labelClass}>Prezzo Chiusura</label>
                                                        <input type="number" step="0.01" placeholder="-" value={leg.closingPrice || ''} onChange={e => handleLegChange(leg.id, 'closingPrice', e.target.value === '' ? null : parseFloat(e.target.value))} className={`${inputBaseClass} font-mono`} disabled={isReadOnly} />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="min-w-0">
                                                            <label className={`${labelClass} truncate`}>Data Chiusura</label>
                                                            <input type="date" value={leg.closingDate || ''} onChange={e => handleLegChange(leg.id, 'closingDate', e.target.value)} className={inputBaseClass} disabled={isReadOnly} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <label className={`${labelClass} truncate`}>Comm. Chi.</label>
                                                            <input type="number" step="0.01" value={leg.closingCommission || 0} onChange={e => handleLegChange(leg.id, 'closingCommission', parseFloat(e.target.value) || 0)} className={`${inputBaseClass} font-mono text-center`} disabled={isReadOnly} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* IV - Full Width */}
                                        <div className="pt-5 border-t border-slate-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between mb-4">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Volatilità Implicita (IV%)</label>
                                                <div className="flex items-center space-x-2">
                                                    <input 
                                                        type="number" 
                                                        value={leg.impliedVolatility} 
                                                        onChange={e => handleLegChange(leg.id, 'impliedVolatility', parseFloat(e.target.value))} 
                                                        className="w-16 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded px-2 py-1 text-xs font-mono text-center outline-none focus:ring-1 focus:ring-accent"
                                                        disabled={isReadOnly}
                                                    />
                                                    <span className="text-[10px] font-bold text-slate-400">%</span>
                                                </div>
                                            </div>
                                            <div className="px-1">
                                                <input 
                                                    type="range" 
                                                    min="1" 
                                                    max="100" 
                                                    value={leg.impliedVolatility} 
                                                    onChange={e => handleLegChange(leg.id, 'impliedVolatility', parseInt(e.target.value))}
                                                    disabled={isReadOnly}
                                                    className="w-full h-1.5 bg-slate-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-accent"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-4 space-y-3">
                            {!isReadOnly ? (
                                <>
                                    <button onClick={addLeg} className="w-full py-2.5 bg-slate-50 dark:bg-gray-700/50 text-slate-500 font-bold rounded-xl border-2 border-dashed border-slate-200 dark:border-gray-600 hover:bg-slate-100 transition-colors flex items-center justify-center text-sm">
                                        <PlusIcon className="mr-2" /> Aggiungi Gamba
                                    </button>
                                    <button 
                                        onClick={handleSaveAction} 
                                        disabled={isSaving} 
                                        className="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50 text-sm"
                                    >
                                        {isSaving ? 'Salvataggio...' : 'Salva'}
                                    </button>
                                    {('id' in localStructure) && localStructure.id && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <button 
                                                onClick={handleCloseAction} 
                                                disabled={isSaving} 
                                                className={`py-3 font-bold rounded-xl border transition-all disabled:opacity-50 text-sm ${confirmClose ? 'bg-warning text-white border-warning' : 'bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-600'}`}
                                            >
                                                {confirmClose ? 'Confermi Chiusura?' : 'Chiudi Strategia'}
                                            </button>
                                            <button 
                                                onClick={handleDeleteAction} 
                                                disabled={isSaving} 
                                                className={`py-3 font-bold rounded-xl border transition-all disabled:opacity-50 text-sm ${confirmDelete ? 'bg-red-600 text-white border-red-600' : 'bg-loss/10 text-loss border-loss/20'}`}
                                            >
                                                {confirmDelete ? 'Confermi?' : 'Elimina'}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <button onClick={() => reopenStructure(localStructure.id)} className="w-full py-4 bg-accent text-white font-bold rounded-xl flex items-center justify-center shadow-lg transition-all active:scale-95 text-sm">
                                    <ReopenIcon /> <span className="ml-2">Riapri per Modifica</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Chart & Tables */}
                <div className="lg:col-span-7 space-y-6">
                    {/* Chart */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-slate-200 dark:border-gray-700 shadow-sm h-[450px]">
                        <PayoffChart 
                            legs={localStructure.legs.filter(l => l.enabled !== false)} 
                            marketData={{...marketData, daxSpot: simulatedSpot}} 
                            multiplier={localStructure.multiplier}
                            structureStatus={('status' in localStructure) ? localStructure.status : 'Active'}
                            realizedPnl={('realizedPnl' in localStructure) ? localStructure.realizedPnl : undefined}
                        />
                    </div>

                    {/* Detailed Analysis Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Table 1: P&L */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm flex flex-col">
                            <div className="px-4 py-3 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Analisi P&L</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-right">
                                    <thead className="text-slate-500 bg-slate-50/50 dark:bg-gray-800 dark:text-gray-400 font-medium">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Gamba</th>
                                            <th className="px-3 py-2">Prezzo Att.</th>
                                            <th className="px-3 py-2">Punti</th>
                                            <th className="px-3 py-2">Lordo</th>
                                            <th className="px-3 py-2">Comm.</th>
                                            <th className="px-3 py-2">Netto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-slate-700 dark:text-gray-300">
                                        {analysis?.legAnalysis.map((row, i) => {
                                            const leg = localStructure.legs.find(l => l.id === row.id);
                                            const isEnabled = leg?.enabled !== false;
                                            return (
                                            <tr key={row.id} className={`${row.isClosed ? 'bg-slate-50/80 dark:bg-gray-900/30 text-slate-400' : ''} ${!isEnabled ? 'opacity-40 line-through decoration-slate-400' : ''}`}>
                                                <td className="px-3 py-2 text-left font-mono">
                                                    #{i + 1} {row.isClosed ? '(Chiusa)' : ''}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">
                                                    {row.currentPrice.toFixed(2)}
                                                    {row.volatilityUsed && isLiveMode && !row.isClosed && (
                                                        <span className="text-[9px] text-slate-400 ml-1 block">IV: {row.volatilityUsed.toFixed(1)}%</span>
                                                    )}
                                                </td>
                                                <td className={`px-3 py-2 font-mono ${row.pnlPoints >= 0 ? 'text-profit' : 'text-loss'}`}>{row.pnlPoints.toFixed(2)}</td>
                                                <td className={`px-3 py-2 font-mono ${row.grossPnl >= 0 ? 'text-profit' : 'text-loss'}`}>€{row.grossPnl.toFixed(2)}</td>
                                                <td className="px-3 py-2 font-mono text-warning">-€{row.commissions.toFixed(2)}</td>
                                                <td className={`px-3 py-2 font-mono font-bold ${row.netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>€{row.netPnl.toFixed(2)}</td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-50 dark:bg-gray-700/30 font-bold border-t border-slate-200 dark:border-gray-700">
                                        <tr>
                                            <td className="px-3 py-2 text-left text-slate-500">Realizzato</td>
                                            <td className="px-3 py-2"></td>
                                            <td className={`px-3 py-2 font-mono ${analysis?.realizedPoints >= 0 ? 'text-profit' : 'text-loss'}`}>{analysis?.realizedPoints.toFixed(2)}</td>
                                            <td colSpan={3} className={`px-3 py-2 font-mono text-right ${analysis?.realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>€{analysis?.realizedPnl.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-3 py-2 text-left text-slate-500">Non Realizz.</td>
                                            <td className="px-3 py-2"></td>
                                            <td className={`px-3 py-2 font-mono ${analysis?.unrealizedPoints >= 0 ? 'text-profit' : 'text-loss'}`}>{analysis?.unrealizedPoints.toFixed(2)}</td>
                                            <td colSpan={3} className={`px-3 py-2 font-mono text-right ${analysis?.unrealizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>€{analysis?.unrealizedPnl.toFixed(2)}</td>
                                        </tr>
                                        <tr className="bg-slate-100 dark:bg-gray-700">
                                            <td className="px-3 py-2 text-left text-slate-800 dark:text-white uppercase">Totale</td>
                                            <td className="px-3 py-2"></td>
                                            <td className={`px-3 py-2 font-mono ${analysis?.totals.pnlPoints >= 0 ? 'text-profit' : 'text-loss'}`}>{analysis?.totals.pnlPoints.toFixed(2)}</td>
                                            <td className={`px-3 py-2 font-mono ${analysis?.totals.gross >= 0 ? 'text-profit' : 'text-loss'}`}>€{analysis?.totals.gross.toFixed(2)}</td>
                                            <td className="px-3 py-2 font-mono text-warning">-€{analysis?.totals.comm.toFixed(2)}</td>
                                            <td className={`px-3 py-2 font-mono text-base ${analysis?.totals.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>€{analysis?.totals.pnl.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Table 2: Greeks - Hidden if closed */}
                        {(!('status' in localStructure) || localStructure.status === 'Active') && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm flex flex-col h-fit">
                            <div className="px-4 py-3 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Analisi Greche (Gambe Aperte)</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs text-right">
                                    <thead className="text-slate-500 bg-slate-50/50 dark:bg-gray-800 dark:text-gray-400 font-medium">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Gamba</th>
                                            <th className="px-3 py-2">Delta</th>
                                            <th className="px-3 py-2">Gamma</th>
                                            <th className="px-3 py-2">Theta (Pts)</th>
                                            <th className="px-3 py-2">Theta (€)</th>
                                            <th className="px-3 py-2">Vega (Pts)</th>
                                            <th className="px-3 py-2">Vega (€)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-slate-700 dark:text-gray-300">
                                        {analysis?.legAnalysis.filter(l => !l.isClosed).map((row, i) => {
                                            const originalIndex = analysis.legAnalysis.indexOf(row);
                                            const leg = localStructure.legs[originalIndex];
                                            const isEnabled = leg?.enabled !== false;
                                            return (
                                                <tr key={row.id} className={!isEnabled ? 'opacity-40 line-through decoration-slate-400' : ''}>
                                                    <td className="px-3 py-2 text-left font-mono truncate max-w-[100px]" title={`${leg.strike} ${leg.optionType}`}>
                                                        #{originalIndex + 1} {leg.strike} {leg.optionType.charAt(0)}
                                                    </td>
                                                    <td className="px-3 py-2 font-mono">{row.delta.toFixed(2)}</td>
                                                    <td className="px-3 py-2 font-mono">{row.gamma.toFixed(3)}</td>
                                                    <td className="px-3 py-2 font-mono">{row.thetaPoints.toFixed(2)}</td>
                                                    <td className="px-3 py-2 font-mono">€{row.theta.toFixed(2)}</td>
                                                    <td className="px-3 py-2 font-mono">{row.vegaPoints.toFixed(2)}</td>
                                                    <td className="px-3 py-2 font-mono">€{row.vega.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-100 dark:bg-gray-700 font-bold border-t border-slate-200 dark:border-gray-700">
                                        <tr>
                                            <td className="px-3 py-2 text-left text-slate-800 dark:text-white uppercase">Totali</td>
                                            <td className="px-3 py-2 font-mono text-slate-900 dark:text-white">{analysis?.totals.delta.toFixed(2)}</td>
                                            <td className="px-3 py-2 font-mono text-slate-900 dark:text-white">{analysis?.totals.gamma.toFixed(3)}</td>
                                            <td className="px-3 py-2 font-mono text-slate-900 dark:text-white">{analysis?.totals.thetaPoints.toFixed(2)}</td>
                                            <td className="px-3 py-2 font-mono text-slate-900 dark:text-white">€{analysis?.totals.theta.toFixed(2)}</td>
                                            <td className="px-3 py-2 font-mono text-slate-900 dark:text-white">{analysis?.totals.vegaPoints.toFixed(2)}</td>
                                            <td className="px-3 py-2 font-mono text-slate-900 dark:text-white">€{analysis?.totals.vega.toFixed(2)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                        )}
                        {('status' in localStructure) && localStructure.status === 'Closed' && (
                            <div className="bg-slate-50 dark:bg-gray-800/50 rounded-xl border border-slate-200 dark:border-gray-700 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                                <ArchiveIcon />
                                <p className="mt-2 text-sm font-medium">Strategia Chiusa</p>
                                <p className="text-xs">Nessun rischio greco attivo</p>
                            </div>
                        )}

                    </div>
                </div>
            </div>
            {/* Validation Modal */}
            {validationMessage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-warning/10 text-warning mb-4 mx-auto">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 text-center">{validationMessage.title}</h3>
                        <p className="text-slate-600 dark:text-gray-300 mb-6 text-center text-sm">
                            {validationMessage.message}
                        </p>
                        <button 
                            onClick={() => setValidationMessage(null)}
                            className="w-full py-2.5 rounded-xl font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition"
                        >
                            Ho capito
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StructureDetailView;
