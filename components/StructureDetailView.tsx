
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { OptionLeg, MarketData, Structure, CalculatedGreeks } from '../types';
import { BlackScholes, getTimeToExpiry, calculateImpliedVolatility } from '../services/blackScholes';
import { calculateStructureMargin } from '../utils/marginCalculator';
import usePortfolioStore from '../store/portfolioStore';
import useSettingsStore from '../store/settingsStore';
import PayoffChart from './PayoffChart';
import { PlusIcon, TrashIcon, CloudDownloadIcon, CalculatorIcon, ArchiveIcon } from './icons';
import { StickyNote } from 'lucide-react';
import NotesDialog from './NotesDialog';
import ExpiryDateSelector, { findThirdFridayOfMonth } from './ExpiryDateSelector';
import QuantitySelector from './QuantitySelector';
import StrikeSelector from './StrikeSelector';
import { formatNumber, formatCurrency, formatPercent, formatInputNumber } from '../utils/formatters';

import useUserStore from '../store/userStore';

const DragHandleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 cursor-grab active:cursor-grabbing" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
);

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

// Componente per l'input del prezzo manuale con gestione locale dello stato per decimali (virgola)
const ManualPriceInput = ({ initialValue, placeholder, onChange, className, title }: any) => {
    const [localValue, setLocalValue] = useState(formatInputNumber(initialValue));
    const isFocused = useRef(false);

    useEffect(() => {
        if (!isFocused.current) {
            setLocalValue(formatInputNumber(initialValue));
        }
    }, [initialValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const originalVal = e.target.value;
        const valForParsing = originalVal.replace(',', '.');
        
        if (valForParsing === '' || valForParsing === '-' || valForParsing === '.' || valForParsing === '-.' || /^-?\d*\.?\d*$/.test(valForParsing)) {
            setLocalValue(originalVal);
            const parsed = parseFloat(valForParsing);
            if (!isNaN(parsed)) {
                onChange(parsed);
            } else if (valForParsing === '' || valForParsing === '-') {
                onChange(null);
            }
        }
    };

    const handleBlur = () => {
        isFocused.current = false;
        let val = localValue.replace(',', '.');
        if (val.endsWith('.')) {
            val = val.slice(0, -1);
        }
        if (val === '' || val === '-') {
            setLocalValue('');
            onChange(null);
        } else {
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) {
                setLocalValue(formatInputNumber(parsed));
                onChange(parsed);
            } else {
                setLocalValue(formatInputNumber(initialValue));
            }
        }
    };

    return (
        <input
            type="text"
            inputMode="decimal"
            placeholder={placeholder}
            value={localValue}
            onChange={handleChange}
            onFocus={() => { isFocused.current = true; }}
            onBlur={handleBlur}
            className={className}
            title={title}
        />
    );
};

const SortableLegItem = React.memo(({ leg, idx, isReadOnly, simulatedSpot, inputBaseClass, labelClass, handleLegChange, setFairValueAsTradePrice, removeLeg }: any) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: leg.id });

    const [localTradePrice, setLocalTradePrice] = useState(formatInputNumber(leg.tradePrice));
    const [localClosingPrice, setLocalClosingPrice] = useState(formatInputNumber(leg.closingPrice));
    const isTradePriceFocused = useRef(false);
    const isClosingPriceFocused = useRef(false);
    
    const [isNotesOpen, setIsNotesOpen] = useState(false);

    // Sync from props only when NOT focused
    useEffect(() => {
        if (!isTradePriceFocused.current) {
            setLocalTradePrice(formatInputNumber(leg.tradePrice));
        }
    }, [leg.tradePrice]);

    useEffect(() => {
        if (!isClosingPriceFocused.current) {
            setLocalClosingPrice(formatInputNumber(leg.closingPrice));
        }
    }, [leg.closingPrice]);

    const handleTradePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const originalVal = e.target.value;
        const valForParsing = originalVal.replace(',', '.');
        
        if (valForParsing === '' || valForParsing === '-' || valForParsing === '.' || valForParsing === '-.' || /^-?\d*\.?\d*$/.test(valForParsing)) {
            setLocalTradePrice(originalVal);
            const parsed = parseFloat(valForParsing);
            if (!isNaN(parsed)) {
                handleLegChange(leg.id, 'tradePrice', parsed);
            }
        }
    };

    const handleClosingPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const originalVal = e.target.value;
        const valForParsing = originalVal.replace(',', '.');
        
        if (valForParsing === '' || valForParsing === '-' || valForParsing === '.' || valForParsing === '-.' || /^-?\d*\.?\d*$/.test(valForParsing)) {
            setLocalClosingPrice(originalVal);
            const parsed = parseFloat(valForParsing);
            if (!isNaN(parsed)) {
                handleLegChange(leg.id, 'closingPrice', parsed);
            } else if (valForParsing === '' || valForParsing === '-') {
                handleLegChange(leg.id, 'closingPrice', null);
            }
        }
    };

    const handleTradePriceBlur = () => {
        isTradePriceFocused.current = false;
        let val = localTradePrice.replace(',', '.');
        if (val.endsWith('.')) {
            val = val.slice(0, -1);
        }
        if (val === '' || val === '-') {
            setLocalTradePrice('0');
            handleLegChange(leg.id, 'tradePrice', 0);
        } else {
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) {
                setLocalTradePrice(formatInputNumber(parsed));
                handleLegChange(leg.id, 'tradePrice', parsed);
            } else {
                setLocalTradePrice(formatInputNumber(leg.tradePrice));
            }
        }
    };

    const handleClosingPriceBlur = () => {
        isClosingPriceFocused.current = false;
        let val = localClosingPrice.replace(',', '.');
        if (val.endsWith('.')) {
            val = val.slice(0, -1);
        }
        if (val === '' || val === '-') {
            setLocalClosingPrice('');
            handleLegChange(leg.id, 'closingPrice', null);
        } else {
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) {
                setLocalClosingPrice(formatInputNumber(parsed));
                handleLegChange(leg.id, 'closingPrice', parsed);
            } else {
                setLocalClosingPrice(formatInputNumber(leg.closingPrice));
            }
        }
    };

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        position: 'relative' as const,
    };

    const isClosed = leg.closingPrice !== null && leg.closingPrice !== undefined;

    // Calculate BEP for the single leg
    const bep = useMemo(() => {
        if (!leg.strike || !leg.tradePrice) return null;
        // BEP based on premium only (ignoring commissions)
        const effectivePremium = leg.tradePrice;
            
        return leg.optionType === 'Call' ? leg.strike + effectivePremium : leg.strike - effectivePremium;
    }, [leg.strike, leg.tradePrice, leg.optionType]);

    return (
        <div ref={setNodeRef} style={style} className={`p-4 rounded-xl border ${isClosed ? 'bg-slate-200/60 dark:bg-gray-900/60' : 'bg-white dark:bg-gray-800'} border-slate-200 dark:border-gray-600 shadow-sm relative group ${isDragging ? 'shadow-lg ring-2 ring-accent opacity-90' : ''}`}>
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center space-x-2">
                    {!isReadOnly && (
                        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 -ml-2">
                            <DragHandleIcon />
                        </div>
                    )}
                    <input 
                        type="checkbox" 
                        checked={leg.enabled !== false} 
                        onChange={(e) => handleLegChange(leg.id, 'enabled', e.target.checked)}
                        className="w-4 h-4 text-accent rounded focus:ring-accent cursor-pointer"
                        disabled={isReadOnly}
                        title={leg.enabled !== false ? "Disabilita Gamba" : "Abilita Gamba"}
                    />
                    <span className={`text-xs font-bold uppercase tracking-widest ${leg.enabled !== false ? 'text-slate-500' : 'text-slate-300 dark:text-gray-600'}`}>Gamba {idx + 1}</span>
                    
                    {bep !== null && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-gray-700 rounded-md border border-slate-200 dark:border-gray-600">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">BEP:</span>
                            <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-gray-200">{formatNumber(bep, 1)}</span>
                        </div>
                    )}

                    <button 
                        onClick={() => setIsNotesOpen(true)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm border ${leg.notes?.text || (leg.notes?.attachments?.length || 0) > 0 ? 'bg-accent text-white border-accent' : 'bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-gray-300 border-slate-200 dark:border-gray-600 hover:bg-slate-200 dark:hover:bg-gray-600'}`}
                        title="Note & Screenshot"
                    >
                        <StickyNote className="w-3.5 h-3.5" />
                        <span>Note</span>
                        {(leg.notes?.attachments?.length || 0) > 0 && <span className="bg-white/20 px-1 rounded-full ml-0.5">{leg.notes?.attachments.length}</span>}
                    </button>
                </div>
                {!isReadOnly && (
                    <button onClick={() => removeLeg(leg.id)} className="text-loss opacity-0 group-hover:opacity-100 transition-opacity p-1"><TrashIcon /></button>
                )}
            </div>

            {/* Row 1: Basic Info - Reorganized for better visibility on small screens */}
            <div className={`grid grid-cols-2 gap-3 mb-4 ${leg.enabled === false ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* First row: Type and Quantity */}
                <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-gray-600 h-[34px] shadow-sm">
                    <button onClick={() => handleLegChange(leg.id, 'optionType', 'Call')} className={`flex-1 text-[11px] font-bold uppercase transition-colors ${leg.optionType === 'Call' ? 'bg-accent text-white' : 'bg-slate-50 dark:bg-gray-700 text-slate-500 hover:bg-slate-100'}`} disabled={isReadOnly}>Call</button>
                    <button onClick={() => handleLegChange(leg.id, 'optionType', 'Put')} className={`flex-1 text-[11px] font-bold uppercase transition-colors ${leg.optionType === 'Put' ? 'bg-warning text-white' : 'bg-slate-50 dark:bg-gray-700 text-slate-500 hover:bg-slate-100'}`} disabled={isReadOnly}>Put</button>
                </div>
                <div className="relative">
                    <QuantitySelector value={leg.quantity} onChange={v => handleLegChange(leg.id, 'quantity', v)} disabled={isReadOnly} className={`${inputBaseClass} h-[34px] w-full`} />
                </div>
                
                {/* Second row: Strike and Expiry */}
                <div className="relative">
                    <StrikeSelector value={leg.strike} onChange={v => handleLegChange(leg.id, 'strike', v)} spotPrice={simulatedSpot} optionType={leg.optionType} disabled={isReadOnly} className={`${inputBaseClass} h-[34px] w-full`} />
                </div>
                <div className="relative">
                    <ExpiryDateSelector value={leg.expiryDate} onChange={v => handleLegChange(leg.id, 'expiryDate', v)} disabled={isReadOnly} className={`${inputBaseClass} h-[34px] w-full`} />
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
                                <input 
                                    type="text" 
                                    inputMode="decimal" 
                                    value={localTradePrice} 
                                    onChange={handleTradePriceChange} 
                                    onFocus={() => { isTradePriceFocused.current = true; }}
                                    onBlur={handleTradePriceBlur} 
                                    className={`${inputBaseClass} font-mono border-accent/20`} 
                                    disabled={isReadOnly} 
                                />
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
                                <input 
                                    type="text" 
                                    inputMode="decimal" 
                                    placeholder="-" 
                                    value={localClosingPrice} 
                                    onChange={handleClosingPriceChange} 
                                    onFocus={() => { isClosingPriceFocused.current = true; }}
                                    onBlur={handleClosingPriceBlur} 
                                    className={`${inputBaseClass} font-mono`} 
                                    disabled={isReadOnly} 
                                />
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
            </div>

            <NotesDialog 
                isOpen={isNotesOpen}
                onClose={() => setIsNotesOpen(false)}
                notes={leg.notes}
                onSave={(notes) => handleLegChange(leg.id, 'notes', notes)}
                title={`Gamba ${idx + 1} - ${leg.optionType} ${leg.strike}`}
            />
        </div>
    );
});

interface StructureDetailViewProps {
    structureId: string | 'new' | null;
}

const StructureDetailView: React.FC<StructureDetailViewProps> = ({ structureId }) => {
    const { structures, marketData, setMarketData, addStructure, updateStructure, deleteStructure, closeStructure, reopenStructure, setCurrentView, refreshDaxSpot, isLoadingSpot } = usePortfolioStore();
    const { settings } = useSettingsStore();
    const { profile } = useUserStore();
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
    const [filterMode, setFilterMode] = useState<'all' | 'open' | 'closed'>('all');
    const [confirmClose, setConfirmClose] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setLocalStructure((prev) => {
                if (!prev) return prev;
                const oldIndex = prev.legs.findIndex((leg) => leg.id === active.id);
                const newIndex = prev.legs.findIndex((leg) => leg.id === over.id);
                return {
                    ...prev,
                    legs: arrayMove(prev.legs, oldIndex, newIndex),
                };
            });
        }
    };

    const sortLegsByDate = () => {
        if (!localStructure || isReadOnly) return;
        setLocalStructure(prev => {
            if (!prev) return prev;
            const sortedLegs = [...prev.legs].sort((a, b) => {
                const dateA = new Date(a.openingDate).getTime();
                const dateB = new Date(b.openingDate).getTime();
                return dateA - dateB;
            });
            return { ...prev, legs: sortedLegs };
        });
    };

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
        try {
            const timeToExpiry = getTimeToExpiry(leg.expiryDate);
            const bs = new BlackScholes(simulatedSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
            const price = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
            return isNaN(price) ? 0 : Number(price.toFixed(2));
        } catch (e) {
            console.error("Fair value calculation error:", e);
            return 0;
        }
    };

    const handleLegChange = useCallback((id: string, field: keyof Omit<OptionLeg, 'id'>, value: any) => {
        if (isReadOnly) return;
        
        setLocalStructure(prev => {
            if (!prev) return null;
            const updatedLegs = prev.legs.map(leg => {
                if (leg.id === id) {
                    const newLeg = { ...leg, [field]: value };
                    
                    // Automazione: Se inserisco prezzo chiusura e la data è vuota, metti oggi (o data chiusura struttura se già chiusa)
                    if (field === 'closingPrice' && value !== '' && value !== null) {
                        if (!newLeg.closingDate) {
                            newLeg.closingDate = prev.closingDate || new Date().toISOString().split('T')[0];
                        }
                    }
                    
                    // Automazione: Se inserisco prezzo apertura e la data è vuota, metti oggi
                    if (field === 'tradePrice' && value !== '' && value !== null && value !== 0) {
                        if (!newLeg.openingDate) {
                            newLeg.openingDate = new Date().toISOString().split('T')[0];
                        }
                    }
                    return newLeg;
                }
                return leg;
            });
            return { ...prev, legs: updatedLegs };
        });
    }, [isReadOnly]);

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
            impliedVolatility: marketData.daxVolatility || 15,
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
            impliedVolatility: marketData.daxVolatility || 15,
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
            l.closingPrice === null || l.closingPrice === undefined
        );
        
        if (missingPrice) {
            setValidationMessage({
                title: "Dati Mancanti",
                message: "Per archiviare la strategia, è necessario inserire il prezzo di chiusura per tutte le gambe (può essere 0)."
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

    const filteredLegs = useMemo(() => {
        if (!localStructure || !localStructure.legs) return [];
        if (filterMode === 'all') return localStructure.legs;
        
        // Cerchiamo la versione "salvata" della struttura per decidere se una gamba è aperta o chiusa.
        // Questo evita che una gamba sparisca istantaneamente mentre l'utente sta scrivendo il prezzo di chiusura.
        const persistedStructure = structureId !== 'new' ? structures.find(s => s.id === structureId) : null;

        return localStructure.legs.filter(leg => {
            const persistedLeg = persistedStructure?.legs.find(l => l.id === leg.id);
            
            if (persistedLeg) {
                // Usiamo lo stato salvato per il filtraggio
                const isSavedClosed = persistedLeg.closingPrice !== null && persistedLeg.closingPrice !== undefined;
                return filterMode === 'open' ? !isSavedClosed : isSavedClosed;
            }
            
            // Se la gamba è nuova (non ancora salvata), la consideriamo "Aperta" di default
            return filterMode === 'open';
        });
    }, [localStructure, filterMode, structures, structureId]);

    const analysis = useMemo(() => {
        if (!localStructure) return null;
        
        const legAnalysis = localStructure.legs.map(leg => {
            const timeToExpiry = getTimeToExpiry(leg.expiryDate);
            const volatilityToUse = marketData.daxVolatility > 0 ? marketData.daxVolatility : leg.impliedVolatility;
            
            // Check if specifically this leg is closed (has closing price)
            // Fix: allow 0 as a valid closing price
            const isLegClosed = leg.closingPrice !== null && leg.closingPrice !== undefined;
            
            // Calculate Effective IV if there's a manual price
            let effectiveIv = volatilityToUse;
            if (!isLegClosed && leg.manualCurrentPrice !== null && leg.manualCurrentPrice !== undefined) {
                const solvedIv = calculateImpliedVolatility(
                    leg.manualCurrentPrice,
                    marketData.daxSpot,
                    leg.strike,
                    timeToExpiry,
                    marketData.riskFreeRate,
                    leg.optionType
                );
                if (solvedIv !== null && !isNaN(solvedIv)) {
                    effectiveIv = solvedIv;
                }
            }

            // Theoretical price at SIMULATED spot (for current valuation)
            const bsSim = new BlackScholes(simulatedSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, effectiveIv);
            const fairValue = leg.optionType === 'Call' ? bsSim.callPrice() : bsSim.putPrice();
            const greeks = leg.optionType === 'Call' ? bsSim.callGreeks() : bsSim.putGreeks();
            
            let currentPrice = fairValue;
            if (isLegClosed) {
                currentPrice = Number(leg.closingPrice);
            } else if (leg.manualCurrentPrice !== null && leg.manualCurrentPrice !== undefined) {
                currentPrice = leg.manualCurrentPrice;
            }
            
            // P&L calculation: (Exit - Entry) * Qty. 
            const tradePrice = isNaN(leg.tradePrice) ? 0 : leg.tradePrice;
            const priceDiff = currentPrice - tradePrice;
            const pnlPoints = priceDiff * leg.quantity;
            
            const grossPnl = pnlPoints * localStructure.multiplier;
            const commissions = ((leg.openingCommission || 0) + (leg.closingCommission || 0)) * Math.abs(leg.quantity);
            const netPnl = grossPnl - commissions;

            const thetaPoints = greeks.theta * leg.quantity;
            const vegaPoints = greeks.vega * leg.quantity;

            return {
                id: leg.id,
                fairValue,
                currentPrice,
                effectiveIv,
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
                volatilityUsed: effectiveIv
            };
        });

        const totals = legAnalysis.reduce((acc, curr) => {
            const leg = localStructure.legs.find(l => l.id === curr.id);
            if (leg?.enabled === false) return acc;

            acc.pnl += curr.netPnl;
            acc.pnlPoints += curr.pnlPoints;
            acc.gross += curr.grossPnl;
            acc.comm += curr.commissions;
            
            if (curr.isClosed) {
                acc.realized += curr.netPnl;
                acc.realizedPoints += curr.pnlPoints;
            } else {
                acc.unrealized += curr.netPnl;
                acc.unrealizedPoints += curr.pnlPoints;
                acc.delta += curr.delta;
                acc.gamma += curr.gamma;
                acc.theta += curr.theta;
                acc.vega += curr.vega;
                acc.thetaPoints += curr.thetaPoints;
                acc.vegaPoints += curr.vegaPoints;
            }
            return acc;
        }, { 
            pnl: 0, pnlPoints: 0, gross: 0, comm: 0, 
            realized: 0, realizedPoints: 0, 
            unrealized: 0, unrealizedPoints: 0, 
            delta: 0, gamma: 0, theta: 0, vega: 0, thetaPoints: 0, vegaPoints: 0 
        });

        // Calculate Global PDC (Net Entry Price in Points)
        // Formula: (Total Net Cash Flow / Multiplier)
        // Includes ALL legs (open and closed) and ALL commissions.
        const totalNetCashFlow = localStructure.legs.reduce((acc, leg) => {
            if (leg.enabled === false) return acc;

            // Opening Flow:
            // Long (Qty > 0): Pays money -> Negative Flow
            // Short (Qty < 0): Receives money -> Positive Flow
            // Math: -1 * Qty * Price * Multiplier
            const openingFlow = -1 * leg.quantity * leg.tradePrice * localStructure.multiplier;
            const openingComm = (leg.openingCommission || 0) * Math.abs(leg.quantity);
            
            let legFlow = openingFlow - openingComm;

            // Closing Flow (if closed):
            // Long (Qty > 0): Sells -> Receives money -> Positive Flow
            // Short (Qty < 0): Buys -> Pays money -> Negative Flow
            // Math: +1 * Qty * Price * Multiplier
            if (leg.closingPrice !== null && leg.closingPrice !== undefined) {
                const closingFlow = leg.quantity * leg.closingPrice * localStructure.multiplier;
                const closingComm = (leg.closingCommission || 0) * Math.abs(leg.quantity);
                legFlow += (closingFlow - closingComm);
            }

            return acc + legFlow;
        }, 0);

        const globalPDC = totalNetCashFlow / localStructure.multiplier;

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

        const occupiedMargin = calculateStructureMargin(localStructure as Structure, marketData, settings);

        return { legAnalysis, totals, realizedPnl, realizedPoints, unrealizedPnl, unrealizedPoints, globalPDC, occupiedMargin };
    }, [localStructure, simulatedSpot, marketData.riskFreeRate, isLiveMode, structures, marketData.daxVolatility, settings]); // Use simulatedSpot

    if (!localStructure) return null;

    const inputBaseClass = "bg-slate-50 dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs w-full outline-none focus:ring-1 focus:ring-accent disabled:opacity-60";
    const labelClass = "text-[9px] font-bold text-slate-400 uppercase block mb-1 tracking-wider";

    const isMarketDataValid = marketData.daxSpot > 0 && marketData.daxVolatility > 0;

    return (
        <div className="space-y-6 w-full mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex items-center space-x-2 md:space-x-4">
                    <button onClick={() => setCurrentView('list')} className="p-2 hover:bg-slate-200 dark:hover:bg-gray-700 rounded-full transition-colors">&larr;</button>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white truncate max-w-[200px] md:max-w-none">
                        {structureId === 'new' ? 'Nuova Strategia' : localStructure.tag}
                    </h1>
                </div>
                
                <div className="flex items-center space-x-2 md:space-x-3 bg-white dark:bg-gray-800 p-2 rounded-lg border border-slate-200 dark:border-gray-700 shadow-sm w-full md:w-auto overflow-x-auto">
                    <button 
                        onClick={() => isLiveMode ? setIsLiveMode(false) : resetToLive()}
                        className={`flex-shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
                            isLiveMode 
                                ? (isMarketDataValid ? 'bg-green-500 text-white' : 'bg-red-500 text-white animate-pulse') 
                                : 'bg-slate-200 text-slate-500'
                        }`}
                        title={isLiveMode && !isMarketDataValid ? "Dati di mercato incompleti o non aggiornati" : ""}
                    >
                        {isLiveMode ? 'LIVE' : 'SIM'}
                    </button>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 md:pl-2 flex-shrink-0">Spot</span>
                    <input 
                        type="number" 
                        value={simulatedSpot} 
                        onChange={e => handleSpotChange(parseFloat(e.target.value) || 0)} 
                        className={`bg-transparent w-20 md:w-24 text-center font-mono font-bold outline-none flex-shrink-0 ${isLiveMode ? 'text-slate-400' : 'text-accent'}`}
                        readOnly={isLiveMode}
                    />
                    
                    {/* Divider */}
                    <div className="w-px h-4 bg-slate-200 dark:bg-gray-700 mx-1 md:mx-2 flex-shrink-0"></div>

                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex-shrink-0">VDAX</span>
                    <span className={`font-mono font-bold text-xs md:text-sm flex-shrink-0 ${isLiveMode ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                        {marketData.daxVolatility ? formatPercent(marketData.daxVolatility, 1) : '-'}
                    </span>

                    {!isLiveMode && (
                        <button onClick={handleRefreshSpot} disabled={isLoadingSpot} className={`p-2 rounded hover:bg-slate-100 dark:hover:bg-gray-700 text-accent flex-shrink-0 ${isLoadingSpot ? 'animate-spin' : ''}`}>
                            <CloudDownloadIcon />
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">P&L Totale</span>
                    <div className={`text-sm font-mono font-bold mt-1 ${(analysis?.totals.pnl || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {formatCurrency(analysis?.totals.pnl || 0)}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Margine Occupato</span>
                    <div className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 mt-1">
                        {formatCurrency(analysis?.occupiedMargin || 0)}
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">PDC Globale</span>
                    <div className="text-sm font-mono font-bold mt-1 text-slate-700 dark:text-slate-300">
                        {formatNumber(Math.abs(analysis?.globalPDC || 0))} 
                        <span className="text-[10px] ml-1 font-normal text-slate-400">
                            {(analysis?.globalPDC || 0) >= 0 ? '(Credito)' : '(Debito)'}
                        </span>
                    </div>
                </div>
                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Delta Totale</span>
                    <div className="text-sm font-mono font-bold text-slate-700 dark:text-gray-300 mt-1">
                        {formatNumber(analysis?.totals.delta || 0)}
                    </div>
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
                        
                        {/* Admin Sharing Toggle */}
                        {!isReadOnly && profile?.role === 'admin' && (
                            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-gray-700">
                                <input 
                                    type="checkbox" 
                                    id="isShared"
                                    checked={localStructure.isShared || false} 
                                    onChange={e => setLocalStructure({...localStructure, isShared: e.target.checked})}
                                    className="w-4 h-4 text-accent rounded focus:ring-accent cursor-pointer"
                                />
                                <label htmlFor="isShared" className="text-xs font-medium text-slate-700 dark:text-gray-300 cursor-pointer select-none">
                                    Condividi con tutti i clienti
                                </label>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-gray-700">
                            <div className="flex items-center space-x-3">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Gambe</h3>
                                <div className="flex bg-slate-100 dark:bg-gray-700 p-0.5 rounded-lg border border-slate-200 dark:border-gray-600">
                                    <button 
                                        onClick={() => setFilterMode('all')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${filterMode === 'all' ? 'bg-white dark:bg-gray-600 text-accent shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                    >
                                        TUTTE
                                    </button>
                                    <button 
                                        onClick={() => setFilterMode('open')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${filterMode === 'open' ? 'bg-white dark:bg-gray-600 text-accent shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                    >
                                        APERTE
                                    </button>
                                    <button 
                                        onClick={() => setFilterMode('closed')}
                                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${filterMode === 'closed' ? 'bg-white dark:bg-gray-600 text-accent shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                                    >
                                        CHIUSE
                                    </button>
                                </div>
                            </div>
                            {!isReadOnly && (
                                <button 
                                    onClick={sortLegsByDate}
                                    className="text-xs font-bold text-accent hover:text-accent/80 flex items-center space-x-1"
                                    title="Ordina per data di apertura"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                                    </svg>
                                    <span>Ordina per data</span>
                                </button>
                            )}
                        </div>

                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={filteredLegs.map(l => l.id)} strategy={verticalListSortingStrategy}>
                                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {filteredLegs.map((leg) => {
                                        const originalIdx = localStructure.legs.findIndex(l => l.id === leg.id);
                                        return (
                                            <SortableLegItem 
                                                key={leg.id}
                                                leg={leg}
                                                idx={originalIdx}
                                                isReadOnly={isReadOnly}
                                                simulatedSpot={simulatedSpot}
                                                inputBaseClass={inputBaseClass}
                                                labelClass={labelClass}
                                                handleLegChange={handleLegChange}
                                                setFairValueAsTradePrice={setFairValueAsTradePrice}
                                                removeLeg={(id: string) => setLocalStructure({...localStructure, legs: localStructure.legs.filter(l => l.id !== id)})}
                                            />
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>

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
                            actualMarketSpot={marketData.daxSpot}
                            multiplier={localStructure.multiplier}
                            structureStatus={('status' in localStructure) ? localStructure.status : 'Active'}
                            realizedPnl={0}
                            extraPoints={0}
                            currentPrices={(analysis?.legAnalysis || []).reduce((acc, curr) => ({ ...acc, [curr.id]: curr.currentPrice }), {})}
                            effectiveIvs={(analysis?.legAnalysis || []).reduce((acc, curr) => ({ ...acc, [curr.id]: curr.effectiveIv }), {})}
                            closedPrices={(analysis?.legAnalysis || []).filter(l => l.isClosed).reduce((acc, curr) => ({ ...acc, [curr.id]: curr.currentPrice }), {})}
                            legCommissions={(analysis?.legAnalysis || []).reduce((acc, curr) => ({ ...acc, [curr.id]: curr.commissions }), {})}
                        />
                    </div>

                    {/* Detailed Analysis Tables */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Table 1: P&L */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm flex flex-col">
                            <div className="px-4 py-3 bg-slate-50 dark:bg-gray-700/50 border-b border-slate-200 dark:border-gray-700">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Analisi P&L</h3>
                            </div>
                            <div className="overflow-x-auto lg:overflow-x-hidden hover:overflow-x-auto transition-all">
                                <table className="w-full text-xs text-right border-collapse">
                                    <thead className="text-slate-500 bg-slate-50/50 dark:bg-gray-800 dark:text-gray-400 font-medium whitespace-nowrap">
                                        <tr>
                                            <th className="px-2 lg:px-3 py-2 text-left">Gamba</th>
                                            <th className="px-2 lg:px-3 py-2">Prezzo Ape.</th>
                                            <th className="px-2 lg:px-3 py-2">Prezzo Att.</th>
                                            <th className="px-2 lg:px-3 py-2">Punti</th>
                                            <th className="px-2 lg:px-3 py-2">Lordo</th>
                                            <th className="px-2 lg:px-3 py-2">Comm.</th>
                                            <th className="px-2 lg:px-3 py-2">Netto</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-slate-700 dark:text-gray-300 whitespace-nowrap">
                                        {analysis?.legAnalysis.map((row, i) => {
                                            const leg = localStructure.legs.find(l => l.id === row.id);
                                            const isEnabled = leg?.enabled !== false;
                                            return (
                                            <tr key={row.id} className={`${row.isClosed ? 'bg-slate-50/80 dark:bg-gray-900/30 text-slate-400' : ''} ${!isEnabled ? 'opacity-40 line-through decoration-slate-400' : ''}`}>
                                                <td className="px-2 lg:px-3 py-2 text-left font-mono">
                                                    #{i + 1} {row.isClosed ? '(Chiusa)' : ''}
                                                </td>
                                                <td className="px-2 lg:px-3 py-2 font-mono text-slate-600 dark:text-slate-400">
                                                    {formatNumber(leg?.tradePrice)}
                                                </td>
                                                <td className="px-2 lg:px-3 py-2 font-mono text-slate-600 dark:text-slate-400">
                                                    {row.isClosed ? (
                                                        formatNumber(row.currentPrice)
                                                    ) : (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <ManualPriceInput
                                                                initialValue={leg?.manualCurrentPrice}
                                                                placeholder={formatNumber(row.fairValue)}
                                                                onChange={(val: number | null) => handleLegChange(row.id, 'manualCurrentPrice', val)}
                                                                className="w-16 lg:w-20 px-1 lg:px-2 py-1 text-right text-xs border border-slate-200 dark:border-gray-600 rounded bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                                                                title="Prezzo manuale (lascia vuoto per calcolo automatico)"
                                                            />
                                                            {row.volatilityUsed && isLiveMode && (
                                                                <span className="text-[9px] text-slate-400 block">IV: {formatPercent(row.volatilityUsed, 1)}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={`px-2 lg:px-3 py-2 font-mono ${row.pnlPoints >= 0 ? 'text-profit' : 'text-loss'}`}>{formatNumber(row.pnlPoints)}</td>
                                                <td className={`px-2 lg:px-3 py-2 font-mono ${row.grossPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(row.grossPnl)}</td>
                                                <td className="px-2 lg:px-3 py-2 font-mono text-warning">-{formatCurrency(row.commissions)}</td>
                                                <td className={`px-2 lg:px-3 py-2 font-mono font-bold ${row.netPnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(row.netPnl)}</td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-50 dark:bg-gray-700/30 font-bold border-t border-slate-200 dark:border-gray-700">
                                        <tr>
                                            <td className="px-2 lg:px-3 py-2 text-left text-slate-500">Realizzato</td>
                                            <td className="px-2 lg:px-3 py-2"></td>
                                            <td className="px-2 lg:px-3 py-2"></td>
                                            <td className={`px-2 lg:px-3 py-2 font-mono ${(analysis?.totals.realizedPoints || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>{formatNumber(analysis?.totals.realizedPoints)}</td>
                                            <td colSpan={3} className={`px-2 lg:px-3 py-2 font-mono text-right ${(analysis?.totals.realized || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(analysis?.totals.realized)}</td>
                                        </tr>
                                        <tr>
                                            <td className="px-2 lg:px-3 py-2 text-left text-slate-500">Non Realizz.</td>
                                            <td className="px-2 lg:px-3 py-2"></td>
                                            <td className="px-2 lg:px-3 py-2"></td>
                                            <td className={`px-2 lg:px-3 py-2 font-mono ${(analysis?.totals.unrealizedPoints || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>{formatNumber(analysis?.totals.unrealizedPoints)}</td>
                                            <td colSpan={3} className={`px-2 lg:px-3 py-2 font-mono text-right ${(analysis?.totals.unrealized || 0) >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(analysis?.totals.unrealized)}</td>
                                        </tr>
                                        <tr className="bg-slate-100 dark:bg-gray-700">
                                            <td className="px-2 lg:px-3 py-2 text-left text-slate-800 dark:text-white uppercase">Totale</td>
                                            <td className="px-2 lg:px-3 py-2"></td>
                                            <td className="px-2 lg:px-3 py-2"></td>
                                            <td className={`px-2 lg:px-3 py-2 font-mono ${analysis?.totals.pnlPoints >= 0 ? 'text-profit' : 'text-loss'}`}>{formatNumber(analysis?.totals.pnlPoints)}</td>
                                            <td className={`px-2 lg:px-3 py-2 font-mono ${analysis?.totals.gross >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(analysis?.totals.gross)}</td>
                                            <td className="px-2 lg:px-3 py-2 font-mono text-warning">-{formatCurrency(analysis?.totals.comm)}</td>
                                            <td className={`px-2 lg:px-3 py-2 font-mono font-bold ${analysis?.totals.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>{formatCurrency(analysis?.totals.pnl)}</td>
                                        </tr>
                                        {/* Global PDC Row */}
                                        <tr className="bg-slate-200 dark:bg-gray-600 border-t border-slate-300 dark:border-gray-500">
                                            <td colSpan={3} className="px-2 lg:px-3 py-2 text-left text-slate-800 dark:text-white font-bold uppercase text-[10px] tracking-wider">
                                                PDC Globale (Punti)
                                                <span className="block text-[8px] font-normal text-slate-500 dark:text-gray-300 normal-case">
                                                    (Incasso/Costo Netto Totale / Moltiplicatore)
                                                </span>
                                            </td>
                                            <td className="px-2 lg:px-3 py-2 font-mono font-bold text-slate-900 dark:text-white">
                                                {formatNumber(Math.abs(analysis?.globalPDC || 0))}
                                            </td>
                                            <td colSpan={3} className="px-2 lg:px-3 py-2 text-right text-[10px] text-slate-600 dark:text-gray-300 font-medium">
                                                {analysis?.globalPDC >= 0 ? 'CREDITO NETTO' : 'COSTO NETTO'}
                                            </td>
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
                            <div className="overflow-x-auto lg:overflow-x-hidden hover:overflow-x-auto transition-all">
                                <table className="w-full text-xs text-right border-collapse">
                                    <thead className="text-slate-500 bg-slate-50/50 dark:bg-gray-800 dark:text-gray-400 font-medium whitespace-nowrap">
                                        <tr>
                                            <th className="px-2 lg:px-3 py-2 text-left">Gamba</th>
                                            <th className="px-2 lg:px-3 py-2">Delta</th>
                                            <th className="px-2 lg:px-3 py-2">Gamma</th>
                                            <th className="px-2 lg:px-3 py-2">Theta (Pts)</th>
                                            <th className="px-2 lg:px-3 py-2">Theta (€)</th>
                                            <th className="px-2 lg:px-3 py-2">Vega (Pts)</th>
                                            <th className="px-2 lg:px-3 py-2">Vega (€)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-gray-700 text-slate-700 dark:text-gray-300 whitespace-nowrap">
                                        {analysis?.legAnalysis.filter(l => !l.isClosed).map((row, i) => {
                                            const originalIndex = analysis.legAnalysis.indexOf(row);
                                            const leg = localStructure.legs[originalIndex];
                                            const isEnabled = leg?.enabled !== false;
                                            return (
                                                <tr key={row.id} className={!isEnabled ? 'opacity-40 line-through decoration-slate-400' : ''}>
                                                    <td className="px-2 lg:px-3 py-2 text-left font-mono truncate max-w-[80px] lg:max-w-[100px]" title={`${leg.strike} ${leg.optionType}`}>
                                                        #{originalIndex + 1} {leg.strike} {leg.optionType.charAt(0)}
                                                    </td>
                                                    <td className="px-2 lg:px-3 py-2 font-mono">{formatNumber(row.delta)}</td>
                                                    <td className="px-2 lg:px-3 py-2 font-mono">{formatNumber(row.gamma, 3)}</td>
                                                    <td className="px-2 lg:px-3 py-2 font-mono">{formatNumber(row.thetaPoints)}</td>
                                                    <td className="px-2 lg:px-3 py-2 font-mono">{formatCurrency(row.theta)}</td>
                                                    <td className="px-2 lg:px-3 py-2 font-mono">{formatNumber(row.vegaPoints)}</td>
                                                    <td className="px-2 lg:px-3 py-2 font-mono">{formatCurrency(row.vega)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-100 dark:bg-gray-700 font-bold border-t border-slate-200 dark:border-gray-700">
                                        <tr>
                                            <td className="px-2 lg:px-3 py-2 text-left text-slate-800 dark:text-white uppercase">Totali</td>
                                            <td className="px-2 lg:px-3 py-2 font-mono text-slate-900 dark:text-white">{formatNumber(analysis?.totals.delta)}</td>
                                            <td className="px-2 lg:px-3 py-2 font-mono text-slate-900 dark:text-white">{formatNumber(analysis?.totals.gamma, 3)}</td>
                                            <td className="px-2 lg:px-3 py-2 font-mono text-slate-900 dark:text-white">{formatNumber(analysis?.totals.thetaPoints)}</td>
                                            <td className="px-2 lg:px-3 py-2 font-mono text-slate-900 dark:text-white">{formatCurrency(analysis?.totals.theta)}</td>
                                            <td className="px-2 lg:px-3 py-2 font-mono text-slate-900 dark:text-white">{formatNumber(analysis?.totals.vegaPoints)}</td>
                                            <td className="px-2 lg:px-3 py-2 font-mono text-slate-900 dark:text-white">{formatCurrency(analysis?.totals.vega)}</td>
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
