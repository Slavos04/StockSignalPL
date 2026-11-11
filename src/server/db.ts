import pg from 'pg';
import { INITIAL_PORTFOLIOS, INITIAL_TRADES, INITIAL_USERS } from '../data/initialData';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgres://stockuser:stockpassword123!@localhost:5432/stocksignalpl';

export let pool: pg.Pool | null = null;
export let isPostgresConnected = false;

// Fallback in-memory stores if Postgres is not running (e.g. dev preview without local Postgres daemon)
const memoryUsers = new Map<string, any>();
const memoryPortfolios = new Map<string, any[]>();
const memoryTrades = new Map<string, any[]>();
const memorySettings = new Map<string, any>();

// Initialize default users and their portfolios in memory
INITIAL_USERS.forEach(u => {
  memoryUsers.set(u.id, {
    ...u,
    password_hash: u.username === 'admin' ? 'Admin123!' : 'gpw2026!'
  });
  // Pre-seed default portfolios & trades so server daemon has data immediately on boot
  memoryPortfolios.set(u.id, JSON.parse(JSON.stringify(INITIAL_PORTFOLIOS)));
  memoryTrades.set(u.id, JSON.parse(JSON.stringify(INITIAL_TRADES)));
});

export async function initPostgres(): Promise<void> {
  try {
    pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 2500,
      idleTimeoutMillis: 10000,
      max: 15
    });

    // Test connection
    const client = await pool.connect();
    isPostgresConnected = true;
    console.log('[PostgreSQL] Pomyślnie połączono z bazą PostgreSQL na serwerze.');

    // Create tables if not exist
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
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id, user_id)
      );

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

      -- Default Admin account
      INSERT INTO users (id, username, email, full_name, password_hash, role, status, last_login)
      VALUES ('usr_admin', 'admin', 'slavosmm@gmail.com', 'Główny Administrator GPW', 'Admin123!', 'admin', 'active', '04.11.2026, 10:00')
      ON CONFLICT (username) DO NOTHING;

      -- Default Trader account
      INSERT INTO users (id, username, email, full_name, password_hash, role, status, last_login)
      VALUES ('usr_trader', 'trader_gpw', 'trader@gpw.pl', 'Inwestor Indywidualny GPW', 'gpw2026!', 'trader', 'active', '04.11.2026, 10:00')
      ON CONFLICT (username) DO NOTHING;
    `);

    client.release();
  } catch (err: any) {
    isPostgresConnected = false;
    console.warn(`[PostgreSQL] Baza danych Postgres na serwerze nie jest jeszcze aktywna (${err.message}). Używam wbudowanego bufora pamięci serwera.`);
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

  // Memory fallback
  for (const user of memoryUsers.values()) {
    if (user.username.toLowerCase() === clean || user.email.toLowerCase() === clean) {
      return user;
    }
  }
  return null;
}

export async function dbCreateUser(user: { id: string; username: string; email: string; fullName: string; passwordHash: string; role: string }): Promise<any> {
  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(
        `INSERT INTO users (id, username, email, full_name, password_hash, role, status, last_login)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
         RETURNING *`,
        [user.id, user.username, user.email, user.fullName, user.passwordHash, user.role, new Date().toLocaleString('pl-PL')]
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
    last_login: new Date().toLocaleString('pl-PL')
  };
  memoryUsers.set(user.id, memoryObj);
  return memoryObj;
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
        return res.rows.map(r => ({
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
        }));
      }

      // If user has no portfolios yet, seed defaults in PostgreSQL
      for (const p of INITIAL_PORTFOLIOS) {
        await dbSavePortfolio(userId, p);
      }
      return INITIAL_PORTFOLIOS;
    } catch (e) {
      console.error('[PostgreSQL] dbGetPortfolios error:', e);
    }
  }

  // Memory fallback
  const list = memoryPortfolios.get(userId);
  if (list && list.length > 0) return list;
  const initial = [...INITIAL_PORTFOLIOS];
  memoryPortfolios.set(userId, initial);
  return initial;
}

export async function dbSavePortfolio(userId: string, p: any): Promise<void> {
  if (isPostgresConnected && pool) {
    try {
      await pool.query(
        `INSERT INTO portfolios (
          id, user_id, name, short_desc, risk_level, initial_capital, current_balance,
          allocated_pln, cash_pln, total_profit_pln, total_profit_percent, benchmark_return_wig20,
          alpha, trades_count, win_rate, autopilot_enabled, telegram_enabled, is_custom,
          active_positions, history_data, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, CURRENT_TIMESTAMP
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
          JSON.stringify(p.historyData || [])
        ]
      );
      return;
    } catch (e) {
      console.error('[PostgreSQL] dbSavePortfolio error:', e);
    }
  }

  // Memory fallback
  const list = memoryPortfolios.get(userId) || [];
  const idx = list.findIndex(x => x.id === p.id);
  if (idx >= 0) {
    list[idx] = { ...p };
  } else {
    list.push({ ...p });
  }
  memoryPortfolios.set(userId, list);
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
  if (list && list.length > 0) return list;
  const initial = [...INITIAL_TRADES];
  memoryTrades.set(userId, initial);
  return initial;
}

export async function dbSaveTrade(userId: string, t: any): Promise<void> {
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
          t.date || new Date().toLocaleString('pl-PL'),
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
  list.unshift({ ...t });
  memoryTrades.set(userId, list.slice(0, 200));
}

export async function dbGetAllPortfoliosWithUsers(): Promise<{ userId: string; portfolio: any }[]> {
  const result: { userId: string; portfolio: any }[] = [];

  if (isPostgresConnected && pool) {
    try {
      const res = await pool.query(`SELECT * FROM portfolios WHERE autopilot_enabled = true`);
      res.rows.forEach(r => {
        result.push({
          userId: r.user_id,
          portfolio: {
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
          }
        });
      });
      return result;
    } catch (e) {
      console.error('[PostgreSQL] dbGetAllPortfoliosWithUsers error:', e);
    }
  }

  // Memory fallback
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
           theme = EXCLUDED.theme,
           custom_bg_url = EXCLUDED.custom_bg_url,
           refresh_interval_sec = EXCLUDED.refresh_interval_sec,
           bg_opacity = EXCLUDED.bg_opacity,
           bg_blur = EXCLUDED.bg_blur,
           bot_token = EXCLUDED.bot_token,
           chat_id = EXCLUDED.chat_id,
           alerts_enabled = EXCLUDED.alerts_enabled,
           updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          s.theme || 'dark',
          s.customBgUrl || '',
          s.refreshIntervalSec || 4,
          s.bgOpacity || 85,
          s.bgBlur || 0,
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
}

