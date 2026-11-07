import React, { useState, useRef, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { PortfolioStrategy, TradeRecord, StockQuote, PositionItem, HistoricalBar } from '../types/stock';
import { PortfolioService } from '../services/portfolioService';
import { CreatePortfolioModal } from './CreatePortfolioModal';
import { EditPortfolioModal } from './EditPortfolioModal';
import { Settings } from 'lucide-react';
import {
  Layers,
  TrendingUp,
  RefreshCw,
  Download,
  Plus,
  CheckCircle,
  ArrowUpDown,
  Zap,
  Send,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertTriangle,
  BarChart2,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TabPortfoliosProps {
  portfolios: PortfolioStrategy[];
  onPortfoliosUpdate: (portfolios: PortfolioStrategy[]) => void;
  trades: TradeRecord[];
  onTradesUpdate: (trades: TradeRecord[]) => void;
  stocks: StockQuote[];
}

export type TimeRange = '1D' | '3D' | '1W' | '2W' | '1M' | '3M' | '6M' | 'ALL';

/**
 * Deterministyczny pseudo-generator liczb losowych na podstawie ziarna (seed)
 * Gwarantuje, że wykresy i świece nie drgają ani nie skaczą przy re-renderach i ruchach myszy!
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Dedykowana własna świeca dla Recharts (Candlestick Bar Shape)
 * Oblicza dokładne współrzędne SVG na podstawie zakresu YAxis [yMin, yMax].
 * Gwarantuje czytelny, trójwymiarowy korpus (min. 6px) oraz wyraźne knoty High/Low.
 */
const CandlestickBar = (props: any) => {
  const { x, width, payload } = props;
  if (!payload || typeof x !== 'number') return null;

  const open = payload.open ?? payload.close;
  const close = payload.close ?? open;
  const high = payload.high ?? Math.max(open, close);
  const low = payload.low ?? Math.min(open, close);

  const isBullish = close >= open;
  const isDoji = Math.abs(close - open) < 0.005;
  const color = isBullish ? '#10b981' : '#f43f5e';
  const strokeColor = isBullish ? '#059669' : '#e11d48';

  const yMin = payload.yMin ?? Math.min(open, close, low, high);
  const yMax = payload.yMax ?? Math.max(open, close, low, high);
  const domainSpan = Math.max(0.001, yMax - yMin);

  // Dokładna transformacja ceny na współrzędne SVG (obszar wykresu: wysokość 200px, top margin 15px)
  const plotHeight = 200;
  const topMargin = 15;

  const getY = (val: number) => {
    return topMargin + ((yMax - val) / domainSpan) * plotHeight;
  };

  const openY = getY(open);
  const closeY = getY(close);
  const highY = getY(high);
  const lowY = getY(low);

  // Szerokość świecy proporcjonalna do slotu
  const candleWidth = Math.max(6, Math.min(18, width * 0.72));
  const candleX = x + (width - candleWidth) / 2;
  const centerX = x + width / 2;

  // Korpus świecy z minimalną grubością 6px (nigdy nie ma wyglądu płaskiej kreski)
  const rawBodyHeight = Math.abs(closeY - openY);
  const bodyHeight = isDoji ? 2 : Math.max(6, rawBodyHeight);
  const rawBodyTop = Math.min(openY, closeY);
  const bodyTop = rawBodyHeight < 6 && !isDoji
    ? rawBodyTop - (6 - rawBodyHeight) / 2
    : rawBodyTop;

  // Knoty: od highY do lowY
  const topWickY = Math.min(highY, bodyTop);
  const bottomWickY = Math.max(lowY, bodyTop + bodyHeight);

  return (
    <g className="candlestick-bar">
      {/* Knot Pionowy (High - Low Wick) */}
      <line
        x1={centerX}
        y1={topWickY}
        x2={centerX}
        y2={bottomWickY}
        stroke={color}
        strokeWidth={Math.max(1.5, Math.min(2.5, candleWidth * 0.22))}
      />
      {/* Korpus Świecy (Open - Close Body) */}
      {isDoji ? (
        <line
          x1={candleX}
          y1={bodyTop}
          x2={candleX + candleWidth}
          y2={bodyTop}
          stroke="#cbd5e1"
          strokeWidth={2}
        />
      ) : (
        <rect
          x={candleX}
          y={bodyTop}
          width={candleWidth}
          height={bodyHeight}
          fill={color}
          stroke={strokeColor}
          strokeWidth={1.2}
          rx={1}
        />
      )}
    </g>
  );
};

/**
 * Generuje dzienne punkty historii dla portfela na podstawie punktów miesięcznych
 */
function generateDailyPortfolioPoints(monthlyData: { date: string; portfolioVal: number; wig20Val: number }[]) {
  if (!monthlyData || monthlyData.length === 0) return [];
  if (monthlyData.length < 2) return monthlyData;

  const dailyPoints: { date: string; portfolioVal: number; wig20Val: number }[] = [];
  const totalDays = 180;
  const now = new Date();

  const startPort = monthlyData[0].portfolioVal;
  const endPort = monthlyData[monthlyData.length - 1].portfolioVal;
  const startWig = monthlyData[0].wig20Val;
  const endWig = monthlyData[monthlyData.length - 1].wig20Val;

  for (let i = totalDays; i >= 0; i--) {
    const dateObj = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const progress = (totalDays - i) / totalDays;
    const targetPort = startPort + (endPort - startPort) * Math.pow(progress, 0.95);
    const targetWig = startWig + (endWig - startWig) * Math.pow(progress, 1.05);

    const seed = i * 19 + startPort % 100;
    const noisePort = Math.sin(seed) * 0.0035 * targetPort;
    const noiseWig = Math.cos(seed * 0.8) * 0.0028 * targetWig;

    const ptPort = i === 0 ? endPort : Math.round(targetPort + noisePort);
    const ptWig = i === 0 ? endWig : Math.round(targetWig + noiseWig);

    const dateStr = dateObj.toISOString().split('T')[0];
    dailyPoints.push({
      date: dateStr,
      portfolioVal: ptPort,
      wig20Val: ptWig
    });
  }

  return dailyPoints;
}

/**
 * Filtruje punkty według wybranego zakresu czasowego (dla 1W i dłuższych horyzontów)
 */
function filterPointsByTimeRange<T extends { date: string }>(data: T[], range: TimeRange): T[] {
  if (!data || data.length === 0 || range === 'ALL') return data;

  const daysMap: Record<TimeRange, number> = {
    '1D': 1,
    '3D': 3,
    '1W': 7,
    '2W': 14,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    'ALL': 9999
  };

  const daysBack = daysMap[range] || 180;
  const lastTime = new Date(data[data.length - 1].date).getTime();
  const cutoff = lastTime - daysBack * 24 * 60 * 60 * 1000;

  const filtered = data.filter(pt => new Date(pt.date).getTime() >= cutoff);
  if (filtered.length < 2) {
    return data.slice(-Math.max(2, filtered.length));
  }
  return filtered;
}

/**
 * Generuje punkty Krzywej Kapitału dostosowane do wybranego horyzontu:
 * - 1D: pełna krzywa śródsesyjna MTM (Mark-to-Market) co 30 min od 09:00 do 17:00 (17 punktów z naturalnymi falami sesji)
 * - 3D: pełna wielosesyjna krzywa z ostatnich 3 sesji giełdowych (18 punktów)
 * - 1W i wyżej: dzienne punkty sesyjne EOD
 */
function generatePortfolioPointsForTimeRange(
  dailyPoints: { date: string; portfolioVal: number; wig20Val: number }[],
  range: TimeRange,
  portfolioId: string
): { date: string; portfolioVal: number; wig20Val: number }[] {
  if (!dailyPoints || dailyPoints.length === 0) return [];

  const lastPt = dailyPoints[dailyPoints.length - 1];
  const endPort = lastPt.portfolioVal;
  const endWig = lastPt.wig20Val;
  const nowDateStr = lastPt.date;

  const idSeed = portfolioId.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);

  if (range === '1D') {
    // 17 punktów śródsesyjnych dzisiejszej sesji (09:00 - 17:00)
    const hours = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
      '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
    ];
    // Dynamiczny przebieg sesji: otwarcie, poranny impuls, południowa konsolidacja, popołudniowe przyspieszenie, fixing
    const sessionPortMovePct = (((idSeed % 7) - 2.8) * 0.32); // np. +0.6% do +1.4%
    const sessionWigMovePct = (((idSeed % 5) - 2) * 0.28);
    const startPort = Math.round(endPort / (1 + sessionPortMovePct / 100));
    const startWig = Math.round(endWig / (1 + sessionWigMovePct / 100));

    return hours.map((hour, idx) => {
      if (idx === 0) {
        return { date: `${nowDateStr} ${hour}`, portfolioVal: startPort, wig20Val: startWig };
      }
      if (idx === hours.length - 1) {
        return { date: `${nowDateStr} ${hour}`, portfolioVal: endPort, wig20Val: endWig };
      }
      const progress = idx / (hours.length - 1);
      // Krzywa sesyjna: naturalne fale popytu/podaży w ciągu dnia (tworzące krzywą, a nie prostą kreskę)
      const harmonic1 = Math.sin(progress * Math.PI * 1.5) * 0.55;
      const harmonic2 = Math.sin(progress * Math.PI * 3.5 + (idSeed % 3)) * 0.22;
      const curveWeight = progress + (harmonic1 + harmonic2) * 0.28;
      const clampedWeight = Math.max(0, Math.min(1.15, curveWeight));

      const midPort = Math.round(startPort + (endPort - startPort) * clampedWeight);
      const midWig = Math.round(startWig + (endWig - startWig) * (progress + Math.sin(progress * Math.PI * 2) * 0.15));

      return {
        date: `${nowDateStr} ${hour}`,
        portfolioVal: midPort,
        wig20Val: midWig
      };
    });
  }

  if (range === '3D') {
    // 3 dni sesyjne po 6 punktów śródsesyjnych = 18 punktów
    const sessionHours = ['09:30', '11:00', '12:30', '14:00', '15:30', '17:00'];
    const now = new Date(nowDateStr);
    const pts: { date: string; portfolioVal: number; wig20Val: number }[] = [];
    
    // Wartości bazowe 3 sesje wstecz
    const move3dPort = ((idSeed % 9) - 3) * 0.55;
    const move3dWig = ((idSeed % 7) - 3) * 0.42;
    const basePort3d = Math.round(endPort / (1 + move3dPort / 100));
    const baseWig3d = Math.round(endWig / (1 + move3dWig / 100));

    const totalSteps = 3 * sessionHours.length;
    let step = 0;

    for (let day = 2; day >= 0; day--) {
      const d = new Date(now.getTime() - day * 24 * 3600 * 1000);
      const dStr = d.toISOString().split('T')[0];

      sessionHours.forEach((hour) => {
        if (step === totalSteps - 1) {
          pts.push({ date: `${dStr.slice(5)} ${hour}`, portfolioVal: endPort, wig20Val: endWig });
        } else {
          const progress = step / (totalSteps - 1);
          const wave = Math.sin(step * 0.6 + (idSeed % 5)) * 0.18;
          const combinedProgress = Math.max(0, Math.min(1.12, progress + wave));
          const pPort = Math.round(basePort3d + (endPort - basePort3d) * combinedProgress);
          const pWig = Math.round(baseWig3d + (endWig - baseWig3d) * (progress + Math.sin(step * 0.5) * 0.12));

          pts.push({
            date: `${dStr.slice(5)} ${hour}`,
            portfolioVal: pPort,
            wig20Val: pWig
          });
        }
        step++;
      });
    }
    return pts;
  }

  return filterPointsByTimeRange(dailyPoints, range);
}

/**
 * Generuje punkty sesyjne/świecowe dostosowane do wybranego horyzontu (1D = sesja dzisiejsza intraday, 3D = 3 sesje, itd.)
 * Świece od 0 do 10 są stabilne i zamrożone - tylko ostatnia bieżąca świeca aktualizuje się na żywo do aktualnego kursu!
 * Dzięki temu świece nie skaczą ani nie 'ruszają się' bezustannie przy każdym ticku.
 */
function generateBarsForTimeRange(
  baseBars: HistoricalBar[],
  currentPrice: number,
  range: TimeRange,
  ticker: string = 'STOCK',
  stockQuote?: StockQuote
): HistoricalBar[] {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const tickerSeed = ticker.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);

  // Pobierz realne parametry sesji ze StockQuote
  const openPrice = stockQuote?.open && stockQuote.open > 0
    ? stockQuote.open
    : Number((currentPrice * (1 - ((seededRandom(tickerSeed + 13) - 0.48) * 0.016))).toFixed(2));
  
  const highPrice = stockQuote?.high && stockQuote.high >= Math.max(openPrice, currentPrice)
    ? stockQuote.high
    : Number((Math.max(openPrice, currentPrice) * (1 + (seededRandom(tickerSeed + 29) * 0.012 + 0.006))).toFixed(2));
    
  const lowPrice = stockQuote?.low && stockQuote.low <= Math.min(openPrice, currentPrice)
    ? stockQuote.low
    : Number((Math.min(openPrice, currentPrice) * (1 - (seededRandom(tickerSeed + 41) * 0.012 + 0.006))).toFixed(2));

  if (range === '1D') {
    // 12 świec sesji dzisiejszej (09:00 - 17:00)
    const hours = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
    const totalBars = hours.length;
    const intradayBars: HistoricalBar[] = [];

    let prevBarClose = openPrice;

    for (let index = 0; index < totalBars; index++) {
      const time = hours[index];
      const isLast = index === totalBars - 1;
      const progress = index / (totalBars - 1);

      const open = prevBarClose;
      
      let close: number;
      if (isLast) {
        // Tylko ostatnia świeca reaguje na żywo na bieżący kurs rynkowy
        close = currentPrice;
      } else {
        // Poprzednie świece są deterministycznie zamrożone - nie drgają przy re-renderze
        const sessionPath = openPrice + (currentPrice - openPrice) * Math.pow(progress, 0.95);
        const wave = Math.sin(index * 0.75 + (tickerSeed % 7)) * (Math.max(0.4, (highPrice - lowPrice) * 0.32));
        const swing = (seededRandom(tickerSeed + index * 31) - 0.48) * (Math.max(0.25, (highPrice - lowPrice) * 0.22));
        close = Number((sessionPath + wave + swing).toFixed(2));
        close = Math.max(lowPrice + 0.05, Math.min(highPrice - 0.05, close));
      }

      // Wyraźny korpus (min. 0.3% wartości waloru)
      const minBodySize = Math.max(0.25, currentPrice * 0.004);
      if (Math.abs(close - open) < minBodySize * 0.4) {
        const dir = (tickerSeed + index) % 2 === 0 ? 1 : -1;
        close = Number((open + dir * minBodySize).toFixed(2));
      }

      const candleBody = Math.abs(close - open);
      const wickSpan = Math.max(0.25, (highPrice - lowPrice) * 0.3, candleBody * 0.75);
      const topWick = Number((seededRandom(tickerSeed + index * 47) * wickSpan + 0.12).toFixed(2));
      const bottomWick = Number((seededRandom(tickerSeed + index * 61) * wickSpan + 0.12).toFixed(2));

      let high = Number((Math.max(open, close) + topWick).toFixed(2));
      let low = Number((Math.min(open, close) - bottomWick).toFixed(2));
      
      if (isLast) {
        high = Math.max(high, currentPrice, highPrice * 0.999);
        low = Math.min(low, currentPrice, lowPrice * 1.001);
      }

      intradayBars.push({
        date: `${dateStr} ${time}`,
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(Math.max(0.01, low).toFixed(2)),
        close: Number(close.toFixed(2)),
        volume: Math.floor(seededRandom(tickerSeed + index * 73) * 45000) + 12000
      });

      prevBarClose = close;
    }

    return intradayBars;
  }

  if (range === '3D') {
    // 3 dni sesyjne x 4 świece = 12 świec
    const bars3d: HistoricalBar[] = [];
    const times = ['09:30', '12:00', '14:30', '16:45'];
    const basePrice3d = Number((openPrice * 0.985).toFixed(2));
    let prevBarClose = basePrice3d;
    let step = 0;
    const totalSteps = 3 * times.length;

    for (let day = 2; day >= 0; day--) {
      const d = new Date(now.getTime() - day * 24 * 3600 * 1000);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const dStr = d.toISOString().split('T')[0];

      times.forEach((t) => {
        const isLast = step === totalSteps - 1;
        const progress = step / (totalSteps - 1);
        const open = prevBarClose;

        let close: number;
        if (isLast) {
          close = currentPrice;
        } else {
          const idealPath = basePrice3d + (currentPrice - basePrice3d) * Math.pow(progress, 0.95);
          const wave = Math.sin(step * 0.65 + (tickerSeed % 5)) * (Math.max(0.5, (highPrice - lowPrice) * 0.35));
          const swing = (seededRandom(tickerSeed + step * 23) - 0.48) * (Math.max(0.3, (highPrice - lowPrice) * 0.25));
          close = Number((idealPath + wave + swing).toFixed(2));
        }

        const minBodySize = Math.max(0.28, currentPrice * 0.005);
        if (Math.abs(close - open) < minBodySize * 0.4) {
          const dir = (tickerSeed + step) % 2 === 0 ? 1 : -1;
          close = Number((open + dir * minBodySize).toFixed(2));
        }

        const candleBody = Math.abs(close - open);
        const wickSpan = Math.max(0.3, (highPrice - lowPrice) * 0.35, candleBody * 0.8);
        const topWick = Number((seededRandom(tickerSeed + step * 37) * wickSpan + 0.15).toFixed(2));
        const bottomWick = Number((seededRandom(tickerSeed + step * 49) * wickSpan + 0.15).toFixed(2));

        const high = Number((Math.max(open, close) + topWick).toFixed(2));
        const low = Number((Math.max(0.01, Math.min(open, close) - bottomWick)).toFixed(2));

        bars3d.push({
          date: `${dStr.slice(5)} ${t}`,
          open: Number(open.toFixed(2)),
          high,
          low,
          close: Number(close.toFixed(2)),
          volume: Math.floor(seededRandom(tickerSeed + step * 57) * 40000) + 8000
        });

        prevBarClose = close;
        step++;
      });
    }
    return bars3d;
  }

  return filterPointsByTimeRange(baseBars, range);
}

const CustomTooltip = ({ active, payload, label, displayMode }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  const portVal = displayMode === 'percent' ? data.portfolioReturn : data.portfolioVal;
  const wigVal = displayMode === 'percent' ? data.wig20Return : (data.scaledWig20Val ?? data.wig20Val);

  // Układanie wskaźników wg wielkości wartości w danym punkcie (najwyższa wartość na samej górze)
  const items = [
    {
      id: 'portfolio',
      label: 'Portfel:',
      valNum: portVal,
      colorClass: 'text-emerald-400',
      dotClass: 'bg-emerald-400',
      formatted: displayMode === 'percent'
        ? `${data.portfolioReturn >= 0 ? '+' : ''}${data.portfolioReturn.toFixed(2)}% (${data.portfolioVal.toLocaleString('pl-PL')} PLN)`
        : `${data.portfolioVal.toLocaleString('pl-PL')} PLN (${data.portfolioReturn >= 0 ? '+' : ''}${data.portfolioReturn.toFixed(2)}%)`
    },
    {
      id: 'wig20',
      label: 'WIG20:',
      valNum: wigVal,
      colorClass: 'text-slate-400',
      dotClass: 'bg-slate-500',
      formatted: displayMode === 'percent'
        ? `${data.wig20Return >= 0 ? '+' : ''}${data.wig20Return.toFixed(2)}% (${data.wig20Val.toLocaleString('pl-PL')} PLN)`
        : `${(data.scaledWig20Val ?? data.wig20Val).toLocaleString('pl-PL')} PLN (${data.wig20Return >= 0 ? '+' : ''}${data.wig20Return.toFixed(2)}%)`
    }
  ].sort((a, b) => b.valNum - a.valNum);

  return (
    <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono z-50 min-w-[250px]">
      <div className="font-sans font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 flex justify-between items-center gap-4">
        <span>{label}</span>
        <span className="text-[10px] text-slate-400 font-normal">Krzywa Kapitału</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-sans font-semibold text-slate-300">
              <span className={`w-2 h-2 rounded-full ${item.dotClass}`}></span>
              {item.label}
            </span>
            <span className={`font-bold ${item.id === 'portfolio' ? 'text-emerald-400' : 'text-slate-300'}`}>
              {item.formatted}
            </span>
          </div>
        ))}
        <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between gap-4">
          <span className="text-slate-400 font-sans">Przewaga (Alpha):</span>
          <span className={`font-bold ${data.alpha >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.alpha >= 0 ? '+' : ''}{data.alpha.toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
};

const StockChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-slate-900/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono z-50">
      <div className="font-sans font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1.5 flex justify-between items-center gap-4">
        <span>{label}</span>
        <span className="text-[10px] text-slate-400 font-normal">Notowania Waloru</span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4 text-emerald-400">
          <span className="font-sans">Kurs (Close):</span>
          <span className="font-bold">{data.close?.toFixed(2)} zł</span>
        </div>
        {data.open && (
          <div className="flex justify-between gap-4 text-slate-400 text-[11px]">
            <span className="font-sans">Otwarcie (Open):</span>
            <span>{data.open?.toFixed(2)} zł</span>
          </div>
        )}
        {data.high && (
          <div className="flex justify-between gap-4 text-slate-400 text-[11px]">
            <span className="font-sans">Maksimum (High):</span>
            <span>{data.high?.toFixed(2)} zł</span>
          </div>
        )}
        {data.low && (
          <div className="flex justify-between gap-4 text-slate-400 text-[11px]">
            <span className="font-sans">Minimum (Low):</span>
            <span>{data.low?.toFixed(2)} zł</span>
          </div>
        )}
        {data.volume && (
          <div className="flex justify-between gap-4 text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
            <span className="font-sans">Wolumen:</span>
            <span>{data.volume.toLocaleString('pl-PL')} szt.</span>
          </div>
        )}
      </div>
    </div>
  );
};

const PORTFOLIO_COLORS: Record<string, string> = {
  wig20_bluechips: '#10b981',      // Emerald
  gpw_dividend_kings: '#f59e0b',   // Amber
  ai_tech_poland: '#06b6d4',       // Cyan
  small_caps_growth: '#a855f7',    // Purple
  commodities_poland: '#f97316',   // Orange
  short_hedging_gpw: '#f43f5e'     // Rose
};

const FALLBACK_PALETTE = ['#10b981', '#f59e0b', '#06b6d4', '#a855f7', '#f97316', '#3b82f6', '#ec4899', '#14b8a6', '#eab308'];

function getPortfolioColor(id: string, index: number): string {
  return PORTFOLIO_COLORS[id] || FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

export function getCommodityUsdPrice(ticker: string, pricePln: number): string | null {
  const upper = ticker.toUpperCase();
  if (upper.includes('XAU')) return `$${(pricePln / 3.95).toFixed(2)}`;
  if (upper.includes('CB') || upper.includes('BRENT')) return `$${(pricePln / 4.09).toFixed(2)}`;
  if (upper.includes('CL') || upper.includes('WTI')) return `$${(pricePln / 4.08).toFixed(2)}`;
  if (upper.includes('XAG') || upper.includes('SREBRO')) return `$${(pricePln / 3.95).toFixed(2)}`;
  if (upper.includes('XPT') || upper.includes('PLAT')) return `$${(pricePln / 4.00).toFixed(2)}`;
  if (upper.includes('COPPER') || upper.includes('MIEDZ') || upper.includes('MIEDŹ')) return `$${(pricePln / 4.00).toFixed(2)}`;
  if (upper.includes('NATGAS') || upper.includes('GAZ')) return `$${(pricePln / 4.00).toFixed(2)}`;
  if (upper.includes('WHEAT') || upper.includes('PSZEN')) return `$${(pricePln / 4.00).toFixed(2)}`;
  return null;
}

const AllPortfoliosTooltip = ({ active, payload, label, displayMode }: any) => {
  if (!active || !payload || !payload.length) return null;

  // Sortuj pozycje w legendzie zwięźle i dynamicznie wg wielkości wartości (najwyższa wartość na samej górze, najniższa na dole)
  const sortedPayload = [...payload].sort((a: any, b: any) => {
    const valA = typeof a.value === 'number' ? a.value : -Infinity;
    const valB = typeof b.value === 'number' ? b.value : -Infinity;
    return valB - valA;
  });

  return (
    <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs font-mono min-w-[270px] z-50">
      <p className="text-slate-400 font-semibold mb-2.5 pb-1 border-b border-slate-800 text-[11px] font-sans flex items-center justify-between">
        <span className="text-slate-400">Okres / Sesja:</span>
        <span className="text-white font-mono">{label}</span>
      </p>
      <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
        {sortedPayload.map((item: any, idx: number) => {
          const val = item.value;
          const formatted = displayMode === 'percent'
            ? `${val >= 0 ? '+' : ''}${typeof val === 'number' ? val.toFixed(2) : val}%`
            : `${typeof val === 'number' ? val.toLocaleString('pl-PL') : val} zł`;
          return (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300 font-sans text-[11px] truncate max-w-[170px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </span>
              <span className={`font-bold shrink-0 ${displayMode === 'percent' ? (val >= 0 ? 'text-emerald-400' : 'text-rose-400') : 'text-white'}`}>
                {formatted}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const TabPortfolios: React.FC<TabPortfoliosProps> = ({
  portfolios,
  onPortfoliosUpdate,
  trades,
  onTradesUpdate,
  stocks
}) => {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>(portfolios[0]?.id || 'wig20_bluechips');
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'AUTO-PILOT' | 'ZYSK (TP)' | 'STRATA (SL)' | 'REBALANCE'>('ALL');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Sorting state for Active Positions
  const [posSortField, setPosSortField] = useState<'ticker' | 'shares' | 'entryPrice' | 'currentPrice' | 'pnlPln' | 'pnlPercent'>('pnlPln');
  const [posSortOrder, setPosSortOrder] = useState<'asc' | 'desc'>('desc');

  // Sorting state for Trader Journal
  const [tradeSortField, setTradeSortField] = useState<'date' | 'ticker' | 'type' | 'pricePln' | 'shares' | 'totalPln' | 'resultPln'>('date');
  const [tradeSortOrder, setTradeSortOrder] = useState<'asc' | 'desc'>('desc');

  const portfolioBarRef = useRef<HTMLDivElement>(null);

  const scrollPortfolios = (direction: 'left' | 'right') => {
    if (portfolioBarRef.current) {
      const scrollAmount = direction === 'left' ? -260 : 260;
      portfolioBarRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const isAllPortfoliosSelected = selectedPortfolioId === 'ALL_PORTFOLIOS';
  const currentPortfolio = isAllPortfoliosSelected
    ? portfolios[0]
    : (portfolios.find(p => p.id === selectedPortfolioId) || portfolios[0]);

  const [chartDisplayMode, setChartDisplayMode] = useState<'percent' | 'pln'>('percent');
  const [portfolioTimeRange, setPortfolioTimeRange] = useState<TimeRange>('6M');

  // Aggregate statistics across all portfolios
  const aggregateStats = useMemo(() => {
    const totalCurrentBalance = portfolios.reduce((acc, p) => acc + (p.currentBalance || 0), 0);
    const totalInitialCapital = portfolios.reduce((acc, p) => acc + (p.initialCapital || 0), 0);
    const totalProfitPln = portfolios.reduce((acc, p) => acc + (p.totalProfitPln || 0), 0);
    const totalProfitPercent = totalInitialCapital > 0 ? (totalProfitPln / totalInitialCapital) * 100 : 0;
    const totalCashPln = portfolios.reduce((acc, p) => acc + (p.cashPln || 0), 0);
    const totalAllocatedPln = portfolios.reduce((acc, p) => acc + (p.allocatedPln || 0), 0);
    const totalPositionsCount = portfolios.reduce((acc, p) => acc + (p.activePositions?.length || 0), 0);
    const bestPortfolio = portfolios.length > 0
      ? [...portfolios].sort((a, b) => b.totalProfitPercent - a.totalProfitPercent)[0]
      : null;

    return {
      totalCurrentBalance,
      totalInitialCapital,
      totalProfitPln,
      totalProfitPercent,
      totalCashPln,
      totalAllocatedPln,
      totalPositionsCount,
      bestPortfolio
    };
  }, [portfolios]);

  // Multi-portfolio comparative chart data (all portfolios plotted together)
  const allPortfoliosChartData = useMemo(() => {
    if (!portfolios || portfolios.length === 0) return [];

    const seriesByPortfolio = portfolios.map(p => {
      const daily = generateDailyPortfolioPoints(p.historyData || []);
      const pts = generatePortfolioPointsForTimeRange(daily, portfolioTimeRange, p.id);
      return { portfolio: p, pts };
    });

    const samplePts = seriesByPortfolio[0]?.pts || [];
    if (samplePts.length === 0) return [];

    return samplePts.map((basePt, idx) => {
      const row: any = {
        date: basePt.date
      };

      let totalCombinedPln = 0;
      let totalBasePln = 0;

      seriesByPortfolio.forEach(({ portfolio, pts }) => {
        const pt = pts[idx] || pts[pts.length - 1] || basePt;
        const baseVal = pts[0]?.portfolioVal || portfolio.initialCapital || 100000;
        const currentVal = pt.portfolioVal;
        const retPct = ((currentVal - baseVal) / baseVal) * 100;

        row[portfolio.id] = chartDisplayMode === 'percent' ? Number(retPct.toFixed(2)) : currentVal;
        row[`${portfolio.id}_pln`] = currentVal;
        row[`${portfolio.id}_pct`] = Number(retPct.toFixed(2));

        totalCombinedPln += currentVal;
        totalBasePln += baseVal;
      });

      // Benchmark WIG20
      const baseWig = samplePts[0]?.wig20Val || 100000;
      const currentWig = basePt.wig20Val || baseWig;
      const wigReturn = ((currentWig - baseWig) / baseWig) * 100;
      const scaledWigVal = totalBasePln > 0 ? (totalBasePln / portfolios.length) * (currentWig / baseWig) : currentWig;

      row.wig20Return = Number(wigReturn.toFixed(2));
      row.scaledWig20Val = Math.round(scaledWigVal);
      row.totalPln = totalCombinedPln;
      row.totalReturn = totalBasePln > 0 ? Number((((totalCombinedPln - totalBasePln) / totalBasePln) * 100).toFixed(2)) : 0;

      return row;
    });
  }, [portfolios, portfolioTimeRange, chartDisplayMode]);

  const handleClosePosition = (pos: PositionItem, portfolioId?: string) => {
    const targetPortId = portfolioId || currentPortfolio?.id;
    if (!targetPortId) return;
    const targetPort = portfolios.find(p => p.id === targetPortId);
    const pnl = Number(((pos.currentPrice - pos.entryPrice) * pos.shares).toFixed(2));
    const pnlStr = `${pnl >= 0 ? '+' : ''}${pnl.toLocaleString('pl-PL')} PLN`;
    const totalValStr = (pos.shares * pos.currentPrice).toLocaleString('pl-PL');

    const confirmMsg = `Czy na pewno chcesz zamknąć pozycję ${pos.ticker} (${pos.name}) w portfelu "${targetPort?.name || targetPortId}"?\n\n• Wolumen: ${pos.shares} szt.\n• Aktualny kurs rynkowy: ${pos.currentPrice.toFixed(2)} zł\n• Wartość transakcji: ${totalValStr} PLN\n• Szacowany wynik PnL: ${pnlStr}\n\nŚrodki powrócą natychmiast do rezerwy gotówkowej portfela, a transakcja zostanie odnotowana w Dzienniku Tradera.`;

    if (window.confirm(confirmMsg)) {
      const res = PortfolioService.closePosition(targetPortId, pos.id);
      if (res.success) {
        onPortfoliosUpdate([...PortfolioService.getPortfolios()]);
        onTradesUpdate([...PortfolioService.getTrades()]);
        setToastMessage(`Pozycja ${pos.ticker} została pomyślnie zamknięta po kursie ${pos.currentPrice.toFixed(2)} zł (${pnlStr}).`);
        if (pnl > 0) {
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        }
        setTimeout(() => setToastMessage(null), 4000);
      } else {
        setToastMessage(res.message);
        setTimeout(() => setToastMessage(null), 3000);
      }
    }
  };

  // State for expanding active position individual stock chart
  const [expandedPosId, setExpandedPosId] = useState<string | null>(null);
  const [stockTimeRange, setStockTimeRange] = useState<TimeRange>('1M');
  const [stockChartStyle, setStockChartStyle] = useState<'candlestick' | 'line'>('candlestick');

  // Generate daily points for portfolio
  const dailyPortfolioPoints = useMemo(() => {
    if (!currentPortfolio || !currentPortfolio.historyData) return [];
    return generateDailyPortfolioPoints(currentPortfolio.historyData);
  }, [currentPortfolio]);

  // Filtered daily / intraday points by selected time range
  const filteredDailyPoints = useMemo(() => {
    return generatePortfolioPointsForTimeRange(dailyPortfolioPoints, portfolioTimeRange, currentPortfolio?.id || 'default');
  }, [dailyPortfolioPoints, portfolioTimeRange, currentPortfolio?.id]);

  // Chart data calculation relative to starting point of selected timeframe
  const chartData = useMemo(() => {
    if (!filteredDailyPoints || filteredDailyPoints.length === 0) return [];

    const basePort = filteredDailyPoints[0].portfolioVal || 100000;
    const baseWig = filteredDailyPoints[0].wig20Val || 100000;

    return filteredDailyPoints.map(pt => {
      const portfolioReturn = ((pt.portfolioVal - basePort) / basePort) * 100;
      const wig20Return = ((pt.wig20Val - baseWig) / baseWig) * 100;
      const alpha = portfolioReturn - wig20Return;
      const scaledWig20Val = basePort * (pt.wig20Val / baseWig);

      return {
        date: pt.date,
        portfolioVal: pt.portfolioVal,
        wig20Val: pt.wig20Val,
        scaledWig20Val: Math.round(scaledWig20Val),
        portfolioReturn,
        wig20Return,
        alpha
      };
    });
  }, [filteredDailyPoints]);

  // Summary statistics for selected timeframe
  const timeframeStats = useMemo(() => {
    if (!chartData || chartData.length === 0) {
      return { portReturn: 0, plnDiff: 0, wigReturn: 0, alpha: 0 };
    }
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    const plnDiff = last.portfolioVal - first.portfolioVal;
    const portReturn = last.portfolioReturn;
    const wigReturn = last.wig20Return;
    const alpha = last.alpha;
    return { portReturn, plnDiff, wigReturn, alpha };
  }, [chartData]);

  const handleRebalance = () => {
    if (!currentPortfolio) return;
    const res = PortfolioService.triggerSmartRebalance(currentPortfolio.id);
    if (res.success) {
      setToastMessage(res.message);
      onPortfoliosUpdate([...PortfolioService.getPortfolios()]);
      onTradesUpdate([...PortfolioService.getTrades()]);
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  const handleToggleAutoPilot = () => {
    if (!currentPortfolio) return;
    const newState = PortfolioService.toggleAutoPilot(currentPortfolio.id);
    onPortfoliosUpdate([...PortfolioService.getPortfolios()]);
    setToastMessage(`Auto-Pilot dla portfela "${currentPortfolio.name}": ${newState ? 'WŁĄCZONY (>= 76%)' : 'WYŁĄCZONY'}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleToggleTelegram = () => {
    if (!currentPortfolio) return;
    const newState = PortfolioService.toggleTelegram(currentPortfolio.id);
    onPortfoliosUpdate([...PortfolioService.getPortfolios()]);
    setToastMessage(`Powiadomienia Telegram dla portfela "${currentPortfolio.name}": ${newState ? 'WŁĄCZONE' : 'WYŁĄCZONE'}`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDeletePortfolio = () => {
    if (!currentPortfolio) return;
    if (portfolios.length <= 1) {
      setToastMessage('Nie można usunąć jedynego portfela w systemie.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    if (window.confirm(`Czy na pewno chcesz usunąć portfel "${currentPortfolio.name}"? Wszystkie otwarte pozycje zostaną zarchiwizowane.`)) {
      const res = PortfolioService.deletePortfolio(currentPortfolio.id);
      if (res.success) {
        const remaining = PortfolioService.getPortfolios();
        onPortfoliosUpdate([...remaining]);
        setSelectedPortfolioId(remaining[0]?.id || '');
        setToastMessage(res.message);
        setTimeout(() => setToastMessage(null), 3500);
      }
    }
  };

  const handlePortfolioCreated = (newPort: PortfolioStrategy) => {
    onPortfoliosUpdate([...PortfolioService.getPortfolios()]);
    setSelectedPortfolioId(newPort.id);
    setToastMessage(`Portfel "${newPort.name}" został pomyślnie utworzony!`);
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleExportCsv = () => {
    PortfolioService.exportTradesToCsv();
  };

  // Sorted Active Positions
  const sortedPositions = useMemo(() => {
    if (!currentPortfolio?.activePositions) return [];
    return [...currentPortfolio.activePositions].sort((a, b) => {
      const valA = a[posSortField];
      const valB = b[posSortField];
      if (posSortOrder === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
  }, [currentPortfolio, posSortField, posSortOrder]);

  const togglePosSort = (field: typeof posSortField) => {
    if (posSortField === field) {
      setPosSortOrder(posSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setPosSortField(field);
      setPosSortOrder('desc');
    }
  };

  // Filtered & Sorted Trades
  const filteredAndSortedTrades = useMemo(() => {
    return trades
      .filter(t => {
        if (tradeFilter === 'ALL') return true;
        return t.status === tradeFilter;
      })
      .sort((a, b) => {
        const valA = a[tradeSortField];
        const valB = b[tradeSortField];
        if (tradeSortOrder === 'asc') return valA > valB ? 1 : -1;
        return valA < valB ? 1 : -1;
      });
  }, [trades, tradeFilter, tradeSortField, tradeSortOrder]);

  const toggleTradeSort = (field: typeof tradeSortField) => {
    if (tradeSortField === field) {
      setTradeSortOrder(tradeSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setTradeSortField(field);
      setTradeSortOrder('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/60 text-emerald-300 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-sm font-medium animate-bounce">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Portfolio Selector Bar with Horizontal < and > Scroll + '+' Button */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-lg flex items-center gap-2">
        {/* Scroll Left Button */}
        <button
          onClick={() => scrollPortfolios('left')}
          title="Przewiń portfele w lewo (<)"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrollable Portfolios List */}
        <div
          ref={portfolioBarRef}
          className="flex items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-1"
        >
          {/* Wszystkie Portfele (Zbiorczo) Tile */}
          <button
            onClick={() => setSelectedPortfolioId('ALL_PORTFOLIOS')}
            title="Wszystkie Portfele na jednym wykresie • Zbiorcza analiza wyników w PLN i %"
            className={`p-3 rounded-xl text-left transition-all border shrink-0 w-56 sm:w-64 cursor-pointer relative ${
              isAllPortfoliosSelected
                ? 'bg-gradient-to-br from-emerald-950/70 to-teal-950/60 border-emerald-400 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Zbiorczo</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                aggregateStats.totalProfitPercent >= 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950 text-rose-400 border border-rose-800/50'
              }`}>
                {aggregateStats.totalProfitPercent >= 0 ? '+' : ''}{aggregateStats.totalProfitPercent.toFixed(1)}%
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-100 truncate">Wszystkie Portfele ({portfolios.length})</h4>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mt-1">
              <span className="text-emerald-400 font-semibold">{aggregateStats.totalCurrentBalance.toLocaleString('pl-PL')} PLN</span>
              <span className="text-[10px] text-slate-400 font-sans">Wykres Multi</span>
            </div>
          </button>

          {portfolios.map(p => {
            const isSelected = p.id === selectedPortfolioId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPortfolioId(p.id)}
                title={`Portfel: ${p.name} • Saldo: ${p.currentBalance.toLocaleString('pl-PL')} PLN • Wynik: ${p.totalProfitPercent.toFixed(1)}%`}
                className={`p-3 rounded-xl text-left transition-all border shrink-0 w-52 sm:w-60 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-950/50 border-emerald-500 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">{p.riskLevel}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    p.totalProfitPercent >= 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                  }`}>
                    {p.totalProfitPercent >= 0 ? '+' : ''}{p.totalProfitPercent.toFixed(1)}%
                  </span>
                </div>
                <h4 className="text-xs font-bold text-slate-100 truncate">{p.name}</h4>
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mt-1">
                  <span>{p.currentBalance.toLocaleString('pl-PL')} PLN</span>
                  <div className="flex items-center gap-1">
                    {p.autoPilotEnabled && <span title="Auto-Pilot aktywny" className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                    {p.telegramEnabled && <span title="Alerty Telegram aktywne" className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          onClick={() => scrollPortfolios('right')}
          title="Przewiń portfele w prawo (>)"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 shrink-0 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* '+' Add New Portfolio Button */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          title="Dodaj nowy portfel inwestycyjny GPW (+)"
          className="p-3 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center justify-center shrink-0 shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Main Portfolio Overview Panel or All Portfolios Comparative View */}
      {isAllPortfoliosSelected ? (
        <div className="space-y-6">
          {/* Top Aggregate Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">Łączny Kapitał Portfeli</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-emerald-400 block mt-1">
                {aggregateStats.totalCurrentBalance.toLocaleString('pl-PL')} PLN
              </span>
              <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                Kapitał pocz.: {aggregateStats.totalInitialCapital.toLocaleString('pl-PL')} PLN
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">Łączny Wynik Funduszu</span>
              <span className={`text-lg sm:text-xl font-bold font-mono block mt-1 ${aggregateStats.totalProfitPln >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {aggregateStats.totalProfitPln >= 0 ? '+' : ''}{aggregateStats.totalProfitPln.toLocaleString('pl-PL')} PLN
              </span>
              <span className={`text-[10px] font-mono font-semibold block mt-0.5 ${aggregateStats.totalProfitPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {aggregateStats.totalProfitPercent >= 0 ? '+' : ''}{aggregateStats.totalProfitPercent.toFixed(2)}% od startu
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">Rezerwa Gotówkowa</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-sky-400 block mt-1">
                {aggregateStats.totalCashPln.toLocaleString('pl-PL')} PLN
              </span>
              <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                {aggregateStats.totalCurrentBalance > 0 ? ((aggregateStats.totalCashPln / aggregateStats.totalCurrentBalance) * 100).toFixed(1) : 0}% w gotówce
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
              <span className="text-[11px] text-slate-400 block font-sans">Portfel Lider</span>
              <span className="text-sm sm:text-base font-bold text-yellow-400 block mt-1 truncate" title={aggregateStats.bestPortfolio?.name}>
                {aggregateStats.bestPortfolio?.name || 'Brak'}
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold block mt-0.5">
                +{aggregateStats.bestPortfolio?.totalProfitPercent.toFixed(1)}% zysku
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg col-span-2 sm:col-span-1">
              <span className="text-[11px] text-slate-400 block font-sans">Aktywne Pozycje Funduszu</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-white block mt-1">
                {aggregateStats.totalPositionsCount} spółek / surowców
              </span>
              <span className="text-[10px] text-slate-500 font-sans block mt-0.5">
                {portfolios.length} aktywnych portfeli
              </span>
            </div>
          </div>

          {/* Multi-Line Chart Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            {/* Chart Header with Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg sm:text-xl font-bold text-white">Porównanie Wartości Wszystkich Portfeli</h2>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-lg">
                    {portfolios.length} strategii + WIG20
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Wieloliniowa krzywa kapitału prezentująca równoległą dynamikę wszystkich portfeli GPW i benchmarku
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* % vs PLN Toggle */}
                <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs font-semibold">
                  <button
                    onClick={() => setChartDisplayMode('percent')}
                    title="Pokaż dynamikę względną stóp zwrotu w %"
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      chartDisplayMode === 'percent'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Zwrot (%)
                  </button>
                  <button
                    onClick={() => setChartDisplayMode('pln')}
                    title="Pokaż nominalną wycenę portfeli w PLN (zł)"
                    className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                      chartDisplayMode === 'pln'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Wartość w zł (PLN)
                  </button>
                </div>

                {/* Timeframe Buttons */}
                <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs font-semibold overflow-x-auto">
                  {(['1D', '3D', '1W', '2W', '1M', '3M', '6M', 'ALL'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setPortfolioTimeRange(range)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        portfolioTimeRange === range
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {range === 'ALL' ? 'Wszystkie' : range}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recharts Multi-Line Comparative Chart */}
            <div className="h-[380px] w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={allPortfoliosChartData} margin={{ top: 15, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    tickFormatter={(val) => {
                      if (typeof val !== 'string') return val;
                      if (val.includes(':')) {
                        const parts = val.split(' ');
                        return parts.length > 1 ? parts[1] : val;
                      }
                      return val.slice(5);
                    }}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: '#334155' }}
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => {
                      if (chartDisplayMode === 'percent') {
                        const abs = Math.abs(val);
                        return `${val >= 0 ? '+' : ''}${abs < 10 ? val.toFixed(1) : val.toFixed(0)}%`;
                      }
                      return `${(val / 1000).toFixed(1)}k zł`;
                    }}
                  />
                  <Tooltip content={<AllPortfoliosTooltip displayMode={chartDisplayMode} />} />

                  {/* Portfolio Lines */}
                  {portfolios.map((p, idx) => (
                    <Line
                      key={p.id}
                      type="monotone"
                      dataKey={p.id}
                      name={p.name}
                      stroke={getPortfolioColor(p.id, idx)}
                      strokeWidth={2.4}
                      dot={allPortfoliosChartData.length <= 18 ? { r: 2.5, fill: getPortfolioColor(p.id, idx) } : false}
                      activeDot={{ r: 5, fill: getPortfolioColor(p.id, idx), stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  ))}

                  {/* Benchmark WIG20 Line */}
                  <Line
                    type="monotone"
                    dataKey={chartDisplayMode === 'percent' ? 'wig20Return' : 'scaledWig20Val'}
                    name="Benchmark WIG20"
                    stroke="#94a3b8"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#94a3b8' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Interactive Legend with Portfolio Pills */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-slate-400 font-sans mr-1">Legenda:</span>
              {portfolios.map((p, idx) => {
                const color = getPortfolioColor(p.id, idx);
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPortfolioId(p.id)}
                    title={`Przejdź do szczegółów portfela "${p.name}"`}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs transition-colors cursor-pointer group"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-slate-300 group-hover:text-white font-medium">{p.name}:</span>
                    <span className="font-mono text-white font-semibold">
                      {chartDisplayMode === 'percent'
                        ? `${p.totalProfitPercent >= 0 ? '+' : ''}${p.totalProfitPercent.toFixed(1)}%`
                        : `${p.currentBalance.toLocaleString('pl-PL')} zł`}
                    </span>
                  </button>
                );
              })}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs">
                <span className="w-3 h-0.5 border-t border-dashed border-slate-400" />
                <span className="text-slate-400">Benchmark WIG20</span>
              </div>
            </div>
          </div>

          {/* Portfolios Comparison Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center justify-between">
              <span>Zestawienie Szczegółowe Portfeli Modelowych GPW</span>
              <span className="text-xs font-normal text-slate-400">Kliknij "Szczegóły", aby otworzyć widok pojedynczego portfela</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                    <th className="pb-3 px-3">Portfel / Strategia</th>
                    <th className="pb-3 px-3">Profil Ryzyka</th>
                    <th className="pb-3 px-3 text-right">Saldo Całkowite</th>
                    <th className="pb-3 px-3 text-right">Wolna Gotówka</th>
                    <th className="pb-3 px-3 text-right">Zaangażowanie</th>
                    <th className="pb-3 px-3 text-right">Wynik Łączny</th>
                    <th className="pb-3 px-3 text-center">Otwarte Pozycje</th>
                    <th className="pb-3 px-3 text-center">Auto-Pilot</th>
                    <th className="pb-3 px-3 text-center">Akcja</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {portfolios.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getPortfolioColor(p.id, idx) }} />
                          <div>
                            <span className="font-bold text-white block">{p.name}</span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">{p.shortDesc}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-yellow-400 border border-slate-700">
                          {p.riskLevel}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-white">
                        {p.currentBalance.toLocaleString('pl-PL')} zł
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {p.cashPln.toLocaleString('pl-PL')} zł
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {p.allocatedPln.toLocaleString('pl-PL')} zł
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className={`font-bold block ${p.totalProfitPln >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {p.totalProfitPln >= 0 ? '+' : ''}{p.totalProfitPln.toLocaleString('pl-PL')} zł
                        </span>
                        <span className={`text-[10px] ${p.totalProfitPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {p.totalProfitPercent >= 0 ? '+' : ''}{p.totalProfitPercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-300 font-sans">
                        {p.activePositions?.length || 0} szt.
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        {p.autoPilotEnabled ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                            WŁ (≥76%)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                            WYŁ
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <button
                          onClick={() => setSelectedPortfolioId(p.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700 hover:border-emerald-500 transition-all cursor-pointer"
                        >
                          Szczegóły →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* All Portfolios Combined Active Positions Table with "Zamknij" Button */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Wszystkie Otwarte Pozycje Funduszu ({aggregateStats.totalPositionsCount})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Zbiorczy podgląd pozycji ze wszystkich portfeli z możliwością natychmiastowego ręcznego zamknięcia.
                </p>
              </div>
            </div>

            {aggregateStats.totalPositionsCount === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Brak otwartych pozycji w żadnym z portfeli.
              </div>
            ) : (
              <div className="overflow-x-auto relative">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold select-none">
                      <th className="pb-3 px-3">Portfel</th>
                      <th className="pb-3 px-3">Walor GPW</th>
                      <th className="pb-3 px-3">Pakiet</th>
                      <th className="pb-3 px-3">Wejście</th>
                      <th className="pb-3 px-3">Aktualny Kurs</th>
                      <th className="pb-3 px-3">TP1 (33%)</th>
                      <th className="pb-3 px-3">TP2 (33%)</th>
                      <th className="pb-3 px-3">TP3 (34%)</th>
                      <th className="pb-3 px-3">Stop Loss</th>
                      <th className="pb-3 px-3 text-right">Wynik PnL</th>
                      <th className="pb-3 px-3 text-center">Akcja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {portfolios.flatMap(p =>
                      (p.activePositions || []).map(pos => (
                        <tr key={`${p.id}_${pos.id}`} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-sans">
                            <span className="text-xs font-semibold text-slate-300 block truncate max-w-[130px]">{p.name}</span>
                          </td>
                          <td className="py-3 px-3 font-sans">
                            <span className="font-bold text-white block">{pos.ticker}</span>
                            <span className="text-[11px] text-slate-400 block truncate max-w-[90px]">{pos.name}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">{pos.shares} szt.</td>
                          <td className="py-3 px-3 text-slate-300">{pos.entryPrice.toFixed(2)} zł</td>
                          <td className="py-3 px-3 font-bold text-white">
                            <div>{pos.currentPrice.toFixed(2)} zł</div>
                            {getCommodityUsdPrice(pos.ticker, pos.currentPrice) && (
                              <div className="text-[10px] text-amber-400 font-sans font-normal" title="Cena w dolarach (USD)">
                                {getCommodityUsdPrice(pos.ticker, pos.currentPrice)}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pos.tp1Reached ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-slate-800 text-slate-400'}`}>
                              {pos.targetPrice1.toFixed(2)} zł {pos.tp1Reached ? '✓' : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pos.tp2Reached ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-slate-800 text-slate-400'}`}>
                              {pos.targetPrice2.toFixed(2)} zł {pos.tp2Reached ? '✓' : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${pos.tp3Reached ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60' : 'bg-slate-800 text-slate-400'}`}>
                              {pos.targetPrice3.toFixed(2)} zł {pos.tp3Reached ? '✓' : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-rose-400">{pos.stopLoss.toFixed(2)} zł</td>
                          <td className="py-3 px-3 text-right">
                            <span className={`font-bold block ${pos.pnlPln >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {pos.pnlPln >= 0 ? '+' : ''}{pos.pnlPln.toLocaleString('pl-PL')} PLN
                            </span>
                            <span className={`text-[10px] ${pos.pnlPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-sans">
                            <button
                              onClick={() => handleClosePosition(pos, p.id)}
                              title={`Zamknij natychmiast pozycję ${pos.ticker} z portfela "${p.name}" po kursie ${pos.currentPrice.toFixed(2)} zł`}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-700/60 transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-sm"
                            >
                              <X className="w-3.5 h-3.5 text-rose-400" />
                              <span>Zamknij</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : currentPortfolio ? (
        <div className="space-y-6">
          {/* Kafelek 1: Statystyki i Krzywa Kapitału (Pełna Szerokość Okna) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-white">{currentPortfolio.name}</h2>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-800 text-yellow-400 border border-slate-700 rounded-lg">
                      {currentPortfolio.riskLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">{currentPortfolio.shortDesc}</p>
                </div>

                {/* Portfolio Control Buttons: AutoPilot, Telegram, Delete, Rebalance */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Auto-Pilot Toggle */}
                  <button
                    onClick={handleToggleAutoPilot}
                    title="Przełącz automatyczne zawieranie transakcji Auto-Pilot (poziom konsensusu >= 76%) dla tego portfela"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      currentPortfolio.autoPilotEnabled
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/70 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <Zap className={`w-3.5 h-3.5 ${currentPortfolio.autoPilotEnabled ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                    <span>Auto-Pilot: {currentPortfolio.autoPilotEnabled ? 'WŁ' : 'WYŁ'}</span>
                  </button>

                  {/* Telegram Toggle */}
                  <button
                    onClick={handleToggleTelegram}
                    title="Przełącz wysyłanie alertów i powiadomień Telegram dla transakcji z tego portfela"
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      currentPortfolio.telegramEnabled
                        ? 'bg-sky-950/80 text-sky-300 border-sky-500/70 shadow-sm'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <Send className={`w-3.5 h-3.5 ${currentPortfolio.telegramEnabled ? 'text-sky-400' : 'text-slate-500'}`} />
                    <span>Telegram: {currentPortfolio.telegramEnabled ? 'WŁ' : 'WYŁ'}</span>
                  </button>

                  {/* Smart Rebalance Button */}
                  <button
                    onClick={handleRebalance}
                    title="Optymalizuje alokację kapitału i zabezpiecza 20% bufor gotówki w PLN"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-950/30 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Rebalance</span>
                  </button>

                  {/* Delete Portfolio Button */}
                  {portfolios.length > 1 && (
                    <button
                      onClick={handleDeletePortfolio}
                      title="Usuń ten portfel i zarchiwizuj jego transakcje"
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Metric KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3"
                  title="Łączna aktualna wartość portfela (akcje + gotówka w PLN)"
                >
                  <p className="text-[11px] text-slate-400">Wartość Całkowita</p>
                  <p className="text-base font-black text-white font-mono mt-0.5">
                    {currentPortfolio.currentBalance.toLocaleString('pl-PL')} <span className="text-xs font-normal text-slate-400">PLN</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Start: {currentPortfolio.initialCapital.toLocaleString('pl-PL')} PLN</p>
                </div>

                <div
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3"
                  title="Skumulowany zysk wygenerowany przez ten portfel od początku inwestycji"
                >
                  <p className="text-[11px] text-slate-400">Zysk Całkowity</p>
                  <p className="text-base font-black text-emerald-400 font-mono mt-0.5">
                    +{currentPortfolio.totalProfitPln.toLocaleString('pl-PL')} <span className="text-xs font-normal text-slate-400">PLN</span>
                  </p>
                  <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">+{currentPortfolio.totalProfitPercent.toFixed(2)}% ROI</p>
                </div>

                <div
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3"
                  title="Zwrot benchmarku WIG20 oraz przewaga rynkowa (Alpha) osiągnięta przez portfel"
                >
                  <p className="text-[11px] text-slate-400">Benchmark WIG20</p>
                  <p className="text-base font-black text-slate-200 font-mono mt-0.5">
                    +{currentPortfolio.benchmarkReturnWig20.toFixed(2)}%
                  </p>
                  <p className="text-[10px] text-emerald-400 font-bold mt-0.5">
                    Alpha: +{currentPortfolio.alpha.toFixed(2)}% vs GPW
                  </p>
                </div>

                <div
                  className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3"
                  title="Wskaźnik zyskownych transakcji w stosunku do wszystkich zamkniętych pozycji"
                >
                  <p className="text-[11px] text-slate-400">Trafność / Transakcje</p>
                  <p className="text-base font-black text-indigo-400 font-mono mt-0.5">
                    {currentPortfolio.winRate.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{currentPortfolio.tradesCount} zamkniętych zleceń</p>
                </div>
              </div>

              {/* Comparison Equity Curve Chart */}
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs mb-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="font-semibold text-slate-200">Krzywa Kapitału vs Indeks WIG20</span>
                    <div className="flex items-center gap-3 text-[11px]">
                      <span className="flex items-center gap-1.5" title="Krzywa wzrostu kapitału strategii portfela">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                        <span className="text-slate-300">
                          Portfel ({timeframeStats.portReturn >= 0 ? '+' : ''}{timeframeStats.portReturn.toFixed(1)}% / {timeframeStats.plnDiff >= 0 ? '+' : ''}{timeframeStats.plnDiff.toLocaleString('pl-PL')} PLN)
                        </span>
                      </span>
                      <span className="flex items-center gap-1.5" title="Stopa zwrotu indeksu szerokiego rynku WIG20">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
                        <span className="text-slate-400">
                          WIG20 ({timeframeStats.wigReturn >= 0 ? '+' : ''}{timeframeStats.wigReturn.toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Right side controls: Timeframe selector buttons & % / PLN view toggle */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Timeframe Buttons */}
                    <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                      {(['1D', '3D', '1W', '2W', '1M', '3M', '6M', 'ALL'] as TimeRange[]).map(range => (
                        <button
                          key={range}
                          onClick={() => setPortfolioTimeRange(range)}
                          className={`px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                            portfolioTimeRange === range
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {range === 'ALL' ? 'Wszystkie' : range}
                        </button>
                      ))}
                    </div>

                    {/* Mode Selector Toggle (% vs PLN) */}
                    <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                      <button
                        onClick={() => setChartDisplayMode('percent')}
                        className={`px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                          chartDisplayMode === 'percent'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        %
                      </button>
                      <button
                        onClick={() => setChartDisplayMode('pln')}
                        className={`px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                          chartDisplayMode === 'pln'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        PLN
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recharts Curve */}
                <div className="h-56 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                        tickFormatter={(val) => {
                          if (typeof val !== 'string') return val;
                          if (val.includes(':')) {
                            const parts = val.split(' ');
                            return parts.length > 1 ? parts[1] : val;
                          }
                          return val.slice(5);
                        }}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: '#334155' }}
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => {
                          if (chartDisplayMode === 'percent') {
                            const abs = Math.abs(val);
                            return `${val >= 0 ? '+' : ''}${abs < 10 ? val.toFixed(1) : val.toFixed(0)}%`;
                          }
                          return `${(val / 1000).toFixed(1)}k zł`;
                        }}
                      />
                      <Tooltip content={<CustomTooltip displayMode={chartDisplayMode} />} />
                      
                      <Area
                        type="monotone"
                        dataKey={chartDisplayMode === 'percent' ? 'portfolioReturn' : 'portfolioVal'}
                        name="Portfel"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#portfolioGradient)"
                        dot={chartData.length <= 20 ? { r: 2.5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 1 } : false}
                        activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey={chartDisplayMode === 'percent' ? 'wig20Return' : 'scaledWig20Val'}
                        name="WIG20"
                        stroke="#64748b"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                        activeDot={{ r: 4, fill: '#64748b' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Kafelek 2: Otwarte Pozycje & Mechanika Multi-TP (Pełna Szerokość Okna) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Otwarte Pozycje & Mechanika Multi-TP (33/33/34)</span>
                    <span className="text-xs font-normal text-slate-400">({currentPortfolio.activePositions.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Pierwsza kolumna jest nieruchoma podczas przewijania. Kliknij nagłówki, aby posortować.
                  </p>
                </div>
              </div>

              {currentPortfolio.activePositions.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  Brak otwartych pozycji w tym portfelu. Użyj zakładki "Etap 2: Live Konsensus", aby aktywować zlecenie.
                </div>
              ) : (
                <div className="overflow-x-auto relative">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-semibold select-none">
                        {/* Sticky Column 1: Spółka GPW */}
                        <th
                          onClick={() => togglePosSort('ticker')}
                          className="pb-3 sticky left-0 z-20 bg-slate-900 px-3 cursor-pointer hover:text-white min-w-[130px]"
                          title="Kliknij, aby posortować po symbolu waloru"
                        >
                          <div className="flex items-center gap-1">
                            <span>Walor / Surowiec</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th
                          onClick={() => togglePosSort('shares')}
                          className="pb-3 px-3 cursor-pointer hover:text-white"
                          title="Kliknij, aby posortować po ilości akcji"
                        >
                          <div className="flex items-center gap-1">
                            <span>Pakiet (szt.)</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th
                          onClick={() => togglePosSort('entryPrice')}
                          className="pb-3 px-3 cursor-pointer hover:text-white"
                          title="Kliknij, aby posortować po cenie wejścia"
                        >
                          <div className="flex items-center gap-1">
                            <span>Wejście</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th
                          onClick={() => togglePosSort('currentPrice')}
                          className="pb-3 px-3 cursor-pointer hover:text-white"
                          title="Kliknij, aby posortować po aktualnym kursie"
                        >
                          <div className="flex items-center gap-1">
                            <span>Aktualny Kurs</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th className="pb-3 px-3" title="Poziom realizacji 33% zysku i przesunięcia SL na wejście">TP1 (33%)</th>
                        <th className="pb-3 px-3" title="Poziom realizacji kolejnych 33% zysku">TP2 (33%)</th>
                        <th className="pb-3 px-3" title="Poziom realizacji ostatnich 34% pozycji">TP3 (34%)</th>
                        <th className="pb-3 px-3" title="Poziom obrony kapitału Stop Loss">Stop Loss</th>
                        <th
                          onClick={() => togglePosSort('pnlPln')}
                          className="pb-3 px-3 text-right cursor-pointer hover:text-white min-w-[110px]"
                          title="Kliknij, aby posortować po wyniku PnL"
                        >
                          <div className="flex items-center justify-end gap-1">
                            <span>Wynik PnL</span>
                            <ArrowUpDown className="w-3 h-3" />
                          </div>
                        </th>
                        <th className="pb-3 px-3 text-center" title="Ręczne zamknięcie pozycji po aktualnym kursie">Akcja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {sortedPositions.map(pos => {
                        const isExpanded = expandedPosId === pos.id;
                        return (
                          <React.Fragment key={pos.id}>
                            <tr className="hover:bg-slate-800/40 transition-colors">
                              {/* Sticky Column 1: Spółka GPW + Wykres Button */}
                              <td className="py-3 sticky left-0 z-10 bg-slate-900 px-3 font-sans shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                <div className="flex items-center justify-between gap-2 min-w-[150px]">
                                  <div>
                                    <span className="font-bold text-white block">{pos.ticker}</span>
                                    <span className="text-[11px] text-slate-400 block truncate max-w-[95px]">{pos.name}</span>
                                  </div>
                                  <button
                                    onClick={() => setExpandedPosId(isExpanded ? null : pos.id)}
                                    title="Pokaż/Ukryj interaktywny wykres notowań tego waloru z poziomami WEJŚCIE / SL / TP"
                                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-all flex items-center gap-1 cursor-pointer shrink-0 ${
                                      isExpanded
                                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                                    }`}
                                  >
                                    <BarChart2 className="w-3 h-3" />
                                    <span>{isExpanded ? 'Zamknij' : 'Wykres'}</span>
                                  </button>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-slate-300">{pos.shares} szt.</td>
                              <td className="py-3 px-3 text-slate-300">{pos.entryPrice.toFixed(2)} zł</td>
                              <td className="py-3 px-3 font-bold text-white">
                                <div>{pos.currentPrice.toFixed(2)} zł</div>
                                {getCommodityUsdPrice(pos.ticker, pos.currentPrice) && (
                                  <div className="text-[10px] text-amber-400 font-sans font-normal" title="Cena w dolarach (USD)">
                                    {getCommodityUsdPrice(pos.ticker, pos.currentPrice)}
                                  </div>
                                )}
                              </td>

                              {/* TP1 Status */}
                              <td className="py-3 px-3">
                                <span
                                  title={pos.tp1Reached ? 'Zrealizowano 33% pozycji z zyskiem' : 'Oczekiwanie na poziom TP1'}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    pos.tp1Reached
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {pos.targetPrice1.toFixed(2)} zł {pos.tp1Reached ? '✓' : ''}
                                </span>
                              </td>

                              {/* TP2 Status */}
                              <td className="py-3 px-3">
                                <span
                                  title={pos.tp2Reached ? 'Zrealizowano kolejne 33% pozycji z zyskiem' : 'Oczekiwanie na poziom TP2'}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    pos.tp2Reached
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {pos.targetPrice2.toFixed(2)} zł {pos.tp2Reached ? '✓' : ''}
                                </span>
                              </td>

                              {/* TP3 Status */}
                              <td className="py-3 px-3">
                                <span
                                  title={pos.tp3Reached ? 'Zrealizowano ostatnie 34% pozycji z zyskiem' : 'Oczekiwanie na poziom TP3'}
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    pos.tp3Reached
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {pos.targetPrice3.toFixed(2)} zł {pos.tp3Reached ? '✓' : ''}
                                </span>
                              </td>

                              {/* Stop Loss */}
                              <td className="py-3 px-3 text-rose-400" title="Cena ucięcia strat">{pos.stopLoss.toFixed(2)} zł</td>

                              {/* PnL */}
                              <td className="py-3 px-3 text-right">
                                <span className={`font-bold block ${pos.pnlPln >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {pos.pnlPln >= 0 ? '+' : ''}{pos.pnlPln.toLocaleString('pl-PL')} PLN
                                </span>
                                <span className={`text-[10px] ${pos.pnlPercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                  {pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%
                                </span>
                              </td>

                              {/* Akcja: Przycisk Zamknij */}
                              <td className="py-3 px-3 text-center">
                                <button
                                  onClick={() => handleClosePosition(pos)}
                                  title={`Zamknij pozycję ${pos.ticker} po bieżącym kursie ${pos.currentPrice.toFixed(2)} zł`}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white border border-rose-700/60 transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-sm"
                                >
                                  <X className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Zamknij</span>
                                </button>
                              </td>
                            </tr>

                            {/* Expandable Individual Asset Chart Row */}
                            {isExpanded && (
                              <tr key={`${pos.id}_chart_row`} className="bg-slate-950/95">
                                <td colSpan={10} className="p-4 border-b border-slate-800/80">
                                  {(() => {
                                    const matchingStock = stocks.find(
                                      s => s.symbol.toLowerCase() === pos.ticker.toLowerCase() ||
                                           s.cleanSymbol.toLowerCase() === pos.ticker.replace('.PL', '').toLowerCase()
                                    );

                                    let rawBars = matchingStock?.history || [];
                                    if (rawBars.length === 0) {
                                      let p = Number((pos.entryPrice * 0.88).toFixed(2));
                                      const now = new Date();
                                      const symSeed = pos.ticker.split('').reduce((acc, c, idx) => acc + c.charCodeAt(0) * (idx + 1), 0);
                                      for (let i = 180; i >= 0; i--) {
                                        const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
                                        if (d.getDay() === 0 || d.getDay() === 6) continue;
                                        const progress = (180 - i) / 180;
                                        const target = pos.currentPrice * (0.88 + 0.12 * Math.pow(progress, 0.85));
                                        const wave = Math.sin(i / 5) * (pos.currentPrice * 0.025);

                                        const open = p;
                                        const pseudo = Math.sin(symSeed + i * 31.7) * 0.5 + 0.5;
                                        const dailySwing = (pseudo - 0.47) * (pos.currentPrice * 0.022);
                                        const trendPull = (target + wave - open) * 0.18;
                                        let close = i === 0 ? pos.currentPrice : Number((open + dailySwing + trendPull).toFixed(2));
                                        close = Math.max(0.05, close);

                                        const bodySize = Math.abs(close - open);
                                        const wickBase = Math.max(pos.currentPrice * 0.006, bodySize * 0.35);
                                        const wickP = Math.sin(symSeed + i * 47.3) * 0.5 + 0.5;

                                        const high = Number((Math.max(open, close) + wickP * wickBase).toFixed(2));
                                        const low = Number((Math.max(0.01, Math.min(open, close) - (1 - wickP) * wickBase)).toFixed(2));

                                        rawBars.push({
                                          date: d.toISOString().split('T')[0],
                                          open: Number(open.toFixed(2)),
                                          high,
                                          low,
                                          close,
                                          volume: Math.floor(pseudo * 200000) + 10000
                                        });
                                        p = close;
                                      }
                                    }

                                    const rawFilteredBars = generateBarsForTimeRange(rawBars, pos.currentPrice, stockTimeRange, pos.ticker, matchingStock);

                                    // Dynamiczna dziedzina YAxis zoptymalizowana ściśle pod widoczne świece
                                    const prices = rawFilteredBars.flatMap(b => [b.open, b.close, b.high, b.low].filter(Boolean));
                                    const pMin = prices.length > 0 ? Math.min(...prices) : pos.currentPrice * 0.98;
                                    const pMax = prices.length > 0 ? Math.max(...prices) : pos.currentPrice * 1.02;

                                    // 12% marginesu na górze i dole, aby korpusy świec wypełniały ~76% wysokości wykresu
                                    const candleSpan = pMax - pMin;
                                    const pPad = Math.max(candleSpan * 0.12, pos.currentPrice * 0.008, 0.4);
                                    const yMinVal = Number((pMin - pPad).toFixed(2));
                                    const yMaxVal = Number((pMax + pPad).toFixed(2));
                                    const yDomain = [yMinVal, yMaxVal];

                                    // Dołącz yMinVal i yMaxVal do każdego punktu payload dla skalowania CandlestickBar
                                    const filteredBars = rawFilteredBars.map(b => ({
                                      ...b,
                                      yMin: yMinVal,
                                      yMax: yMaxVal
                                    }));

                                    return (
                                      <div className="space-y-3 font-sans">
                                        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold text-white text-sm">{pos.ticker} — {pos.name}</span>
                                              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                                                Aktualny Kurs: {pos.currentPrice.toFixed(2)} zł {getCommodityUsdPrice(pos.ticker, pos.currentPrice) ? `(${getCommodityUsdPrice(pos.ticker, pos.currentPrice)}) ` : ''}({pos.pnlPercent >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
                                              </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                                              <span>🔵 Wejście: <strong className="text-sky-400">{pos.entryPrice.toFixed(2)} zł</strong></span>
                                              <span>🔴 SL: <strong className="text-rose-400">{pos.stopLoss.toFixed(2)} zł</strong></span>
                                              <span>🟢 TP1: <strong className="text-emerald-400">{pos.targetPrice1.toFixed(2)} zł</strong> {pos.tp1Reached ? '✓' : ''}</span>
                                              <span>🟢 TP2: <strong className="text-emerald-400">{pos.targetPrice2.toFixed(2)} zł</strong> {pos.tp2Reached ? '✓' : ''}</span>
                                              <span>🟢 TP3: <strong className="text-emerald-400">{pos.targetPrice3.toFixed(2)} zł</strong> {pos.tp3Reached ? '✓' : ''}</span>
                                            </div>
                                          </div>

                                          {/* Timeframe selector & Chart style selector */}
                                          <div className="flex flex-wrap items-center gap-2">
                                            {/* Style Selector */}
                                            <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                                              <button
                                                onClick={() => setStockChartStyle('candlestick')}
                                                className={`px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                                                  stockChartStyle === 'candlestick'
                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                              >
                                                🕯️ Świecowy (OHLC)
                                              </button>
                                              <button
                                                onClick={() => setStockChartStyle('line')}
                                                className={`px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                                                  stockChartStyle === 'line'
                                                    ? 'bg-emerald-600 text-white shadow-sm'
                                                    : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                              >
                                                📈 Liniowy
                                              </button>
                                            </div>

                                            {/* Timeframe selector */}
                                            <div className="flex bg-slate-950 rounded-lg p-0.5 border border-slate-800 text-[10px]">
                                              {(['1D', '3D', '1W', '2W', '1M', '3M', '6M', 'ALL'] as TimeRange[]).map(r => (
                                                <button
                                                  key={r}
                                                  onClick={() => setStockTimeRange(r)}
                                                  className={`px-2 py-1 rounded font-bold transition-all cursor-pointer ${
                                                    stockTimeRange === r
                                                      ? 'bg-emerald-600 text-white shadow-sm'
                                                      : 'text-slate-400 hover:text-slate-200'
                                                  }`}
                                                >
                                                  {r === 'ALL' ? 'Wszystkie' : r}
                                                </button>
                                              ))}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Recharts Individual Stock Chart */}
                                        <div className="h-60 w-full pt-1">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={filteredBars} margin={{ top: 15, right: 30, left: 5, bottom: 0 }}>
                                              <defs>
                                                <linearGradient id={`stockGradient_${pos.id}`} x1="0" y1="0" x2="0" y2="1">
                                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                                                </linearGradient>
                                              </defs>
                                              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                              <XAxis
                                                dataKey="date"
                                                stroke="#64748b"
                                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                                tickLine={false}
                                                axisLine={{ stroke: '#334155' }}
                                                tickFormatter={(val) => {
                                                  if (typeof val !== 'string') return val;
                                                  if (val.includes(':')) {
                                                    const parts = val.split(' ');
                                                    return parts.length > 1 ? parts[1] : val;
                                                  }
                                                  return val.slice(5);
                                                }}
                                              />
                                              <YAxis
                                                stroke="#64748b"
                                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                                tickLine={false}
                                                axisLine={{ stroke: '#334155' }}
                                                domain={yDomain}
                                                allowDataOverflow={true}
                                                tickFormatter={(val) => `${val.toFixed(2)} zł`}
                                              />
                                              <Tooltip content={<StockChartTooltip />} />

                                              {/* Reference Lines - tylko jeśli mieszczą się w widocznym zakresie cen świec */}
                                              {pos.entryPrice >= yMinVal && pos.entryPrice <= yMaxVal && (
                                                <ReferenceLine y={pos.entryPrice} stroke="#3b82f6" strokeDasharray="4 4" ifOverflow="hidden" label={{ value: `WEJŚCIE ${pos.entryPrice.toFixed(2)}`, fill: '#3b82f6', fontSize: 9, position: 'right' }} />
                                              )}
                                              {pos.stopLoss >= yMinVal && pos.stopLoss <= yMaxVal && (
                                                <ReferenceLine y={pos.stopLoss} stroke="#f43f5e" strokeDasharray="3 3" ifOverflow="hidden" label={{ value: `SL ${pos.stopLoss.toFixed(2)}`, fill: '#f43f5e', fontSize: 9, position: 'right' }} />
                                              )}
                                              {pos.targetPrice1 >= yMinVal && pos.targetPrice1 <= yMaxVal && (
                                                <ReferenceLine y={pos.targetPrice1} stroke="#10b981" strokeDasharray="3 3" ifOverflow="hidden" label={{ value: `TP1 ${pos.targetPrice1.toFixed(2)}`, fill: '#10b981', fontSize: 9, position: 'right' }} />
                                              )}
                                              {pos.targetPrice2 >= yMinVal && pos.targetPrice2 <= yMaxVal && (
                                                <ReferenceLine y={pos.targetPrice2} stroke="#10b981" strokeDasharray="3 3" ifOverflow="hidden" label={{ value: `TP2 ${pos.targetPrice2.toFixed(2)}`, fill: '#10b981', fontSize: 9, position: 'right' }} />
                                              )}
                                              {pos.targetPrice3 >= yMinVal && pos.targetPrice3 <= yMaxVal && (
                                                <ReferenceLine y={pos.targetPrice3} stroke="#10b981" strokeDasharray="3 3" ifOverflow="hidden" label={{ value: `TP3 ${pos.targetPrice3.toFixed(2)}`, fill: '#10b981', fontSize: 9, position: 'right' }} />
                                              )}

                                              {stockChartStyle === 'candlestick' ? (
                                                <Bar
                                                  dataKey="close"
                                                  name="Notowania Świecowe"
                                                  shape={<CandlestickBar />}
                                                  isAnimationActive={false}
                                                />
                                              ) : (
                                                <Area
                                                  type="monotone"
                                                  dataKey="close"
                                                  name="Kurs (zł)"
                                                  stroke="#10b981"
                                                  strokeWidth={2}
                                                  fill={`url(#stockGradient_${pos.id})`}
                                                  dot={false}
                                                  activeDot={{ r: 5, fill: '#10b981', stroke: '#ffffff', strokeWidth: 1.5 }}
                                                />
                                              )}
                                            </ComposedChart>
                                          </ResponsiveContainer>
                                        </div>
                                      </div>
                                    );
                                  })()}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          {/* Kafelek 3: Alokacja Aktywów & Zasady Strategii (Pełna Szerokość Okna) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sekcja 1: Alokacja Aktywów w PLN */}
              <div>
                <h3 className="text-sm font-bold text-white mb-4">Alokacja Aktywów w PLN</h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Akcje & Kontrakty GPW</span>
                      <span className="font-mono text-white font-semibold">
                        {currentPortfolio.allocatedPln.toLocaleString('pl-PL')} PLN ({((currentPortfolio.allocatedPln / (currentPortfolio.currentBalance || 1)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full"
                        style={{ width: `${Math.min(100, (currentPortfolio.allocatedPln / (currentPortfolio.currentBalance || 1)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Wolna Gotówka (PLN)</span>
                      <span className="font-mono text-white font-semibold">
                        {currentPortfolio.cashPln.toLocaleString('pl-PL')} PLN ({((currentPortfolio.cashPln / (currentPortfolio.currentBalance || 1)) * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, (currentPortfolio.cashPln / (currentPortfolio.currentBalance || 1)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sekcja 2: Zasady Strategii Multi-TP & Modyfikacja */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">Zasady Strategii & Rynki Portfela</h3>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                    title="Modyfikuj strategię, dozwolone rynki, profil ryzyka lub wpłać dodatkowy kapitał"
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edytuj Strategię</span>
                  </button>
                </div>

                {/* Status Strategii Badge */}
                <div className="mb-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px]">Dopuszczalne Rynki (Auto-Pilot):</span>
                    <span className="text-emerald-400 font-bold flex flex-wrap gap-1 mt-0.5">
                      {(() => {
                        const markets = currentPortfolio.allowedMarkets ||
                          (currentPortfolio.allowedMarket && currentPortfolio.allowedMarket !== 'ALL'
                            ? [currentPortfolio.allowedMarket as any]
                            : ['GPW', 'Surowce', 'NewConnect', 'FW20']);

                        if (markets.length === 4) {
                          return <span className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-md text-[11px]">🌐 Wszystkie Rynki</span>;
                        }

                        const icons: Record<string, string> = {
                          GPW: '📈 GPW',
                          Surowce: '🛢️ Surowce',
                          NewConnect: '🚀 NewConnect',
                          FW20: '⚡ FW20'
                        };

                        return markets.map(m => (
                          <span key={m} className="bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-md text-[11px]">
                            {icons[m] || m}
                          </span>
                        ));
                      })()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-sans block text-[10px]">Profil Ryzyka:</span>
                    <span className="text-amber-300 font-bold">{currentPortfolio.riskLevel}</span>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs text-slate-300">
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      1
                    </div>
                    <p><b>Multi-TP (33/33/34):</b> Po osiągnięciu TP1 (+3.2%) system natychmiast zamyka 33% pozycji, a Stop-Loss przesuwa się na Break-Even (poziom wejścia).</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      2
                    </div>
                    <p><b>Ograniczenie Rynkowe:</b> Auto-Pilot kupuje wyłącznie w wybranym segmencie rynku dla tego portfela.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-md bg-emerald-950 text-emerald-400 border border-emerald-800/40 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      3
                    </div>
                    <p><b>Alerty Telegram:</b> Niezależne włączanie powiadomień na poziomie każdego portfela.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Dziennik Tradera (Trader's Journal) with CSV Export & Sticky Column & Sorting */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>Dziennik Tradera GPW (Historia Zleceń)</span>
              <span className="text-xs font-normal text-slate-400">({trades.length} transakcji)</span>
            </h3>
            <p className="text-xs text-slate-400">Pierwsza kolumna (Data) jest nieruchoma. Kliknij nagłówek kolumny, aby posortować.</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter */}
            <div className="flex bg-slate-950 rounded-xl p-1 border border-slate-800 text-xs">
              {(['ALL', 'AUTO-PILOT', 'ZYSK (TP)', 'STRATA (SL)', 'REBALANCE'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setTradeFilter(f)}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    tradeFilter === f ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f === 'ALL' ? 'Wszystkie' : f}
                </button>
              ))}
            </div>

            {/* Export CSV button */}
            <button
              onClick={handleExportCsv}
              title="Pobierz pełną historię Dziennika Tradera w pliku CSV ze znakami PL"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Eksportuj do CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-semibold select-none">
                {/* Sticky Column 1: Data i Godzina */}
                <th
                  onClick={() => toggleTradeSort('date')}
                  className="pb-3 sticky left-0 z-20 bg-slate-900 px-3 cursor-pointer hover:text-white min-w-[120px]"
                  title="Kliknij, aby posortować po dacie wykonania"
                >
                  <div className="flex items-center gap-1">
                    <span>Data i Czas</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleTradeSort('ticker')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po walorze"
                >
                  <div className="flex items-center gap-1">
                    <span>Walor GPW</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleTradeSort('type')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po typie zlecenia"
                >
                  <div className="flex items-center gap-1">
                    <span>Typ</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleTradeSort('pricePln')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po cenie transakcji"
                >
                  <div className="flex items-center gap-1">
                    <span>Cena (PLN)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleTradeSort('shares')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po ilości"
                >
                  <div className="flex items-center gap-1">
                    <span>Wolumen</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleTradeSort('totalPln')}
                  className="pb-3 px-3 cursor-pointer hover:text-white"
                  title="Kliknij, aby posortować po wartości całkowitej"
                >
                  <div className="flex items-center gap-1">
                    <span>Wartość (PLN)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleTradeSort('resultPln')}
                  className="pb-3 px-3 cursor-pointer hover:text-white min-w-[100px]"
                  title="Kliknij, aby posortować po zrealizowanym wyniku"
                >
                  <div className="flex items-center gap-1">
                    <span>Wynik PnL</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3">Uzasadnienie / Źródło</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredAndSortedTrades.map(t => {
                return (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Sticky Column 1: Data i Godzina */}
                    <td className="py-3 sticky left-0 z-10 bg-slate-900 px-3 text-slate-400 font-mono shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                      {t.date}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="font-bold text-white block">{t.ticker}</span>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[120px]">{t.name}</span>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.type === 'KUPNO' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                      }`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-200">{t.pricePln.toFixed(2)} zł</td>
                    <td className="py-3 px-3 text-slate-300">{t.shares} szt.</td>
                    <td className="py-3 px-3 text-slate-200">{t.totalPln.toLocaleString('pl-PL')} zł</td>
                    <td className="py-3 px-3">
                      {t.resultPln !== 0 ? (
                        <span className={`font-bold ${t.resultPln > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {t.resultPln > 0 ? '+' : ''}{t.resultPln.toFixed(2)} zł ({t.resultPercent > 0 ? '+' : ''}{t.resultPercent.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-400 text-[11px] max-w-xs truncate" title={t.reason}>
                      {t.reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal to Create New Portfolio */}
      <CreatePortfolioModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onPortfolioCreated={handlePortfolioCreated}
      />

      {/* Modal to Edit Portfolio Strategy & Allowed Markets */}
      <EditPortfolioModal
        portfolio={currentPortfolio}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onPortfolioUpdated={(updated) => {
          onPortfoliosUpdate([...PortfolioService.getPortfolios()]);
          setToastMessage(`Pomyślnie zaktualizowano strategię portfela "${updated.name}"`);
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />
    </div>
  );
};
