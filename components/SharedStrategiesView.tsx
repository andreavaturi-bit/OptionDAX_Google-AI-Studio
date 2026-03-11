import React, { useEffect, useState } from 'react';
import usePortfolioStore from '../store/portfolioStore';
import { Structure } from '../types';

const SharedStrategiesView: React.FC = () => {
    const { fetchSharedStructures, importStructure } = usePortfolioStore();
    const [sharedStructures, setSharedStructures] = useState<Structure[]>([]);
    const [loading, setLoading] = useState(false);
    const [importingId, setImportingId] = useState<string | null>(null);

    useEffect(() => {
        loadSharedStructures();
    }, []);

    const loadSharedStructures = async () => {
        setLoading(true);
        const data = await fetchSharedStructures();
        setSharedStructures(data);
        setLoading(false);
    };

    const sortedStructures = React.useMemo(() => {
        return [...sharedStructures].sort((a, b) => {
            const getNumericValue = (tag: string) => {
                if (!tag) return 0;
                // Extract all digits from the string
                const digits = tag.replace(/\D/g, '');
                return digits ? parseInt(digits, 10) : 0;
            };
            
            const valA = getNumericValue(a.tag);
            const valB = getNumericValue(b.tag);
            
            // Sort by numeric value descending
            if (valA !== valB) {
                return valB - valA;
            }
            
            // Fallback to creation date (newest first)
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
    }, [sharedStructures]);

    const handleImport = async (id: string) => {
        if (window.confirm("Vuoi importare questa strategia nel tuo portafoglio?")) {
            setImportingId(id);
            try {
                await importStructure(id);
                // Redirect is handled in store (sets currentView to list)
            } catch (error) {
                alert("Errore durante l'importazione");
                setImportingId(null);
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Strategie Condivise</h1>
                <button 
                    onClick={loadSharedStructures} 
                    className="text-sm text-accent hover:underline"
                >
                    Aggiorna
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                </div>
            ) : sharedStructures.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-sm border border-slate-200 dark:border-gray-700">
                    <p className="text-slate-500 dark:text-gray-400">Nessuna strategia condivisa disponibile al momento.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedStructures.map(structure => (
                        <div key={structure.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden flex flex-col">
                            <div className="p-4 border-b border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-gray-700/50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 dark:text-white truncate" title={structure.tag}>
                                    {structure.tag}
                                </h3>
                                <span className={`text-[10px] px-2 py-1 rounded-full uppercase font-bold tracking-wider ${
                                    structure.status === 'Active' 
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                        : 'bg-slate-100 text-slate-600 dark:bg-gray-700 dark:text-gray-400'
                                }`}>
                                    {structure.status === 'Active' ? 'Attiva' : 'Chiusa'}
                                </span>
                            </div>
                            
                            <div className="p-4 flex-1">
                                <div className="space-y-2 text-sm text-slate-600 dark:text-gray-300">
                                    <div className="flex justify-between">
                                        <span>Data Creazione:</span>
                                        <span className="font-mono">{new Date(structure.createdAt || '').toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Gambe:</span>
                                        <span className="font-mono">{structure.legs.length}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Moltiplicatore:</span>
                                        <span className="font-mono">€{structure.multiplier}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-gray-700/30 border-t border-slate-100 dark:border-gray-700">
                                <button
                                    onClick={() => handleImport(structure.id)}
                                    disabled={importingId === structure.id}
                                    className="w-full py-2 bg-accent text-white rounded-lg font-bold text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 flex justify-center items-center"
                                >
                                    {importingId === structure.id ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                            Importazione...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            Importa nel Portafoglio
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SharedStrategiesView;
