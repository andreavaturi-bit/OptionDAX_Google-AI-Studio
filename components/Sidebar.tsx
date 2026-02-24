
import React from 'react';
import usePortfolioStore from '../store/portfolioStore';
import useAuthStore from '../store/authStore';
import useUserStore from '../store/userStore';
import { PortfolioIcon, ChartBarIcon, SettingsIcon, SunIcon, MoonIcon, LogoFull, UsersIcon } from './icons';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    theme: 'light' | 'dark';
    onToggleTheme: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, theme, onToggleTheme }) => {
    const { currentView, setCurrentView } = usePortfolioStore();
    const { signOut, user } = useAuthStore();
    const { profile } = useUserStore();

    const navItems = [
        { id: 'list', label: 'Portafoglio', icon: <PortfolioIcon /> },
        { id: 'analysis', label: 'Analisi', icon: <ChartBarIcon /> },
        { id: 'settings', label: 'Impostazioni', icon: <SettingsIcon /> },
    ];

    if (profile?.role === 'admin') {
        navItems.push({ id: 'admin', label: 'Admin', icon: <UsersIcon /> });
    }

    const handleNavClick = (viewId: any) => {
        setCurrentView(viewId);
        onClose();
    };

    return (
        <>
            {isOpen && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden backdrop-blur-sm" onClick={onClose} />}

            <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="h-full flex flex-col">
                    <div className="h-16 flex items-center px-4 border-b border-slate-200 dark:border-gray-700">
                        <LogoFull className="h-8 w-auto" />
                    </div>

                    <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleNavClick(item.id)}
                                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${currentView === item.id ? 'bg-accent/10 text-accent' : 'text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700/50'}`}
                            >
                                <span className="mr-3">{item.icon}</span>
                                {item.label}
                                {currentView === item.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />}
                            </button>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-slate-200 dark:border-gray-700 space-y-4">
                        <div className="px-3 py-2">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Account</p>
                          <p className="text-xs font-mono text-slate-600 dark:text-gray-300 truncate" title={user?.email}>{user?.email}</p>
                        </div>
                        
                        <button onClick={onToggleTheme} className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-slate-500 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                            <span className="flex items-center">
                                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                                <span className="ml-3">{theme === 'light' ? 'Tema Scuro' : 'Tema Chiaro'}</span>
                            </span>
                        </button>

                        <button 
                            onClick={() => signOut()}
                            className="w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-loss hover:bg-loss/10 transition-colors"
                        >
                            <svg className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Disconnetti
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
