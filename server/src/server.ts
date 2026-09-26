import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/authRoutes.js';
import { customerRouter } from './routes/customerRoutes.js';
import { collectionRouter } from './routes/collectionRoutes.js';
import { rateRouter } from './routes/rateRoutes.js';
import { paymentRouter } from './routes/paymentRoutes.js';
import { settlementRouter } from './routes/settlementRoutes.js';
import { ledgerRouter } from './routes/ledgerRoutes.js';
import { expenseRouter } from './routes/expenseRoutes.js';
import { staffRouter } from './routes/staffRoutes.js';
import { centerRouter } from './routes/centerRoutes.js';
import { dashboardRouter } from './routes/dashboardRoutes.js';
import { reportRouter } from './routes/reportRoutes.js';
import { notificationRouter } from './routes/notificationRoutes.js';
import { settingRouter } from './routes/settingRoutes.js';
import { deliveryRouter } from './routes/deliveryRoutes.js';
import { store } from './db/store.js';
import { tidb } from './db/tidb.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Request logger for operations
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production' && req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MilkHub Milk CRM Backend (TiDB Powered)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// TiDB Database status diagnostic
app.get('/api/db/status', async (req, res) => {
  try {
    const status = await tidb.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error checking DB status' });
  }
});

// Reset data to clean state (dev/testing)
app.post('/api/reset-data', (req, res) => {
  const fresh = store.resetToFreshSeed();
  res.json({
    status: 'ok',
    message: 'Store reset to clean seed',
    customers_count: fresh.customers.length,
    collections_count: fresh.milk_collections.length,
    payments_count: fresh.payments.length,
    expenses_count: fresh.expenses.length,
  });
});

// Mount Public Auth Routes (Login, Logout)
app.use('/api/auth', authRouter);

// Apply strict authMiddleware to all protected CRM business API routes
app.use('/api', authMiddleware);
app.use('/api/customers', customerRouter);
app.use('/api/deliveries', deliveryRouter);
app.use('/api/collections', collectionRouter);
app.use('/api/rates', rateRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/settlements', settlementRouter);
app.use('/api/ledger', ledgerRouter);
app.use('/api/expenses', expenseRouter);
app.use('/api/staff', staffRouter);
app.use('/api/centers', centerRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/settings', settingRouter);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Initialize database and start server
async function startServer() {
  console.log('[Bootstrap] Initializing TiDB database connection & users table...');
  const connected = await tidb.initDatabase();
  if (connected) {
    console.log('[Bootstrap] TiDB connected and schema initialized.');
  } else {
    console.log('[Bootstrap] Operating with local fallback while TiDB credentials are configured.');
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`  MilkHub Milk Collection & Dairy CRM API           `);
    console.log(`  Database: TiDB (Status: ${connected ? 'CONNECTED' : 'LOCAL FALLBACK'})`);
    console.log(`  Running on http://0.0.0.0:${PORT}               `);
    console.log(`====================================================`);
  });
}

startServer().catch((err) => {
  console.error('[Bootstrap Error] Failed to start server:', err);
});
