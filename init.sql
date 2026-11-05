-- StockSignalPl v1.8 Database Schema for PostgreSQL
-- Self-hosted on Ubuntu with Docker & Docker Compose

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

-- Seed default Administrator account if not exists
INSERT INTO users (id, username, email, full_name, password_hash, role, status, created_at, last_login)
VALUES (
    'usr_admin',
    'admin',
    'slavosmm@gmail.com',
    'Główny Administrator GPW',
    'Admin123!',
    'admin',
    'active',
    CURRENT_TIMESTAMP,
    TO_CHAR(CURRENT_TIMESTAMP, 'DD.MM.YYYY, HH24:MI')
) ON CONFLICT (username) DO NOTHING;

-- Seed trader_gpw account
INSERT INTO users (id, username, email, full_name, password_hash, role, status, created_at, last_login)
VALUES (
    'usr_trader',
    'trader_gpw',
    'trader@gpw.pl',
    'Inwestor Indywidualny GPW',
    'gpw2026!',
    'trader',
    'active',
    CURRENT_TIMESTAMP,
    TO_CHAR(CURRENT_TIMESTAMP, 'DD.MM.YYYY, HH24:MI')
) ON CONFLICT (username) DO NOTHING;
