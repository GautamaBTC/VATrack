-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS search_history, weekly_reports, orders, clients, users CASCADE;

CREATE TABLE users (
    login TEXT PRIMARY KEY,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT[],
    car_model TEXT,
    license_plate TEXT,
    favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE weekly_reports (
    week_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    salary_report JSONB
);

CREATE TABLE orders (
    id TEXT PRIMARY KEY,
    master_name TEXT NOT NULL,
    car_model TEXT,
    license_plate TEXT,
    description TEXT,
    amount NUMERIC,
    payment_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
    client_name TEXT,
    client_phone TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    week_id TEXT REFERENCES weekly_reports(week_id) ON DELETE SET NULL
);

CREATE TABLE search_history (
    id TEXT PRIMARY KEY,
    user_login TEXT REFERENCES users(login) ON DELETE CASCADE,
    query TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial users
-- Seed initial users with final, complex, hashed passwords
INSERT INTO users (login, password, role, name) VALUES
('Chief.Orlov', '$2b$10$84KZgSt.ff9HxRH9r3gwoeiOWxEdhRDVRSIYdeUMfrmkZMvNrumC6', 'DIRECTOR', 'Владимир Орлов'),
('Senior.Vlad', '$2b$10$a6LiDKCDIx2og0OurlINnuXEeQSLSod7RIiz.D2Q6qS.gfN0Aoe9C', 'SENIOR_MASTER', 'Владимир Ч.'),
('Master.Vladimir', '$2b$10$FfGiyFpGSU/QWJnyi1MfyO/fV0t24g08Cn20JO6UVUjWfXi2TeZ.m', 'MASTER', 'Владимир А.'),
('Master.Andrey', '$2b$10$7f.bppgfTDTCfCIXazUnnO/cyuvmtN0bTJEUCkdqH1mcGtkEtjiGC', 'MASTER', 'Андрей'),
('Master.Danila', '$2b$10$aqoFMafFJFCNsk9ObMyE9.M6sHcJMLm1IF5iAGoGnhWbW.F2FTv5y', 'MASTER', 'Данила'),
('Master.Maxim', '$2b$10$zINh15CF1qvguPHXwc6Bn.JK1WhsXbakNJa/N.loZUheGUoRsXTPi', 'MASTER', 'Максим'),
('Master.Artyom', '$2b$10$fPZ1F9DFYeJZXulbdSREa.zlSFq2I.hLL9qp8CGQAA3DeCnLn0/uK', 'MASTER', 'Артём');
