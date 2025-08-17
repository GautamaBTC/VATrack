/*────────────────────────────────────────────
  server.js
  Final Polish - Version 9.0 (PostgreSQL)
─────────────────────────────────────────────*/

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('./database');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-for-vipauto-dont-share-it';

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(__dirname));

const isPrivileged = (user) => user && (user.role === 'DIRECTOR' || user.role === 'SENIOR_MASTER');

const prepareDataForUser = async (user) => {
    // Fetch all necessary data in parallel for efficiency
    const [
        weekOrdersResult,
        allOrdersResult,
        users,
        historyResult,
        clientsResult
    ] = await Promise.all([
        db.getOrders(),
        db.getAllOrders(),
        db.getUsers(),
        db.getHistory(),
        db.getClients()
    ]);

    const weekOrders = weekOrdersResult.rows;
    const allOrders = allOrdersResult.rows; // Includes active and archived orders
    const history = historyResult.rows;
    const clients = clientsResult.rows;

    // Filter out the director from the list of masters
    const masters = Object.values(users)
        .filter(u => u.role.includes('MASTER'))
        .map(u => u.name);

    // Determine which orders are relevant for the current user
    const userIsPrivileged = isPrivileged(user);
    const relevantWeekOrders = userIsPrivileged ? weekOrders : weekOrders.filter(o => o.masterName === user.name);

    // Calculate statistics for the current week
    const weekStats = {
        revenue: relevantWeekOrders.reduce((s, o) => s + parseFloat(o.amount || 0), 0),
        ordersCount: relevantWeekOrders.length,
        avgCheck: relevantWeekOrders.length > 0 ? Math.round(relevantWeekOrders.reduce((s, o) => s + parseFloat(o.amount || 0), 0) / relevantWeekOrders.length) : 0
    };

    // Create a leaderboard based on the current week's orders
    const leaderboard = Object.values(weekOrders.reduce((acc, o) => {
        if (!acc[o.masterName]) acc[o.masterName] = { name: o.masterName, revenue: 0, ordersCount: 0 };
        acc[o.masterName].revenue += parseFloat(o.amount || 0);
        acc[o.masterName].ordersCount++;
        return acc;
    }, {})).sort((a, b) => b.revenue - a.revenue);

    // Filter for today's orders from the relevant weekly orders
    const todayOrders = relevantWeekOrders.filter(o => new Date(o.createdAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10));

    // Attach the full order list to each history item for client-side rendering
    const historyWithOrders = history.map(h => {
        return {
            ...h,
            orders: allOrders.filter(o => o.weekId === h.weekId)
        };
    });

    return {
        weekOrders: relevantWeekOrders,
        weekStats,
        todayOrders,
        leaderboard,
        masters,
        user,
        history: historyWithOrders || [],
        clients: clients || []
    };
};

const broadcastUpdates = async () => {
    for (const socket of io.sockets.sockets.values()) {
        if (socket.user) {
            const data = await prepareDataForUser(socket.user);
            socket.emit('dataUpdate', data);
        }
    }
};

app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  const users = await db.getUsers();
  const userRecord = users[login];
  if (!userRecord || userRecord.password !== password) return res.status(401).json({ message: 'Invalid login or password' });
  const token = jwt.sign({ login, role: userRecord.role, name: userRecord.name }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { login, name: userRecord.name, role: userRecord.role } });
});

io.use((socket, next) => {
  try {
    socket.user = jwt.verify(socket.handshake.auth.token, JWT_SECRET);
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', async (socket) => {
  console.log(`[Socket] Connected: '${socket.user.name}'`);

  socket.emit('initialData', await prepareDataForUser(socket.user));

  socket.on('searchClients', async (query) => {
    if (query && query.trim().length > 1) {
      await db.addSearchQuery(socket.user.login, query);
    }
    const results = await db.searchClients(query);
    socket.emit('clientSearchResults', results);
  });

  socket.on('getSearchHistory', async () => {
    const history = await db.getSearchHistory(socket.user.login);
    socket.emit('searchHistoryResults', history);
  });

  const handleDatabaseWrite = async (socket, operation, ...args) => {
    try {
      await operation(...args);
      await broadcastUpdates();
    } catch (error) {
      console.error(`Database operation failed for user ${socket.user.login}:`, error);
      socket.emit('serverError', 'Ошибка при сохранении данных в базу. Пожалуйста, попробуйте еще раз.');
    }
  };

  socket.on('addClient', async (clientData) => {
    if (isPrivileged(socket.user)) {
      const newClient = { ...clientData, id: `client-${Date.now()}` };
      await handleDatabaseWrite(socket, db.addClient, newClient);
    }
  });

  socket.on('updateClient', async (clientData) => {
    if (isPrivileged(socket.user)) {
      await handleDatabaseWrite(socket, db.updateClient, clientData);
    }
  });

  socket.on('deleteClient', async (payload) => {
    console.log('--- DEBUG: deleteClient event received ---');
    console.log('Raw payload:', payload);
    console.log('Type of payload:', typeof payload);

    // Let's manually destructure to be safe
    const id = payload ? payload.id : undefined;

    console.log('Extracted ID:', id);
    console.log('Type of ID:', typeof id);
    console.log('User is privileged:', isPrivileged(socket.user));
    console.log('Condition check (isPrivileged && id):', isPrivileged(socket.user) && !!id);

    if (isPrivileged(socket.user) && id) {
      console.log('--- DEBUG: Proceeding with delete operation ---');
      await handleDatabaseWrite(socket, db.deleteClient, id);
    } else {
      console.log('--- DEBUG: Delete operation skipped due to failed checks ---');
    }
  });

  socket.on('addOrder', async (orderData) => {
    try {
        if (!isPrivileged(socket.user)) orderData.masterName = socket.user.name;

        const { clientName, clientPhone, carModel, licensePlate } = orderData;
        let client = null;
        if (clientPhone) {
            client = await db.findClientByPhone(clientPhone);
        }

        if (!client && clientPhone) {
            client = {
                id: `client-${Date.now()}`,
                name: clientName || 'Новый клиент',
                phone: clientPhone,
                carModel: carModel || '',
                licensePlate: licensePlate || ''
            };
            await db.addClient(client);
        }

        const newOrder = { ...orderData, id: `ord-${Date.now()}`, clientId: client ? client.id : null };
        await db.addOrder(newOrder);
        await broadcastUpdates();
    } catch (error) {
        console.error(`Add order failed for user ${socket.user.login}:`, error);
        socket.emit('serverError', 'Не удалось создать заказ-наряд.');
    }
  });

  socket.on('updateOrder', async (orderData) => {
    if (isPrivileged(socket.user) || orderData.masterName === socket.user.name) {
      await handleDatabaseWrite(socket, db.updateOrder, orderData);
    } else {
      socket.emit('serverError', 'У вас нет прав на редактирование этого заказа.');
    }
  });

  socket.on('deleteOrder', async ({ id }) => {
    if (isPrivileged(socket.user) && id) {
      await handleDatabaseWrite(socket, db.deleteOrder, id);
    }
  });

  socket.on('updateOrderStatus', async ({ id, status }) => {
    await handleDatabaseWrite(socket, db.updateOrderStatus, id, status);
  });

  socket.on('closeWeek', async (payload) => {
    const ordersResult = await db.getOrders();
    if (isPrivileged(socket.user) && ordersResult.rows.length) {
      await handleDatabaseWrite(socket, db.closeWeek, payload);
    }
  });

  socket.on('clearData', async () => {
    if (isPrivileged(socket.user)) {
      await handleDatabaseWrite(socket, db.clearData);
    }
  });

  socket.on('clearHistory', async () => {
    if (isPrivileged(socket.user)) {
      await handleDatabaseWrite(socket, db.clearHistory);
    }
  });

  socket.on('disconnect', () => console.log(`[Socket] Disconnected: '${socket.user.name}'`));
});

server.listen(PORT, async () => {
  try {
    await db.loadDB();
    console.log(`>>> VIP-Auto Server v9.0 (PostgreSQL) is running on port ${PORT} <<<`);
  } catch (err) {
    console.error("!!! FAILED TO START SERVER:", err);
    process.exit(1);
  }
});
