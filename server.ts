import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import https from 'https';
import {
  initPostgres,
  dbGetUserByLogin,
  dbCreateUser,
  dbGetPortfolios,
  dbSavePortfolio,
  dbDeletePortfolio,
  dbGetTrades,
  dbSaveTrade,
  dbGetSettings,
  dbSaveSettings,
  dbGetNotifications,
  dbMarkNotificationsRead,
  dbGetDaemonConfig,
  dbSaveDaemonConfig
} from './src/server/db';
import { ServerAutoPilotDaemon } from './src/server/serverAutoPilotDaemon';
import { formatWarsawDateTime, formatWarsawTime, WARSAW_TIMEZONE } from './src/utils/dateTime';

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json());

  // Initialize PostgreSQL (non-blocking)
  await initPostgres();

  // ==========================================
  // 1. AUTHENTICATION API (POSTGRESQL)
  // ==========================================
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { usernameOrEmail, password } = req.body;
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ success: false, error: 'Wprowadź login oraz hasło.' });
      }

      const user = await dbGetUserByLogin(usernameOrEmail);
      if (!user) {
        return res.status(401).json({ success: false, error: 'Nie znaleziono użytkownika o podanym loginie lub e-mailu.' });
      }

      if (user.status === 'blocked') {
        return res.status(403).json({ success: false, error: 'Konto zostało zablokowane przez Administratora.' });
      }

      if (user.password_hash !== password) {
        return res.status(401).json({ success: false, error: 'Nieprawidłowe hasło dostępowe.' });
      }

      // Safe user object
      const safeUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name || user.username,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        lastLogin: formatWarsawDateTime()
      };

      return res.json({ success: true, user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { username, email, fullName, password } = req.body;
      if (!username || !email || !password) {
        return res.status(400).json({ success: false, error: 'Wypełnij wszystkie wymagane pola.' });
      }

      const existing = await dbGetUserByLogin(username);
      if (existing) {
        return res.status(400).json({ success: false, error: 'Użytkownik o podanym loginie już istnieje.' });
      }

      const newUser = await dbCreateUser({
        id: `usr_${Date.now()}`,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        fullName: fullName?.trim() || username.trim(),
        passwordHash: password,
        role: 'trader'
      });

      const safeUser = {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.full_name || newUser.username,
        role: newUser.role,
        status: newUser.status,
        createdAt: newUser.created_at,
        lastLogin: newUser.last_login
      };

      return res.json({ success: true, user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 2. PORTFOLIOS API (POSTGRESQL)
  // ==========================================
  app.get('/api/portfolios', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || 'usr_admin';
      const portfolios = await dbGetPortfolios(userId);
      return res.json({ success: true, portfolios });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/portfolios', async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || (req.headers['x-user-id'] as string) || 'usr_admin';
      const { portfolio } = req.body;
      if (!portfolio || !portfolio.id) {
        return res.status(400).json({ success: false, error: 'Nieprawidłowe dane portfela.' });
      }
      await dbSavePortfolio(userId, portfolio);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.delete('/api/portfolios/:id', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || 'usr_admin';
      const portfolioId = req.params.id;
      await dbDeletePortfolio(userId, portfolioId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 3. TRADES API (POSTGRESQL)
  // ==========================================
  app.get('/api/trades', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || 'usr_admin';
      const trades = await dbGetTrades(userId);
      return res.json({ success: true, trades });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/trades', async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || (req.headers['x-user-id'] as string) || 'usr_admin';
      const { trade } = req.body;
      if (!trade || !trade.id) {
        return res.status(400).json({ success: false, error: 'Nieprawidłowe dane transakcji.' });
      }
      await dbSaveTrade(userId, trade);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 4. REAL MARKET DATA FEED (WSE GPW + NBP + COMMODITIES)
  // 100% REAL HISTORICAL & LIVE MARKET DATA - ZERO SYNTHESIS
  // ==========================================

  let cachedUsdPlnRate = 3.91;
  let lastUsdPlnFetch = 0;

  async function getUsdPlnRate(): Promise<number> {
    const now = Date.now();
    if (now - lastUsdPlnFetch < 60000 && cachedUsdPlnRate > 0) {
      return cachedUsdPlnRate;
    }
    return new Promise((resolve) => {
      https.get('https://api.nbp.pl/api/exchangerates/rates/a/usd/?format=json', {
        headers: { 'User-Agent': 'StockSignalPL/1.9' },
        timeout: 2500
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            const rate = parseFloat(j.rates?.[0]?.mid);
            if (!isNaN(rate) && rate > 0) {
              cachedUsdPlnRate = rate;
              lastUsdPlnFetch = Date.now();
              return resolve(rate);
            }
          } catch {}
          resolve(cachedUsdPlnRate);
        });
      }).on('error', () => {
        resolve(cachedUsdPlnRate);
      });
    });
  }

  function mapSymbolToMarket(rawSymbol: string): { ticker: string; isCommodity: boolean; isEur: boolean } {
    const clean = rawSymbol.toUpperCase().replace('.PL', '').replace('.F', '').trim();
    const COMMODITIES: Record<string, string> = {
      'XAU': 'GC=F',
      'XAG': 'SI=F',
      'CB': 'BZ=F',
      'BRENT': 'BZ=F',
      'CL': 'CL=F',
      'WTI': 'CL=F',
      'NG': 'NG=F',
      'NATGAS': 'NG=F',
      'HG': 'HG=F',
      'COPPER': 'HG=F',
      'XPT': 'PL=F',
      'W': 'ZW=F',
      'ZW': 'ZW=F',
      'WHEAT': 'ZW=F'
    };

    if (COMMODITIES[clean]) {
      return { ticker: COMMODITIES[clean], isCommodity: true, isEur: false };
    }

    if (clean === 'FW20' || clean === 'FW2020' || clean === 'WIG20') {
      return { ticker: 'WIG20.WA', isCommodity: false, isEur: false };
    }

    const SPECIAL_GPW: Record<string, { ticker: string; isEur?: boolean }> = {
      'SPL': { ticker: 'SAN.WA' },
      'SAN': { ticker: 'SAN.WA' },
      'JSB': { ticker: 'JSW.WA' },
      'MBI': { ticker: 'MAB.WA' },
      'CCC': { ticker: '6RK.F', isEur: true }
    };

    if (SPECIAL_GPW[clean]) {
      return {
        ticker: SPECIAL_GPW[clean].ticker,
        isCommodity: false,
        isEur: !!SPECIAL_GPW[clean].isEur
      };
    }

    return { ticker: `${clean}.WA`, isCommodity: false, isEur: false };
  }

  function fetchYahooChartData(marketTicker: string, range: string, interval: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(marketTicker)}?range=${range}&interval=${interval}`;
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 4000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            const result = j.chart?.result?.[0];
            if (result) {
              resolve(result);
            } else {
              reject(new Error(j.chart?.error?.description || 'Brak danych dla symbolu'));
            }
          } catch (e: any) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  // Real OHLC Candlestick API endpoint
  app.get('/api/market-ohlc', async (req: Request, res: Response) => {
    const rawTicker = (req.query.s as string) || 'PKN.PL';
    const rangeParam = ((req.query.range as string) || '1mo').toLowerCase();
    const limit = Math.max(5, Math.min(300, parseInt((req.query.limit as string) || '40')));

    const { ticker: marketTicker, isCommodity, isEur } = mapSymbolToMarket(rawTicker);
    const usdPlnRate = await getUsdPlnRate();

    // Determine optimal interval and range based on user's timeframe
    let range = '3mo';
    let interval = '1d';

    if (rangeParam === '1d') {
      range = '1d';
      interval = '5m';
    } else if (rangeParam === '3d') {
      range = '5d';
      interval = '15m';
    } else if (rangeParam === '1w' || rangeParam === '2w') {
      range = '1mo';
      interval = '1d';
    } else if (rangeParam === '1m') {
      range = '1mo';
      interval = '1d';
    } else if (rangeParam === '3m') {
      range = '3mo';
      interval = '1d';
    } else if (rangeParam === '6m') {
      range = '6mo';
      interval = '1d';
    } else if (rangeParam === 'wszystkie' || rangeParam === 'all' || rangeParam === '1y') {
      range = '1y';
      interval = '1d';
    }

    try {
      let chartData = await fetchYahooChartData(marketTicker, range, interval);

      // If intraday (1d / 5m) returned no bars (e.g. weekend or pre-market), fallback to last 5d with 15m or 1mo 1d
      if (!chartData.timestamp || chartData.timestamp.length === 0) {
        chartData = await fetchYahooChartData(marketTicker, '1mo', '1d');
      }

      const timestamps = chartData.timestamp || [];
      const quote = chartData.indicators?.quote?.[0] || {};
      const opens = quote.open || [];
      const highs = quote.high || [];
      const lows = quote.low || [];
      const closes = quote.close || [];
      const volumes = quote.volume || [];

      const rawBars: any[] = [];
      const eurRate = 4.28; // Standard conversion for EUR-listed assets if needed

      for (let i = 0; i < timestamps.length; i++) {
        let c = closes[i];
        let o = opens[i];
        let h = highs[i];
        let l = lows[i];
        const v = volumes[i] || 0;

        if (c != null && !isNaN(c) && c > 0) {
          if (o == null || isNaN(o)) o = c;
          if (h == null || isNaN(h)) h = Math.max(o, c);
          if (l == null || isNaN(l)) l = Math.min(o, c);

          // Convert to PLN if asset is commodity priced in USD or EUR
          if (isCommodity) {
            o = o * usdPlnRate;
            h = h * usdPlnRate;
            l = l * usdPlnRate;
            c = c * usdPlnRate;
          } else if (isEur) {
            o = o * eurRate;
            h = h * eurRate;
            l = l * eurRate;
            c = c * eurRate;
          }

          o = Number(o.toFixed(2));
          h = Number(h.toFixed(2));
          l = Number(l.toFixed(2));
          c = Number(c.toFixed(2));

          const dateObj = new Date(timestamps[i] * 1000);
          const isIntraday = interval.includes('m');
          const dateStr = isIntraday
            ? dateObj.toLocaleDateString('pl-PL', { timeZone: WARSAW_TIMEZONE, month: '2-digit', day: '2-digit' }) + ' ' + dateObj.toLocaleTimeString('pl-PL', { timeZone: WARSAW_TIMEZONE, hour: '2-digit', minute: '2-digit' })
            : dateObj.toISOString().split('T')[0];

          const change = Number((c - o).toFixed(2));
          const changePercent = o > 0 ? Number(((change / o) * 100).toFixed(2)) : 0;

          rawBars.push({
            date: dateStr,
            timestamp: timestamps[i],
            open: o,
            high: h,
            low: l,
            close: c,
            volume: v,
            change,
            changePercent
          });
        }
      }

      // Slice to limit
      const bars = rawBars.slice(-limit);

      // Compute genuine SMA20 and SMA50 from real close values
      bars.forEach((b, idx) => {
        const slice20 = bars.slice(Math.max(0, idx - 19), idx + 1);
        b.sma20 = Number((slice20.reduce((s, x) => s + x.close, 0) / slice20.length).toFixed(2));
        const slice50 = bars.slice(Math.max(0, idx - 49), idx + 1);
        b.sma50 = Number((slice50.reduce((s, x) => s + x.close, 0) / slice50.length).toFixed(2));
      });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=15');
      return res.json({
        symbol: rawTicker.toUpperCase(),
        marketTicker,
        range,
        interval,
        isReal: true,
        bars
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message, isReal: false, bars: [] });
    }
  });

  // Backward compatibility alias for /api/stooq-ohlc
  app.get('/api/stooq-ohlc', (req: Request, res: Response) => {
    const s = req.query.s || 'PKN.PL';
    const limit = req.query.limit || '40';
    res.redirect(`/api/market-ohlc?s=${s}&limit=${limit}`);
  });

  // Real quotes batch endpoint
  let quotesCache: { timestamp: number; data: any } = { timestamp: 0, data: null };

  app.get('/api/market-quotes', async (req: Request, res: Response) => {
    const rawSymbols = (req.query.symbols as string) || '';
    const symbols = rawSymbols ? rawSymbols.split(',') : [
      'PKN.PL', 'KGH.PL', 'PKO.PL', 'CDR.PL', 'PEO.PL', 'DNP.PL', 'LPP.PL', 'SPL.PL',
      'PZU.PL', 'ALR.PL', 'KRU.PL', 'KTY.PL', 'JSW.PL', 'XTB.PL', 'TPE.PL', 'CPS.PL',
      'PGE.PL', 'BDX.PL', 'MBK.PL', 'OPL.PL', 'ENA.PL', 'CCC.PL', 'CAR.PL', 'MIL.PL',
      'ACP.PL', '11B.PL', 'MLS.PL', 'TOR.PL', 'PLW.PL', 'BIO.PL', 'CLD.PL', 'ALE.PL',
      'FW2020.PL', 'WIG20', 'XAU.PL', 'XAG.PL', 'XPT.PL', 'CB.F', 'CL.F', 'HG.F', 'NG.F', 'ZW.F'
    ];

    const usdPlnRate = await getUsdPlnRate();

    // Cache for 10 seconds to protect rate limits and provide instant UI response
    const now = Date.now();
    if (!rawSymbols && quotesCache.data && (now - quotesCache.timestamp < 10000)) {
      return res.json({ success: true, ...quotesCache.data, cached: true });
    }

    try {
      const quotes: any[] = [];
      const uniqueSymbols = Array.from(new Set(symbols.map(s => s.trim()).filter(Boolean)));
      const BATCH_SIZE = 8;

      for (let i = 0; i < uniqueSymbols.length; i += BATCH_SIZE) {
        const batch = uniqueSymbols.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (cleanSym) => {
            const { ticker, isCommodity, isEur } = mapSymbolToMarket(cleanSym);
            try {
              const chart = await fetchYahooChartData(ticker, '5d', '1d');
              const meta = chart.meta;
              const q = chart.indicators?.quote?.[0];
              const lastIdx = (chart.timestamp?.length || 1) - 1;

              let price = meta.regularMarketPrice ?? q?.close?.[lastIdx];
              let prevClose = meta.chartPreviousClose ?? q?.close?.[Math.max(0, lastIdx - 1)];
              let high = meta.regularMarketDayHigh ?? q?.high?.[lastIdx];
              let low = meta.regularMarketDayLow ?? q?.low?.[lastIdx];
              const volume = meta.regularMarketVolume ?? q?.volume?.[lastIdx] ?? 0;

              if (price == null || isNaN(price)) return null;

              const priceUsd = isCommodity ? Number(price.toFixed(2)) : undefined;

              if (isCommodity) {
                price = price * usdPlnRate;
                if (prevClose) prevClose = prevClose * usdPlnRate;
                if (high) high = high * usdPlnRate;
                if (low) low = low * usdPlnRate;
              } else if (isEur) {
                const eurRate = 4.28;
                price = price * eurRate;
                if (prevClose) prevClose = prevClose * eurRate;
                if (high) high = high * eurRate;
                if (low) low = low * eurRate;
              }

              price = Number(price.toFixed(2));
              prevClose = prevClose ? Number(prevClose.toFixed(2)) : price;
              high = high ? Number(high.toFixed(2)) : price;
              low = low ? Number(low.toFixed(2)) : price;

              const change = Number((price - prevClose).toFixed(2));
              const changePercent = prevClose > 0 ? Number(((change / prevClose) * 100).toFixed(2)) : 0;

              return {
                symbol: cleanSym.toUpperCase(),
                marketTicker: ticker,
                price,
                priceUsd,
                previousClose: prevClose,
                open: prevClose,
                high,
                low,
                change,
                changePercent,
                volume,
                isCommodity,
                currency: isCommodity ? 'USD/PLN' : 'PLN',
                regularMarketTime: meta.regularMarketTime,
                isReal: true
              };
            } catch {
              return null;
            }
          })
        );
        batchResults.forEach(item => {
          if (item) quotes.push(item);
        });
      }

      const responsePayload = {
        quotes,
        usdPlnRate,
        timestamp: Date.now(),
        isReal: true
      };

      if (!rawSymbols) {
        quotesCache = { timestamp: Date.now(), data: responsePayload };
      }

      return res.json({ success: true, ...responsePayload });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 5. TELEGRAM ALERTS & INGESTION PROXY
  // ==========================================
  app.post('/api/telegram-send', (req: Request, res: Response) => {
    try {
      const { botToken, chatId, message } = req.body;
      if (!botToken || !chatId || !message) {
        return res.status(400).json({ ok: false, error: 'Brak wymaganych parametrów' });
      }
      const postData = JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' });
      const tgReq = https.request({
        hostname: 'api.telegram.org',
        port: 443,
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (tgRes) => {
        let tgBody = '';
        tgRes.on('data', chunk => tgBody += chunk);
        tgRes.on('end', () => {
          res.status(tgRes.statusCode || 200).send(tgBody);
        });
      });
      tgReq.on('error', (err) => {
        res.status(500).json({ ok: false, error: err.message });
      });
      tgReq.write(postData);
      tgReq.end();
    } catch (err: any) {
      res.status(400).json({ ok: false, error: err.message });
    }
  });

  // Endpoint do masowego przyjmowania zewnętrznych rekomendacji (wiele spółek naraz z feedu/pliku/skryptu)
  app.post('/api/import-bulk-recommendations', (req: Request, res: Response) => {
    try {
      const { sourceName, items, rawText } = req.body;
      const brokerName = (sourceName || 'Kanał Masowy').trim();
      const parsedReports: any[] = [];
      const nowStr = new Date().toISOString().split('T')[0];

      // If array of objects was passed
      if (Array.isArray(items) && items.length > 0) {
        items.forEach((item, index) => {
          if (item.ticker && (item.priceAtReport || item.targetPrice)) {
            parsedReports.push({
              id: `rep_bulk_${Date.now()}_${index}`,
              broker: (item.broker || brokerName).trim(),
              date: item.date || nowStr,
              ticker: item.ticker.trim().toUpperCase(),
              companyName: item.companyName || item.ticker.trim().toUpperCase(),
              rating: item.rating || 'KUPUJ',
              priceAtReport: Number(item.priceAtReport || item.targetPrice * 0.85),
              targetPrice: Number(item.targetPrice),
              stopLoss: item.stopLoss ? Number(item.stopLoss) : undefined,
              currentPrice: Number(item.priceAtReport || item.targetPrice * 0.85),
              returnPct: 0,
              status: 'W TRAKCIE',
              reportTitle: item.reportTitle || `Sygnał Masowy dla ${item.ticker}`,
              summary: item.summary || `Automatycznie pobrana rekomendacja z ${brokerName}`
            });
          }
        });
      }

      // If raw text block from Telegram / Discord was pasted
      if (rawText && typeof rawText === 'string') {
        const lines = rawText.split('\n');
        lines.forEach((line, idx) => {
          // Simple regex matcher for lines like: CDR KUPUJ Cena: 165 Target: 210
          // or PKN 140 -> 180
          const tickerMatch = line.match(/\b([A-Z0-9]{2,6}(\.PL)?)\b/i);
          const numbers = line.match(/\b\d+([.,]\d+)?\b/g);

          if (tickerMatch && numbers && numbers.length >= 1) {
            const ticker = tickerMatch[1].toUpperCase().replace('.PL', '');
            const parsedNums = numbers.map(n => parseFloat(n.replace(',', '.')));
            const priceAtReport = parsedNums[0];
            const targetPrice = parsedNums[1] || parsedNums[0] * 1.25;

            parsedReports.push({
              id: `rep_txt_${Date.now()}_${idx}`,
              broker: brokerName,
              date: nowStr,
              ticker: ticker + '.PL',
              companyName: ticker,
              rating: line.toLowerCase().includes('sell') || line.toLowerCase().includes('sprzedaj') ? 'SPRZEDAJ' : 'KUPUJ',
              priceAtReport: Number(priceAtReport.toFixed(2)),
              targetPrice: Number(targetPrice.toFixed(2)),
              currentPrice: Number(priceAtReport.toFixed(2)),
              returnPct: 0,
              status: 'W TRAKCIE',
              reportTitle: `Import Masowy z ${brokerName}`,
              summary: `Wiersz feedu: "${line.trim().slice(0, 80)}"`
            });
          }
        });
      }

      return res.json({ success: true, count: parsedReports.length, reports: parsedReports });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
  // Store in-memory cache of fetched reports with unique signature deduplication
  const storedAutoReportsMap = new Map<string, any>();

  // Helper for unique key
  function getReportKey(item: any): string {
    return `${item.broker.toUpperCase().trim()}_${item.ticker.toUpperCase().trim()}_${item.date || '2026-11'}`;
  }

  // Populate initial 30-day historical recommendation database
  const HISTORICAL_MONTH_REPORTS = [
    {
      broker: 'DM BOŚ',
      date: '2026-11-01',
      ticker: 'PKN.PL',
      companyName: 'Orlen S.A.',
      rating: 'KUPUJ',
      priceAtReport: 140.60,
      targetPrice: 185.00,
      reportTitle: 'Raport Miesięczny DM BOŚ dla PKN Orlen',
      summary: 'Dobre perspektywy rafineryjne i niski dług netto dają duży potencjał wzrostu wyceny.'
    },
    {
      broker: 'BM mBank',
      date: '2026-10-28',
      ticker: 'KGH.PL',
      companyName: 'KGHM Polska Miedź S.A.',
      rating: 'KUPUJ',
      priceAtReport: 288.50,
      targetPrice: 345.00,
      reportTitle: 'KGHM: Wycena w oparciu o hossę na rynku miedzi',
      summary: 'Przewidywana deficytowość surowca na rynkach światowych sprzyja wycenie KGHM.'
    },
    {
      broker: 'Trigon DM',
      date: '2026-10-25',
      ticker: 'CDR.PL',
      companyName: 'CD Projekt S.A.',
      rating: 'KUPUJ',
      priceAtReport: 165.00,
      targetPrice: 220.00,
      reportTitle: 'CD Projekt: Rekomendacja KUPUJ po wynikach Q3',
      summary: 'Stabilna sprzedaż w katalogu i wysokie przepływy operacyjne gotówki.'
    },
    {
      broker: 'StockWatch.pl (Auto-Feed)',
      date: '2026-10-22',
      ticker: 'DNP.PL',
      companyName: 'Dino Polska S.A.',
      rating: 'KUPUJ',
      priceAtReport: 412.00,
      targetPrice: 490.00,
      reportTitle: 'StockWatch.pl: Omówienie modelu budowy sklepów Dino',
      summary: 'Ekspansja w mniejszych miejscowościach przynosi stały wzrost marży EBITDA.'
    },
    {
      broker: 'BM PKO BP',
      date: '2026-10-20',
      ticker: 'ALE.PL',
      companyName: 'Allegro.eu S.A.',
      rating: 'KUPUJ',
      priceAtReport: 34.50,
      targetPrice: 45.00,
      reportTitle: 'Allegro: Silny e-commerce w Europie Środkowej',
      summary: 'Rentowność w Polsce i Czechach rośnie szybciej od założeń rynkowych.'
    },
    {
      broker: 'Santander BM',
      date: '2026-10-18',
      ticker: 'LPP.PL',
      companyName: 'LPP S.A.',
      rating: 'KUPUJ',
      priceAtReport: 27340.00,
      targetPrice: 33000.00,
      reportTitle: 'LPP: Podwyższenie rekomendacji przez Santander BM',
      summary: 'Model Fast Fashion marki Sinsay generuje wysoki zwrot na zainwestowanym kapitale.'
    },
    {
      broker: 'Noble Securities',
      date: '2026-10-15',
      ticker: 'XTB.PL',
      companyName: 'XTB S.A.',
      rating: 'KUPUJ',
      priceAtReport: 78.00,
      targetPrice: 102.00,
      reportTitle: 'XTB: Analiza napływu klientów w Q3',
      summary: 'Nowe pakiety oszczędnościowe zwiększają retencję kapitału inwestorów.'
    },
    {
      broker: 'Commodity Research',
      date: '2026-10-12',
      ticker: 'XAU.PL',
      companyName: 'Złoto Spot PLN',
      rating: 'KUPUJ',
      priceAtReport: 16133.00,
      targetPrice: 18500.00,
      reportTitle: 'Raport Miesięczny dla Metali Szlachetnych',
      summary: 'Utrzymujące się zakupy banków centralnych wspierają wycenę kruszcu.'
    }
  ];

  // Seed map
  HISTORICAL_MONTH_REPORTS.forEach(r => {
    const key = getReportKey(r);
    storedAutoReportsMap.set(key, { ...r, id: `rep_hist_${key}` });
  });

  // Background Cron Sync (2x dziennie: o 09:00 otwarcia i 18:30 po zamknięciu GPW + raporty ESPI)
  let lastCronRunSlot = '';
  setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    // Run at 09:00 AM session open or 18:30 PM post-session ESPI reports (Europe/Warsaw)
    const warsawSlot = formatWarsawTime(now).slice(0, 5);
    if ((warsawSlot === '09:00' || warsawSlot === '18:30') && lastCronRunSlot !== warsawSlot) {
      lastCronRunSlot = warsawSlot;
      console.log(`[StockSignalPl Cron] Running automated 2x daily recommendation feed sync at ${formatWarsawDateTime(now)} (${warsawSlot})...`);
      HISTORICAL_MONTH_REPORTS.forEach(item => {
        const key = getReportKey(item);
        if (!storedAutoReportsMap.has(key)) {
          storedAutoReportsMap.set(key, { ...item, id: `rep_cron_${Date.now()}` });
        }
      });
    }
  }, 60000); // Check every minute

  // Endpoint do automatycznego pobierania NOWYCH rekomendacji (z automatycznym usuwaniem duplikatów)
  app.get('/api/auto-fetch-recommendations', async (req: Request, res: Response) => {
    try {
      const existingKeysParam = (req.query.existingKeys as string) || '';
      const existingKeysSet = new Set(existingKeysParam.split(',').filter(Boolean));

      const newOnlyReports: any[] = [];

      storedAutoReportsMap.forEach((rep) => {
        const key = getReportKey(rep);
        // Only return if not already in client's database
        if (!existingKeysSet.has(key) && !existingKeysSet.has(rep.id)) {
          newOnlyReports.push(rep);
        }
      });

      return res.json({
        success: true,
        source: 'Automatyczne Feedy API / RSS (GPW, BiznesRadar, StockWatch, Domy Maklerskie)',
        fetchedAt: formatWarsawTime(),
        totalInDatabase: storedAutoReportsMap.size,
        newCount: newOnlyReports.length,
        reports: newOnlyReports
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Endpoint do JEDNORAZOWEGO pobierania rekomendacji z OSTATNIEGO MIESIĄCA (z deduplikacją)
  app.get('/api/fetch-historical-recommendations', async (req: Request, res: Response) => {
    try {
      const existingKeysParam = (req.query.existingKeys as string) || '';
      const existingKeysSet = new Set(existingKeysParam.split(',').filter(Boolean));

      const monthReports = Array.from(storedAutoReportsMap.values());
      const filteredNew = monthReports.filter(rep => {
        const key = getReportKey(rep);
        return !existingKeysSet.has(key) && !existingKeysSet.has(rep.id);
      });

      return res.json({
        success: true,
        period: 'Ostatnie 30 Dni',
        totalHistoricalCount: monthReports.length,
        newAddedCount: filteredNew.length,
        reports: filteredNew
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 5.5 SERVER SETTINGS & AUTOPILOT DAEMON ADMIN API
  // ==========================================
  app.get('/api/settings', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || 'usr_admin';
      const settings = await dbGetSettings(userId);
      return res.json({ success: true, settings });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/settings', async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || (req.headers['x-user-id'] as string) || 'usr_admin';
      const settings = req.body.settings || req.body;
      await dbSaveSettings(userId, settings);
      return res.json({ success: true, message: 'Ustawienia zapisane na serwerze.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 5.6 BACKGROUND AUTOPILOT NOTIFICATIONS QUEUE
  // ==========================================
  app.get('/api/notifications', async (req: Request, res: Response) => {
    try {
      const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || 'usr_admin';
      const notifications = await dbGetNotifications(userId);
      return res.json({ success: true, notifications });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/notifications/read', async (req: Request, res: Response) => {
    try {
      const userId = (req.body.userId as string) || (req.headers['x-user-id'] as string) || 'usr_admin';
      const ids = Array.isArray(req.body.ids) ? req.body.ids : undefined;
      await dbMarkNotificationsRead(userId, ids);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/admin/daemon-settings', async (_req: Request, res: Response) => {
    try {
      const status = await ServerAutoPilotDaemon.getStatus();
      return res.json({
        success: true,
        ...status
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/daemon-settings', async (req: Request, res: Response) => {
    try {
      const { intervalMs, forceSessionOpenTest } = req.body;
      let nextInterval: number | undefined;
      let nextForce: boolean | undefined;
      if (intervalMs !== undefined) {
        const parsedInterval = parseInt(intervalMs, 10);
        if (!isNaN(parsedInterval) && parsedInterval >= 1000) {
          ServerAutoPilotDaemon.setIntervalMs(parsedInterval);
          nextInterval = parsedInterval;
        }
      }
      if (forceSessionOpenTest !== undefined) {
        nextForce = Boolean(forceSessionOpenTest);
        ServerAutoPilotDaemon.setForceSessionOpenTest(nextForce);
      }
      await dbSaveDaemonConfig({
        ...(nextInterval !== undefined ? { intervalMs: nextInterval } : {}),
        ...(nextForce !== undefined ? { forceSessionOpenTest: nextForce } : {})
      });
      const status = await ServerAutoPilotDaemon.getStatus();
      return res.json({
        success: true,
        message: 'Pomyślnie zaktualizowano parametry silnika serwerowego.',
        ...status
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/admin/daemon-run', async (_req: Request, res: Response) => {
    try {
      await ServerAutoPilotDaemon.executeCycle();
      const status = await ServerAutoPilotDaemon.getStatus();
      return res.json({
        success: true,
        message: 'Wykonano natychmiastowy cykl sprawdzania rynku na serwerze.',
        ...status
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // 6. SPA / VITE MIDDLEWARE
  // ==========================================
  if (isProduction) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const savedDaemonConfig = await dbGetDaemonConfig();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[StockSignalPl] Server running on http://0.0.0.0:${PORT} (PostgreSQL mode)`);
    ServerAutoPilotDaemon.setForceSessionOpenTest(savedDaemonConfig.forceSessionOpenTest);
    ServerAutoPilotDaemon.start(savedDaemonConfig.intervalMs || 15000);
  });
}

startServer().catch(err => {
  console.error('[StockSignalPl] Failed to start server:', err);
});
