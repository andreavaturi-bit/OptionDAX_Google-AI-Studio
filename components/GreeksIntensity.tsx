
import React from 'react';
import { motion } from 'motion/react';
import { CalculatedGreeks } from '../types';
import { formatNumber } from '../utils/formatters';

interface GreeksIntensityProps {
  greeks: CalculatedGreeks;
  isDarkMode: boolean;
}

const IntensityBar = ({ label, value, max, color, description, unit = '' }: { label: string, value: number, max: number, color: string, description: string, unit?: string }) => {
  const percentage = Math.min(100, Math.max(0, (Math.abs(value) / max) * 100));
  
  return (
    <div className="bg-slate-50 dark:bg-gray-700/30 p-4 rounded-xl border border-slate-100 dark:border-gray-700/50 flex flex-col h-full">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-1">{label}</p>
          <p className="text-lg font-bold font-mono text-slate-900 dark:text-white">
            {value > 0 ? '+' : ''}{formatNumber(value, 2)}{unit}
          </p>
        </div>
      </div>
      
      <div className="mt-auto">
        <div className="h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full ${color}`}
          />
        </div>
        <p className="text-[9px] text-slate-400 dark:text-gray-500 font-medium leading-tight">
          {description}
        </p>
      </div>
    </div>
  );
};

const DeltaCompass = ({ value }: { value: number }) => {
  const maxDelta = 100; 
  // Normalize to -90 to 90 degrees for a semi-circle
  const rotation = Math.min(90, Math.max(-90, (value / maxDelta) * 90));
  
  return (
    <div className="bg-slate-50 dark:bg-gray-700/30 p-6 rounded-xl border border-slate-100 dark:border-gray-700/50 relative overflow-hidden">
      <div className="flex justify-between items-start mb-2 relative z-10">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500">Delta (Direzionalità)</p>
          <p className={`text-3xl font-bold font-mono ${value >= 0 ? 'text-profit' : 'text-loss'}`}>
            {value > 0 ? '+' : ''}{formatNumber(value, 2)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-gray-500 mb-1">Bias di Mercato</p>
          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${Math.abs(value) > 10 ? (value > 0 ? 'bg-profit/10 text-profit border border-profit/20' : 'bg-loss/10 text-loss border border-loss/20') : 'bg-slate-200 dark:bg-gray-700 text-slate-500'}`}>
            {value > 10 ? 'Bullish' : value < -10 ? 'Bearish' : 'Neutrale'}
          </span>
        </div>
      </div>

      <div className="flex justify-center mt-4 relative h-32">
        {/* Semi-circle gauge */}
        <div className="absolute bottom-0 w-48 h-24 border-t-8 border-l-8 border-r-8 border-slate-200 dark:border-gray-700 rounded-t-full">
          {/* Ticks */}
          <div className="absolute -left-8 bottom-0 text-[8px] font-bold text-slate-400">-100</div>
          <div className="absolute -right-8 bottom-0 text-[8px] font-bold text-slate-400">+100</div>
          <div className="absolute left-1/2 -top-6 -translate-x-1/2 text-[8px] font-bold text-slate-400">0</div>
        </div>

        {/* Needle */}
        <motion.div 
          className="absolute bottom-0 left-1/2 origin-bottom w-1 h-20 bg-slate-400 dark:bg-gray-400 rounded-full z-20"
          initial={{ rotate: 0 }}
          animate={{ rotate: rotation }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
        >
          <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 shadow-lg ${value >= 0 ? 'bg-profit' : 'bg-loss'}`} />
        </motion.div>
        
        {/* Center hub */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-3 bg-slate-300 dark:bg-gray-600 rounded-t-full z-30" />
      </div>
    </div>
  );
};

const GreeksIntensity: React.FC<GreeksIntensityProps> = ({ greeks }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="md:col-span-2 lg:col-span-3">
          <DeltaCompass value={greeks.delta} />
        </div>
        
        <IntensityBar 
          label="Theta (Tempo)" 
          value={greeks.theta} 
          max={500} 
          color="bg-accent" 
          description="Guadagno teorico giornaliero dal passare del tempo."
          unit="€/gg"
        />
        
        <IntensityBar 
          label="Vega (Volatilità)" 
          value={greeks.vega} 
          max={1000} 
          color="bg-purple-500" 
          description="Sensibilità del portafoglio a variazioni dell'1% di IV."
          unit="€/1%"
        />
        
        <IntensityBar 
          label="Gamma (Accelerazione)" 
          value={greeks.gamma} 
          max={2} 
          color="bg-orange-500" 
          description="Rischio di variazione del Delta al muoversi del sottostante."
        />
      </div>
      
      <div className="p-4 bg-slate-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-slate-200 dark:border-gray-700">
        <p className="text-[10px] text-slate-400 dark:text-gray-500 leading-relaxed">
          <span className="font-bold text-slate-500 dark:text-gray-400 uppercase mr-2">Nota Metodologica:</span>
          Le barre di intensità sono scalate su valori di riferimento per un portafoglio retail standard. 
          Un'intensità al 100% indica un'esposizione elevata che richiede monitoraggio attivo. 
          Il Delta è espresso in punti indice.
        </p>
      </div>
    </div>
  );
};

export default GreeksIntensity;
