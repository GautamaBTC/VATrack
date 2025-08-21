/*────────────────────────────────────────────
  database.js
  Database management module (PostgreSQL)
─────────────────────────────────────────────*/

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

// Use DATABASE_URL from environment variables, with a fallback for local development
const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/vipauto';

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

/**
 * Executes a SQL query against the database
 * @param {string} text - The SQL query text
 * @param {Array} params - The query parameters
 * @returns {Promise<QueryResult>}
 */
const query = (text, params) => pool.query(text, params);

/**
 * Checks if a table exists in the database
 * @param {string} tableName - The name of the table
 * @returns {Promise<boolean>}
 */
const tableExists = async (tableName) => {
  const res = await query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    );
  `, [tableName]);
  return res.rows[0].exists;
};

/**
 * Checks if a specific column exists in a table
 * @param {string} tableName - The name of the table
 * @param {string} columnName - The name of the column
 * @returns {Promise<boolean>}
 */
const columnExists = async (tableName, columnName) => {
    const res = await query(`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = $1
            AND column_name = $2
        );
    `, [tableName, columnName]);
    return res.rows[0].exists;
};


const migrateUserData = async () => {
    console.log('[DB] Checking for user data migration...');
    const client = await pool.connect();
    try {
        const { rows: allUsers } = await client.query("SELECT login, password FROM users");

        // Check if any user has an un-hashed password. This is a more robust check.
        const needsMigration = allUsers.some(user => !user.password.startsWith('$2b$'));

        if (needsMigration) {
            console.log('[DB] Old password format detected. Migrating all user data...');
            await client.query('BEGIN');

            const usersToUpdate = {
                'director': { newLogin: 'Chief.Orlov', newHash: '$2b$10$84KZgSt.ff9HxRH9r3gwoeiOWxEdhRDVRSIYdeUMfrmkZMvNrumC6' },
                'vladimir.ch': { newLogin: 'Senior.Vlad', newHash: '$2b$10$a6LiDKCDIx2og0OurlINnuXEeQSLSod7RIiz.D2Q6qS.gfN0Aoe9C' },
                'vladimir.a': { newLogin: 'Master.Vladimir', newHash: '$2b$10$FfGiyFpGSU/QWJnyi1MfyO/fV0t24g08Cn20JO6UVUjWfXi2TeZ.m' },
                'andrey': { newLogin: 'Master.Andrey', newHash: '$2b$10$7f.bppgfTDTCfCIXazUnnO/cyuvmtN0bTJEUCkdqH1mcGtkEtjiGC' },
                'danila': { newLogin: 'Master.Danila', newHash: '$2b$10$aqoFMafFJFCNsk9ObMyE9.M6sHcJMLm1IF5iAGoGnhWbW.F2FTv5y' },
                'maxim': { newLogin: 'Master.Maxim', newHash: '$2b$10$zINh15CF1qvguPHXwc6Bn.JK1WhsXbakNJa/N.loZUheGUoRsXTPi' },
                'artyom': { newLogin: 'Master.Artyom', newHash: '$2b$10$fPZ1F9DFYeJZXulbdSREa.zlSFq2I.hLL9qp8CGQAA3DeCnLn0/uK' }
            };

            for (const oldLogin in usersToUpdate) {
                const { newLogin, newHash } = usersToUpdate[oldLogin];
                // Use a single UPDATE statement per user for clarity and atomicity.
                // This is safer as it won't fail if a user was already partially renamed.
                await client.query('UPDATE users SET login = $1, password = $2 WHERE login = $3', [newLogin, newHash, oldLogin]);
            }

            await client.query('COMMIT');
            console.log('[DB] User data migration successful.');
        } else {
            console.log('[DB] User data is already up-to-date. No migration needed.');
        }
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('!!! USER DATA MIGRATION ERROR:', err);
        process.exit(1);
    } finally {
        client.release();
    }
};


/**
 * Initializes the database schema and performs necessary migrations.
 */
const initSchema = async () => {
    const usersTableExists = await tableExists('users');
    if (!usersTableExists) {
        console.log('[DB] Tables not found. Initializing schema from schema.sql...');
        try {
            const schemaSql = await fs.readFile(path.join(__dirname, 'schema.sql'), 'utf-8');
            await query(schemaSql);
            console.log('[DB] Schema initialized successfully.');
        } catch (err) {
            console.error('!!! SCHEMA INITIALIZATION ERROR:', err);
            process.exit(1);
        }
    } else {
        console.log('[DB] Tables already exist. Checking for necessary migrations...');

        // Migration 1: Add 'favorite' column to 'clients' table if it doesn't exist
        const favoriteColumnExists = await columnExists('clients', 'favorite');
        if (!favoriteColumnExists) {
            console.log("[DB] Migrating schema: Adding 'favorite' column to 'clients' table...");
            try {
                await query('ALTER TABLE clients ADD COLUMN favorite BOOLEAN DEFAULT FALSE;');
                console.log("[DB] Schema migration for 'favorite' column successful.");
            } catch (err) {
                console.error("!!! MIGRATION ERROR ('favorite' column):", err);
                process.exit(1);
            }
        } else {
            console.log("[DB] 'favorite' column already exists. Skipping schema migration.");
        }

        // Migration 2: Update user logins and passwords to new hashed format
        await migrateUserData();
    }
};

module.exports = {
  // Initialization
  loadDB: initSchema,

  // Data Getters
  getUsers: async () => {
    const { rows } = await pool.query('SELECT * FROM users');
    // Convert array to object for compatibility with old code
    return rows.reduce((acc, user) => {
        acc[user.login] = user;
        return acc;
    }, {});
  },
  getOrders: () => pool.query(`
    SELECT id, master_name AS "masterName", car_model AS "carModel", license_plate AS "licensePlate",
           description, amount, payment_type AS "paymentType", created_at AS "createdAt",
           client_id AS "clientId", client_name AS "clientName", client_phone AS "clientPhone",
           status, week_id AS "weekId"
    FROM orders WHERE week_id IS NULL ORDER BY created_at DESC
  `),
  getAllOrders: () => pool.query(`
    SELECT id, master_name AS "masterName", car_model AS "carModel", license_plate AS "licensePlate",
           description, amount, payment_type AS "paymentType", created_at AS "createdAt",
           client_id AS "clientId", client_name AS "clientName", client_phone AS "clientPhone",
           status, week_id AS "weekId"
    FROM orders ORDER BY created_at DESC
  `),
  getHistory: () => pool.query(`
    SELECT week_id AS "weekId", created_at AS "createdAt", salary_report AS "salaryReport"
    FROM weekly_reports ORDER BY created_at DESC
  `),
  getClients: () => pool.query(`
    SELECT id, name, phone, car_model AS "carModel", license_plate AS "licensePlate", favorite, created_at AS "createdAt"
    FROM clients ORDER BY created_at DESC
  `),
  findClientByPhone: async (phone) => {
    const { rows } = await pool.query(`
      SELECT id, name, phone, car_model AS "carModel", license_plate AS "licensePlate", favorite, created_at AS "createdAt"
      FROM clients WHERE $1 = ANY(phone)
    `, [phone]);
    return rows[0];
  },
  searchClients: async (searchQuery) => {
    const { rows } = await pool.query(`
        SELECT id, name, phone, car_model AS "carModel", license_plate AS "licensePlate", favorite, created_at AS "createdAt"
        FROM clients WHERE name ILIKE $1 OR phone ILIKE $1 LIMIT 10
    `, [`%${searchQuery}%`]);
    return rows;
  },

  // Data Modifiers
  addOrder: (order) => {
    const { id, masterName, carModel, licensePlate, description, amount, paymentType, clientId, clientName, clientPhone } = order;
    return pool.query(
      'INSERT INTO orders (id, master_name, car_model, license_plate, description, amount, payment_type, client_id, client_name, client_phone) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, masterName, carModel, licensePlate, description, amount, paymentType, clientId, clientName, clientPhone]
    );
  },
  updateOrder: (order) => {
    const { id, masterName, carModel, licensePlate, description, amount, paymentType, clientName, clientPhone } = order;
    return pool.query(
      'UPDATE orders SET master_name = $2, car_model = $3, license_plate = $4, description = $5, amount = $6, payment_type = $7, client_name = $8, client_phone = $9 WHERE id = $1',
      [id, masterName, carModel, licensePlate, description, amount, paymentType, clientName, clientPhone]
    );
  },
  updateOrderStatus: (id, status) => pool.query('UPDATE orders SET status = $2 WHERE id = $1', [id, status]),
  deleteOrder: (id) => pool.query('DELETE FROM orders WHERE id = $1', [id]),

  addClient: (client) => {
    const { id, name, phone, carModel, licensePlate } = client;
    return pool.query(
      'INSERT INTO clients (id, name, phone, car_model, license_plate) VALUES ($1, $2, $3, $4, $5)',
      [id, name, phone, carModel, licensePlate]
    );
  },
  updateClient: (client) => {
    const { id, name, phone, carModel, licensePlate } = client;
    return pool.query(
      'UPDATE clients SET name = $2, phone = $3, car_model = $4, license_plate = $5 WHERE id = $1',
      [id, name, phone, carModel, licensePlate]
    );
  },
  deleteClient: (id) => pool.query('DELETE FROM clients WHERE id = $1', [id]),
  toggleFavoriteClient: (id, favorite) => pool.query('UPDATE clients SET favorite = $2 WHERE id = $1', [id, favorite]),

  closeWeek: async (payload) => {
    const { salaryReport } = payload;
    const weekId = `week-${Date.now()}`;
    await pool.query('BEGIN');
    try {
      await pool.query('INSERT INTO weekly_reports (week_id, salary_report) VALUES ($1, $2)', [weekId, JSON.stringify(salaryReport)]);
      await pool.query("UPDATE orders SET week_id = $1 WHERE week_id IS NULL", [weekId]);
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }
  },

  clearData: () => pool.query('DELETE FROM orders') && pool.query('DELETE FROM weekly_reports'),
  clearHistory: () => pool.query('DELETE FROM weekly_reports'),

  // Search History Functions
  getSearchHistory: async (userLogin) => {
    const { rows } = await pool.query(
      'SELECT id, user_login AS "userLogin", query, timestamp FROM search_history WHERE user_login = $1 ORDER BY timestamp DESC LIMIT 10',
      [userLogin]
    );
    return rows;
  },
  addSearchQuery: (userLogin, searchQuery) => {
    return pool.query(
      'INSERT INTO search_history (id, user_login, query) VALUES ($1, $2, $3)',
      [`search-${Date.now()}`, userLogin, searchQuery]
    );
  }
};
