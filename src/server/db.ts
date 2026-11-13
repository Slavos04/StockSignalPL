import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { INITIAL_PORTFOLIOS, INITIAL_TRADES, INITIAL_USERS } from '../data/initialData';
import { formatWarsawDateTime } from '../utils/dateTime';
import type { AutoPilotNotification } from '../types/stock';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgres://stockuser:stockpassword123!@localhost:5432/stocksignalpl';
const RUNTIME_STATE_FILE = path.resolve(process.cwd(), '.runtime-state.json');

export let pool: pg.Pool | null = null;
export let isPostgresConnected = false;

export interface DaemonConfig {
  intervalMs: number;
  forceSessionOpenTest: boolean;
}

// Fallback in-memory stores with JSON disk persistence when PostgreSQL is unavailable
const memoryUsers = new Map<string, any>();
const memoryPortfolios = new Map<string, any[]>();
const memoryTrades = new Map<string, any[]>();
const memorySettings = new Map<string, any>();
const memoryNotifications = new Map<string, AutoPilotNotification[]>();
let memoryDaemonConfig: DaemonConfig = {
  intervalMs: 15000,
  forceSessionOpenTest: false
};

function deduplicateById<T extends { id?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item?.id) continue;
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

function seedDefaultMemoryState(): void {
  INITIAL_USERS.forEach(u => {
    memoryUsers.set(u.id, {
      ...u,
      password_hash: u.username === 'admin' ? 'Admin123!' : 'gpw2026!'
    });
    memoryPortfolios.set(u.id, JSON.parse(JSON.stringify(INITIAL_PORTFOLIOS)));
    memoryTrades.set(u.id, JSON.parse(JSON.stringify(INITIAL_TRADES)));
    memoryNotifications.set(u.id, []);
  });
}

let persistTimer: NodeJS.Timeout | null = null;
function schedulePersistRuntimeState(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      const payload = {
        users: Object.fromEntries(memoryUsers.entries()),
        portfolios: Object.fromEntries(memoryPortfolios.entries()),
        trades: Object.fromEntries(memoryTrades.entries()),
        settings: Object.fromEntries(memorySettings.entries()),
        notifications: Object.fromEntries(memoryNotifications.entries()),
        daemonConfig: memoryDaemonConfig
      };
      const tmpFile = `${RUNTIME_STATE_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), 'utf8');
      fs.renameSync(tmpFile, RUNTIME_STATE_FILE);
    } catch (e: any) {
      console.warn('[RuntimeState] Błąd zapisu stanu serwera:', e?.message || e);
    }
  }, 150);
}

function loadRuntimeStateFromDisk(): void {
  seedDefaultMemoryState();
  try {
    if (!fs.existsSync(RUNTIME_STATE_FILE)) return;
    const raw = fs.readFileSync(RUNTIME_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    if (parsed.users && typeof parsed.users === 'object') {
      for (const [k, v] of Object.entries(parsed.users)) {
        memoryUsers.set(k, v);
      }
    }
    if (parsed.portfolios && typeof parsed.portfolios === 'object') {
      for (const [k, v] of Object.entries(parsed.portfolios)) {
        if (Array.isArray(v) && v.length > 0) {
          memoryPortfolios.set(k, v);
        }
      }
    }
    if (parsed.trades && typeof parsed.trades === 'object') {
      for (const [k, v] of Object.entries(parsed.trades)) {
        if (Array.isArray(v)) {
          memoryTrades.set(k, deduplicateById(v).slice(0, 200));
        }
      }
    }
    if (parsed.settings && typeof parsed.settings === 'object') {
      for (const [k, v] of Object.entries(parsed.settings)) {
        memorySettings.set(k, v);
      }
    }
    if (parsed.notifications && typeof parsed.notifications === 'object') {
      for (const [k, v] of Object.entries(parsed.notifications)) {
        if (Array.isArray(v)) {
          memoryNotifications.set(k, deduplicateById(v as AutoPilotNotification[]).slice(0, 100));
        }
      }
    }
    if (parsed.daemonConfig && typeof parsed.daemonConfig === 'object') {
      memoryDaemonConfig = {
        intervalMs: Number(parsed.daemonConfig.intervalMs) || 15000,
        forceSessionOpenTest: Boolean(parsed.daemonConfig.forceSessionOpenTest)
      };
    }
    console.log('[RuntimeState] Przywrócono stan portfeli, transakcji, powiadomień i konfiguracji demona z dysku.');
  } catch (e: any) {
    console.warn('[RuntimeState] Nie udało się odczytać zapisanego stanu, używam domyślnego:', e?.message || e);
  }
}

loadRuntimeStateFromDisk();

export async function initPostgres(): Promise<void> {
  try {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 10000,
      max: 15
    });

    const client = await pool.connect();
    isPostgresConnected = true;
    console.log('[PostgreSQL] Pomyślnie połączono z bazą PostgreSQL na serwerze.');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(128) PRIMARY KEY,
        username VARCHAR(128) UNIQUE NOT NULL,
        email VARCHAR(128) UNIQUE NOT NULL,
        full_name VARCHAR(128),
        password_hash VARCHAR(256) NOT NULL,
        role VARCHAR(32) DEFAULT 'trader',
        status VARCHAR(32) DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        last_login VARCHAR(64)
      );

      CREATE TABLE IF NOT EXISTS portfolios (
        id VARCHAR(128) NOT NULL,
        user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(128) NOT NULL,
        short_desc TEXT,
        risk_level VARCHAR(64) DEFAULT 'Umiarkowane',
        initial_capital NUMERIC(14, 2) DEFAULT 100000,
        current_balance NUMERIC(14, 2) DEFAULT 100000,
        allocated_pln NUMERIC(14, 2) DEFAULT 0,
        cash_pln NUMERIC(14, 2) DEFAULT 100000,
        total_profit_pln NUMERIC(14, 2) DEFAULT 0,
        total_profit_percent NUMERIC(8, 2) DEFAULT 0,
        benchmark_return_wig20 NUMERIC(8, 2) DEFAULT 14.2,
        alpha NUMERIC(8, 2) DEFAULT 0,
        trades_count INT DEFAULT 0,
        win_rate NUMERIC(8, 2) DEFAULT 100,
        autopilot_enabled BOOLEAN DEFAULT true,
        telegram_enabled BOOLEAN DEFAULT false,
        is_custom BOOLEAN DEFAULT false,
        active_positions JSONB DEFAULT '[]'::jsonb,
        history_data JSONB DEFAULT '[]'::jsonb,
        strategy_meta JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, user_id)
      );

      ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS strategy_meta JSONB DEFAULT '{}'::jsonb;

      CREATE TABLE IF NOT EXISTS trades (
        id VARCHAR(128) NOT NULL,
        user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        strategy_id VARCHAR(128),
        date VARCHAR(64),
        ticker VARCHAR(32),
        name VARCHAR(128),
        type VARCHAR(32),
        price_pln NUMERIC(14, 2),
        shares NUMERIC(14, 4),
        total_pln NUMERIC(14, 2),
        result_pln NUMERIC(14, 2) DEFAULT 0,
        result_percent NUMERIC(8, 2) DEFAULT 0,
        reason TEXT,
        status VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, user_id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        user_id VARCHAR(128) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme VARCHAR(32) DEFAULT 'dark',
        custom_bg_url TEXT DEFAULT '',
        refresh_interval_sec INT DEFAULT 4,
        bg_opacity INT DEFAULT 85,
        bg_blur INT DEFAULT 0,
        bot_token VARCHAR(256) DEFAULT '',
        chat_id VARCHAR(128) DEFAULT '',
        alerts_enabled BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(128) NOT NULL,
        user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payload JSONB NOT NULL,
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, user_id)
      );

      CREATE TABLE IF NOT EXISTS daemon_config (
        id VARCHAR(32) PRIMARY KEY,
        interval_ms INT DEFAULT 15000,
        force_session_open_test BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO users (id, username, email, full_name, password_hash, role, status, last_login)
      VALUES ('usr_admin', 'admin', 'slavosmm@gmail.com', 'Główny Administrator GPW', 'Admin123!', 'admin', 'active', '04.11.2026, 10:00')
      ON CONFLICT (username) DO NOTHING;

      INSERT INTO users (id, username, email, full_name, password_hash, role, status, last_login)
      VALUES ('usr_trader', 'trader_gpw', 'trader@gpw.pl', 'Inwestor Indywidualny GPW', 'gpw2026!', 'trader', 'active', '04.11.2026, 10:00')
      ON CONFLICT (username) DO NOTHING;
    `);

    client.release();
  } catch (err: any) {
    isPostgresConnected = false;
    console.warn(`[PostgreSQL] Baza danych Postgres na serwerze nie jest jeszcze aktywna (${err.message}). Używam trwałego bufora serwera.`);
  }
}

// User methods
export async function dbGetUserByLogin(usernameOrEmail: string): Promise<any | null> {
  const clean = usernameOrEmail.trim().toLowerCase();
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT * FROM users WHERE LOWER(username) = $1 OR LOWER(email) = $1 LIMIT 1`,
        [clean]
      );
      if (res.rows.length > 0) return res.rows[0];
      return null;
    } catch (e) {
      console.error('[PostgreSQL] dbGetUserByLogin error:', e);
    }
  }

  for (const user of memoryUsers.values()) {
    if (user.username.toLowerCase() === clean || user.email.toLowerCase() === clean) {
      return user;
    }
  }
  return null;
}

export async function dbCreateUser(user: { id: string; username: string; email: string; fullName: string; passwordHash: string; role: string }): Promise<any> {
  const nowStr = formatWarsawDateTime();
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `INSERT INTO users (id, username, email, full_name, password_hash, role, status, last_login)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
         RETURNING *`,
        [user.id, user.username, user.email, user.fullName, user.passwordHash, user.role, nowStr]
      );
      return res.rows[0];
    } catch (e) {
      console.error('[PostgreSQL] dbCreateUser error:', e);
    }
  }

  const memoryObj = {
    ...user,
    full_name: user.fullName,
    password_hash: user.passwordHash,
    status: 'active',
    last_login: nowStr
  };
  memoryUsers.set(user.id, memoryObj);
  schedulePersistRuntimeState();
  return memoryObj;
}

function mapPgPortfolioRow(r: any): any {
  const meta = (r.strategy_meta && typeof r.strategy_meta === 'object') ? r.strategy_meta : {};
  return {
    ...meta,
    id: r.id,
    userId: r.user_id,
    name: r.name,
    shortDesc: r.short_desc,
    riskLevel: r.risk_level,
    initialCapital: Number(r.initial_capital),
    currentBalance: Number(r.current_balance),
    allocatedPln: Number(r.allocated_pln),
    cashPln: Number(r.cash_pln),
    totalProfitPln: Number(r.total_profit_pln),
    totalProfitPercent: Number(r.total_profit_percent),
    benchmarkReturnWig20: Number(r.benchmark_return_wig20),
    alpha: Number(r.alpha),
    tradesCount: r.trades_count,
    winRate: Number(r.win_rate),
    autoPilotEnabled: r.autopilot_enabled,
    telegramEnabled: r.telegram_enabled,
    isCustom: r.is_custom,
    activePositions: r.active_positions || [],
    historyData: r.history_data || []
  };
}

// Portfolios methods
export async function dbGetPortfolios(userId: string): Promise<any[]> {
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT * FROM portfolios WHERE user_id = $1 ORDER BY updated_at DESC`,
        [userId]
      );
      if (res.rows.length > 0) {
        return res.rows.map(mapPgPortfolioRow);
      }

      for (const p of INITIAL_PORTFOLIOS) {
        await dbSavePortfolio(userId, p);
      }
      return INITIAL_PORTFOLIOS;
    } catch (e) {
      console.error('[PostgreSQL] dbGetPortfolios error:', e);
    }
  }

  const list = memoryPortfolios.get(userId);
  if (list && list.length > 0) return list;
  const initial = JSON.parse(JSON.stringify(INITIAL_PORTFOLIOS));
  memoryPortfolios.set(userId, initial);
  schedulePersistRuntimeState();
  return initial;
}

export async function dbSavePortfolio(userId: string, p: any): Promise<void> {
  if (isPostgresConnected && pool) {
    try {
      const strategyMeta = {
        allowedMarkets: p.allowedMarkets,
        allowedMarket: p.allowedMarket,
        createdAt: p.createdAt,
        orderExecutionType: p.orderExecutionType,
        positionSizingModel: p.positionSizingModel,
        stopLossTrailingMode: p.stopLossTrailingMode,
        categoryAllocationLimit: p.categoryAllocationLimit,
        allowPyramiding: p.allowPyramiding,
        multiTpBreakEvenEnabled: p.multiTpBreakEvenEnabled,
        anchorLeaderTracking: p.anchorLeaderTracking,
        anchorLeaderTicker: p.anchorLeaderTicker,
        anchorLeaderTrendMode: p.anchorLeaderTrendMode,
        anchorLeaderCorrelation: p.anchorLeaderCorrelation,
        anchorLeaderLagMinutes: p.anchorLeaderLagMinutes,
        autoPilotMinConfidence: p.autoPilotMinConfidence,
        autoPilotMinRiskReward: p.autoPilotMinRiskReward,
        autoPilotMaxPositions: p.autoPilotMaxPositions,
        autoPilotAllocationPercent: p.autoPilotAllocationPercent,
        drawdownLockCap: p.drawdownLockCap,
        drawdownLockActive: p.drawdownLockActive,
        autoCutWeakConsensus: p.autoCutWeakConsensus,
        autoPilotLogs: (p.autoPilotLogs || []).slice(0, 100)
      };

      await pool.query(
        `INSERT INTO portfolios (
          id, user_id, name, short_desc, risk_level, initial_capital, current_balance,
          allocated_pln, cash_pln, total_profit_pln, total_profit_percent, benchmark_return_wig20,
          alpha, trades_count, win_rate, autopilot_enabled, telegram_enabled, is_custom,
          active_positions, history_data, strategy_meta, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP
        )
        ON CONFLICT (id, user_id) DO UPDATE SET
          name = EXCLUDED.name,
          short_desc = EXCLUDED.short_desc,
          risk_level = EXCLUDED.risk_level,
          initial_capital = EXCLUDED.initial_capital,
          current_balance = EXCLUDED.current_balance,
          allocated_pln = EXCLUDED.allocated_pln,
          cash_pln = EXCLUDED.cash_pln,
          total_profit_pln = EXCLUDED.total_profit_pln,
          total_profit_percent = EXCLUDED.total_profit_percent,
          benchmark_return_wig20 = EXCLUDED.benchmark_return_wig20,
          alpha = EXCLUDED.alpha,
          trades_count = EXCLUDED.trades_count,
          win_rate = EXCLUDED.win_rate,
          autopilot_enabled = EXCLUDED.autopilot_enabled,
          telegram_enabled = EXCLUDED.telegram_enabled,
          is_custom = EXCLUDED.is_custom,
          active_positions = EXCLUDED.active_positions,
          history_data = EXCLUDED.history_data,
          strategy_meta = EXCLUDED.strategy_meta,
          updated_at = CURRENT_TIMESTAMP`,
        [
          p.id,
          userId,
          p.name,
          p.shortDesc || '',
          p.riskLevel || 'Umiarkowane',
          Number(p.initialCapital) || 100000,
          Number(p.currentBalance) || 100000,
          Number(p.allocatedPln) || 0,
          Number(p.cashPln) || 100000,
          Number(p.totalProfitPln) || 0,
          Number(p.totalProfitPercent) || 0,
          Number(p.benchmarkReturnWig20) || 14.2,
          Number(p.alpha) || 0,
          Number(p.tradesCount) || 0,
          Number(p.winRate) || 100,
          Boolean(p.autoPilotEnabled),
          Boolean(p.telegramEnabled),
          Boolean(p.isCustom),
          JSON.stringify(p.activePositions || []),
          JSON.stringify(p.historyData || []),
          JSON.stringify(strategyMeta)
        ]
      );
      return;
    } catch (e) {
      console.error('[PostgreSQL] dbSavePortfolio error:', e);
    }
  }

  const list = memoryPortfolios.get(userId) || [];
  const idx = list.findIndex(x => x.id === p.id);
  if (idx >= 0) {
    list[idx] = { ...p };
  } else {
    list.push({ ...p });
  }
  memoryPortfolios.set(userId, list);
  schedulePersistRuntimeState();
}

export async function dbDeletePortfolio(userId: string, portfolioId: string): Promise<void> {
  if (isPostgresConnected && pool) {
    try {
      await pool.query(`DELETE FROM portfolios WHERE id = $1 AND user_id = $2`, [portfolioId, userId]);
      return;
    } catch (e) {
      console.error('[PostgreSQL] dbDeletePortfolio error:', e);
    }
  }

  const list = memoryPortfolios.get(userId) || [];
  memoryPortfolios.set(userId, list.filter(x => x.id !== portfolioId));
  schedulePersistRuntimeState();
}

// Trades methods
export async function dbGetTrades(userId: string): Promise<any[]> {
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT * FROM trades WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
        [userId]
      );
      if (res.rows.length > 0) {
        return res.rows.map(r => ({
          id: r.id,
          strategyId: r.strategy_id,
          date: r.date,
          ticker: r.ticker,
          name: r.name,
          type: r.type,
          pricePln: Number(r.price_pln),
          shares: Number(r.shares),
          totalPln: Number(r.total_pln),
          resultPln: Number(r.result_pln),
          resultPercent: Number(r.result_percent),
          reason: r.reason,
          status: r.status
        }));
      }

      for (const t of INITIAL_TRADES) {
        await dbSaveTrade(userId, t);
      }
      return INITIAL_TRADES;
    } catch (e) {
      console.error('[PostgreSQL] dbGetTrades error:', e);
    }
  }

  const list = memoryTrades.get(userId);
  if (list && list.length > 0) return deduplicateById(list);
  const initial = JSON.parse(JSON.stringify(INITIAL_TRADES));
  memoryTrades.set(userId, initial);
  schedulePersistRuntimeState();
  return initial;
}

export async function dbSaveTrade(userId: string, t: any): Promise<void> {
  if (!t || !t.id) return;

  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO trades (
          id, user_id, strategy_id, date, ticker, name, type, price_pln,
          shares, total_pln, result_pln, result_percent, reason, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) ON CONFLICT (id, user_id) DO NOTHING`,
        [
          t.id,
          userId,
          t.strategyId || 'p1',
          t.date || formatWarsawDateTime(),
          t.ticker,
          t.name,
          t.type,
          Number(t.pricePln) || 0,
          Number(t.shares) || 1,
          Number(t.totalPln) || 0,
          Number(t.resultPln) || 0,
          Number(t.resultPercent) || 0,
          t.reason || '',
          t.status || 'AUTO-PILOT'
        ]
      );
      return;
    } catch (e) {
      console.error('[PostgreSQL] dbSaveTrade error:', e);
    }
  }

  const list = memoryTrades.get(userId) || [];
  if (list.some(x => x.id === t.id)) {
    return;
  }
  list.unshift({ ...t });
  memoryTrades.set(userId, list.slice(0, 200));
  schedulePersistRuntimeState();
}

export async function dbGetAllPortfoliosWithUsers(): Promise<{ userId: string; portfolio: any }[]> {
  const result: { userId: string; portfolio: any }[] = [];

  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(`SELECT * FROM portfolios WHERE autopilot_enabled = true`);
      res.rows.forEach(r => {
        result.push({
          userId: r.user_id,
          portfolio: mapPgPortfolioRow(r)
        });
      });
      return result;
    } catch (e) {
      console.error('[PostgreSQL] dbGetAllPortfoliosWithUsers error:', e);
    }
  }

  for (const [userId, ports] of memoryPortfolios.entries()) {
    ports.forEach(p => {
      if (p.autoPilotEnabled) {
        result.push({ userId, portfolio: p });
      }
    });
  }

  return result;
}

export async function dbGetSettings(userId: string): Promise<any | null> {
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(`SELECT * FROM settings WHERE user_id = $1 LIMIT 1`, [userId]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (e) {
      console.error('[PostgreSQL] dbGetSettings error:', e);
    }
  }
  return memorySettings.get(userId) || null;
}

export async function dbSaveSettings(userId: string, s: any): Promise<void> {
  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO settings (user_id, theme, custom_bg_url, refresh_interval_sec, bg_opacity, bg_blur, bot_token, chat_id, alerts_enabled, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE SET
           theme = COALESCE(NULLIF(EXCLUDED.theme, ''), settings.theme),
           custom_bg_url = COALESCE(NULLIF(EXCLUDED.custom_bg_url, ''), settings.custom_bg_url),
           refresh_interval_sec = COALESCE(EXCLUDED.refresh_interval_sec, settings.refresh_interval_sec),
           bg_opacity = COALESCE(EXCLUDED.bg_opacity, settings.bg_opacity),
           bg_blur = COALESCE(EXCLUDED.bg_blur, settings.bg_blur),
           bot_token = COALESCE(NULLIF(EXCLUDED.bot_token, ''), settings.bot_token),
           chat_id = COALESCE(NULLIF(EXCLUDED.chat_id, ''), settings.chat_id),
           alerts_enabled = EXCLUDED.alerts_enabled,
           updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          s.theme || 'dark',
          s.customBgUrl || s.custom_bg_url || '',
          s.refreshIntervalSec || s.refresh_interval_sec || 4,
          s.bgOpacity ?? s.bg_opacity ?? 85,
          s.bgBlur ?? s.bg_blur ?? 0,
          s.botToken || s.bot_token || '',
          s.chatId || s.chat_id || '',
          Boolean(s.alertsEnabled ?? s.alerts_enabled ?? true)
        ]
      );
      return;
    } catch (e) {
      console.error('[PostgreSQL] dbSaveSettings error:', e);
    }
  }

  const existing = memorySettings.get(userId) || {};
  memorySettings.set(userId, { ...existing, ...s });
  schedulePersistRuntimeState();
}

// ==========================================
// NOTIFICATIONS METHODS (Persistent Background Queue)
// ==========================================
export async function dbGetNotifications(userId: string): Promise<AutoPilotNotification[]> {
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `SELECT payload, is_read FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`,
        [userId]
      );
      return res.rows.map(r => ({
        ...(r.payload || {}),
        read: Boolean(r.is_read)
      }));
    } catch (e) {
      console.error('[PostgreSQL] dbGetNotifications error:', e);
    }
  }

  const list = memoryNotifications.get(userId) || [];
  return deduplicateById(list);
}

export async function dbSaveNotification(userId: string, notif: AutoPilotNotification): Promise<void> {
  if (!notif || !notif.id) return;
  const payload: AutoPilotNotification = {
    ...notif,
    source: notif.source || 'SERVER_DAEMON',
    read: Boolean(notif.read)
  };

  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO notifications (id, user_id, payload, is_read)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id, user_id) DO NOTHING`,
        [payload.id, userId, JSON.stringify(payload), Boolean(payload.read)]
      );
      return;
    } catch (e) {
      console.error('[PostgreSQL] dbSaveNotification error:', e);
    }
  }

  const list = memoryNotifications.get(userId) || [];
  if (list.some(x => x.id === payload.id)) return;
  list.unshift(payload);
  memoryNotifications.set(userId, list.slice(0, 100));
  schedulePersistRuntimeState();
}

export async function dbMarkNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  if (isPostgresConnected && pool) {
    try {
      if (ids && ids.length > 0) {
        await pool.query(
          `UPDATE notifications SET is_read = true WHERE user_id = $1 AND id = ANY($2::text[])`,
          [userId, ids]
        );
      } else {
        await pool.query(
          `UPDATE notifications SET is_read = true WHERE user_id = $1`,
          [userId]
        );
      }
      return;
    } catch (e) {
      console.error('[PostgreSQL] dbMarkNotificationsRead error:', e);
    }
  }

  const list = memoryNotifications.get(userId) || [];
  const idSet = ids && ids.length > 0 ? new Set(ids) : null;
  const updated = list.map(n => (!idSet || idSet.has(n.id) ? { ...n, read: true } : n));
  memoryNotifications.set(userId, updated);
  schedulePersistRuntimeState();
}

// ==========================================
// DAEMON CONFIG METHODS
// ==========================================
export async function dbGetDaemonConfig(): Promise<DaemonConfig> {
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(`SELECT * FROM daemon_config WHERE id = 'default' LIMIT 1`);
      if (res.rows.length > 0) {
        return {
          intervalMs: Number(res.rows[0].interval_ms) || 15000,
          forceSessionOpenTest: Boolean(res.rows[0].force_session_open_test)
        };
      }
    } catch (e) {
      console.error('[PostgreSQL] dbGetDaemonConfig error:', e);
    }
  }
  return { ...memoryDaemonConfig };
}

export async function dbSaveDaemonConfig(cfg: Partial<DaemonConfig>): Promise<DaemonConfig> {
  const current = await dbGetDaemonConfig();
  const next: DaemonConfig = {
    intervalMs: cfg.intervalMs !== undefined ? Math.max(1000, Number(cfg.intervalMs)) : current.intervalMs,
    forceSessionOpenTest: cfg.forceSessionOpenTest !== undefined ? Boolean(cfg.forceSessionOpenTest) : current.forceSessionOpenTest
  };

  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO daemon_config (id, interval_ms, force_session_open_test, updated_at)
         VALUES ('default', $1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           interval_ms = EXCLUDED.interval_ms,
           force_session_open_test = EXCLUDED.force_session_open_test,
           updated_at = CURRENT_TIMESTAMP`,
        [next.intervalMs, next.forceSessionOpenTest]
      );
      return next;
    } catch (e) {
      console.error('[PostgreSQL] dbSaveDaemonConfig error:', e);
    }
  }

  memoryDaemonConfig = next;
  schedulePersistRuntimeState();
  return next;
}
