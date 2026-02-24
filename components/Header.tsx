import React from 'react';
import usePortfolioStore from '../store/portfolioStore';
import { SunIcon, MoonIcon, LogoIcon } from './icons';

interface HeaderProps {
    onMenuToggle: () => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle, theme, onToggleTheme }) => {
    const { currentView } = usePortfolioStore();

    const getViewTitle = () => {
        switch (currentView) {
            case 'list': return 'Portafoglio';
            case 'analysis': return 'Analisi';
            case 'settings': return 'Impostazioni';
            case 'detail': return 'Dettaglio Struttura';
            default: return 'Option DAX';
        }
    };

    return (
        <header className="bg-white dark:bg-gray-800 border-b border-slate-200 dark:border-gray-700 h-16 flex items-center justify-between px-4 sticky top-0 z-20 lg:hidden">
            <div className="flex items-center">
                <button 
                    onClick={onMenuToggle}
                    className="p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white"
                    aria-label="Apri menu"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                    </svg>
                </button>
                <h1 className="ml-2 text-lg font-bold text-slate-900 dark:text-white">{getViewTitle()}</h1>
            </div>
            
            <div className="flex items-center space-x-3">
                <button 
                    onClick={onToggleTheme}
                    className="p-2 text-slate-500 dark:text-gray-400"
                >
                    {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                </button>
                <LogoIcon className="h-8 w-8" />
            </div>
        </header>
    );
};

export default Header;