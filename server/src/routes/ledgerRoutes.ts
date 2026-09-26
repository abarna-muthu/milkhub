import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const ledgerRouter = Router();

// Get customer ledger statement
ledgerRouter.get('/:customerId', (req: AuthenticatedRequest, res: Response) => {
  const cust = store.getCustomerById(req.params.customerId);
  if (!cust) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const center = store.getCenterById(cust.collection_center_id || cust.center_id || '');
  const rawLedger = store.getLedgerByCustomerId(cust.id);

  // Recalculate running balance strictly in chronological order for financial accuracy
  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  let totalMilk = 0;

  const entries = rawLedger.map((item) => {
    totalDebit += item.debit;
    totalCredit += item.credit;
    if (item.milk_quantity) {
      totalMilk += item.milk_quantity;
    }
    running += item.debit - item.credit;

    return {
      ...item,
      running_balance: Number(running.toFixed(2)),
    };
  });

  res.json({
    customer: {
      id: cust.id,
      name: cust.name,
      customer_code: cust.customer_code,
      mobile: cust.mobile,
      village: cust.village,
      center_name: center?.name || 'Main Center',
    },
    opening_balance: 0,
    closing_balance: Number(running.toFixed(2)),
    total_milk_litres: Number(totalMilk.toFixed(1)),
    total_debit: Number(totalDebit.toFixed(2)),
    total_credit: Number(totalCredit.toFixed(2)),
    entries,
  });
});
