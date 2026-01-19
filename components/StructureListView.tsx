
import React, { useState, useMemo, useCallback } from 'react';
import usePortfolioStore from '../store/portfolioStore';
import { Structure, MarketData, CalculatedGreeks, Settings } from '../types';
import { BlackScholes, getTimeToExpiry } from '../services/blackScholes';
import { PlusIcon, ArchiveIcon, ScanIcon, PortfolioIcon, UploadIcon, EditIcon, TrashIcon } from './icons';
import ImageAnalysisModal from './ImageAnalysisModal';
import HistoricalImportModal from './HistoricalImportModal';
import useSettingsStore from '../store/settingsStore';


// This function now calculates all Greeks in their "points" or standard format.
// Monetization is handled separately in the component's render method.
const calculateTotalGreeks = (structure: Structure, marketData: MarketData): CalculatedGreeks => {
    const initialGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };
    if (!structure.legs || structure.legs.length === 0) return initialGreeks;

    return structure.legs.reduce((acc, leg) => {
        const timeToExpiry = getTimeToExpiry(leg.expiryDate);
        const bs = new BlackScholes(marketData.daxSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
        const greeks = leg.optionType === 'Call' ? bs.callGreeks() : bs.putGreeks();
        
        acc.delta += greeks.delta * leg.quantity;
        acc.gamma += greeks.gamma * leg.quantity;
        acc.theta += greeks.theta * leg.quantity; // Now in points
        acc.vega += greeks.vega * leg.quantity;   // Now in points
        
        return acc;
    }, initialGreeks);
};

const calculateNetPremium = (structure: Structure): number => {
    if (!structure.legs || structure.legs.length === 0) return 0;
    const totalPremium = structure.legs.reduce((acc, leg) => {
        // A positive quantity (long position) means a debit (cost).
        // A negative quantity (short position) means a credit (income).
        // The algebraic sum gives a positive value for net debit and negative for net credit.
        return acc + (leg.tradePrice * leg.quantity);
    }, 0);
    // The value is shown in index points, so the contract multiplier is not applied here.
    return totalPremium;
};

const calculateUnrealizedPnlForStructure = (structure: Structure, marketData: MarketData, settings: Settings): number => {
    if (structure.status !== 'Active') {
        return 0;
    }

    const totalNetPnl = structure.legs.reduce((acc, leg) => {
        const timeToExpiry = getTimeToExpiry(leg.expiryDate);
        let currentPrice = 0;
        if (timeToExpiry > 0) {
            const bs = new BlackScholes(marketData.daxSpot, leg.strike, timeToExpiry, marketData.riskFreeRate, leg.impliedVolatility);
            currentPrice = leg.optionType === 'Call' ? bs.callPrice() : bs.putPrice();
        } else {
            currentPrice = leg.optionType === 'Call'
                ? Math.max(0, marketData.daxSpot - leg.strike)
                : Math.max(0, leg.strike - marketData.daxSpot);
        }

        let pnlPoints = 0;
        if (leg.quantity > 0) { // Long
            pnlPoints = (currentPrice - leg.tradePrice) * leg.quantity;
        } else { // Short
            pnlPoints = (leg.tradePrice - currentPrice) * Math.abs(leg.quantity);
        }

        const grossPnl = pnlPoints * structure.multiplier;
        const openingCommission = (leg.openingCommission ?? settings.defaultOpeningCommission) * Math.abs(leg.quantity);
        const closingCommission = (leg.closingCommission ?? settings.defaultClosingCommission) * Math.abs(leg.quantity);
        const netPnl = grossPnl - openingCommission - closingCommission;
        
        return acc + netPnl;
    }, 0);

    return totalNetPnl;
};


const StructureListView: React.FC = () => {
    const { structures, setCurrentView, marketData, setMarketData, deleteStructures } = usePortfolioStore();
    const { settings } = useSettingsStore();
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isBulkEditMode, setIsBulkEditMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const activeStructures = structures.filter(s => s.status === 'Active');
    const closedStructures = structures.filter(s => s.status === 'Closed');

    const totalPortfolioGreeks = useMemo(() => {
        const initialGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0 };

        if (activeStructures.length === 0) {
            return initialGreeks;
        }

        return activeStructures.reduce((acc, structure) => {
            const structureGreeks = calculateTotalGreeks(structure, marketData);
            acc.delta += structureGreeks.delta;
            acc.gamma += structureGreeks.gamma;
            acc.theta += structureGreeks.theta * structure.multiplier; // Monetize here
            acc.vega += structureGreeks.vega * structure.multiplier;   // Monetize here
            return acc;
        }, initialGreeks);

    }, [activeStructures, marketData]);
    
    const totalPortfolioUnrealizedPnl = useMemo(() => {
        return activeStructures.reduce((acc, structure) => {
            return acc + calculateUnrealizedPnlForStructure(structure, marketData, settings);
        }, 0);
    }, [activeStructures, marketData, settings]);

    const handleSelect = useCallback((id: number) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.checked) {
            setSelectedIds(new Set(closedStructures.map(s => s.id)));
        } else {
            setSelectedIds(new Set());
        }
    }, [closedStructures]);
    
    const handleSpotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMarketData({ daxSpot: value === '' ? 0 : parseFloat(value) });
    };

    const handleSpotStep = (amount: number) => {
        setMarketData({ daxSpot: parseFloat((marketData.daxSpot + amount).toFixed(2)) });
    };


    return (
        <>
            <ImageAnalysisModal
                isOpen={isAnalysisModalOpen}
                onClose={() => setIsAnalysisModalOpen(false)}
            />
            <HistoricalImportModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
            />
            <div className={`max-w-4xl mx-auto space-y-8 ${isBulkEditMode && selectedIds.size > 0 ? 'pb-24' : ''}`}>

                 <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex flex-wrap gap-y-3 justify-between items-center mb-4">
                        <div className="flex items-center space-x-3">
                            <PortfolioIcon />
                            <h1 className="text-2xl font-bold text-white">Analisi di Portafoglio</h1>
                        </div>
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
                                <button onClick={() => handleSpotStep(10)} className="px-2 py-1 text-gray-300 hover:bg-gray-600 rounded-r-md font-mono">+10</button>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-700 p-4 rounded-md grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                         <div>
                            <span className="text-sm text-gray-400">P/L Aperto Totale</span>
                            <p className={`font-mono text-lg md:text-xl font-bold ${totalPortfolioUnrealizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                €{totalPortfolioUnrealizedPnl.toFixed(2)}
                            </p>
                        </div>
                        <div>
                            <span className="text-sm text-gray-400">Δ Delta Totale</span>
                            <p className="font-mono text-lg md:text-xl font-bold text-white">{totalPortfolioGreeks.delta.toFixed(2)}</p>
                        </div>
                        <div>
                            <span className="text-sm text-gray-400">Γ Gamma Totale</span>
                            <p className="font-mono text-lg md:text-xl font-bold text-white">{totalPortfolioGreeks.gamma.toFixed(3)}</p>
                        </div>
                        <div>
                            <span className="text-sm text-gray-400">Θ Theta Totale</span>
                            <p className={`font-mono text-lg md:text-xl font-bold ${totalPortfolioGreeks.theta >= 0 ? 'text-profit' : 'text-loss'}`}>€{totalPortfolioGreeks.theta.toFixed(2)}</p>
                        </div>
                        <div>
                            <span className="text-sm text-gray-400">ν Vega Totale</span>
                             <p className={`font-mono text-lg md:text-xl font-bold ${totalPortfolioGreeks.vega >= 0 ? 'text-profit' : 'text-loss'}`}>€{totalPortfolioGreeks.vega.toFixed(2)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex flex-wrap gap-y-3 justify-between items-center mb-4">
                        <h1 className="text-2xl font-bold text-white">Strutture Attive</h1>
                        <div className="flex items-center space-x-2">
                             <button 
                                onClick={() => setIsHistoryModalOpen(true)}
                                className="flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-semibold p-2 md:py-2 md:px-3 rounded-md transition"
                                title="Importa Storico da Immagini"
                            >
                                <UploadIcon />
                                <span className="hidden md:inline ml-2">Importa Storico</span>
                            </button>
                             <button 
                                onClick={() => setIsAnalysisModalOpen(true)}
                                className="flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white font-semibold p-2 md:py-2 md:px-3 rounded-md transition"
                                title="Carica Screenshot di un Trade"
                            >
                                <ScanIcon />
                                <span className="hidden md:inline ml-2">Carica Screenshot</span>
                            </button>
                            <button 
                                onClick={() => setCurrentView('detail', 'new')}
                                className="flex items-center justify-center bg-accent/80 hover:bg-accent text-white font-semibold p-2 md:py-2 md:px-3 rounded-md transition"
                                title="Crea Nuova Struttura"
                            >
                                <PlusIcon />
                                <span className="hidden md:inline ml-2">Crea Nuova</span>
                            </button>
                        </div>
                    </div>
                    <div className="space-y-3">
                        {activeStructures.length > 0 ? (
                            activeStructures.map(structure => {
                                const totalGreeks = calculateTotalGreeks(structure, marketData);
                                const netPremium = calculateNetPremium(structure);
                                const unrealizedPnl = calculateUnrealizedPnlForStructure(structure, marketData, settings);
                                return (
                                    <div 
                                        key={structure.id} 
                                        className="bg-gray-700 p-3 rounded-md cursor-pointer hover:bg-gray-600/70 transition flex flex-col sm:flex-row sm:justify-between sm:items-center"
                                        onClick={() => setCurrentView('detail', structure.id)}
                                    >
                                        <div className="flex-shrink-0 mb-3 sm:mb-0 w-full sm:w-auto">
                                            <h2 className="font-bold text-lg text-white">{structure.tag}</h2>
                                            <p className="text-sm text-gray-400">{structure.legs.length} gamba/e</p>
                                        </div>
                                        <div className="w-full sm:w-auto grid grid-cols-3 gap-x-4 gap-y-2 sm:flex sm:space-x-4 font-mono text-sm text-left sm:text-right">
                                            <div>
                                                <span className="text-xs text-gray-400">P/L Aperto</span>
                                                <p className={`font-bold ${unrealizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                                    €{unrealizedPnl.toFixed(2)}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400">PDC</span>
                                                <p className={netPremium > 0 ? 'text-loss' : 'text-profit'}>
                                                    {netPremium.toFixed(2)}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400">Δ Delta</span>
                                                <p className="text-white">{totalGreeks.delta.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400">Γ Gamma</span>
                                                <p className="text-white">{totalGreeks.gamma.toFixed(3)}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400">Θ Theta</span>
                                                <p className="text-white">€{(totalGreeks.theta * structure.multiplier).toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400">ν Vega</span>
                                                <p className="text-white">€{(totalGreeks.vega * structure.multiplier).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-gray-400">Nessuna struttura attiva trovata.</p>
                                <p className="text-gray-500 text-sm">Clicca su "Crea Nuova Struttura" per iniziare.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-3">
                            <ArchiveIcon />
                            <h1 className="text-2xl font-bold text-white">Strutture Chiuse</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            {isBulkEditMode && (
                                <div className="flex items-center space-x-2">
                                    <input
                                        id="select-all-closed"
                                        type="checkbox"
                                        className="h-5 w-5 bg-gray-600 border-gray-500 text-accent focus:ring-accent rounded cursor-pointer"
                                        checked={closedStructures.length > 0 && selectedIds.size === closedStructures.length}
                                        onChange={handleSelectAll}
                                    />
                                    <label htmlFor="select-all-closed" className="text-sm text-gray-300 cursor-pointer">Seleziona tutti</label>
                                </div>
                            )}
                            {closedStructures.length > 0 && (
                                <button
                                    onClick={() => {
                                        setIsBulkEditMode(!isBulkEditMode);
                                        setSelectedIds(new Set()); // Reset selection on toggle
                                    }}
                                    className="flex items-center space-x-2 text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-3 rounded-md transition"
                                >
                                    {isBulkEditMode ? <span>Annulla</span> : <><EditIcon /><span>Modifica</span></>}
                                </button>
                            )}
                        </div>
                    </div>
                     <div className="space-y-3">
                        {closedStructures.length > 0 ? (
                            closedStructures.map(structure => {
                                const isSelected = selectedIds.has(structure.id);
                                return (
                                    <div
                                        key={structure.id}
                                        className={`rounded-md flex items-center transition cursor-pointer ${isBulkEditMode ? (isSelected ? 'bg-accent/20 border border-accent/50' : 'bg-gray-700 hover:bg-gray-600/70') : 'bg-gray-700/50 hover:bg-gray-600/70'}`}
                                        onClick={() => {
                                            if (isBulkEditMode) {
                                                handleSelect(structure.id);
                                            } else {
                                                setCurrentView('detail', structure.id);
                                            }
                                        }}
                                    >
                                        {isBulkEditMode && (
                                            <div className="px-4 py-4 flex-shrink-0">
                                                <input
                                                    type="checkbox"
                                                    className="h-5 w-5 bg-gray-600 border-gray-500 text-accent focus:ring-accent rounded cursor-pointer"
                                                    checked={isSelected}
                                                    onChange={() => handleSelect(structure.id)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                        )}
                                        <div className={`flex justify-between items-center w-full ${isBulkEditMode ? 'py-4 pr-4' : 'p-4'}`}>
                                            <div>
                                                <h2 className="font-semibold text-lg text-gray-300">{structure.tag}</h2>
                                                <p className="text-sm text-gray-400">Chiusa il: {structure.closingDate}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`font-mono font-bold text-lg ${structure.realizedPnl && structure.realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                                    {structure.realizedPnl?.toFixed(2) ?? 'N/A'} €
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-10">
                                <p className="text-gray-400">Nessuna struttura chiusa.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isBulkEditMode && selectedIds.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-sm border-t border-gray-700 p-4 z-40 transition-transform duration-300 ease-in-out">
                    <div className="max-w-4xl mx-auto flex justify-between items-center">
                        <span className="font-semibold text-white">{selectedIds.size} {selectedIds.size === 1 ? 'struttura selezionata' : 'strutture selezionate'}</span>
                        <button
                            onClick={() => {
                                if (selectedIds.size > 0 && window.confirm(`Sei sicuro di voler eliminare permanentemente ${selectedIds.size} strutture? L'azione è irreversibile.`)) {
                                    deleteStructures(Array.from(selectedIds));
                                    setIsBulkEditMode(false);
                                    setSelectedIds(new Set());
                                }
                            }}
                            className="flex items-center space-x-2 bg-loss hover:bg-loss/80 text-white font-bold py-2 px-4 rounded-md transition"
                        >
                            <TrashIcon />
                            <span>Elimina Selezionate</span>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default StructureListView;
