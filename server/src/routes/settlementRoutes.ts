import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Settlement } from '../types/index.js';

export const settlementRouter = Router();

// List settlements
settlementRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const { customer_id, month_year } = req.query;
  const settlements = store.getSettlements({
    customer_id: customer_id as string,
    month_year: month_year as string,
  });

  const enriched = settlements.map((stl) => {
    const cust = store.getCustomerById(stl.customer_id);
    const center = store.getCenterById(stl.collection_center_id);
    return {
      ...stl,
      customer_name: cust?.name || 'Unknown',
      customer_code: cust?.customer_code || '---',
      customer_mobile: cust?.mobile || '',
      center_name: center?.name || 'Main Center',
    };
  });

  res.json(enriched);
});

// Calculate Monthly Settlement Preview
settlementRouter.post('/calculate', (req: AuthenticatedRequest, res: Response) => {
  const { customer_id, month_year, from_date, to_date } = req.body;

  if (!customer_id) {
    return res.status(400).json({ error: 'Customer is required' });
  }

  const cust = store.getCustomerById(customer_id);
  if (!cust) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  // Derive date bounds
  const mYear = month_year || new Date().toISOString().slice(0, 7); // YYYY-MM
  const fDate = from_date || `${mYear}-01`;
  const [y, m] = mYear.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const tDate = to_date || `${mYear}-${String(lastDay).padStart(2, '0')}`;

  // Filter collections in range
  const collections = store.getCollections({
    customer_id: cust.id,
    from_date: fDate,
    to_date: tDate,
  });

  // Filter payments in range
  const payments = store.getPayments({
    customer_id: cust.id,
    from_date: fDate,
    to_date: tDate,
  });

  const totalMilk = Number(collections.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const totalAmount = Number(collections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
  const previousPaid = Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
  const pendingAmount = Number(Math.max(0, totalAmount - previousPaid).toFixed(2));

  res.json({
    customer: {
      id: cust.id,
      name: cust.name,
      customer_code: cust.customer_code,
      mobile: cust.mobile,
      village: cust.village,
    },
    month_year: mYear,
    from_date: fDate,
    to_date: tDate,
    total_milk: totalMilk,
    total_amount: totalAmount,
    previous_paid: previousPaid,
    pending_amount: pendingAmount,
    settlement_amount_suggested: pendingAmount,
    collection_count: collections.length,
    payment_count: payments.length,
  });
});

// Confirm Settlement
settlementRouter.post('/confirm', (req: AuthenticatedRequest, res: Response) => {
  const { customer_id, month_year, settled_amount, from_date, to_date } = req.body;

  if (!customer_id) {
    return res.status(400).json({ error: 'Customer is required' });
  }

  const cust = store.getCustomerById(customer_id);
  if (!cust) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const mYear = month_year || new Date().toISOString().slice(0, 7);
  const fDate = from_date || `${mYear}-01`;
  const [y, m] = mYear.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const tDate = to_date || `${mYear}-${String(lastDay).padStart(2, '0')}`;

  const collections = store.getCollections({
    customer_id: cust.id,
    from_date: fDate,
    to_date: tDate,
  });

  const payments = store.getPayments({
    customer_id: cust.id,
    from_date: fDate,
    to_date: tDate,
  });

  const totalMilk = Number(collections.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const totalAmount = Number(collections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
  const previousPaid = Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
  const pendingAmount = Number(Math.max(0, totalAmount - previousPaid).toFixed(2));
  const amountToSettle = settled_amount !== undefined ? Number(settled_amount) : pendingAmount;

  const settlementCode = `SET-${mYear.replace('-', '')}-${cust.customer_code}`;

  const newSettlement: Settlement = {
    id: `stl_${Date.now()}`,
    settlement_code: settlementCode,
    customer_id: cust.id,
    collection_center_id: cust.collection_center_id || 'c1',
    month_year: mYear,
    from_date: fDate,
    to_date: tDate,
    total_milk: totalMilk,
    total_amount: totalAmount,
    previous_paid: previousPaid,
    pending_amount: pendingAmount,
    settled_amount: amountToSettle,
    status: amountToSettle >= pendingAmount ? 'settled' : 'partial',
    confirmed_at: new Date().toISOString(),
    confirmed_by: req.user?.name || 'Admin',
  };

  const saved = store.addSettlement(newSettlement);

  res.status(201).json({
    ...saved,
    customer_name: cust.name,
    customer_code: cust.customer_code,
  });
});
