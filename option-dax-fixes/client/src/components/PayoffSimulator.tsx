import React from 'react';
import { TrendingUp } from 'lucide-react';

const PayoffSimulator: React.FC = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-card border border-border rounded-lg p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <TrendingUp className="w-8 h-8 text-sky-500" />
                    <h1 className="text-3xl font-bold text-foreground">Simulatore Payoff</h1>
                </div>

                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center">
                        <TrendingUp className="w-8 h-8 text-sky-500" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">Coming Soon</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                        Il simulatore di payoff interattivo sarà disponibile a breve.
                        Potrai visualizzare graficamente il profilo di rischio/rendimento delle tue strategie.
                    </p>
                    <div className="mt-8 bg-muted border border-border rounded-lg p-6 max-w-2xl">
                        <h3 className="text-lg font-semibold text-foreground mb-3">Funzionalità previste:</h3>
                        <ul className="space-y-2 text-muted-foreground">
                            <li className="flex items-start">
                                <span className="text-sky-500 mr-2">&bull;</span>
                                <span>Grafico payoff interattivo con zoom e pan</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-sky-500 mr-2">&bull;</span>
                                <span>Visualizzazione breakeven points e max profit/loss</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-sky-500 mr-2">&bull;</span>
                                <span>Simulazione di scenari con diversi prezzi spot</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-sky-500 mr-2">&bull;</span>
                                <span>Confronto tra strategie multiple</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PayoffSimulator;
