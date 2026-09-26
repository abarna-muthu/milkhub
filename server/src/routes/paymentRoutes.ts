import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { PaymentType, PaymentMode } from '../types/index.js';

export const paymentRouter = Router();

/**
 * GET /api/payments/daily-summary
 * Get daily payment sheet:
 * Supplier, Date, Sale, Advance Used, Paid, Due, Payment Status
 */
paymentRouter.get('/daily-summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const center_id = (req.query.center_id as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const summaries = await tidb.getDailyPaymentSummaries({
      date,
      center_id: center_id !== 'all' ? center_id : undefined,
      search,
    });

    const totalSale = Number(summaries.reduce((sum, s) => sum + s.sale, 0).toFixed(2));
    const totalAdvanceUsed = Number(summaries.reduce((sum, s) => sum + s.advance_used, 0).toFixed(2));
    const totalPaid = Number(summaries.reduce((sum, s) => sum + s.paid, 0).toFixed(2));
    const totalDue = Number(summaries.reduce((sum, s) => sum + s.due, 0).toFixed(2));

    res.json({
      date,
      summaries,
      count: summaries.length,
      metrics: {
        total_sale: totalSale,
        total_advance_used: totalAdvanceUsed,
        total_paid: totalPaid,
        total_due: totalDue,
      },
    });
  } catch (err: any) {
    console.error('[Payment Error] GET /api/payments/daily-summary:', err);
    res.status(500).json({ error: 'Failed to retrieve daily payment summaries' });
  }
});

/**
 * GET /api/payments/advance-balance/:customer_id
 * Available advance balance for a supplier
 */
paymentRouter.get('/advance-balance/:customer_id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const balance = await tidb.getCustomerAdvanceBalance(req.params.customer_id);
    res.json(balance);
  } catch (err: any) {
    console.error('[Payment Error] GET /api/payments/advance-balance/:customer_id:', err);
    res.status(500).json({ error: 'Failed to retrieve advance balance' });
  }
});

/**
 * GET /api/payments/advance-ledger
 * Traceable advance ledger movements
 */
paymentRouter.get('/advance-ledger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, from_date, to_date } = req.query;
    const ledger = await tidb.getAdvanceLedger({
      customer_id: customer_id as string,
      from_date: from_date as string,
      to_date: to_date as string,
    });
    res.json(ledger);
  } catch (err: any) {
    console.error('[Payment Error] GET /api/payments/advance-ledger:', err);
    res.status(500).json({ error: 'Failed to retrieve advance ledger' });
  }
});

/**
 * POST /api/payments/auto-adjust
 * Automatically adjust advance against daily sale (Rule 5 & 6)
 */
paymentRouter.post('/auto-adjust', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, date, sale } = req.body;
    if (!customer_id || !date) {
      return res.status(400).json({ error: 'Customer ID and date are required' });
    }

    const result = await tidb.autoAdjustAdvanceForCustomer(
      customer_id,
      date,
      sale !== undefined ? Number(sale) : undefined
    );

    res.json(result);
  } catch (err: any) {
    console.error('[Payment Error] POST /api/payments/auto-adjust:', err);
    res.status(500).json({ error: 'Failed to auto-adjust advance' });
  }
});

/**
 * GET /api/payments
 * List payment records
 */
paymentRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { customer_id, date, from_date, to_date, payment_type, payment_mode } = req.query;

    const payments = await tidb.getPayments({
      customer_id: customer_id as string,
      date: date as string,
      from_date: from_date as string,
      to_date: to_date as string,
      payment_type: payment_type as string,
      payment_mode: payment_mode as string,
    });

    res.json(payments);
  } catch (err: any) {
    console.error('[Payment Error] GET /api/payments:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

/**
 * POST /api/payments
 * Record Payment (DAILY_PAYMENT or ADVANCE)
 */
paymentRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      customer_id,
      date,
      amount,
      payment_type,
      payment_mode,
      reference_id,
      reference_no,
      notes,
    } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }

    const customer = await tidb.getCustomerById(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    if (customer.status === 'inactive') {
      return res.status(400).json({ error: 'Cannot record payment for an inactive customer' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    const normalizedPaymentType: PaymentType =
      String(payment_type).toUpperCase() === 'ADVANCE' ? 'ADVANCE' : 'DAILY_PAYMENT';

    let normalizedPaymentMode: PaymentMode = 'CASH';
    const modeUpper = String(payment_mode || '').toUpperCase();
    if (modeUpper === 'UPI') normalizedPaymentMode = 'UPI';
    else if (modeUpper === 'BANK_TRANSFER' || modeUpper === 'BANK') normalizedPaymentMode = 'BANK_TRANSFER';

    const saved = await tidb.recordPayment({
      customer_id,
      date: date || new Date().toISOString().split('T')[0],
      amount: numAmount,
      payment_type: normalizedPaymentType,
      payment_mode: normalizedPaymentMode,
      reference_id: reference_id || reference_no || '',
      notes: notes || '',
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('[Payment Error] POST /api/payments:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

/**
 * GET /api/payments/summary
 * Backward compatibility summary endpoint
 */
paymentRouter.get('/summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const center_id = (req.query.center_id as string) || undefined;

    const summaries = await tidb.getDailyPaymentSummaries({
      date,
      center_id: center_id !== 'all' ? center_id : undefined,
    });

    const totalPayable = Number(summaries.reduce((sum, s) => sum + s.sale, 0).toFixed(2));
    const totalPaid = Number(summaries.reduce((sum, s) => sum + s.paid, 0).toFixed(2));
    const totalPending = Number(summaries.reduce((sum, s) => sum + s.due, 0).toFixed(2));

    res.json({
      total_payable: totalPayable,
      total_paid: totalPaid,
      total_pending: totalPending,
      payment_count: summaries.length,
    });
  } catch (err: any) {
    console.error('[Payment Error] GET /api/payments/summary:', err);
    res.status(500).json({ error: 'Failed to calculate payments summary' });
  }
});
