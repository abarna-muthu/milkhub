import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/authRoutes.js';
import { customerRouter } from './routes/customerRoutes.js';
import { deliveryRouter } from './routes/deliveryRoutes.js';
import { salesRouter } from './routes/salesRoutes.js';
import { paymentRouter } from './routes/paymentRoutes.js';
import { tidb } from './db/tidb.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Milk Business CRM Backend (Phase 7 - Deployment Ready)',
    version: '1.7.0',
    phase: 'Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7: Owner Auth, Customer CRUD, Deliveries, Sales Calculation, Daily Payments, Advance Ledger, Customer History, Testing & Deployment-Readiness Active',
    architecture: 'Customer has NO LOGIN • Owner is the primary system user',
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

// Mount Public & Protected Auth Routes (/api/auth/login, /api/auth/me, /api/auth/logout)
app.use('/api/auth', authRouter);

// Mount Phase 2 Customer Routes (/api/customers)
app.use('/api/customers', customerRouter);

// Mount Phase 3 Delivery Routes (/api/deliveries)
app.use('/api/deliveries', deliveryRouter);

// Mount Phase 4 Sales Routes (/api/sales)
app.use('/api/sales', salesRouter);

// Mount Phase 5 Payment Routes (/api/payments)
app.use('/api/payments', paymentRouter);

// Global 404 handler for undefined endpoints
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found or not part of Milk CRM scope',
  });
});



// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error occurred',
  });
});

// Start Server and Initialize TiDB Connection
async function startServer() {
  console.log('--- Initializing Milk Business CRM Backend (Phase 1) ---');
  await tidb.initDatabase();

  app.listen(PORT, () => {
    console.log(`[MilkHub Server] Running on http://localhost:${PORT}`);
    console.log(`[Auth API] POST http://localhost:${PORT}/api/auth/login`);
    console.log(`[Health API] GET http://localhost:${PORT}/api/health`);
    console.log(`[DB Status] GET http://localhost:${PORT}/api/db/status`);
    console.log(`[Blueprint] Customer has NO LOGIN • Owner is the primary system user`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export { app };
