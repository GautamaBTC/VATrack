/*────────────────────────────────────────────
  seed.js
  Populates the database with test data.
─────────────────────────────────────────────*/

const { Pool } = require('pg');

// Use DATABASE_URL from environment variables, with a fallback for local development
const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/vipauto';

const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const seedData = async () => {
  const client = await pool.connect();
  try {
    console.log('Seeding database with test data...');

    // Clear existing data
    await client.query('DELETE FROM orders');
    await client.query('DELETE FROM clients');

    // Seed clients
    const clientsData = [
      { id: 'client-1', name: 'Иван Петров', phone: '+79123456789', carModel: 'Lada Vesta', licensePlate: 'A123BC77' },
      { id: 'client-2', name: 'Сергей Смирнов', phone: '+79234567890', carModel: 'Toyota Camry', licensePlate: 'B456DE777' },
      { id: 'client-3', name: 'Анна Кузнецова', phone: '+79345678901', carModel: 'Ford Focus', licensePlate: 'C789FG99' },
    ];

    for (const c of clientsData) {
      await client.query(
        'INSERT INTO clients (id, name, phone, car_model, license_plate) VALUES ($1, $2, $3, $4, $5)',
        [c.id, c.name, c.phone, c.carModel, c.licensePlate]
      );
    }
    console.log(`Seeded ${clientsData.length} clients.`);

    // Seed orders
    const ordersData = [
      { id: 'ord-1', masterName: 'Владимир А.', carModel: 'Lada Vesta', licensePlate: 'A123BC77', description: 'Замена масла', amount: 1500, paymentType: 'Картой', clientId: 'client-1' },
      { id: 'ord-2', masterName: 'Андрей', carModel: 'Toyota Camry', licensePlate: 'B456DE777', description: 'Шиномонтаж', amount: 3000, paymentType: 'Наличные', clientId: 'client-2' },
      { id: 'ord-3', masterName: 'Данила', carModel: 'Ford Focus', licensePlate: 'C789FG99', description: 'Диагностика', amount: 1000, paymentType: 'Перевод', clientId: 'client-3' },
    ];

    for (const o of ordersData) {
      await client.query(
        'INSERT INTO orders (id, master_name, car_model, license_plate, description, amount, payment_type, client_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [o.id, o.masterName, o.carModel, o.licensePlate, o.description, o.amount, o.paymentType, o.clientId]
      );
    }
    console.log(`Seeded ${ordersData.length} orders.`);

    console.log('Database seeded successfully.');
  } catch (err) {
    console.error('Error seeding database:', err);
  } finally {
    client.release();
    pool.end();
  }
};

seedData();
