import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Payment } from '../types/index.js';

export const paymentRouter = Router();

// List payments
paymentRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const { customer_id, center_id, from_date, to_date, payment_method } = req.query;

  const payments = store.getPayments({
    customer_id: customer_id as string,
    center_id: center_id as string,
    from_date: from_date as string,
    to_date: to_date as string,
    payment_method: payment_method as string,
  });

  const enriched = payments.map((pay) => {
    const cust = store.getCustomerById(pay.customer_id);
    const center = store.getCenterById(pay.collection_center_id);
    return {
      ...pay,
      customer_name: cust?.name || 'Unknown',
      customer_code: cust?.customer_code || '---',
      customer_mobile: cust?.mobile || '',
      village: cust?.village || '',
      center_name: center?.name || 'Main Center',
    };
  });

  res.json(enriched);
});

// Payments summary metrics
paymentRouter.get('/summary', (req: AuthenticatedRequest, res: Response) => {
  const centerId = req.query.center_id as string;

  const collections = store.getCollections({ center_id: centerId });
  const payments = store.getPayments({ center_id: centerId });

  const totalPayable = Number(collections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
  const totalPaid = Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));
  const totalPending = Number(Math.max(0, totalPayable - totalPaid).toFixed(2));

  res.json({
    total_payable: totalPayable,
    total_paid: totalPaid,
    total_pending: totalPending,
    payment_count: payments.length,
  });
});

// Record Payment
paymentRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  const {
    customer_id,
    collection_center_id,
    date,
    amount,
    payment_method = 'cash',
    reference_no,
    notes,
  } = req.body;

  if (!customer_id || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Customer and valid payment Amount are required' });
  }

  const cust = store.getCustomerById(customer_id);
  if (!cust) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const centerId = collection_center_id || cust.collection_center_id || 'c1';

  const newPayment: Payment = {
    id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    customer_id: cust.id,
    collection_center_id: centerId,
    date: date || new Date().toISOString().split('T')[0],
    amount: Number(Number(amount).toFixed(2)),
    payment_method,
    reference_no: reference_no?.trim() || '',
    status: 'completed',
    notes: notes?.trim() || '',
    created_by: req.user?.name || 'Cashier',
    created_at: new Date().toISOString(),
  };

  const saved = store.addPayment(newPayment);

  res.status(201).json({
    ...saved,
    customer_name: cust.name,
    customer_code: cust.customer_code,
  });
});
