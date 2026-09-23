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
import { store } from './db/store.js';

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
    service: 'MilkHub Milk CRM Backend (Developed by Gen Z Neural-X)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Reset data to 5 clean records
app.post('/api/reset-data', (req, res) => {
  const fresh = store.resetToFreshSeed();
  res.json({
    status: 'ok',
    message: 'Database reset to clean 5 records',
    customers_count: fresh.customers.length,
    collections_count: fresh.milk_collections.length,
    payments_count: fresh.payments.length,
    expenses_count: fresh.expenses.length,
  });
});

// Mount Routes
app.use('/api/auth', authRouter);

// Apply authMiddleware to all other business API routes
app.use('/api', authMiddleware);
app.use('/api/customers', customerRouter);
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

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  MilkHub Milk Collection & Dairy CRM API           `);
  console.log(`  Developed by Gen Z Neural-X                       `);
  console.log(`  Running on http://localhost:${PORT}             `);
  console.log(`====================================================`);
});
