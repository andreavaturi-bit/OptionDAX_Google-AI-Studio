
import React, { useState, useEffect } from 'react';
import usePortfolioStore from './store/portfolioStore';
import useAuthStore from './store/authStore';
import useUserStore from './store/userStore';
import StructureListView from './components/StructureListView';
import StructureDetailView from './components/StructureDetailView';
import SettingsView from './components/SettingsView';
import PortfolioAnalysis from './components/PortfolioAnalysis';
import AdminDashboard from './components/AdminDashboard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AuthView from './components/AuthView';

const App: React.FC = () => {
    const { currentView, currentStructureId, refreshDaxSpot, fetchStructures, isLoading } = usePortfolioStore();
    const { user, initialize, isLoading: authLoading } = useAuthStore();
    const { fetchProfile } = useUserStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showWelcome, setShowWelcome] = useState(false);
    
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const stored = localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });

    useEffect(() => {
        initialize();
        if (window.location.hash.includes('access_token')) {
            setShowWelcome(true);
            setTimeout(() => setShowWelcome(false), 5000);
        }
    }, []);

    useEffect(() => {
        if (user) {
            fetchProfile();
            fetchStructures();
            refreshDaxSpot();
            const intervalId = setInterval(refreshDaxSpot, 30000);
            return () => clearInterval(intervalId);
        }
    }, [user, fetchStructures, refreshDaxSpot, fetchProfile]);

    useEffect(() => {
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
        </div>
      );
    }

    if (!user) return <AuthView />;

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const renderView = () => {
        if (isLoading) return (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                <p className="text-slate-500 dark:text-gray-400 font-medium">Sincronizzazione dati cloud...</p>
            </div>
        );

        switch (currentView) {
            case 'list':
                return <StructureListView />;
            case 'detail':
                return <StructureDetailView structureId={currentStructureId} />;
            case 'settings':
                return <SettingsView />;
            case 'analysis':
                return <PortfolioAnalysis />;
            case 'admin':
                return <AdminDashboard />;
            default:
                return <StructureListView />;
        }
    }

    return (
        <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-gray-900">
            {showWelcome && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-white dark:bg-gray-800 border border-profit/30 shadow-2xl rounded-2xl p-4 flex items-center space-x-4 animate-bounce">
                    <div className="bg-profit/10 p-2 rounded-full text-profit">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">Email Verificata!</p>
                        <p className="text-xs text-slate-500 dark:text-gray-400">Bentornato su Option DAX.</p>
                    </div>
                </div>
            )}

            <Sidebar 
                isOpen={isMenuOpen} 
                onClose={() => setIsMenuOpen(false)} 
                theme={theme} 
                onToggleTheme={toggleTheme} 
            />
            
            <div className="flex-1 flex flex-col min-w-0">
                <Header 
                    onMenuToggle={() => setIsMenuOpen(true)} 
                    theme={theme} 
                    onToggleTheme={toggleTheme} 
                />
                
                <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
                    {renderView()}
                </main>
            </div>
            
            <div id="modal-root"></div>
        </div>
    );
};

export default App;
