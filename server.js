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
    const allWeekOrdersResult = await db.getOrders();
    const allWeekOrders = allWeekOrdersResult.rows;

    const users = await db.getUsers(); // This is an object now
    const historyResult = await db.getHistory();
    const history = historyResult.rows;
    const clientsResult = await db.getClients();
    const clients = clientsResult.rows;

    const masters = Object.values(users)
        .filter(u => u.name !== 'Владимир Орлов' && u.role.includes('MASTER'))
        .map(u => u.name);

    const userIsPrivileged = isPrivileged(user);
    const relevantOrders = userIsPrivileged ? allWeekOrders : allWeekOrders.filter(o => o.masterName === user.name);

    const weekStats = {
        revenue: relevantOrders.reduce((s, o) => s + parseFloat(o.amount), 0),
        ordersCount: relevantOrders.length,
        avgCheck: relevantOrders.length > 0 ? Math.round(relevantOrders.reduce((s, o) => s + parseFloat(o.amount), 0) / relevantOrders.length) : 0
    };

    const leaderboard = Object.values(allWeekOrders.reduce((acc, o) => {
        if (!acc[o.masterName]) acc[o.masterName] = { name: o.masterName, revenue: 0, ordersCount: 0 };
        acc[o.masterName].revenue += parseFloat(o.amount);
        acc[o.masterName].ordersCount++;
        return acc;
    }, {})).sort((a, b) => b.revenue - a.revenue);

    const todayOrders = relevantOrders.filter(o => new Date(o.created_at).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10));

    return {
        weekOrders: relevantOrders,
        weekStats: weekStats,
        todayOrders,
        leaderboard,
        masters,
        user,
        history: history || [],
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

  socket.on('addClient', async (clientData) => {
    if (isPrivileged(socket.user)) {
      const newClient = { ...clientData, id: `client-${Date.now()}` };
      await db.addClient(newClient);
      await broadcastUpdates();
    }
  });

  socket.on('updateClient', async (clientData) => {
    if (isPrivileged(socket.user)) {
      await db.updateClient(clientData);
      await broadcastUpdates();
    }
  });

  socket.on('addOrder', async (orderData) => {
    if (!isPrivileged(socket.user)) orderData.masterName = socket.user.name;

    const { clientName, clientPhone, carModel, licensePlate } = orderData;
    let client = await db.findClientByPhone(clientPhone);

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
  });

  socket.on('updateOrder', async (orderData) => {
    // Note: The complex time-based edit logic is simplified here.
    // In a real app, you might want to fetch the order first to check its timestamp.
    // For now, we trust the client-side checks and privilege level.
    if (isPrivileged(socket.user) || orderData.masterName === socket.user.name) {
        await db.updateOrder(orderData);
        await broadcastUpdates();
    } else {
        socket.emit('serverError', 'You do not have permission to edit this order.');
    }
  });

  socket.on('deleteOrder', async (id) => {
    if (isPrivileged(socket.user)) {
      await db.deleteOrder(id);
      await broadcastUpdates();
    }
  });

  socket.on('updateOrderStatus', async ({ id, status }) => {
    await db.updateOrderStatus(id, status);
    await broadcastUpdates();
  });

  socket.on('closeWeek', async (payload) => {
    const ordersResult = await db.getOrders();
    if (isPrivileged(socket.user) && ordersResult.rows.length) {
      await db.closeWeek(payload);
      await broadcastUpdates();
    }
  });

  socket.on('clearData', async () => {
    if (isPrivileged(socket.user)) {
      await db.clearData();
      await broadcastUpdates();
    }
  });

  socket.on('clearHistory', async () => {
    if (isPrivileged(socket.user)) {
      await db.clearHistory();
      await broadcastUpdates();
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
