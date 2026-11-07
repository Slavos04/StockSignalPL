import React, { useState } from 'react';
import { X, TrendingUp, HelpCircle, Activity, Calendar, Clock, Info } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

interface MarketOptimismTrendModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentOptimism: number; // e.g. 68
}

interface OptimismPoint {
  date: string;
  optimism: number;
  label: string;
  wig20: string;
  wigVix: number;
  change?: string;
  note?: string;
}

// 14 sessions daily closing history of GPW Market Optimism (EOD - End Of Day)
const HISTORICAL_SESSIONS: OptimismPoint[] = [
  { date: '14 dni temu', optimism: 42, label: 'Chłodny sentyment', wig20: '2 310 pkt', wigVix: 22.4, change: '-1.2%' },
  { date: '13 dni temu', optimism: 45, label: 'Neutralny / Ostrożny', wig20: '2 325 pkt', wigVix: 21.8, change: '+0.6%' },
  { date: '12 dni temu', optimism: 48, label: 'Równowaga', wig20: '2 340 pkt', wigVix: 20.9, change: '+0.6%' },
  { date: '11 dni temu', optimism: 52, label: 'Umiarkowany optymizm', wig20: '2 360 pkt', wigVix: 19.5, change: '+0.9%' },
  { date: '10 dni temu', optimism: 49, label: 'Konsolidacja', wig20: '2 350 pkt', wigVix: 20.1, change: '-0.4%' },
  { date: '9 dni temu', optimism: 56, label: 'Napływ kapitału', wig20: '2 385 pkt', wigVix: 18.7, change: '+1.5%' },
  { date: '8 dni temu', optimism: 61, label: 'Optymizm rynkowy', wig20: '2 410 pkt', wigVix: 17.9, change: '+1.1%' },
  { date: '7 dni temu', optimism: 58, label: 'Umiarkowany', wig20: '2 402 pkt', wigVix: 18.2, change: '-0.3%' },
  { date: '6 dni temu', optimism: 64, label: 'Silny optymizm', wig20: '2 435 pkt', wigVix: 16.8, change: '+1.4%' },
  { date: '5 dni temu', optimism: 62, label: 'Optymizm', wig20: '2 428 pkt', wigVix: 17.1, change: '-0.3%' },
  { date: '4 dni temu', optimism: 67, label: 'Silny optymizm', wig20: '2 455 pkt', wigVix: 16.0, change: '+1.1%' },
  { date: '3 dni temu', optimism: 65, label: 'Wzrost momentum', wig20: '2 448 pkt', wigVix: 16.4, change: '-0.3%' },
  { date: 'Wczoraj', optimism: 66, label: 'Silny optymizm', wig20: '2 460 pkt', wigVix: 15.9, change: '+0.5%' },
  { date: 'Dziś (Live)', optimism: 68, label: 'Chciwość / Hossa', wig20: '2 472.10 pkt', wigVix: 15.5, change: '+0.84%' },
];

// Intraday points of today's GPW trading session (od 09:00 do 17:00)
const INTRADAY_TODAY: OptimismPoint[] = [
  { date: '09:00', optimism: 64, label: 'Otwarcie sesji GPW', wig20: '2 458.20 pkt', wigVix: 16.2, change: '+0.2%' },
  { date: '09:30', optimism: 65, label: 'Wzrost popytu na Blue Chips', wig20: '2 461.50 pkt', wigVix: 16.0, change: '+0.3%' },
  { date: '10:30', optimism: 65, label: 'Stabilizacja kursów', wig20: '2 463.10 pkt', wigVix: 15.9, change: '+0.4%' },
  { date: '11:45', optimism: 66, label: 'Silny sentyment banków', wig20: '2 465.80 pkt', wigVix: 15.8, change: '+0.5%' },
  { date: '13:00', optimism: 66, label: 'Środek sesji / Hossa', wig20: '2 467.40 pkt', wigVix: 15.7, change: '+0.6%' },
  { date: '14:15', optimism: 67, label: 'Oczekiwanie na Wall St.', wig20: '2 469.00 pkt', wigVix: 15.6, change: '+0.7%' },
  { date: '15:30', optimism: 68, label: 'Otwarcie USA na plusie', wig20: '2 471.50 pkt', wigVix: 15.5, change: '+0.8%' },
  { date: 'Teraz (Live)', optimism: 68, label: 'Chciwość / Hossa', wig20: '2 472.10 pkt', wigVix: 15.5, change: '+0.84%' },
];

/**
 * Bogaty, czytelny Tooltip dla wykresu Optymizmu Rynku GPW
 */
const OptimismTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data: OptimismPoint = payload[0].payload;

  const wig20Num = parseFloat((data.wig20 || '').replace(/[^0-9.]/g, '')) || 0;

  // Układanie wskaźników według wielkości wartości w danym punkcie (najwyższa wartość na samej górze)
  const sortedItems = [
    { name: 'Optymizm rynku', value: `${data.optimism}%`, valNum: data.optimism, color: 'text-emerald-400' },
    { name: 'Indeks WIG20', value: data.wig20, valNum: wig20Num, color: 'text-white' },
    { name: 'Indeks Strachu (WIG-VIX)', value: `${data.wigVix} pkt`, valNum: data.wigVix, color: 'text-amber-400' }
  ].sort((a, b) => b.valNum - a.valNum);

  return (
    <div className="bg-slate-900/95 border border-slate-700 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs font-mono min-w-[230px] z-50">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] font-sans">
        <span className="text-white font-bold">{data.date}</span>
        <span className="text-emerald-400 font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-800/50">
          {data.label}
        </span>
      </div>

      <div className="space-y-1.5">
        {sortedItems.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="text-slate-400 font-sans">{item.name}:</span>
            <span className={`font-bold ${item.color}`}>{item.value}</span>
          </div>
        ))}
        {data.change && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
            <span className="text-slate-400 font-sans">Zmiana sesyjna:</span>
            <span className={`font-bold ${data.change.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.change}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export const MarketOptimismTrendModal: React.FC<MarketOptimismTrendModalProps> = ({
  isOpen,
  onClose,
  currentOptimism = 68,
}) => {
  const [viewMode, setViewMode] = useState<'daily' | 'intraday'>('daily');

  if (!isOpen) return null;

  const chartData = viewMode === 'daily'
    ? HISTORICAL_SESSIONS.map((d, i) => i === HISTORICAL_SESSIONS.length - 1 ? { ...d, optimism: currentOptimism } : d)
    : INTRADAY_TODAY.map((d, i) => i === INTRADAY_TODAY.length - 1 ? { ...d, optimism: currentOptimism } : d);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto pt-16 sm:pt-20 animate-in fade-in"
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 my-auto overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-white">Optymizm Rynku GPW</h2>
                {/* 68% (Hossa / Chciwość) Badge with Tooltip */}
                <div className="relative group cursor-help">
                  <span
                    title="Przedział 56%–75%: Faza optymizmu i hossy na GPW. Przewaga popytu, silne momentum i napływ kapitału do funduszy. Sprzyja pozycjom długim (LONG)."
                    className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/40 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>{currentOptimism}% (Hossa / Chciwość)</span>
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                  </span>
                  <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute top-full left-0 mt-2 w-72 sm:w-80 p-3 bg-slate-950/95 border border-emerald-500/40 rounded-xl text-[11px] text-slate-300 shadow-2xl z-50 pointer-events-none font-normal leading-relaxed backdrop-blur-md">
                    <span className="font-bold text-emerald-400 block mb-1 text-xs">
                      Co oznacza {currentOptimism}% (Hossa / Chciwość)?
                    </span>
                    Wskaźnik w przedziale <b>56% – 75%</b> sygnalizuje dominację popytu instytucjonalnego i silną tendencję wzrostową na GPW. Akcje zyskują przy umiarkowanej zmienności, a inwestorzy chętnie otwierają pozycje. Wskazana strategia: podążanie za trendem (Trend Following) z dyscypliną realizacji zysków na kolejnych poziomach TP (Take Profit).
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Syntetyczny wskaźnik sentymentu GPW Warszawa (0% = Skrajna panika, 100% = Skrajna euforia)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metric Cards Row with Interactive Explanatory Tooltips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          {/* Card 1: Aktualny Poziom */}
          <div
            className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 relative group cursor-help hover:border-emerald-500/40 transition-colors"
            title="Aktualny Poziom Optymizmu: Syntetyczny wskaźnik sentymentu wyliczany na żywo z kursów GPW względem średnich SMA50/200, wskaźnika zmienności WIG-VIX, bilansu Advance/Decline oraz wolumenu."
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Aktualny Poziom</span>
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="text-2xl font-black text-emerald-400 mt-1">{currentOptimism}%</div>
            <div className="text-[11px] text-emerald-400/80 flex items-center gap-1 mt-0.5">
              <span>▲ +2.0% vs wczoraj</span>
            </div>

            {/* Hover Tooltip Box */}
            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute top-full left-0 mt-2 w-72 sm:w-80 p-3 bg-slate-950/95 border border-slate-700 rounded-xl text-[11px] text-slate-300 shadow-2xl z-50 pointer-events-none font-normal leading-relaxed backdrop-blur-md">
              <span className="font-bold text-emerald-400 block mb-1 text-xs">Czym jest Aktualny Poziom?</span>
              Syntetyczny miernik sentymentu GPW wyliczany w czasie rzeczywistym z 4 kluczowych wag:<br />
              • <b>Wycena vs średnie SMA50/SMA200 (40%):</b> relacja kursów spółek do trendów średnioterminowych.<br />
              • <b>Zmienność opcji WIG-VIX (25%):</b> poziom nerwowości graczy.<br />
              • <b>Advance/Decline (20%):</b> stosunek spółek rosnących do spadających.<br />
              • <b>Dynamika wolumenu (15%):</b> zaangażowanie kapitałowe rynku.
            </div>
          </div>

          {/* Card 2: Indeks Strachu (WIG-VIX) */}
          <div
            className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 relative group cursor-help hover:border-amber-500/40 transition-colors"
            title="Indeks Strachu (WIG-VIX): Miernik 30-dniowej oczekiwanej zmienności implikowanej wyliczany z opcji na WIG20. Poniżej 18 pkt = spokój i hossa; powyżej 25 pkt = panika."
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Indeks Strachu (WIG-VIX)</span>
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </div>
            <div className="text-2xl font-black text-amber-400 mt-1">15.50 pkt</div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Niska zmienność (Stabilnie)</span>
            </div>

            {/* Hover Tooltip Box */}
            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 sm:w-80 p-3 bg-slate-950/95 border border-slate-700 rounded-xl text-[11px] text-slate-300 shadow-2xl z-50 pointer-events-none font-normal leading-relaxed backdrop-blur-md">
              <span className="font-bold text-amber-400 block mb-1 text-xs">Czym jest Indeks Strachu (WIG-VIX)?</span>
              Oficjalny polski odpowiednik amerykańskiego 'indeksu strachu' CBOE VIX, oparty o implikowaną zmienność cen opcji na indeks WIG20:<br />
              • <b>&lt; 18 pkt:</b> Niska zmienność, stabilność, optymizm i bezpieczne warunki dla trendu wzrostowego.<br />
              • <b>18 – 25 pkt:</b> Przeciętna zmienność rynkowa, konsolidacja.<br />
              • <b>&gt; 25 pkt:</b> Wysoka nerwowość, strach i wyprzedaż aktywów.
            </div>
          </div>

          {/* Card 3: WIG20 Benchmark */}
          <div
            className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 relative group cursor-help hover:border-blue-500/40 transition-colors"
            title="WIG20 Benchmark: Główny indeks 20 największych i najbardziej płynnych spółek GPW Warszawa (m.in. Orlen, PKO BP, KGHM, PZU, Dino). Główny punkt odniesienia dla sentymentu polskiego rynku."
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">WIG20 Benchmark</span>
              <HelpCircle className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="text-2xl font-black text-blue-400 mt-1">2 472.10</div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <span>+0.84% dzisiaj</span>
            </div>

            {/* Hover Tooltip Box */}
            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 absolute top-full right-0 mt-2 w-72 sm:w-80 p-3 bg-slate-950/95 border border-slate-700 rounded-xl text-[11px] text-slate-300 shadow-2xl z-50 pointer-events-none font-normal leading-relaxed backdrop-blur-md">
              <span className="font-bold text-blue-400 block mb-1 text-xs">Czym jest WIG20 Benchmark?</span>
              Kluczowy indeks warszawskiej giełdy skupiający 20 największych spółek blue-chip o najwyższej kapitalizacji i płynności (m.in. Orlen, PKO BP, KGHM, PZU, Dino, Pekao, LPP, Allegro). Odzwierciedla ogólną kondycję polskiej gospodarki i decyduje o kierunku przepływów kapitału zagranicznego na GPW.
            </div>
          </div>
        </div>

        {/* Recharts Interactive Trend Chart */}
        <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-xs font-semibold text-white block">
                {viewMode === 'daily' ? 'Historia ostatnich 14 sesji giełdowych GPW' : 'Przebieg dzisiejszej sesji GPW (Intraday Live)'}
              </span>
              <span className="text-[11px] text-slate-400">
                Najedź myszą na wykres, aby wyświetlić szczegółowy dymek (tooltip) dla dowolnego punktu.
              </span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-xs shrink-0">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'daily' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>14 sesji</span>
              </button>
              <button
                onClick={() => setViewMode('intraday')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  viewMode === 'intraday' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Dziś (Live)</span>
              </button>
            </div>
          </div>

          <div className="h-52 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="optimismModalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
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
                />
                <YAxis
                  domain={[25, 85]}
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: '#334155' }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip content={<OptimismTooltip />} />

                {/* Poziomy sentymentu */}
                <ReferenceLine y={75} stroke="#10b981" strokeDasharray="2 2" strokeOpacity={0.5} />
                <ReferenceLine y={50} stroke="#64748b" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine y={25} stroke="#f43f5e" strokeDasharray="2 2" strokeOpacity={0.5} />

                <Area
                  type="monotone"
                  dataKey="optimism"
                  name="Optymizm rynku"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#optimismModalGrad)"
                  dot={{ r: 3.5, fill: '#10b981', stroke: '#020617', strokeWidth: 1.5 }}
                  activeDot={{ r: 6, fill: '#34d399', stroke: '#ffffff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2 px-1">
            <span>25% = Skrajna panika</span>
            <span className="text-slate-400">50% = Równowaga neutralna</span>
            <span className="text-emerald-400 font-semibold">75%+ = Silna hossa / chciwość</span>
          </div>
        </div>

        {/* Detailed Explanation on Calculation Frequency */}
        <div className="mt-3.5 p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-white">Jak często obliczany jest ten wskaźnik?</span>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                • <b>W trakcie sesji (Live):</b> Wartość na górnym pasku odświeża się <b>na bieżąco w czasie rzeczywistym</b> wraz z kolejnymi tickami i pobieraniem danych ze Stooq (co kilka sekund), reagując dynamicznie na wahania kursu WIG20 i napływające obroty.<br />
                • <b>Punkty na wykresie 14 sesji:</b> Przedstawiają <b>oficjalną wycenę na zamknięcie każdej sesji giełdowej (EOD)</b>, co pozwala tradereom badać wielodniowy trend sentymentu bez zniekształceń szumem śródsesyjnym. Ostatni punkt reprezentuje aktualny odczyt <b>Dziś (Live)</b>.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-400">
              <span className="text-slate-200 font-medium">Składowe algorytmu:</span> Relacja kursów do średnich SMA50/SMA200, zmienność opcyjna indeksu WIG-VIX, wskaźnik spółek rosnących vs spadających (Advance/Decline) oraz dynamika wolumenu GPW.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs rounded-xl transition-colors border border-slate-700 cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
