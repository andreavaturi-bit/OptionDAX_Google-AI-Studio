import { create } from 'zustand';
import { Settings } from '../types';
import { persist, createJSONStorage } from 'zustand/middleware'

interface SettingsState {
    settings: Settings;
    updateSettings: (newSettings: Partial<Settings>) => void;
}

const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            settings: {
                initialCapital: 10000,
                broker: 'Interactive Brokers',
                defaultMultiplier: 5,
                defaultOpeningCommission: 2,
                defaultClosingCommission: 2,
            },
            updateSettings: (newSettings) =>
                set((state) => ({
                    settings: { ...state.settings, ...newSettings },
                })),
        }),
        {
            name: 'option-dax-settings-storage', // unique name for localStorage key
            storage: createJSONStorage(() => localStorage),
        }
    )
);

export default useSettingsStore;