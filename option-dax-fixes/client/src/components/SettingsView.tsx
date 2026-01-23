import React, { useState, useEffect } from 'react';
import useSettingsStore from '../store/settingsStore';
import { Settings } from '../types';

interface SettingsViewProps {
    setCurrentView: (view: 'dashboard' | 'payoff' | 'greeks' | 'history' | 'settings' | 'detail' | 'analysis' | 'public' | 'test', structureId?: number | 'new' | null) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ setCurrentView }) => {
    const { settings, updateSettings } = useSettingsStore();
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

    // Classi comuni per input e select
    const inputClasses = "mt-1 w-full px-3 py-2 rounded-md border outline-none transition-colors " +
        "bg-white dark:bg-gray-800 " +
        "border-gray-300 dark:border-gray-600 " +
        "text-gray-900 dark:text-white " +
        "focus:ring-2 focus:ring-sky-500 focus:border-sky-500";

    const labelClasses = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Impostazioni Generali</h1>

                <div className="space-y-5">
                    <div>
                        <label htmlFor="initialCapital" className={labelClasses}>
                            Capitale Iniziale (&euro;)
                        </label>
                        <input
                            type="number"
                            id="initialCapital"
                            name="initialCapital"
                            value={localSettings.initialCapital}
                            onChange={handleChange}
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label htmlFor="broker" className={labelClasses}>
                            Broker
                        </label>
                        <select
                            id="broker"
                            name="broker"
                            value={localSettings.broker}
                            onChange={handleChange}
                            className={inputClasses}
                        >
                            <option>AvaOptions</option>
                            <option>BGSaxo</option>
                            <option>Interactive Brokers</option>
                            <option>Webank</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="defaultMultiplier" className={labelClasses}>
                            Prodotto di Default
                        </label>
                        <select
                            id="defaultMultiplier"
                            name="defaultMultiplier"
                            value={localSettings.defaultMultiplier}
                            onChange={handleChange}
                            className={inputClasses}
                        >
                            <option value="5">Indice (5&euro;/punto)</option>
                            <option value="1">CFD (1&euro;/punto)</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="defaultOpeningCommission" className={labelClasses}>
                            Commissione di Apertura Default (per contratto)
                        </label>
                        <input
                            type="number"
                            id="defaultOpeningCommission"
                            name="defaultOpeningCommission"
                            step="0.01"
                            value={localSettings.defaultOpeningCommission}
                            onChange={handleChange}
                            className={inputClasses}
                        />
                    </div>

                    <div>
                        <label htmlFor="defaultClosingCommission" className={labelClasses}>
                            Commissione di Chiusura Default (per contratto)
                        </label>
                        <input
                            type="number"
                            id="defaultClosingCommission"
                            name="defaultClosingCommission"
                            step="0.01"
                            value={localSettings.defaultClosingCommission}
                            onChange={handleChange}
                            className={inputClasses}
                        />
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end">
                    {isSaved && (
                        <span className="text-sm text-green-600 dark:text-green-400 mr-4">
                            Impostazioni salvate!
                        </span>
                    )}
                    <button
                        onClick={handleSave}
                        className="bg-sky-500 hover:bg-sky-600 text-white font-bold py-2 px-6 rounded-md transition-colors"
                    >
                        Salva Modifiche
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
