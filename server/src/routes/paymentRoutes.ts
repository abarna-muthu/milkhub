import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { CreatePaymentDTO, PaymentType } from '../types/index.js';

const router = Router();

// Protect all payment routes with Owner auth middleware
router.use(authMiddleware);

/**
 * Phase 5: POST /api/payments
 * Record a Daily Payment or Advance Deposit
 * Strict fields: id, customer_id, date, amount, payment_type, payment_mode
 *
 * Examples:
 * 1. Daily Payment: Sale = ₹120, Paid = ₹50 -> Due = ₹70
 * 2. Advance: Advance = ₹500, Future Sale = ₹120 -> Advance Used = ₹120, Remaining = ₹380, Due = ₹0
 * 3. Partial Advance: Advance = ₹230, Sale = ₹300 -> Advance Used = ₹230, Remaining amount = ₹70
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, date, amount, payment_type, payment_mode } = req.body;

    // Validation
    if (!customer_id || typeof customer_id !== 'string') {
      return res.status(400).json({ error: 'Customer ID is required', field: 'customer_id' });
    }

    if (!date || isNaN(Date.parse(date))) {
      return res.status(400).json({ error: 'Valid date (YYYY-MM-DD) is required', field: 'date' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        error: 'Payment amount must be a positive number greater than 0',
        field: 'amount',
      });
    }

    if (payment_type !== 'daily' && payment_type !== 'advance') {
      return res.status(400).json({
        error: "payment_type must be either 'daily' or 'advance'",
        field: 'payment_type',
      });
    }

    const cleanDate = String(date).split('T')[0];
    const payload: CreatePaymentDTO = {
      customer_id,
      date: cleanDate,
      amount: numAmount,
      payment_type: payment_type as PaymentType,
      payment_mode: payment_mode || 'cash',
    };

    const result = await tidb.recordPayment(payload);

    res.status(201).json({
      message:
        payload.payment_type === 'advance'
          ? 'Advance payment credited successfully'
          : 'Daily payment recorded successfully',
      payment: result.payment,
      advance_balance: result.advance_balance,
      ...result.payment,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('not exist')) {
      return res.status(404).json({ error: err.message });
    }
    console.error('Error recording payment:', err);
    res.status(500).json({ error: err.message || 'Failed to record payment' });
  }
});

/**
 * GET /api/payments
 * List payments with optional filters
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const customerId = req.query.customer_id as string | undefined;
    const date = req.query.date as string | undefined;
    const paymentType = req.query.payment_type as PaymentType | undefined;

    const payments = await tidb.getPayments({
      customer_id: customerId,
      date,
      payment_type: paymentType,
    });

    const totalAmount = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    res.json({
      payments,
      total: payments.length,
      total_amount: Math.round(totalAmount * 100) / 100,
    });
  } catch (err: any) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Failed to retrieve payments' });
  }
});

export const paymentRouter = router;
