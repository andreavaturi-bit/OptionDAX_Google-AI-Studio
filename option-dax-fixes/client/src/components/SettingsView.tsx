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

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
                <h1 className="text-2xl font-bold text-foreground mb-6">Impostazioni Generali</h1>

                <div className="space-y-4">
                    <div>
                        <label htmlFor="initialCapital" className="block text-sm font-medium text-muted-foreground">Capitale Iniziale (&euro;)</label>
                        <input
                            type="number"
                            id="initialCapital"
                            name="initialCapital"
                            value={localSettings.initialCapital}
                            onChange={handleChange}
                            className="mt-1 bg-secondary border border-border rounded-md px-3 py-2 w-full text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                    </div>

                    <div>
                        <label htmlFor="broker" className="block text-sm font-medium text-muted-foreground">Broker</label>
                        <select
                            id="broker"
                            name="broker"
                            value={localSettings.broker}
                            onChange={handleChange}
                            className="mt-1 bg-secondary border border-border rounded-md px-3 py-2 w-full text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        >
                            <option>AvaOptions</option>
                            <option>BGSaxo</option>
                            <option>Interactive Brokers</option>
                            <option>Webank</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="defaultMultiplier" className="block text-sm font-medium text-muted-foreground">Prodotto di Default</label>
                        <select
                            id="defaultMultiplier"
                            name="defaultMultiplier"
                            value={localSettings.defaultMultiplier}
                            onChange={handleChange}
                            className="mt-1 bg-secondary border border-border rounded-md px-3 py-2 w-full text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        >
                            <option value="5">Indice (5&euro;/punto)</option>
                            <option value="1">CFD (1&euro;/punto)</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="defaultOpeningCommission" className="block text-sm font-medium text-muted-foreground">Commissione di Apertura Default (per contratto)</label>
                        <input
                            type="number"
                            id="defaultOpeningCommission"
                            name="defaultOpeningCommission"
                            step="0.01"
                            value={localSettings.defaultOpeningCommission}
                            onChange={handleChange}
                            className="mt-1 bg-secondary border border-border rounded-md px-3 py-2 w-full text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                    </div>
                     <div>
                        <label htmlFor="defaultClosingCommission" className="block text-sm font-medium text-muted-foreground">Commissione di Chiusura Default (per contratto)</label>
                        <input
                            type="number"
                            id="defaultClosingCommission"
                            name="defaultClosingCommission"
                            step="0.01"
                            value={localSettings.defaultClosingCommission}
                            onChange={handleChange}
                            className="mt-1 bg-secondary border border-border rounded-md px-3 py-2 w-full text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        />
                    </div>
                </div>

                <div className="mt-6 flex items-center justify-end">
                    {isSaved && <span className="text-sm text-green-600 dark:text-green-400 mr-4">Impostazioni salvate!</span>}
                    <button
                        onClick={handleSave}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2 px-4 rounded-md transition"
                    >
                        Salva Modifiche
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
