import type { StockQuote } from '../types/stock';

/**
 * Czysta funkcja obliczania formacji świecowych, oceny trendu (0-98%) oraz rekomendacji analitycznych.
 * Współdzielona pomiędzy silnikiem serwerowym (ServerAutoPilotDaemon) a przeglądarką (StooqService),
 * dzięki czemu obie strony podejmują identyczne decyzje handlowe.
 */
export function enrichStockSignalsPure(stock: StockQuote): StockQuote {
  const o = stock.open || stock.price;
  const c = stock.price;
  const h = Math.max(stock.high || c, o, c);
  const l = Math.min(stock.low || c, o, c);
  const prevC = stock.previousClose || o;
  const range = Math.max(0.01, h - l);
  const body = Math.abs(c - o);
  const upperShadow = h - Math.max(o, c);
  const lowerShadow = Math.min(o, c) - l;
  const isBullish = c >= o;

  let candlestickPattern = 'Świeca Sesyjna';
  let candlestickSignalType: 'BYCZA (HOSSA)' | 'NIEDŹWIEDZIA (BESSA)' | 'NEUTRALNA' = 'NEUTRALNA';

  if (body <= range * 0.10) {
    if (lowerShadow > upperShadow * 2.0) {
      candlestickPattern = 'Doji Ważka (Dragonfly Doji - odrzucenie dołka)';
      candlestickSignalType = 'BYCZA (HOSSA)';
    } else if (upperShadow > lowerShadow * 2.0) {
      candlestickPattern = 'Doji Nagrobek (Gravestone Doji - presja podaży)';
      candlestickSignalType = 'NIEDŹWIEDZIA (BESSA)';
    } else {
      candlestickPattern = 'Klasyczne Doji (Równowaga popytu i podaży)';
      candlestickSignalType = 'NEUTRALNA';
    }
  } else if (lowerShadow >= 1.6 * body && upperShadow <= 0.35 * body) {
    candlestickPattern = isBullish ? 'Młot (Hammer - Silna obrona wsparcia)' : 'Wisielec (Hanging Man - Ostrzeżenie)';
    candlestickSignalType = isBullish ? 'BYCZA (HOSSA)' : 'NIEDŹWIEDZIA (BESSA)';
  } else if (upperShadow >= 1.6 * body && lowerShadow <= 0.35 * body) {
    candlestickPattern = isBullish ? 'Odwrócony Młot (Inverted Hammer)' : 'Spadająca Gwiazda (Shooting Star - Odrzucenie szczytu)';
    candlestickSignalType = isBullish ? 'BYCZA (HOSSA)' : 'NIEDŹWIEDZIA (BESSA)';
  } else if (isBullish && prevC < o && c > prevC * 1.01 && body > range * 0.45) {
    candlestickPattern = 'Objęcie Hossy (Bullish Engulfing - Przejęcie kontroli przez byki)';
    candlestickSignalType = 'BYCZA (HOSSA)';
  } else if (!isBullish && prevC > o && c < prevC * 0.99 && body > range * 0.45) {
    candlestickPattern = 'Objęcie Bessy (Bearish Engulfing - Presja podaży)';
    candlestickSignalType = 'NIEDŹWIEDZIA (BESSA)';
  } else if (isBullish && body >= range * 0.75) {
    candlestickPattern = 'Białe Marubozu (Silna sesja popytowa)';
    candlestickSignalType = 'BYCZA (HOSSA)';
  } else if (!isBullish && body >= range * 0.75) {
    candlestickPattern = 'Czarne Marubozu (Silna sesja podażowa)';
    candlestickSignalType = 'NIEDŹWIEDZIA (BESSA)';
  } else if (isBullish) {
    candlestickPattern = 'Biała Świeca Wzrostowa (Popyt przeważa)';
    candlestickSignalType = 'BYCZA (HOSSA)';
  } else {
    candlestickPattern = 'Czarna Świeca Spadkowa (Podaż przeważa)';
    candlestickSignalType = 'NIEDŹWIEDZIA (BESSA)';
  }

  let trendScore = 50;
  if (stock.price > stock.sma50) trendScore += 12;
  if (stock.price > stock.sma200) trendScore += 12;
  if (stock.sma50 > stock.sma200) trendScore += 14;
  if (stock.price < stock.sma50) trendScore -= 12;
  if (stock.price < stock.sma200) trendScore -= 12;
  if (stock.sma50 < stock.sma200) trendScore -= 14;

  if (stock.rsi14 >= 50 && stock.rsi14 <= 68) trendScore += 10;
  else if (stock.rsi14 > 68 && stock.rsi14 <= 78) trendScore += 5;
  else if (stock.rsi14 < 35) trendScore -= 12;
  else if (stock.rsi14 < 45) trendScore -= 6;

  if (stock.macd && stock.macd.hist > 0) trendScore += 8;
  else if (stock.macd && stock.macd.hist < 0) trendScore -= 8;

  if (stock.changePercent > 0.5) trendScore += 6;
  else if (stock.changePercent < -0.5) trendScore -= 6;

  trendScore = Math.min(98, Math.max(10, Math.round(trendScore)));

  let trendRating: 'BARDZO SILNY WZROSTOWY' | 'WZROSTOWY' | 'BOCZNY / KONSOLIDACJA' | 'SPADKOWY' | 'SILNY SPADKOWY';
  if (trendScore >= 80) trendRating = 'BARDZO SILNY WZROSTOWY';
  else if (trendScore >= 60) trendRating = 'WZROSTOWY';
  else if (trendScore >= 45) trendRating = 'BOCZNY / KONSOLIDACJA';
  else if (trendScore >= 30) trendRating = 'SPADKOWY';
  else trendRating = 'SILNY SPADKOWY';

  let fairMultipleFactor = 1.0;
  if (stock.peRatio > 0 && stock.peRatio < 12) fairMultipleFactor += 0.08;
  if (stock.pbvRatio > 0 && stock.pbvRatio < 1.3) fairMultipleFactor += 0.06;
  if (stock.dividendYield >= 4.5) fairMultipleFactor += 0.06;

  if (trendScore >= 75) fairMultipleFactor += 0.06;
  else if (trendScore <= 35) fairMultipleFactor -= 0.08;

  const upsideRatio = Number(fairMultipleFactor.toFixed(3));
  const analystTargetPrice = Number((stock.price * upsideRatio).toFixed(2));
  const upsidePct = Number((((analystTargetPrice - stock.price) / (stock.price || 1)) * 100).toFixed(1));

  let analystRecommendation: 'KUPUJ (BUY)' | 'AKUMULUJ' | 'TRZYMAJ (HOLD)' | 'REDUKUJ' | 'SPRZEDAJ (SELL)';
  if (upsidePct >= 14.0) {
    analystRecommendation = 'KUPUJ (BUY)';
  } else if (upsidePct >= 6.0) {
    analystRecommendation = 'AKUMULUJ';
  } else if (upsidePct >= -4.0) {
    analystRecommendation = 'TRZYMAJ (HOLD)';
  } else if (upsidePct >= -12.0) {
    analystRecommendation = 'REDUKUJ';
  } else {
    analystRecommendation = 'SPRZEDAJ (SELL)';
  }

  return {
    ...stock,
    candlestickPattern,
    candlestickSignalType,
    trendRating,
    trendScore,
    analystRecommendation,
    analystTargetPrice
  };
}
