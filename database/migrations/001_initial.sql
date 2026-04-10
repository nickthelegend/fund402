-- fund402 Initial Schema

CREATE TABLE IF NOT EXISTS vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_address TEXT NOT NULL,
    origin_url TEXT NOT NULL,
    price_usdc BIGINT NOT NULL, -- scaled by 1e7
    description TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID REFERENCES vaults(id),
    agent_address TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    borrow_amount BIGINT NOT NULL,
    collateral_amount BIGINT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, confirmed, failed
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lp_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lp_address TEXT NOT NULL,
    amount BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pool_state (
    id SERIAL PRIMARY KEY,
    total_liquidity BIGINT DEFAULT 0,
    total_borrowed BIGINT DEFAULT 0,
    total_loans BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial pool state
INSERT INTO pool_state (total_liquidity, total_borrowed, total_loans) VALUES (0, 0, 0);
