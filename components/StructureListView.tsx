
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import usePortfolioStore from '../store/portfolioStore';
import { Structure, MarketData, CalculatedGreeks, Settings } from '../types';
import { BlackScholes, getTimeToExpiry } from '../services/blackScholes';
import { PlusIcon, PortfolioIcon, TrashIcon, CloudDownloadIcon, ArchiveIcon } from './icons';
import useSettingsStore from '../store/settingsStore';
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ListFilter, Calendar, Hash, ArrowUpDown, ArrowUp, ArrowDown, Euro } from 'lucide-react';

// ... (keep existing helper functions like calculateTotalGreeks, calculateUnrealizedPnlForStructure, getMultiplierLabel)

const calculateTotalGreeks = (structure: Structure, marketData: MarketData): CalculatedGreeks => {
    const initialGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };
    if (!structure.legs || structure.legs.length === 0) return initialGreeks;
    return structure.legs.reduce((acc, leg) => {
        // If leg is disabled, skip it
        if (leg.enabled === false) return acc;

        // If leg is closed, it has no greeks exposure
        if (leg.closingPrice !== null && leg.closingPrice !== undefined && Number(leg.closingPrice) !== 0) {
            return acc;
        }

        const timeToExpiry = getTimeToExpiry(leg.expiryDate);
        const bs = new BlackScholes(marketData.daxSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
        const greeks = leg.optionType === 'Call' ? bs.callGreeks() : bs.putGreeks();
        acc.delta += greeks.delta * leg.quantity;
        acc.gamma += greeks.gamma * leg.quantity;
        acc.theta += greeks.theta * leg.quantity; 
        acc.vega += greeks.vega * leg.quantity;   
        return acc;
    }, initialGreeks);
};

const calculatePnlInfoForStructure = (structure: Structure, marketData: MarketData): { netPnl: number, totalPoints: number } => {
    const calculated = structure.legs.reduce((acc, leg) => {
        // If leg is disabled, skip it
        if (leg.enabled === false) return acc;

        // Check if specifically this leg is closed (has closing price)
        const isLegClosed = leg.closingPrice !== null && leg.closingPrice !== undefined && Number(leg.closingPrice) !== 0;
        
        let currentPrice = 0;
        
        if (isLegClosed) {
            currentPrice = Number(leg.closingPrice);
        } else {
            const timeToExpiry = getTimeToExpiry(leg.expiryDate);
            if (timeToExpiry > 0) {
                const bs = new BlackScholes(marketData.daxSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
                currentPrice = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
            } else {
                currentPrice = leg.optionType === 'Call' ? Math.max(0, marketData.daxSpot - leg.strike) : Math.max(0, leg.strike - marketData.daxSpot);
            }
        }
        
        // P&L calculation: (Current Price - Trade Price) * Quantity
        const priceDiff = currentPrice - leg.tradePrice;
        const pnlPoints = priceDiff * leg.quantity;
        
        const grossPnl = pnlPoints * structure.multiplier;
        
        // Commissions
        const commissions = ((leg.openingCommission || 0) + (leg.closingCommission || 0)) * Math.abs(leg.quantity);
        const netPnl = grossPnl - commissions;
        
        return {
            netPnl: acc.netPnl + netPnl,
            totalPoints: acc.totalPoints + pnlPoints
        };
    }, { netPnl: 0, totalPoints: 0 });

    if (structure.status !== 'Active' && structure.realizedPnl !== undefined) {
        return { netPnl: structure.realizedPnl, totalPoints: calculated.totalPoints };
    }

    return calculated;
};

const calculateUnrealizedPnlForStructure = (structure: Structure, marketData: MarketData): number => {
    return calculatePnlInfoForStructure(structure, marketData).netPnl;
};

const getMultiplierLabel = (m: number) => {
    if (m === 25) return 'Future';
    if (m === 5) return 'Indice';
    return 'CFD';
};

// Sortable Item Component
interface SortableStructureItemProps {
    structure: Structure;
    marketData: MarketData;
    isBulkEditMode: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onView: (id: string) => void;
    isDragEnabled: boolean;
}

const SortableStructureItem: React.FC<SortableStructureItemProps> = ({
    structure,
    marketData,
    isBulkEditMode,
    isSelected,
    onSelect,
    onView,
    isDragEnabled
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: structure.id, disabled: !isDragEnabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1,
    };

    const pnlInfo = calculatePnlInfoForStructure(structure, marketData);
    const pnl = pnlInfo.netPnl;
    const points = pnlInfo.totalPoints;
    
    // Calculate Greeks for the structure
    const greeks = calculateTotalGreeks(structure, marketData);

    // Format creation date
    const creationDate = structure.createdAt 
        ? new Date(structure.createdAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';

    // Determine the display closing date (latest leg closing date or structure closing date)
    const displayClosingDate = useMemo(() => {
        if (!structure.closingDate) return null;
        
        if (structure.legs && structure.legs.length > 0) {
            const legClosingDates = structure.legs
                .map(l => l.closingDate)
                .filter(d => d)
                .map(d => new Date(d as string).getTime());
            
            if (legClosingDates.length > 0) {
                const maxDate = Math.max(...legClosingDates);
                // If the structure closing date is later (e.g. manual override), use it? 
                // User said: "bensì l'ultima data di chiusura della gamba che è stata chiusa più tardi"
                // So we prefer the leg date if available.
                // But let's check if the structure closing date is even later?
                // Usually structure closing date is set when all legs are closed.
                // Let's just use the max of legs if available.
                return new Date(maxDate).toISOString().split('T')[0];
            }
        }
        return structure.closingDate;
    }, [structure]);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group flex items-center transition-all ${isSelected ? 'bg-accent/5' : 'bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700/30'}`}
        >
            {isDragEnabled && (
                <div 
                    {...attributes} 
                    {...listeners} 
                    className="pl-4 pr-2 py-6 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500"
                >
                    <GripVertical className="w-5 h-5" />
                </div>
            )}
            
            <div 
                className={`flex-1 flex items-center cursor-pointer ${!isDragEnabled ? 'pl-0' : ''}`}
                onClick={() => isBulkEditMode ? onSelect(structure.id) : onView(structure.id)}
            >
                {isBulkEditMode && (
                    <div className="pl-6"><input type="checkbox" checked={isSelected} readOnly className="w-5 h-5 rounded text-accent" /></div>
                )}
                <div className={`flex-1 p-6 flex items-center justify-between ${isBulkEditMode ? 'pl-4' : (isDragEnabled ? 'pl-2' : 'pl-6')}`}>
                    <div className="w-1/3">
                        <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-accent transition-colors text-lg">{structure.tag || 'Senza nome'}</h3>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                {structure.legs.length} Gambe • {getMultiplierLabel(structure.multiplier)}
                                {displayClosingDate && ` • Chiusa il ${displayClosingDate}`}
                            </p>
                            {creationDate && (
                                <span className="text-[10px] text-slate-300 dark:text-gray-600 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {creationDate}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Greeks Display (Middle) */}
                    {structure.status === 'Active' && (
                        <div className="flex-1 flex justify-center gap-6">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Delta</span>
                                <span className="font-mono text-xs font-medium text-slate-700 dark:text-gray-300">{greeks.delta.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Gamma</span>
                                <span className="font-mono text-xs font-medium text-slate-700 dark:text-gray-300">{greeks.gamma.toFixed(3)}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Theta</span>
                                <span className={`font-mono text-xs font-medium ${greeks.theta >= 0 ? 'text-profit' : 'text-loss'}`}>{greeks.theta.toFixed(1)}</span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Vega</span>
                                <span className={`font-mono text-xs font-medium ${greeks.vega >= 0 ? 'text-profit' : 'text-loss'}`}>{greeks.vega.toFixed(1)}</span>
                            </div>
                        </div>
                    )}
                    {structure.status === 'Closed' && <div className="flex-1"></div>}

                    <div className="text-right w-1/4">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1">
                            {structure.status === 'Closed' ? 'P&L Realizzato' : 'P&L Stimato'}
                        </span>
                        <div className="flex flex-col items-end">
                            <span className={`font-mono text-base font-bold ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                €{pnl.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={`font-mono text-xs font-medium ${points >= 0 ? 'text-profit' : 'text-loss'}`}>
                                {points > 0 ? '+' : ''}{points.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StructureListView: React.FC = () => {
    const { structures, setCurrentView, marketData, setMarketData, deleteStructures, refreshDaxSpot, isLoadingSpot, isPriceDelayed, lastUpdate } = usePortfolioStore();
    const { settings } = useSettingsStore();
    const [activeTab, setActiveTab] = useState<'active' | 'closed'>('active');
    const [isBulkEditMode, setIsBulkEditMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // Sorting State
    const [sortMethod, setSortMethod] = useState<'date' | 'serial' | 'custom' | 'pnl'>('serial');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [customOrder, setCustomOrder] = useState<string[]>([]);

    const activeStructures = useMemo(() => structures.filter(s => s.status === 'Active'), [structures]);
    const closedStructures = useMemo(() => structures.filter(s => s.status === 'Closed'), [structures]);
    
    // Initialize custom order when structures load
    useEffect(() => {
        if (customOrder.length === 0 && structures.length > 0) {
            setCustomOrder(structures.map(s => s.id));
        }
    }, [structures.length]);

    const handleSortChange = (method: 'date' | 'serial' | 'pnl') => {
        if (sortMethod === method) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortMethod(method);
            setSortDirection('desc'); // Default to descending
        }
    };

    const displayedStructures = useMemo(() => {
        let baseList = activeTab === 'active' ? activeStructures : closedStructures;
        
        let sortedList = [...baseList];

        if (sortMethod === 'date') {
            sortedList.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA; // Newest first
            });
        } else if (sortMethod === 'serial') {
            sortedList.sort((a, b) => {
                const getSerial = (tag: string) => {
                    const match = tag.match(/(\d+)$/); // Match last digits
                    return match ? parseInt(match[1]) : -1;
                };
                return getSerial(b.tag) - getSerial(a.tag); // Descending serial
            });
        } else if (sortMethod === 'pnl') {
            sortedList.sort((a, b) => {
                const pnlA = calculateUnrealizedPnlForStructure(a, marketData);
                const pnlB = calculateUnrealizedPnlForStructure(b, marketData);
                return pnlA - pnlB;
            });
        } else if (sortMethod === 'custom') {
            // Custom order
            if (customOrder.length === 0) return baseList;
            return [...baseList].sort((a, b) => {
                const indexA = customOrder.indexOf(a.id);
                const indexB = customOrder.indexOf(b.id);
                // If not found in custom order (new items), put them at the top
                if (indexA === -1) return -1;
                if (indexB === -1) return 1;
                return indexA - indexB;
            });
        }

        // Apply direction (except for custom sort which is manual)
        if (sortMethod !== 'custom' && sortDirection === 'desc') {
            // For serial, desc is default (highest first). If asc, we reverse.
            // But wait, my logic above for serial is b - a (desc).
            // If sortDirection is 'asc', I should reverse.
            // However, the logic `if (sortDirection === 'desc') sortedList.reverse()` assumes the base sort was ASC.
            // Let's fix the base sorts to be ASC, then reverse if DESC.
            // Date: dateB - dateA is DESC.
            // Serial: b - a is DESC.
            // PnL: A - B is ASC.
            
            // Let's standardize base sort to ASC.
            // Date: A - B
            // Serial: A - B
            // PnL: A - B
            
            // But I don't want to rewrite the logic above too much.
            // Let's just handle the reversal correctly.
            // If current logic is DESC, and I want DESC, do nothing?
            // No, the previous logic was:
            // if (sortMethod !== 'custom' && sortDirection === 'desc') sortedList.reverse();
            // This implies the base sorts were ASC.
            // Date: dateB - dateA is DESC. So if I reverse, it becomes ASC.
            // So if sortDirection is 'desc', I should NOT reverse if the base is DESC?
            // This is confusing. Let's fix the base sorts to be consistent.
        }
        
        // Let's rewrite the sort logic cleanly
        if (sortMethod === 'custom') {
             if (customOrder.length === 0) return baseList;
            return [...baseList].sort((a, b) => {
                const indexA = customOrder.indexOf(a.id);
                const indexB = customOrder.indexOf(b.id);
                if (indexA === -1) return -1;
                if (indexB === -1) return 1;
                return indexA - indexB;
            });
        }

        sortedList.sort((a, b) => {
            let comparison = 0;
            if (sortMethod === 'date') {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                comparison = dateA - dateB;
            } else if (sortMethod === 'serial') {
                const getSerial = (tag: string) => {
                    const match = tag.match(/(\d+)$/);
                    return match ? parseInt(match[1]) : -1;
                };
                comparison = getSerial(a.tag) - getSerial(b.tag);
            } else if (sortMethod === 'pnl') {
                const pnlA = calculateUnrealizedPnlForStructure(a, marketData);
                const pnlB = calculateUnrealizedPnlForStructure(b, marketData);
                comparison = pnlA - pnlB;
            }
            
            return sortDirection === 'asc' ? comparison : -comparison;
        });

        return sortedList;
    }, [activeTab, activeStructures, closedStructures, sortMethod, customOrder, sortDirection, marketData]);

    // Drag & Drop Sensors
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        
        if (active.id !== over?.id) {
            setCustomOrder((items) => {
                // Ensure we have all current IDs in the custom order list to avoid losing items
                const allIds = structures.map(s => s.id);
                const currentItems = items.length > 0 ? items : allIds;
                
                // If items are missing from currentItems (newly added), append them
                const missingIds = allIds.filter(id => !currentItems.includes(id));
                const fullList = [...currentItems, ...missingIds];

                const oldIndex = fullList.indexOf(active.id as string);
                const newIndex = fullList.indexOf(over?.id as string);
                
                return arrayMove(fullList, oldIndex, newIndex);
            });
            
            // Automatically switch to custom sort if dragging
            if (sortMethod !== 'custom') {
                setSortMethod('custom');
            }
        }
    };

    // Reset bulk mode when switching tabs
    useEffect(() => {
        setIsBulkEditMode(false);
        setSelectedIds(new Set());
    }, [activeTab]);

    const handleSelectAll = useCallback(() => {
        if (selectedIds.size === displayedStructures.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(displayedStructures.map(s => s.id)));
        }
    }, [selectedIds, displayedStructures]);

    const handleDeleteClick = useCallback(() => {
        if (selectedIds.size === 0) return;
        setShowDeleteConfirm(true);
    }, [selectedIds]);

    const confirmDelete = useCallback(async () => {
        try {
            await deleteStructures(Array.from(selectedIds));
            setSelectedIds(new Set());
            setIsBulkEditMode(false);
            setShowDeleteConfirm(false);
        } catch (error: any) {
            console.error("Errore durante l'eliminazione:", error);
        }
    }, [selectedIds, deleteStructures]);

    const totalPortfolioGreeks = useMemo(() => {
        const initialGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0, thetaPoints: 0, vegaPoints: 0 };
        return activeStructures.reduce((acc, structure) => {
            const structureGreeks = calculateTotalGreeks(structure, marketData);
            acc.delta += structureGreeks.delta;
            acc.gamma += structureGreeks.gamma;
            acc.theta += structureGreeks.theta * structure.multiplier;
            acc.vega += structureGreeks.vega * structure.multiplier;
            acc.thetaPoints += structureGreeks.theta;
            acc.vegaPoints += structureGreeks.vega;
            return acc;
        }, initialGreeks);
    }, [activeStructures, marketData]);
    
    const totalPortfolioPnlInfo = useMemo(() => {
        return activeStructures.reduce((acc, structure) => {
            const info = calculatePnlInfoForStructure(structure, marketData);
            return {
                netPnl: acc.netPnl + info.netPnl,
                totalPoints: acc.totalPoints + info.totalPoints
            };
        }, { netPnl: 0, totalPoints: 0 });
    }, [activeStructures, marketData]);

    const handleSelect = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);
    
    return (
        <div className={`max-w-5xl mx-auto space-y-6 ${isBulkEditMode && selectedIds.size > 0 ? 'pb-24' : ''}`}>
             
            {activeTab === 'active' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 p-6 shadow-sm">
                    {/* ... (Keep existing Header content) ... */}
                    <div className="flex flex-wrap gap-y-4 justify-between items-center mb-6">
                        <div className="flex items-center space-x-3">
                            <div className="text-slate-600 dark:text-gray-200"><PortfolioIcon /></div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Live Portafoglio Attivo</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="text-right">
                                <div className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">Spot DAX</div>
                                <div className="text-xs font-mono font-bold text-slate-500 dark:text-gray-400">
                                    {lastUpdate ? lastUpdate.toLocaleTimeString('it-IT') : '--:--'}
                                </div>
                            </div>
                            <div className={`flex items-center bg-slate-50 dark:bg-gray-900 border ${isPriceDelayed ? 'border-warning/50' : 'border-slate-200 dark:border-gray-700'} rounded-lg h-9 overflow-hidden`}>
                                <input
                                    type="number"
                                    value={marketData.daxSpot}
                                    onChange={(e) => setMarketData({ daxSpot: parseFloat(e.target.value) || 0 })}
                                    className="bg-transparent w-24 px-3 text-center text-slate-900 dark:text-white font-mono focus:outline-none text-sm"
                                    step="0.01"
                                />
                                <button onClick={refreshDaxSpot} disabled={isLoadingSpot} className="px-3 text-accent border-l border-slate-200 dark:border-gray-700 hover:bg-slate-100 dark:hover:bg-gray-700 transition">
                                    <div className={isLoadingSpot ? "animate-spin" : ""}><CloudDownloadIcon /></div>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { 
                                label: 'P/L Aperto', 
                                val: (
                                    <div className="flex flex-col">
                                        <span>€{totalPortfolioPnlInfo.netPnl.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        <span className="text-xs opacity-80">{totalPortfolioPnlInfo.totalPoints > 0 ? '+' : ''}{totalPortfolioPnlInfo.totalPoints.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pts</span>
                                    </div>
                                ), 
                                color: totalPortfolioPnlInfo.netPnl >= 0 ? 'text-profit' : 'text-loss' 
                            },
                            { label: 'Delta (Δ)', val: totalPortfolioGreeks.delta.toFixed(2), color: 'text-slate-900 dark:text-white' },
                            { label: 'Gamma (Γ)', val: totalPortfolioGreeks.gamma.toFixed(3), color: 'text-slate-900 dark:text-white' },
                            { 
                                label: 'Theta (Θ)', 
                                val: (
                                    <div className="flex flex-col">
                                        <span>€{totalPortfolioGreeks.theta.toFixed(2)}</span>
                                        <span className="text-xs opacity-80">{totalPortfolioGreeks.thetaPoints.toFixed(2)} pts</span>
                                    </div>
                                ),
                                color: totalPortfolioGreeks.theta >= 0 ? 'text-profit' : 'text-loss' 
                            },
                            { 
                                label: 'Vega (ν)', 
                                val: (
                                    <div className="flex flex-col">
                                        <span>€{totalPortfolioGreeks.vega.toFixed(2)}</span>
                                        <span className="text-xs opacity-80">{totalPortfolioGreeks.vegaPoints.toFixed(2)} pts</span>
                                    </div>
                                ),
                                color: totalPortfolioGreeks.vega >= 0 ? 'text-profit' : 'text-loss' 
                            }
                        ].map((metric, i) => (
                            <div key={i} className="bg-slate-50 dark:bg-gray-900/50 p-4 rounded-xl border border-slate-200 dark:border-gray-700/50">
                                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-bold uppercase tracking-widest">{metric.label}</span>
                                <div className={`font-mono text-base font-bold mt-1 ${metric.color}`}>{metric.val}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex bg-white dark:bg-gray-800 rounded-xl p-1 border border-slate-200 dark:border-gray-700 shadow-sm w-full md:w-fit">
                <button 
                    onClick={() => setActiveTab('active')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center space-x-2 ${activeTab === 'active' ? 'bg-accent text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700'}`}
                >
                    <PortfolioIcon className="w-4 h-4" />
                    <span>Strutture Attive ({activeStructures.length})</span>
                </button>
                <button 
                    onClick={() => setActiveTab('closed')}
                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center space-x-2 ${activeTab === 'closed' ? 'bg-accent text-white shadow-md' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-gray-700'}`}
                >
                    <ArchiveIcon className="w-4 h-4" />
                    <span>Strutture Chiuse ({closedStructures.length})</span>
                </button>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200 dark:border-gray-700 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-gray-800/50">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                            {isBulkEditMode && (
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.size === displayedStructures.length && displayedStructures.length > 0}
                                    onChange={handleSelectAll}
                                    className="w-5 h-5 rounded text-accent focus:ring-accent cursor-pointer"
                                />
                            )}
                            {activeTab === 'active' ? 'Strutture Attive' : 'Strutture Chiuse'}
                        </h2>
                        
                        {/* Sorting Controls */}
                        {!isBulkEditMode && (
                            <div className="flex items-center bg-white dark:bg-gray-700 rounded-lg p-1 border border-slate-200 dark:border-gray-600 gap-1">
                                <button 
                                    onClick={() => handleSortChange('serial')}
                                    className={`flex items-center gap-1 px-2 py-1.5 rounded-md transition text-xs font-medium ${sortMethod === 'serial' ? 'bg-slate-100 dark:bg-gray-600 text-accent' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Ordina per Seriale"
                                >
                                    <Hash className="w-3.5 h-3.5" />
                                    {sortMethod === 'serial' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                </button>
                                <button 
                                    onClick={() => handleSortChange('date')}
                                    className={`flex items-center gap-1 px-2 py-1.5 rounded-md transition text-xs font-medium ${sortMethod === 'date' ? 'bg-slate-100 dark:bg-gray-600 text-accent' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Ordina per Data"
                                >
                                    <Calendar className="w-3.5 h-3.5" />
                                    {sortMethod === 'date' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                </button>
                                <button 
                                    onClick={() => handleSortChange('pnl')}
                                    className={`flex items-center gap-1 px-2 py-1.5 rounded-md transition text-xs font-medium ${sortMethod === 'pnl' ? 'bg-slate-100 dark:bg-gray-600 text-accent' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Ordina per P&L"
                                >
                                    <Euro className="w-3.5 h-3.5" />
                                    {sortMethod === 'pnl' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                                </button>
                                <div className="w-px h-4 bg-slate-200 dark:bg-gray-600 mx-1"></div>
                                <button 
                                    onClick={() => setSortMethod('custom')}
                                    className={`flex items-center gap-1 px-2 py-1.5 rounded-md transition text-xs font-medium ${sortMethod === 'custom' ? 'bg-slate-100 dark:bg-gray-600 text-accent' : 'text-slate-400 hover:text-slate-600'}`}
                                    title="Ordine Personalizzato (Trascina)"
                                >
                                    <ListFilter className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center flex-wrap justify-end gap-3">
                        {isBulkEditMode && (
                            <>
                                <button 
                                    onClick={handleSelectAll}
                                    className="text-[10px] font-bold px-3 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 transition uppercase tracking-wider shadow-sm"
                                >
                                    {selectedIds.size === displayedStructures.length ? 'Deseleziona' : 'Seleziona Tutto'}
                                </button>
                                <button 
                                    onClick={handleDeleteClick}
                                    disabled={selectedIds.size === 0}
                                    className="text-[10px] font-bold px-3 py-2 rounded-lg bg-loss text-white hover:bg-loss/90 transition shadow-sm uppercase tracking-wider disabled:opacity-50 flex items-center space-x-1"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                    <span>Elimina ({selectedIds.size})</span>
                                </button>
                            </>
                        )}
                        <button 
                            onClick={() => {
                                setIsBulkEditMode(!isBulkEditMode);
                                if (isBulkEditMode) setSelectedIds(new Set());
                            }} 
                            className={`text-[10px] font-bold px-3 py-2 rounded-lg transition shadow-sm uppercase tracking-wider ${isBulkEditMode ? 'bg-slate-500 text-white' : 'bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20'}`}
                        >
                            {isBulkEditMode ? 'Annulla' : 'Gestisci'}
                        </button>
                        {!isBulkEditMode && activeTab === 'active' && (
                            <button onClick={() => setCurrentView('detail', 'new')} className="bg-accent hover:bg-accent/90 text-white text-[10px] font-bold px-3 py-2 rounded-lg flex items-center space-x-2 shadow-lg shadow-accent/20 transition uppercase tracking-wider">
                                <PlusIcon /><span>Nuova Strategia</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Custom Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-gray-700 animate-in zoom-in-95 duration-200">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Conferma Eliminazione</h3>
                            <p className="text-slate-600 dark:text-gray-300 mb-6">
                                Sei sicuro di voler eliminare definitivamente le <span className="font-bold text-slate-900 dark:text-white">{selectedIds.size}</span> strutture selezionate? 
                                <br/><span className="text-xs text-loss mt-1 block">Questa azione è irreversibile.</span>
                            </p>
                            <div className="flex justify-end space-x-3">
                                <button 
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition"
                                >
                                    Annulla
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    className="px-4 py-2 rounded-lg text-sm font-bold bg-loss text-white hover:bg-loss/90 shadow-lg shadow-loss/20 transition flex items-center space-x-2"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    <span>Elimina Definitivamente</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="divide-y divide-slate-100 dark:divide-gray-700">
                    <DndContext 
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext 
                            items={displayedStructures.map(s => s.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {displayedStructures.length > 0 ? (
                                displayedStructures.map(structure => (
                                    <SortableStructureItem
                                        key={structure.id}
                                        structure={structure}
                                        marketData={marketData}
                                        isBulkEditMode={isBulkEditMode}
                                        isSelected={selectedIds.has(structure.id)}
                                        onSelect={handleSelect}
                                        onView={(id) => setCurrentView('detail', id)}
                                        isDragEnabled={sortMethod === 'custom' && !isBulkEditMode}
                                    />
                                ))
                            ) : (
                                <div className="p-16 text-center space-y-4">
                                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-50 dark:bg-gray-900 text-slate-300">
                                        <PortfolioIcon className="w-10 h-10" />
                                    </div>
                                    <p className="text-slate-500 dark:text-gray-400 font-medium">Nessuna struttura {activeTab === 'active' ? 'attiva' : 'chiusa'} presente.</p>
                                </div>
                            )}
                        </SortableContext>
                    </DndContext>
                </div>
            </div>
        </div>
    );
};

export default StructureListView;
