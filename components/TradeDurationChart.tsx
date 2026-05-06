
import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList
} from 'recharts';
import { Structure } from '../types';
import { formatCurrency } from '../utils/formatters';

interface TradeDurationChartProps {
  structures: Structure[];
  isDarkMode: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const start = new Date(data.range[0]);
    const end = new Date(data.range[1]);
    const durationDays = Math.round(data.duration / (1000 * 60 * 60 * 24));

    return (
      <div className="bg-white dark:bg-gray-900/90 p-3 border border-slate-200 dark:border-gray-600 rounded-xl shadow-xl text-sm backdrop-blur-sm">
        <p className="font-bold text-slate-900 dark:text-gray-200 mb-1">{data.name}</p>
        <div className="space-y-1 text-xs">
          <p className="text-slate-500 dark:text-gray-400 flex justify-between gap-4">
            <span>Inizio:</span>
            <span className="font-mono">{start.toLocaleDateString('it-IT')}</span>
          </p>
          <p className="text-slate-500 dark:text-gray-400 flex justify-between gap-4">
            <span>Fine:</span>
            <span className="font-mono">{end.toLocaleDateString('it-IT')}</span>
          </p>
          <p className="text-accent font-semibold flex justify-between gap-4">
            <span>Durata:</span>
            <span className="font-mono">{durationDays} giorni</span>
          </p>
          {data.pnl !== undefined && (
            <p className={`${data.pnl >= 0 ? 'text-profit' : 'text-loss'} font-semibold flex justify-between gap-4 border-top border-slate-100 dark:border-gray-700 pt-1 mt-1`}>
              <span>P&L:</span>
              <span className="font-mono">{formatCurrency(data.pnl)}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const TradeDurationChart: React.FC<TradeDurationChartProps> = ({ structures, isDarkMode }) => {
  const chartData = useMemo(() => {
    if (!structures || structures.length === 0) return [];

    const now = new Date().getTime();

    const data = structures.map(s => {
      // Filter out invalid or very old dates (before 2020)
      const MIN_DATE = new Date('2020-01-01').getTime();
      
      const openingDates = s.legs
        .map(l => l.openingDate ? new Date(l.openingDate).getTime() : NaN)
        .filter(d => !isNaN(d) && d > MIN_DATE); 

      let startDate = NaN;
      if (openingDates.length > 0) {
        startDate = Math.min(...openingDates);
      } else if (s.createdAt) {
        const created = new Date(s.createdAt).getTime();
        if (!isNaN(created) && created > MIN_DATE) {
          startDate = created;
        }
      }

      // If we still don't have a valid start date, skip
      if (isNaN(startDate) || startDate < MIN_DATE) { 
        return null;
      }

      // If active, use now as end date. If closed, use latest leg closing date.
      const isClosed = s.status === 'Closed';
      
      let endDate = NaN;
      if (isClosed) {
        // Try to get the latest leg closing date
        const legClosingDates = s.legs
          .map(l => l.closingDate ? new Date(l.closingDate).getTime() : NaN)
          .filter(d => !isNaN(d));
        
        if (legClosingDates.length > 0) {
          endDate = Math.max(...legClosingDates);
        } else if (s.closingDate) {
          // Fallback to structure closing date if legs have no dates
          endDate = new Date(s.closingDate).getTime();
        }
      }

      const effectiveEndDate = isClosed 
        ? (!isNaN(endDate) ? endDate : startDate) 
        : now;
      
      const duration = Math.max(0, effectiveEndDate - startDate);

      return {
        name: s.tag,
        range: [startDate, effectiveEndDate],
        duration: duration,
        pnl: s.realizedPnl,
        isClosed
      };
    }).filter((item): item is NonNullable<typeof item> => item !== null);

    // Sort by start date (earliest first)
    return data.sort((a, b) => a.range[0] - b.range[0]);
  }, [structures]);

  if (chartData.length === 0) return null;

  const gridColor = isDarkMode ? "#374151" : "#f1f5f9";
  const axisColor = isDarkMode ? "#9ca3af" : "#94a3b8";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Timeline Operazioni (Gantt)</h2>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-accent"></div>
            <span className="text-slate-500 dark:text-gray-400">Attiva</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-400"></div>
            <span className="text-slate-500 dark:text-gray-400">Chiusa</span>
          </div>
        </div>
      </div>
      <div className="w-full" style={{ height: Math.max(400, chartData.length * 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            barSize={20}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
            <XAxis
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' })}
              stroke={axisColor}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              allowDataOverflow={true}
              minTickGap={30}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke={axisColor}
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: isDarkMode ? 'rgba(55, 65, 81, 0.3)' : 'rgba(241, 245, 249, 0.5)' }} />
            <Bar dataKey="range" radius={[4, 4, 4, 4]}>
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.isClosed ? (entry.pnl && entry.pnl >= 0 ? '#10b981' : (entry.pnl && entry.pnl < 0 ? '#ef4444' : '#94a3b8')) : '#3b82f6'} 
                />
              ))}
              <LabelList 
                dataKey="duration" 
                position="right" 
                formatter={(val: number) => `${Math.round(val / (1000 * 60 * 60 * 24))}gg`}
                style={{ fontSize: '10px', fill: axisColor, fontWeight: 'bold' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TradeDurationChart;
