import React from 'react';
import { Calculator } from 'lucide-react';

const GreeksCalculator: React.FC = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-card border border-border rounded-lg p-8">
                <div className="flex items-center space-x-3 mb-6">
                    <Calculator className="w-8 h-8 text-sky-500" />
                    <h1 className="text-3xl font-bold text-foreground">Calcolatore Greche</h1>
                </div>

                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                    <div className="w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center">
                        <Calculator className="w-8 h-8 text-sky-500" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground">Coming Soon</h2>
                    <p className="text-muted-foreground text-center max-w-md">
                        Il calcolatore avanzato delle greche sarà disponibile a breve.
                        Potrai analizzare in dettaglio Delta, Gamma, Theta, Vega e Rho delle tue posizioni.
                    </p>
                    <div className="mt-8 bg-muted border border-border rounded-lg p-6 max-w-2xl">
                        <h3 className="text-lg font-semibold text-foreground mb-3">Funzionalità previste:</h3>
                        <ul className="space-y-2 text-muted-foreground">
                            <li className="flex items-start">
                                <span className="text-sky-500 mr-2">&bull;</span>
                                <span>Calcolo greche in tempo reale con Black-Scholes</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-sky-500 mr-2">&bull;</span>
                                <span>Visualizzazione grafica dell'evoluzione delle greche</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-sky-500 mr-2">&bull;</span>
                                <span>Analisi di sensibilità a variazioni di spot, volatilità e tempo</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-sky-500 mr-2">&bull;</span>
                                <span>Heatmap delle greche per range di strike e scadenze</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GreeksCalculator;
