import React, { useState } from 'react';
import { StockQuote, HistoricalBar } from '../types/stock';
import { TrendingUp, BarChart2, Activity } from 'lucide-react';

interface StockChartProps {
  stock: StockQuote;
  height?: number;
}

export const StockChart: React.FC<StockChartProps> = ({ stock, height = 280 }) => {
  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [hoveredBar, setHoveredBar] = useState<HistoricalBar | null>(null);

  const history = stock.history && stock.history.length > 0 ? stock.history : [];
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-slate-950/40 rounded-xl text-slate-500 text-xs">
        Brak danych historycznych dla {stock.symbol}
      </div>
    );
  }

  // Calculate scales
  const prices = history.flatMap(b => [b.high, b.low]);
  const minPrice = Math.min(...prices) * 0.99;
  const maxPrice = Math.max(...prices) * 1.01;
  const priceRange = maxPrice - minPrice || 1;

  const maxVolume = Math.max(...history.map(b => b.volume)) || 1;

  const chartHeight = height - 60; // Leave space for volume and labels
  const volumeHeight = 40;

  const getY = (val: number) => {
    return chartHeight - ((val - minPrice) / priceRange) * chartHeight;
  };

  const getVolY = (vol: number) => {
    return height - (vol / maxVolume) * volumeHeight;
  };

  const barWidth = Math.max(3, Math.min(18, 600 / history.length));

  return (
    <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-slate-200">
      {/* Chart header & controls */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-white">{stock.cleanSymbol}</span>
              <span className="text-xs text-slate-400 font-mono font-medium">{stock.price.toFixed(2)} PLN</span>
              <span className={`text-xs font-semibold font-mono ${stock.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400">{stock.name} • {stock.market} ({stock.sector})</p>
          </div>
        </div>

        {/* Hover info or indicators */}
        <div className="hidden sm:flex items-center gap-3 text-xs">
          {hoveredBar ? (
            <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700 font-mono text-[11px]">
              <span className="text-slate-400">{hoveredBar.date}:</span>
              <span>O: {hoveredBar.open.toFixed(2)}</span>
              <span className="text-emerald-400">H: {hoveredBar.high.toFixed(2)}</span>
              <span className="text-rose-400">L: {hoveredBar.low.toFixed(2)}</span>
              <span className="text-white font-bold">C: {hoveredBar.close.toFixed(2)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
                <span>SMA50: {stock.sma50.toFixed(2)}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block"></span>
                <span>SMA200: {stock.sma200.toFixed(2)}</span>
              </span>
            </div>
          )}

          {/* Toggle candle / line */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setChartType('candlestick')}
              title="Wykres Świecowy"
              className={`p-1 rounded ${chartType === 'candlestick' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('line')}
              title="Wykres Liniowy"
              className={`p-1 rounded ${chartType === 'line' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden" style={{ height: `${height}px` }}>
        <svg
          className="w-full h-full overflow-visible"
          viewBox={`0 0 700 ${height}`}
          preserveAspectRatio="none"
        >
          {/* Price grid lines */}
          <line x1="0" y1="20" x2="700" y2="20" stroke="#1e293b" strokeDasharray="3,3" />
          <line x1="0" y1={chartHeight / 2} x2="700" y2={chartHeight / 2} stroke="#1e293b" strokeDasharray="3,3" />
          <line x1="0" y1={chartHeight} x2="700" y2={chartHeight} stroke="#334155" />

          {/* Price axis text */}
          <text x="695" y="18" fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
            {maxPrice.toFixed(2)} zł
          </text>
          <text x="695" y={chartHeight / 2 - 4} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
            {((maxPrice + minPrice) / 2).toFixed(2)} zł
          </text>
          <text x="695" y={chartHeight - 6} fill="#64748b" fontSize="10" textAnchor="end" fontFamily="monospace">
            {minPrice.toFixed(2)} zł
          </text>

          {/* Volume sub-chart base */}
          <text x="5" y={height - 2} fill="#475569" fontSize="9" fontFamily="monospace">
            Wolumen GPW
          </text>

          {/* Candlesticks or Line */}
          {chartType === 'candlestick' ? (
            history.map((bar, i) => {
              const x = 20 + i * ((660 - 20) / (history.length - 1 || 1));
              const isUp = bar.close >= bar.open;
              const openY = getY(bar.open);
              const closeY = getY(bar.close);
              const highY = getY(bar.high);
              const lowY = getY(bar.low);
              const volY = getVolY(bar.volume);

              const color = isUp ? '#10b981' : '#f43f5e';

              return (
                <g
                  key={bar.date}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={() => setHoveredBar(bar)}
                  onMouseLeave={() => setHoveredBar(null)}
                >
                  {/* Wick */}
                  <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1.5" />
                  {/* Body */}
                  <rect
                    x={x - barWidth / 2}
                    y={Math.min(openY, closeY)}
                    width={barWidth}
                    height={Math.max(2, Math.abs(openY - closeY))}
                    fill={color}
                    rx="1"
                  />
                  {/* Volume bar */}
                  <rect
                    x={x - barWidth / 2}
                    y={volY}
                    width={barWidth}
                    height={height - volY}
                    fill={isUp ? 'rgba(16, 185, 129, 0.25)' : 'rgba(244, 63, 94, 0.25)'}
                  />
                </g>
              );
            })
          ) : (
            <>
              {/* Area gradient under line */}
              <defs>
                <linearGradient id="gpwLineGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area path */}
              <path
                d={
                  history.reduce((acc, bar, i) => {
                    const x = 20 + i * ((660 - 20) / (history.length - 1 || 1));
                    const y = getY(bar.close);
                    return `${acc} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }, '') + ` L 660 ${chartHeight} L 20 ${chartHeight} Z`
                }
                fill="url(#gpwLineGrad)"
              />

              {/* Line path */}
              <path
                d={history.reduce((acc, bar, i) => {
                  const x = 20 + i * ((660 - 20) / (history.length - 1 || 1));
                  const y = getY(bar.close);
                  return `${acc} ${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                }, '')}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Volume bars */}
              {history.map((bar, i) => {
                const x = 20 + i * ((660 - 20) / (history.length - 1 || 1));
                const volY = getVolY(bar.volume);
                return (
                  <rect
                    key={`v_${bar.date}`}
                    x={x - 2}
                    y={volY}
                    width="4"
                    height={height - volY}
                    fill="rgba(148, 163, 184, 0.2)"
                  />
                );
              })}
            </>
          )}
        </svg>
      </div>
    </div>
  );
};
