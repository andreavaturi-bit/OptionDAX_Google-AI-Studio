import React, { useState, useEffect } from 'react';
import useSettingsStore from '../store/settingsStore';
import usePortfolioStore from '../store/portfolioStore';
import { Settings } from '../types';

const SettingsView: React.FC = () => {
    const { settings, updateSettings } = useSettingsStore();
    const { setCurrentView } = usePortfolioStore();
    const [localSettings, setLocalSettings] = useState<Settings>(settings);
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['initialCapital', 'defaultOpeningCommission', 'defaultClosingCommission', 'defaultMultiplier'].includes(name);
        setLocalSettings(prev => ({
            ...prev,
            [name]: isNumeric ? parseFloat(value) || 0 : value,
        }));
    };

    const handleSave = () => {
        updateSettings(localSettings);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const labelClass = "block text-sm font-medium text-slate-500 dark:text-gray-400";
    const inputClass = "mt-1 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-md px-3 py-2 w-full text-slate-900 dark:text-white focus:ring-2 focus:ring-accent focus:border-accent outline-none transition-colors";

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <button onClick={() => setCurrentView('list')} className="text-accent hover:underline mb-4 inline-block">
                &larr; Torna alla Lista
            </button>

            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Impostazioni Generali</h1>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="initialCapital" className={labelClass}>Capitale Iniziale (€)</label>
                        <input
                            type="number"
                            id="initialCapital"
                            name="initialCapital"
                            value={localSettings.initialCapital}
                            onChange={handleChange}
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="broker" className={labelClass}>Broker</label>
                        <select
                            id="broker"
                            name="broker"
                            value={localSettings.broker}
                            onChange={handleChange}
                            className={inputClass}
                        >
                            <option>AvaOptions</option>
                            <option>BGSaxo</option>
                            <option>Interactive Brokers</option>
                            <option>Webank</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="defaultMultiplier" className={labelClass}>Prodotto di Default</label>
                        <select
                            id="defaultMultiplier"
                            name="defaultMultiplier"
                            value={localSettings.defaultMultiplier}
                            onChange={handleChange}
                            className={inputClass}
                        >
                            <option value="5">Indice (5€/punto)</option>
                            <option value="1">CFD (1€/punto)</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="defaultOpeningCommission" className={labelClass}>Commissione di Apertura Default (per contratto)</label>
                        <input
                            type="number"
                            id="defaultOpeningCommission"
                            name="defaultOpeningCommission"
                            step="0.01"
                            value={localSettings.defaultOpeningCommission}
                            onChange={handleChange}
                            className={inputClass}
                        />
                    </div>
                     <div>
                        <label htmlFor="defaultClosingCommission" className={labelClass}>Commissione di Chiusura Default (per contratto)</label>
                        <input
                            type="number"
                            id="defaultClosingCommission"
                            name="defaultClosingCommission"
                            step="0.01"
                            value={localSettings.defaultClosingCommission}
                            onChange={handleChange}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-end">
                    {isSaved && <span className="text-sm text-profit mr-4">Impostazioni salvate!</span>}
                    <button
                        onClick={handleSave}
                        className="bg-accent hover:bg-accent/80 text-white font-bold py-2 px-6 rounded-md transition shadow-lg shadow-accent/20"
                    >
                        Salva Modifiche
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;