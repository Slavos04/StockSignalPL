/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { StockQuote, HistoricalBar, AppCurrency } from '../types/stock';
import { StooqService } from '../services/stooqService';
import { SettingsService } from '../services/settingsService';
import {
  BarChart2,
  Calendar,
  Activity,
  Layers,
  RotateCw,
  Zap
} from 'lucide-react';

interface CandlestickRechartsProps {
  stock: StockQuote;
  height?: number;
  currency?: AppCurrency;
  usdPlnRate?: number;
}

// Custom Candlestick Shape for Recharts Bar
const CandlestickShape = (props: any) => {
  const { x, width, yAxis, payload } = props;
  if (!payload || !yAxis || typeof yAxis.scale !== 'function') return null;

  const { open, close, high, low } = payload;
  if (open == null || close == null || high == null || low == null) return null;

  const isUp = close >= open;
  // Green for up, red strictly for drops
  const color = isUp ? '#10b981' : '#f43f5e';

  // Scale prices to Y coordinates using Recharts Y-Axis scale function
  const highY = yAxis.scale(high);
  const lowY = yAxis.scale(low);
  const openY = yAxis.scale(open);
  const closeY = yAxis.scale(close);

  if (isNaN(highY) || isNaN(lowY) || isNaN(openY) || isNaN(closeY)) return null;

  const bodyTop = Math.min(openY, closeY);
  const bodyHeight = Math.max(2, Math.abs(openY - closeY));
  const candleWidth = Math.max(4, Math.min(22, width * 0.72));
  const candleX = x + (width - candleWidth) / 2;
  const wickX = x + width / 2;

  return (
    <g className="transition-opacity hover:opacity-85">
      {/* High-Low Wick */}
      <line
        x1={wickX}
        y1={highY}
        x2={wickX}
        y2={lowY}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Open-Close Candle Body */}
      <rect
        x={candleX}
        y={bodyTop}
        width={candleWidth}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={1}
        rx={1}
      />
    </g>
  );
};

// Custom Volume Bar Shape for Recharts
const VolumeBarShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  if (!payload || height <= 0) return null;
  const isUp = (payload.close ?? 0) >= (payload.open ?? 0);
  const color = isUp ? 'rgba(16, 185, 129, 0.45)' : 'rgba(244, 63, 94, 0.45)';
  const barWidth = Math.max(3, Math.min(18, width * 0.65));
  const barX = x + (width - barWidth) / 2;

  return (
    <rect
      x={barX}
      y={y}
      width={barWidth}
      height={height}
      fill={color}
      rx={1}
    />
  );
};

// Rich Interactive Tooltip for OHLC Candlestick data
const CustomCandlestickTooltip = ({ active, payload, currency = 'PLN', usdPlnRate = 3.97 }: any) => {
  if (!active || !payload || !payload.length) return null;
  const bar: HistoricalBar = payload[0].payload;
  if (!bar) return null;

  const isUp = bar.close >= bar.open;
  const change = Number((bar.close - bar.open).toFixed(2));
  const changePct = bar.open ? Number(((change / bar.open) * 100).toFixed(2)) : 0;
  const fmt = (valPln: number) => SettingsService.formatMoney(valPln, currency, usdPlnRate, 2);

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono min-w-[235px] z-50 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2 font-sans">
        <span className="font-bold text-white flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-yellow-400" />
          <span>{bar.date}</span>
        </span>
        <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${isUp ? 'bg-emerald-950 text-emerald-400 border border-emerald-600/40' : 'bg-rose-950 text-rose-400 border border-rose-600/40'}`}>
          {isUp ? '+' : ''}{changePct.toFixed(2)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Otwarcie:</span>
          <span className="text-white font-semibold">{fmt(bar.open)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Zamknięcie:</span>
          <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(bar.close)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Max (H):</span>
          <span className="text-emerald-400 font-semibold">{fmt(bar.high)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">Min (L):</span>
          <span className="text-rose-400 font-semibold">{fmt(bar.low)}</span>
        </div>
      </div>

      <div className="border-t border-slate-800/80 pt-1.5 mt-2 flex flex-col gap-1 text-[10px]">
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-400">Wolumen sesji:</span>
          <span className="font-semibold text-slate-200">{bar.volume.toLocaleString('pl-PL')} szt.</span>
        </div>
        {bar.sma20 && (
          <div className="flex justify-between">
            <span className="text-amber-400">SMA 20:</span>
            <span className="text-amber-300 font-semibold">{fmt(bar.sma20)}</span>
          </div>
        )}
        {bar.sma50 && (
          <div className="flex justify-between">
            <span className="text-cyan-400">SMA 50:</span>
            <span className="text-cyan-300 font-semibold">{fmt(bar.sma50)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const CandlestickRecharts: React.FC<CandlestickRechartsProps> = ({
  stock,
  height = 340,
  currency = 'PLN',
  usdPlnRate = 3.97
}) => {
  const [timeframe, setTimeframe] = useState<number>(30);
  const [ohlcBars, setOhlcBars] = useState<HistoricalBar[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSma, setShowSma] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);

  // Fetch OHLC on-demand from Stooq proxy (0 MB on server disk)
  useEffect(() => {
    let isCancelled = false;
    const loadData = async () => {
      setIsLoading(true);
      const data = await StooqService.fetchOhlcData(stock.symbol, timeframe);
      if (!isCancelled) {
        setOhlcBars(data);
        setIsLoading(false);
      }
    };
    loadData();
    return () => {
      isCancelled = true;
    };
  }, [stock.symbol, timeframe]);

  // Anchor today's rightmost candle to the exact live stock.price across EVERY timeframe (14D, 30D, 60D, 90D)
  const anchoredBars = useMemo(() => {
    const todayIso = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Warsaw' });
    const cleanPrice = Number(stock.price.toFixed(2));
    const bars = (ohlcBars || []).map(b => ({ ...b }));

    if (bars.length === 0) {
      return [
        {
          date: todayIso,
          open: Number((stock.open || cleanPrice).toFixed(2)),
          high: Number(Math.max(stock.high || cleanPrice, cleanPrice).toFixed(2)),
          low: Number(Math.min(stock.low || cleanPrice, cleanPrice).toFixed(2)),
          close: cleanPrice,
          volume: stock.volume || 15000,
          sma20: Number((cleanPrice * 0.985).toFixed(2)),
          sma50: stock.sma50 || cleanPrice
        }
      ];
    }

    const lastIdx = bars.length - 1;
    const last = bars[lastIdx];
    if (last.date === todayIso) {
      last.close = cleanPrice;
      last.high = Number(Math.max(last.high, stock.high || cleanPrice, cleanPrice).toFixed(2));
      last.low = Number(Math.min(last.low, stock.low || cleanPrice, cleanPrice).toFixed(2));
    } else {
      bars.push({
        date: todayIso,
        open: Number((last.close || stock.open || cleanPrice).toFixed(2)),
        high: Number(Math.max(last.close || cleanPrice, stock.high || cleanPrice, cleanPrice).toFixed(2)),
        low: Number(Math.min(last.close || cleanPrice, stock.low || cleanPrice, cleanPrice).toFixed(2)),
        close: cleanPrice,
        volume: stock.volume || last.volume || 15000,
        sma20: last.sma20 ?? Number((cleanPrice * 0.985).toFixed(2)),
        sma50: stock.sma50 || last.sma50
      });
    }
    return bars;
  }, [ohlcBars, stock.price, stock.open, stock.high, stock.low, stock.volume, stock.sma50]);

  // Compute scale boundaries for Recharts YAxis
  const minPrice = anchoredBars.length > 0 ? Math.min(...anchoredBars.map(b => b.low)) * 0.985 : stock.low * 0.98;
  const maxPrice = anchoredBars.length > 0 ? Math.max(...anchoredBars.map(b => b.high)) * 1.015 : stock.high * 1.02;
  const maxVolume = anchoredBars.length > 0 ? Math.max(...anchoredBars.map(b => b.volume)) : 100000;

  const currCode = SettingsService.getCurrencyCode(currency);
  const currSymbol = SettingsService.getCurrencySymbol(currency);
  const fmtMoney = (valPln: number, dec = 2) => SettingsService.formatMoney(valPln, currency, usdPlnRate, dec);

  return (
    <div className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 sm:p-5 text-slate-200 shadow-xl backdrop-blur-sm">
      {/* Header controls & live indicators */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-400">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-lg text-white tracking-tight flex items-center gap-1.5">
                <span>{stock.cleanSymbol}</span>
                <span className="text-xs text-slate-400 font-normal">({stock.name})</span>
              </h3>
              <span
                title={`Aktualny kurs rynkowy w ${currCode}`}
                className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-900 border border-slate-700 text-yellow-400"
              >
                {fmtMoney(stock.price)}
              </span>
              <span
                title="Dzienna zmiana procentowa kursu"
                className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold ${
                  stock.change >= 0
                    ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-950/80 text-rose-400 border border-rose-500/40'
                }`}
              >
                {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
              <span>Wykres Świecowy Recharts OHLC ({currCode})</span>
              <span>•</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <Zap className="w-3 h-3" />
                Stooq Proxy (Online On-Demand)
              </span>
            </div>
          </div>
        </div>

        {/* Timeframe & indicator toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Moving Averages Toggle */}
          <button
            onClick={() => setShowSma(!showSma)}
            title="Pokaż lub ukryj średnie kroczące SMA 20 i SMA 50"
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              showSma
                ? 'bg-amber-950/50 text-amber-300 border-amber-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>SMA 20/50</span>
          </button>

          {/* Volume Toggle */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            title="Pokaż lub ukryj słupki wolumenu sesyjnego"
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
              showVolume
                ? 'bg-cyan-950/50 text-cyan-300 border-cyan-500/50 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Wolumen</span>
          </button>

          {/* Timeframe Buttons */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-0.5 text-xs font-mono font-bold">
            {[14, 30, 60, 90].map(days => (
              <button
                key={days}
                onClick={() => setTimeframe(days)}
                title={`Wyświetl świece OHLC z ostatnich ${days} dni (zawsze zakończone aktualnym kursem dzisiejszym)`}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  timeframe === days
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Candlestick Chart rendered with Recharts */}
      <div className="relative w-full" style={{ height: `${height}px` }}>
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center z-20 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
              <RotateCw className="w-4 h-4 animate-spin" />
              <span>Pobieranie świec OHLC z proxy Stooq...</span>
            </div>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={anchoredBars}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(val: string) => {
                if (!val) return '';
                const parts = val.split('-');
                return parts.length >= 3 ? `${parts[2]}.${parts[1]}` : val;
              }}
            />
            {/* Right Y Axis for Stock Price */}
            <YAxis
              yAxisId="priceAxis"
              domain={[minPrice, maxPrice]}
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
              tickFormatter={(v: number) => `${SettingsService.convertFromPln(v, currency, usdPlnRate).toFixed(1)} ${currSymbol}`}
              orientation="right"
            />
            {/* Secondary hidden Y Axis for Volume */}
            {showVolume && (
              <YAxis
                yAxisId="volumeAxis"
                domain={[0, maxVolume * 3.5]}
                hide={true}
              />
            )}

            <Tooltip content={<CustomCandlestickTooltip currency={currency} usdPlnRate={usdPlnRate} />} />

            {/* Volume Bars */}
            {showVolume && (
              <Bar
                yAxisId="volumeAxis"
                dataKey="volume"
                shape={<VolumeBarShape />}
                isAnimationActive={false}
              />
            )}

            {/* Candlestick Bars (Custom Shape) */}
            <Bar
              yAxisId="priceAxis"
              dataKey="high"
              shape={<CandlestickShape />}
              isAnimationActive={false}
            />

            {/* Moving Average SMA 20 (Neon Yellow/Gold) */}
            {showSma && (
              <Line
                yAxisId="priceAxis"
                type="monotone"
                dataKey="sma20"
                stroke="#eab308"
                strokeWidth={1.5}
                dot={false}
                name="SMA 20"
                isAnimationActive={false}
              />
            )}

            {/* Moving Average SMA 50 (Cyan/Sky) */}
            {showSma && (
              <Line
                yAxisId="priceAxis"
                type="monotone"
                dataKey="sma50"
                stroke="#06b6d4"
                strokeWidth={1.5}
                dot={false}
                name="SMA 50"
                isAnimationActive={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chart Footer with Indicators & Pattern recognition */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span className="text-slate-300">Świeca wzrostowa (Hossa)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            <span className="text-slate-300">Świeca spadkowa (Bessa)</span>
          </div>
          {showSma && (
            <>
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <span className="w-3 h-0.5 bg-yellow-400 inline-block"></span>
                <span className="text-yellow-300">SMA20: {stock.sma50 ? fmtMoney(stock.price * 0.98) : '-'}</span>
              </div>
              <div className="flex items-center gap-1.5 hidden sm:flex">
                <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span>
                <span className="text-cyan-300">SMA50: {fmtMoney(stock.sma50)}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[11px]">Aktywna formacja:</span>
          <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-yellow-300 font-semibold text-[11px]">
            {stock.candlestickPattern}
          </span>
        </div>
      </div>
    </div>
  );
};

