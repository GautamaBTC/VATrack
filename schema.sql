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
    phone TEXT UNIQUE,
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
INSERT INTO users (login, password, role, name) VALUES
('director', 'Dir7wK9c', 'DIRECTOR', 'Владимир Орлов'),
('vladimir.ch', 'Vch4R5tG', 'SENIOR_MASTER', 'Владимир Ч.'),
('vladimir.a', 'Vla9L2mP', 'MASTER', 'Владимир А.'),
('andrey', 'And3Z8xY', 'MASTER', 'Андрей'),
('danila', 'Dan6J1vE', 'MASTER', 'Данила'),
('maxim', 'Max2B7nS', 'MASTER', 'Максим'),
('artyom', 'Art5H4qF', 'MASTER', 'Артём');
