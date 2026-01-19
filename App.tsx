
import React from 'react';
import usePortfolioStore from './store/portfolioStore';
import StructureListView from './components/StructureListView';
import StructureDetailView from './components/StructureDetailView';
import SettingsView from './components/SettingsView';
import PortfolioAnalysis from './components/PortfolioAnalysis';
import { SettingsIcon, ChartBarIcon } from './components/icons';

const App: React.FC = () => {
    const { currentView, currentStructureId, setCurrentView } = usePortfolioStore();

    const renderView = () => {
        switch (currentView) {
            case 'list':
                return <StructureListView />;
            case 'detail':
                return <StructureDetailView structureId={currentStructureId} />;
            case 'settings':
                return <SettingsView />;
            case 'analysis':
                return <PortfolioAnalysis />;
            default:
                return <StructureListView />;
        }
    }

    return (
        <div className="bg-gray-900 text-gray-200 font-sans min-h-screen flex flex-col">
            <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-3 flex items-center justify-between sticky top-0 z-10">
                <div 
                    className="flex items-center space-x-2 cursor-pointer"
                    onClick={() => setCurrentView('list')}
                >
                    <div className="w-8 h-8 bg-accent rounded-md flex items-center justify-center font-bold text-xl">O</div>
                    <h1 className="text-xl font-bold text-white">Option DAX</h1>
                </div>
                 <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setCurrentView('analysis')} 
                        className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition"
                        title="Analisi Portafoglio"
                    >
                        <ChartBarIcon />
                    </button>
                    <button 
                        onClick={() => setCurrentView('settings')} 
                        className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-700 transition"
                        title="Impostazioni"
                    >
                        <SettingsIcon />
                    </button>
                </div>
            </header>
            <main className="flex-1 p-2 sm:p-4">
                {renderView()}
            </main>
            <div id="modal-root"></div>
        </div>
    );
};

export default App;