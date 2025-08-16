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
 * Initializes the database schema from schema.sql if tables do not exist
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
            // If an error occurs, it might be best to stop the application
            process.exit(1);
        }
    } else {
        console.log('[DB] Tables already exist. Skipping schema initialization.');
    }
};

module.exports = {
  // Initialization
  loadDB: initSchema,

  // Data Getters
  getUsers: async () => {
    const { rows } = await query('SELECT * FROM users');
    // Convert array to object for compatibility with old code
    return rows.reduce((acc, user) => {
        acc[user.login] = user;
        return acc;
    }, {});
  },
  getOrders: () => query(`
    SELECT id, master_name AS "masterName", car_model AS "carModel", license_plate AS "licensePlate",
           description, amount, payment_type AS "paymentType", created_at AS "createdAt",
           client_id AS "clientId", status, week_id AS "weekId"
    FROM orders WHERE week_id IS NULL ORDER BY created_at DESC
  `),
  getAllOrders: () => query(`
    SELECT id, master_name AS "masterName", car_model AS "carModel", license_plate AS "licensePlate",
           description, amount, payment_type AS "paymentType", created_at AS "createdAt",
           client_id AS "clientId", status, week_id AS "weekId"
    FROM orders ORDER BY created_at DESC
  `),
  getHistory: () => query(`
    SELECT week_id AS "weekId", created_at AS "createdAt", salary_report AS "salaryReport"
    FROM weekly_reports ORDER BY created_at DESC
  `),
  getClients: () => query(`
    SELECT id, name, phone, car_model AS "carModel", license_plate AS "licensePlate", created_at AS "createdAt"
    FROM clients ORDER BY created_at DESC
  `),
  findClientByPhone: async (phone) => {
    const { rows } = await query(`
      SELECT id, name, phone, car_model AS "carModel", license_plate AS "licensePlate", created_at AS "createdAt"
      FROM clients WHERE phone = $1
    `, [phone]);
    return rows[0];
  },
  searchClients: async (searchQuery) => {
    const { rows } = await query(`
        SELECT id, name, phone, car_model AS "carModel", license_plate AS "licensePlate", created_at AS "createdAt"
        FROM clients WHERE name ILIKE $1 OR phone ILIKE $1 LIMIT 10
    `, [`%${searchQuery}%`]);
    return rows;
  },

  // Data Modifiers
  addOrder: (order) => {
    const { id, masterName, carModel, licensePlate, description, amount, paymentType, clientId } = order;
    return query(
      'INSERT INTO orders (id, master_name, car_model, license_plate, description, amount, payment_type, client_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, masterName, carModel, licensePlate, description, amount, paymentType, clientId]
    );
  },
  updateOrder: (order) => {
    const { id, masterName, carModel, licensePlate, description, amount, paymentType } = order;
    return query(
      'UPDATE orders SET master_name = $2, car_model = $3, license_plate = $4, description = $5, amount = $6, payment_type = $7 WHERE id = $1',
      [id, masterName, carModel, licensePlate, description, amount, paymentType]
    );
  },
  updateOrderStatus: (id, status) => query('UPDATE orders SET status = $2 WHERE id = $1', [id, status]),
  deleteOrder: (id) => query('DELETE FROM orders WHERE id = $1', [id]),

  addClient: (client) => {
    const { id, name, phone, carModel, licensePlate } = client;
    return query(
      'INSERT INTO clients (id, name, phone, car_model, license_plate) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (phone) DO NOTHING',
      [id, name, phone, carModel, licensePlate]
    );
  },
  updateClient: (client) => {
    const { id, name, phone, carModel, licensePlate } = client;
    return query(
      'UPDATE clients SET name = $2, phone = $3, car_model = $4, license_plate = $5 WHERE id = $1',
      [id, name, phone, carModel, licensePlate]
    );
  },

  closeWeek: async (payload) => {
    const { salaryReport } = payload;
    const weekId = `week-${Date.now()}`;
    await query('BEGIN');
    try {
      await query('INSERT INTO weekly_reports (week_id, salary_report) VALUES ($1, $2)', [weekId, JSON.stringify(salaryReport)]);
      await query("UPDATE orders SET week_id = $1 WHERE week_id IS NULL", [weekId]);
      await query('COMMIT');
    } catch (e) {
      await query('ROLLBACK');
      throw e;
    }
  },

  clearData: () => query('DELETE FROM orders') && query('DELETE FROM weekly_reports'), // Simplified, consider constraints
  clearHistory: () => query('DELETE FROM weekly_reports'),

  // Search History Functions
  getSearchHistory: async (userLogin) => {
    const { rows } = await query(
      'SELECT id, user_login AS "userLogin", query, timestamp FROM search_history WHERE user_login = $1 ORDER BY timestamp DESC LIMIT 10',
      [userLogin]
    );
    return rows;
  },
  addSearchQuery: (userLogin, searchQuery) => {
    return query(
      'INSERT INTO search_history (id, user_login, query) VALUES ($1, $2, $3)',
      [`search-${Date.now()}`, userLogin, searchQuery]
    );
  }
};
