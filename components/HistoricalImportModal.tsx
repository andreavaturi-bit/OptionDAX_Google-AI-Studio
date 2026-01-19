import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HistoricalImportData } from '../types';
import { analyzeHistoryImage } from '../services/geminiService';
import usePortfolioStore from '../store/portfolioStore';

interface HistoricalImportModalProps {
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

const HistoricalImportModal: React.FC<HistoricalImportModalProps> = ({ isOpen, onClose }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [importedData, setImportedData] = useState<HistoricalImportData[]>([]);
    const { addHistoricalStructures } = usePortfolioStore();

    const resetState = useCallback(() => {
        setFiles([]);
        setIsLoading(false);
        setError(null);
        setProgress({ current: 0, total: 0 });
        setImportedData([]);
    }, []);

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(Array.from(event.target.files));
        }
    };

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer.files) {
            setFiles(Array.from(event.dataTransfer.files));
        }
    };

    const handleStartImport = async () => {
        if (files.length === 0) return;

        setIsLoading(true);
        setError(null);
        setImportedData([]);
        setProgress({ current: 0, total: files.length });

        const results: HistoricalImportData[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setProgress({ current: i + 1, total: files.length });
            try {
                const { data, mimeType } = await fileToDataUrl(file);
                const tradeData = await analyzeHistoryImage(data, mimeType);
                results.push(tradeData);
            } catch (err: any) {
                setError(`Errore durante l'analisi del file ${file.name}: ${err.message}. L'importazione è stata interrotta.`);
                setIsLoading(false);
                return;
            }
        }
        
        setImportedData(results);
        setIsLoading(false);
    };

    const handleConfirmImport = () => {
        if (importedData.length > 0) {
            addHistoricalStructures(importedData);
        }
        handleClose();
    };

    if (!isOpen) return null;

    const modalContent = (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-80 z-50 flex items-center justify-center" onClick={handleClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Importa Storico da Immagini</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white text-2xl font-bold leading-none">&times;</button>
                </div>
                
                <div className="p-4 flex-grow overflow-y-auto space-y-4">
                    {importedData.length === 0 && !isLoading && (
                         <div 
                            className="border-2 border-dashed border-gray-600 rounded-lg p-10 text-center cursor-pointer hover:border-accent hover:bg-gray-700/50"
                            onDrop={handleDrop}
                            onDragOver={e => e.preventDefault()}
                            onClick={() => document.getElementById('history-file-upload')?.click()}
                         >
                            <input id="history-file-upload" type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                            <p className="text-gray-400">Trascina le immagini qui o clicca per selezionare i file</p>
                            {files.length > 0 && <p className="text-sm text-gray-500 mt-2">{files.length} file selezionati.</p>}
                        </div>
                    )}
                    
                    {isLoading && (
                        <div className="text-center p-8">
                            <p className="text-lg text-white">Analisi in corso...</p>
                            <p className="text-gray-400">File {progress.current} di {progress.total}</p>
                            <div className="w-full bg-gray-700 rounded-full h-2.5 mt-4">
                                <div className="bg-accent h-2.5 rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                            </div>
                        </div>
                    )}
                    
                    {error && <div className="bg-loss/20 border border-loss text-loss p-3 rounded-md text-sm">{error}</div>}

                    {importedData.length > 0 && !isLoading && (
                        <div>
                            <h3 className="text-lg font-semibold text-profit mb-2">Analisi Completata</h3>
                            <p className="text-gray-400 mb-4">{importedData.length} strutture sono state estratte con successo e sono pronte per essere importate.</p>
                             <div className="overflow-y-auto max-h-64 border border-gray-700 rounded-md">
                                <table className="w-full text-sm text-left">
                                     <thead className="text-xs text-gray-400 uppercase bg-gray-900 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2">Tag Struttura</th>
                                            <th className="px-4 py-2">Data Chiusura</th>
                                            <th className="px-4 py-2 text-right">P&L Realizzato</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-mono text-white">
                                        {importedData.map((data, index) => (
                                            <tr key={index} className="border-b border-gray-700">
                                                <td className="px-4 py-2 font-sans">{data.tag}</td>
                                                <td className="px-4 py-2">{data.closingDate}</td>
                                                <td className={`px-4 py-2 text-right font-bold ${data.realizedPnl >= 0 ? 'text-profit' : 'text-loss'}`}>€{data.realizedPnl.toFixed(2)}</td>
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
                     {importedData.length > 0 ? (
                        <button onClick={handleConfirmImport} className="bg-profit hover:bg-profit/80 text-white font-bold py-2 px-4 rounded-md">
                            Conferma e Importa {importedData.length} Strutture
                        </button>
                     ) : (
                         <button onClick={handleStartImport} disabled={files.length === 0 || isLoading} className="bg-accent hover:bg-accent/80 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                            {isLoading ? 'Importazione...' : `Importa ${files.length} File`}
                        </button>
                     )}
                </div>
            </div>
        </div>
    );
    
    const modalRoot = document.getElementById('modal-root');
    return modalRoot ? createPortal(modalContent, modalRoot) : null;
};

export default HistoricalImportModal;
