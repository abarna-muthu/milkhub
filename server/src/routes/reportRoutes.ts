import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const reportRouter = Router();

/**
 * 1. Daily Milk Report
 * Filters: date, center_id
 */
reportRouter.get('/daily-milk', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const center_id = (req.query.center_id as string) || undefined;

    const morning = await tidb.getDeliveries({ date, session: 'MORNING', center_id });
    const evening = await tidb.getDeliveries({ date, session: 'EVENING', center_id });

    const rows = morning.map((m) => {
      const e = evening.find((item) => item.customer_id === m.customer_id);
      const mQty = m.status === 'DELIVERED' ? Number(m.actual_qty || 0) : 0;
      const eQty = e && e.status === 'DELIVERED' ? Number(e.actual_qty || 0) : 0;
      const totalQty = Number((mQty + eQty).toFixed(2));

      return {
        customer_id: m.customer_id,
        customer_name: m.customer_name,
        customer_code: m.customer_code,
        center_id: m.center_id,
        center_name: m.center_name,
        date,
        morning_milk: mQty,
        evening_milk: eQty,
        total_milk: totalQty,
        status: m.status === 'NO_MILK' && (!e || e.status === 'NO_MILK') ? 'NO_MILK' : 'DELIVERED',
      };
    });

    const totalMorning = Number(rows.reduce((sum, r) => sum + r.morning_milk, 0).toFixed(2));
    const totalEvening = Number(rows.reduce((sum, r) => sum + r.evening_milk, 0).toFixed(2));
    const totalMilk = Number((totalMorning + totalEvening).toFixed(2));

    res.json({
      report_type: 'Daily Milk Report',
      date,
      total_morning: totalMorning,
      total_evening: totalEvening,
      total_milk: totalMilk,
      count: rows.length,
      rows,
    });
  } catch (err: any) {
    console.error('[Report Error] GET /api/reports/daily-milk:', err);
    res.status(500).json({ error: 'Failed to generate Daily Milk Report' });
  }
});

// Backward compatibility alias
reportRouter.get('/daily', async (req: AuthenticatedRequest, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const center_id = (req.query.center_id as string) || undefined;
  const morning = await tidb.getDeliveries({ date, session: 'MORNING', center_id });
  const evening = await tidb.getDeliveries({ date, session: 'EVENING', center_id });

  const rows = morning.map((m) => {
    const e = evening.find((item) => item.customer_id === m.customer_id);
    const mQty = m.status === 'DELIVERED' ? Number(m.actual_qty || 0) : 0;
    const eQty = e && e.status === 'DELIVERED' ? Number(e.actual_qty || 0) : 0;
    return {
      id: m.id,
      customer_id: m.customer_id,
      customer_name: m.customer_name,
      customer_code: m.customer_code,
      center_name: m.center_name,
      session: 'both',
      quantity: mQty + eQty,
      total_amount: Number(((mQty + eQty) * Number(m.rate || 60)).toFixed(2)),
      payment_status: 'PENDING',
      date,
    };
  });

  res.json({
    report_type: 'Daily Milk Report',
    date,
    total_litres: rows.reduce((s, r) => s + r.quantity, 0),
    total_amount: rows.reduce((s, r) => s + r.total_amount, 0),
    rows,
  });
});

/**
 * 2. Center-wise Collection Report
 * Filters: date, center_id
 */
reportRouter.get('/center-wise', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const centerTotals = await tidb.getCenterTotals(date);
    const summaries = await tidb.getDailyPaymentSummaries({ date });
    const allCenters = await tidb.getCenters();

    const rows = centerTotals.centers.map((c) => {
      const centerObj = allCenters.find((item) => item.id === c.center_id);
      const centerSummaries = summaries.filter((s) => s.center_id === c.center_id);
      const sales = Number(centerSummaries.reduce((sum, s) => sum + s.sale, 0).toFixed(2));

      return {
        center_id: c.center_id,
        center_name: c.center_name,
        location: centerObj?.location || 'Tamil Nadu',
        active_suppliers: centerObj?.supplier_count || 0,
        morning_milk: c.morning_total,
        evening_milk: c.evening_total,
        total_milk: c.daily_total,
        total_sales: sales,
      };
    });

    res.json({
      report_type: 'Center-wise Collection Report',
      date,
      overall: centerTotals.overall,
      rows,
    });
  } catch (err: any) {
    console.error('[Report Error] GET /api/reports/center-wise:', err);
    res.status(500).json({ error: 'Failed to generate Center-wise Report' });
  }
});

/**
 * 3. Supplier-wise Collection Report
 * Filters: from_date, to_date, center_id, customer_id
 */
reportRouter.get('/supplier-wise', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const from_date = (req.query.from_date as string) || `${new Date().toISOString().slice(0, 7)}-01`;
    const to_date = (req.query.to_date as string) || new Date().toISOString().split('T')[0];
    const center_id = (req.query.center_id as string) || undefined;
    const customer_id = (req.query.customer_id as string) || undefined;

    const { customers } = await tidb.getCustomers({ center_id, status: 'active' });
    const targetCustomers = customer_id ? customers.filter((c) => c.id === customer_id) : customers;

    const rows = [];
    for (const cust of targetCustomers) {
      const hist = await tidb.getCustomerHistory(cust.id, { from_date, to_date });
      const deliveredDays = hist.history.filter((h) => h.total > 0).length;
      const morningTotal = Number(hist.history.reduce((sum, h) => sum + h.morning, 0).toFixed(2));
      const eveningTotal = Number(hist.history.reduce((sum, h) => sum + h.evening, 0).toFixed(2));
      const totalMilk = hist.monthly_summary.total_milk;
      const avgDaily = deliveredDays > 0 ? Number((totalMilk / deliveredDays).toFixed(2)) : 0;

      rows.push({
        customer_id: cust.id,
        customer_name: cust.name,
        customer_code: cust.customer_code,
        phone: cust.phone || cust.mobile,
        center_id: cust.center_id,
        center_name: cust.center_name || 'Center',
        delivered_days: deliveredDays,
        morning_milk: morningTotal,
        evening_milk: eveningTotal,
        total_milk: totalMilk,
        average_daily_milk: avgDaily,
        total_sales: hist.monthly_summary.total_sales,
      });
    }

    res.json({
      report_type: 'Supplier-wise Collection Report',
      from_date,
      to_date,
      count: rows.length,
      rows,
    });
  } catch (err: any) {
    console.error('[Report Error] GET /api/reports/supplier-wise:', err);
    res.status(500).json({ error: 'Failed to generate Supplier-wise Report' });
  }
});

// Backward compatibility alias for customer-wise
reportRouter.get('/customer-wise', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const from_date = (req.query.from_date as string) || `${new Date().toISOString().slice(0, 7)}-01`;
    const to_date = (req.query.to_date as string) || new Date().toISOString().split('T')[0];
    const center_id = (req.query.center_id as string) || undefined;
    const customer_id = (req.query.customer_id as string) || undefined;

    const { customers } = await tidb.getCustomers({ center_id, status: 'active' });
    const targetCustomers = customer_id ? customers.filter((c) => c.id === customer_id) : customers;

    const rows = [];
    for (const cust of targetCustomers) {
      const hist = await tidb.getCustomerHistory(cust.id, { from_date, to_date });
      rows.push({
        customer_id: cust.id,
        customer_code: cust.customer_code,
        name: cust.name,
        mobile: cust.phone || cust.mobile,
        village: cust.area || cust.village,
        morning_litres: Number(hist.history.reduce((sum, h) => sum + h.morning, 0).toFixed(1)),
        evening_litres: Number(hist.history.reduce((sum, h) => sum + h.evening, 0).toFixed(1)),
        total_litres: hist.monthly_summary.total_milk,
        total_earnings: hist.monthly_summary.total_sales,
        total_paid: hist.monthly_summary.total_paid,
        balance: hist.monthly_summary.total_due,
        entries_count: hist.history.length,
      });
    }

    res.json({
      report_type: 'Customer-wise Report',
      from_date,
      to_date,
      rows: rows.filter((r) => r.total_litres > 0 || r.total_paid > 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch customer-wise report' });
  }
});

/**
 * 4. Daily Sales Report
 * Filters: date, center_id, customer_id
 */
reportRouter.get('/daily-sales', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const center_id = (req.query.center_id as string) || undefined;
    const customer_id = (req.query.customer_id as string) || undefined;

    let summaries = await tidb.getDailyPaymentSummaries({ date, center_id });
    if (customer_id) {
      summaries = summaries.filter((s) => s.customer_id === customer_id);
    }

    const rows = summaries.map((s) => ({
      date,
      customer_id: s.customer_id,
      customer_name: s.customer_name,
      customer_code: s.customer_code,
      center_name: s.center_name,
      total_milk: s.total_qty,
      rate: s.rate,
      gross_sale: s.sale,
      advance_deducted: s.advance_used,
      net_payable: s.remaining_sale,
      paid: s.paid,
      due: s.due,
      status: s.status,
    }));

    const totalSales = Number(rows.reduce((sum, r) => sum + r.gross_sale, 0).toFixed(2));
    const totalAdvanceDeducted = Number(rows.reduce((sum, r) => sum + r.advance_deducted, 0).toFixed(2));
    const totalNetPayable = Number(rows.reduce((sum, r) => sum + r.net_payable, 0).toFixed(2));

    res.json({
      report_type: 'Daily Sales Report',
      date,
      total_sales: totalSales,
      total_advance_deducted: totalAdvanceDeducted,
      total_net_payable: totalNetPayable,
      rows,
    });
  } catch (err: any) {
    console.error('[Report Error] GET /api/reports/daily-sales:', err);
    res.status(500).json({ error: 'Failed to generate Daily Sales Report' });
  }
});

/**
 * 5. Payment Report
 * Filters: from_date, to_date, center_id, customer_id, payment_type
 */
reportRouter.get('/payments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const from_date = (req.query.from_date as string) || `${new Date().toISOString().slice(0, 7)}-01`;
    const to_date = (req.query.to_date as string) || new Date().toISOString().split('T')[0];
    const customer_id = (req.query.customer_id as string) || undefined;
    const payment_type = (req.query.payment_type as string) || undefined;

    const payments = await tidb.getPayments({
      customer_id,
      from_date,
      to_date,
      payment_type,
    });

    const totalAmount = Number(payments.reduce((sum, p) => sum + p.amount, 0).toFixed(2));

    res.json({
      report_type: 'Payment Report',
      from_date,
      to_date,
      total_amount: totalAmount,
      count: payments.length,
      rows: payments,
    });
  } catch (err: any) {
    console.error('[Report Error] GET /api/reports/payments:', err);
    res.status(500).json({ error: 'Failed to generate Payment Report' });
  }
});

/**
 * 6. Pending/Due Report
 * Filters: center_id, customer_id
 */
reportRouter.get('/pending-due', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const center_id = (req.query.center_id as string) || undefined;
    const customer_id = (req.query.customer_id as string) || undefined;

    let summaries = await tidb.getDailyPaymentSummaries({ date, center_id });
    if (customer_id) {
      summaries = summaries.filter((s) => s.customer_id === customer_id);
    }

    const pendingRows = summaries
      .filter((s) => s.due > 0)
      .map((s) => ({
        customer_id: s.customer_id,
        customer_name: s.customer_name,
        customer_code: s.customer_code,
        center_name: s.center_name,
        phone: s.phone,
        sale: s.sale,
        advance_used: s.advance_used,
        paid: s.paid,
        outstanding_due: s.due,
        status: s.status,
      }));

    const totalDue = Number(pendingRows.reduce((sum, r) => sum + r.outstanding_due, 0).toFixed(2));

    res.json({
      report_type: 'Pending / Due Report',
      date,
      total_due: totalDue,
      count: pendingRows.length,
      rows: pendingRows,
    });
  } catch (err: any) {
    console.error('[Report Error] GET /api/reports/pending-due:', err);
    res.status(500).json({ error: 'Failed to generate Pending / Due Report' });
  }
});

// Backward compatibility alias for pending
reportRouter.get('/pending', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const center_id = (req.query.center_id as string) || undefined;
    let summaries = await tidb.getDailyPaymentSummaries({ date, center_id });
    const pendingRows = summaries.filter((s) => s.due > 0).map((s) => ({
      customer_id: s.customer_id,
      customer_name: s.customer_name,
      customer_code: s.customer_code,
      village: s.center_name,
      total_milk: s.total_qty,
      total_earnings: s.sale,
      total_paid: s.paid,
      balance: s.due,
      due_date: date,
    }));
    res.json({
      report_type: 'Pending Balances Report',
      total_pending: pendingRows.reduce((s, r) => s + r.balance, 0),
      count: pendingRows.length,
      rows: pendingRows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate pending balances report' });
  }
});

/**
 * 7. Advance Balance Report
 * Filters: center_id, customer_id
 */
reportRouter.get('/advance-balance', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const center_id = (req.query.center_id as string) || undefined;
    const customer_id = (req.query.customer_id as string) || undefined;

    const { customers } = await tidb.getCustomers({ center_id, status: 'active' });
    const targetCustomers = customer_id ? customers.filter((c) => c.id === customer_id) : customers;

    const rows = [];
    for (const cust of targetCustomers) {
      const bal = await tidb.getCustomerAdvanceBalance(cust.id);
      if (bal.total_added > 0 || bal.available_balance > 0) {
        rows.push({
          customer_id: cust.id,
          customer_name: cust.name,
          customer_code: cust.customer_code,
          phone: cust.phone || cust.mobile,
          center_name: cust.center_name || 'Center',
          total_advance_added: bal.total_added,
          total_advance_used: bal.total_used,
          available_balance: bal.available_balance,
        });
      }
    }

    const totalAvailable = Number(rows.reduce((sum, r) => sum + r.available_balance, 0).toFixed(2));

    res.json({
      report_type: 'Advance Balance Report',
      total_available_advance: totalAvailable,
      count: rows.length,
      rows,
    });
  } catch (err: any) {
    console.error('[Report Error] GET /api/reports/advance-balance:', err);
    res.status(500).json({ error: 'Failed to generate Advance Balance Report' });
  }
});

/**
 * 8. Monthly Summary Report
 * Filters: month_year, center_id
 */
reportRouter.get('/monthly-summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const month_year = (req.query.month_year as string) || new Date().toISOString().slice(0, 7);
    const center_id = (req.query.center_id as string) || undefined;

    const daysInMonth = new Date(parseInt(month_year.slice(0, 4)), parseInt(month_year.slice(5, 7)), 0).getDate();
    const rows = [];

    let totalMonthMilk = 0;
    let totalMonthSales = 0;
    let totalMonthPaid = 0;
    let totalMonthDue = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${month_year}-${String(day).padStart(2, '0')}`;
      const centerTotals = await tidb.getCenterTotals(dStr);
      const summaries = await tidb.getDailyPaymentSummaries({ date: dStr, center_id });

      const dMilk = centerTotals.overall.daily_total;
      const dSales = Number(summaries.reduce((sum, s) => sum + s.sale, 0).toFixed(2));
      const dAdvance = Number(summaries.reduce((sum, s) => sum + s.advance_used, 0).toFixed(2));
      const dPaid = Number(summaries.reduce((sum, s) => sum + s.paid, 0).toFixed(2));
      const dDue = Number(summaries.reduce((sum, s) => sum + s.due, 0).toFixed(2));

      totalMonthMilk += dMilk;
      totalMonthSales += dSales;
      totalMonthPaid += dPaid;
      totalMonthDue += dDue;

      if (dMilk > 0 || dPaid > 0) {
        rows.push({
          date: dStr,
          delivered_suppliers: summaries.filter((s) => s.total_qty > 0).length,
          morning_milk: centerTotals.overall.morning_total,
          evening_milk: centerTotals.overall.evening_total,
          total_milk: dMilk,
          total_sales: dSales,
          advance_adjusted: dAdvance,
          total_paid: dPaid,
          net_due: dDue,
        });
      }
    }

    res.json({
      report_type: 'Monthly Summary Report',
      month_year,
      total_milk: Number(totalMonthMilk.toFixed(2)),
      total_sales: Number(totalMonthSales.toFixed(2)),
      total_paid: Number(totalMonthPaid.toFixed(2)),
      total_due: Number(totalMonthDue.toFixed(2)),
      active_days: rows.length,
      rows,
    });
  } catch (err: any) {
    console.error('[Report Error] GET /api/reports/monthly-summary:', err);
    res.status(500).json({ error: 'Failed to generate Monthly Summary Report' });
  }
});

// Backward compatibility alias for monthly
reportRouter.get('/monthly', async (req: AuthenticatedRequest, res: Response) => {
  const month_year = (req.query.month_year as string) || new Date().toISOString().slice(0, 7);
  const center_id = (req.query.center_id as string) || undefined;
  const centerTotals = await tidb.getCenterTotals(new Date().toISOString().split('T')[0]);
  res.json({
    report_type: 'Monthly Report',
    month_year,
    total_milk: centerTotals.overall.daily_total,
    total_amount: centerTotals.overall.daily_total * 60,
    daily_records: [],
  });
});
