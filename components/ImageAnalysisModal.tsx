
import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExtractedTrade, OptionLeg } from '../types';
import { analyzeImageForTrades } from '../services/geminiService';
import usePortfolioStore from '../store/portfolioStore';
import useSettingsStore from '../store/settingsStore';

interface ImageAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const fileToDataUrl = (file: File): Promise<{ data: string, mimeType: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                const [header, data] = reader.result.split(',');
                const mimeType = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
                resolve({ data, mimeType });
            } else {
                reject(new Error('Failed to read file as data URL.'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const ImageAnalysisModal: React.FC<ImageAnalysisModalProps> = ({ isOpen, onClose }) => {
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [extractedTrades, setExtractedTrades] = useState<ExtractedTrade[]>([]);
    const { addStructure, setCurrentView } = usePortfolioStore();

    useEffect(() => {
        // Cleanup function to revoke the object URL and prevent memory leaks
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const resetState = useCallback(() => {
        setImageFile(null);
        setPreviewUrl(null);
        setIsLoading(false);
        setError(null);
        setExtractedTrades([]);
    }, []);

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            resetState();
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };
    
    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const file = event.dataTransfer.files?.[0];
         if (file) {
            resetState();
            setImageFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleAnalyze = async () => {
        if (!imageFile) {
            setError('Per favore, seleziona un file immagine.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setExtractedTrades([]);

        try {
            const { data, mimeType } = await fileToDataUrl(imageFile);
            const trades = await analyzeImageForTrades(data, mimeType);
            setExtractedTrades(trades);
        } catch (err: any) {
            setError(err.message || 'Si è verificato un errore sconosciuto.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateStructure = () => {
        if (extractedTrades.length === 0) return;
        const { settings } = useSettingsStore.getState();

        const newLegs: Omit<OptionLeg, 'id'>[] = extractedTrades.map(trade => ({
            optionType: trade.optionType,
            strike: trade.strike,
            expiryDate: trade.expiryDate,
            openingDate: new Date().toISOString().split('T')[0], // Set opening date to today
            quantity: trade.tradeType === 'Buy' ? trade.quantity : -trade.quantity,
            tradePrice: trade.price,
            impliedVolatility: 15, // Default VI, user can change it
            closingPrice: null,
            closingDate: null,
            openingCommission: settings.defaultOpeningCommission,
            closingCommission: settings.defaultClosingCommission,
        }));

        const newStructure = {
            tag: `Importato da Immagine - ${new Date().toLocaleString()}`,
            legs: newLegs.map((leg, index) => ({ ...leg, id: index + 1 })),
            multiplier: 25 as const,
        };
        
        addStructure(newStructure);
        
        const newId = usePortfolioStore.getState().nextStructureId -1;
        setCurrentView('detail', newId);
        handleClose();
    };

    if (!isOpen) return null;

    const modalContent = (
         <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex items-center justify-center" onClick={handleClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Carica lo screenshot di un trade</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white text-2xl font-bold leading-none">&times;</button>
                </div>

                <div className="p-4 flex-grow overflow-y-auto space-y-4">
                     {!previewUrl && (
                        <div 
                            className="border-2 border-dashed border-gray-600 rounded-lg p-10 text-center cursor-pointer hover:border-accent hover:bg-gray-700/50"
                            onDrop={handleDrop}
                            onDragOver={e => e.preventDefault()}
                            onClick={() => document.getElementById('file-upload')?.click()}
                         >
                            <input id="file-upload" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                            <p className="text-gray-400">Trascina un'immagine qui o clicca per selezionare un file</p>
                        </div>
                    )}

                    {previewUrl && (
                        <div className="text-center">
                            <img src={previewUrl} alt="Anteprima" className="max-h-64 mx-auto rounded-md" />
                             <button onClick={() => { resetState() }} className="mt-2 text-sm text-accent hover:underline">
                                Cambia immagine
                            </button>
                        </div>
                    )}

                    {error && <div className="bg-loss/20 border border-loss text-loss p-3 rounded-md text-sm">{error}</div>}
                    
                    {isLoading && <div className="text-center text-gray-400">Analisi in corso...</div>}

                    {extractedTrades.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-2">Dati Estratti</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-2">Descrizione</th>
                                            <th className="px-4 py-2">Tipo</th>
                                            <th className="px-4 py-2 text-right">Scadenza</th>
                                            <th className="px-4 py-2 text-right">Prezzo</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono text-white">
                                        {extractedTrades.map((trade, index) => (
                                            <tr key={index} className="border-b border-gray-700">
                                                <td className="px-4 py-2 font-sans">{trade.quantity} {trade.tradeType} {trade.optionType} {trade.strike}</td>
                                                <td className={`px-4 py-2 font-semibold ${trade.tradeType === 'Buy' ? 'text-profit' : 'text-loss'}`}>{trade.tradeType}</td>
                                                <td className="px-4 py-2 text-right">{trade.expiryDate}</td>
                                                <td className="px-4 py-2 text-right">€{trade.price.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-700 flex justify-end space-x-2">
                    <button onClick={handleClose} className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-4 rounded-md">Annulla</button>
                    {extractedTrades.length > 0 ? (
                        <button onClick={handleCreateStructure} className="bg-profit hover:bg-profit/80 text-white font-bold py-2 px-4 rounded-md">
                            Crea Nuova Struttura
                        </button>
                    ) : (
                        <button onClick={handleAnalyze} disabled={!imageFile || isLoading} className="bg-accent hover:bg-accent/80 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                            Analizza
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
    
    const modalRoot = document.getElementById('modal-root');
    return modalRoot ? createPortal(modalContent, modalRoot) : null;
};

export default ImageAnalysisModal;