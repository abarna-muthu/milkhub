import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const reportRouter = Router();

// 1. Daily Milk Report
reportRouter.get('/daily', (req: AuthenticatedRequest, res: Response) => {
  const { date, center_id, session } = req.query;
  const targetDate = (date as string) || new Date().toISOString().split('T')[0];

  const collections = store.getCollections({
    date: targetDate,
    center_id: center_id as string,
    session: session as string,
  });

  const enriched = collections.map((col) => {
    const isDirect = col.supplier_type === 'DIRECT';
    const cust = col.customer_id ? store.getCustomerById(col.customer_id) : undefined;
    const center = store.getCenterById(col.collection_center_id);
    return {
      ...col,
      supplier_type: col.supplier_type || 'REGISTERED',
      customer_name: isDirect ? (col.walk_in_name || 'Direct Supplier') : (cust?.name || 'Customer'),
      customer_code: isDirect ? 'DIRECT' : (cust?.customer_code || '---'),
      village: isDirect ? 'Direct / Walk-in' : (cust?.village || ''),
      center_name: center?.name || 'Main Center',
      payment_status: col.payment_status || (isDirect ? 'PAID' : 'PENDING'),
    };
  });

  const totalLitres = Number(collections.reduce((sum, c) => sum + c.quantity, 0).toFixed(1));
  const totalAmount = Number(collections.reduce((sum, c) => sum + c.total_amount, 0).toFixed(2));
  const avgFat = collections.length > 0 ? Number((collections.reduce((s, c) => s + c.fat_percentage, 0) / collections.length).toFixed(2)) : 0;
  const avgSnf = collections.length > 0 ? Number((collections.reduce((s, c) => s + c.snf_percentage, 0) / collections.length).toFixed(2)) : 0;

  res.json({
    report_type: 'Daily Milk Report',
    date: targetDate,
    total_litres: totalLitres,
    total_amount: totalAmount,
    average_fat: avgFat,
    average_snf: avgSnf,
    collection_count: collections.length,
    rows: enriched,
  });
});

// 2. Customer-wise Report
reportRouter.get('/customer-wise', (req: AuthenticatedRequest, res: Response) => {
  const { from_date, to_date, center_id } = req.query;
  const fDate = (from_date as string) || new Date().toISOString().slice(0, 7) + '-01';
  const tDate = (to_date as string) || new Date().toISOString().split('T')[0];

  const customers = store.getCustomers({ center_id: center_id as string });
  const allCollections = store.getCollections({
    from_date: fDate,
    to_date: tDate,
    center_id: center_id as string,
  });
  const allPayments = store.getPayments({
    from_date: fDate,
    to_date: tDate,
    center_id: center_id as string,
  });

  const rows = customers.map((c) => {
    const custCols = allCollections.filter((col) => col.customer_id === c.id);
    const custPays = allPayments.filter((p) => p.customer_id === c.id);

    const morningL = Number(custCols.filter((col) => col.session === 'morning').reduce((s, col) => s + col.quantity, 0).toFixed(1));
    const eveningL = Number(custCols.filter((col) => col.session === 'evening').reduce((s, col) => s + col.quantity, 0).toFixed(1));
    const totalMilk = Number((morningL + eveningL).toFixed(1));
    const totalEarnings = Number(custCols.reduce((s, col) => s + col.total_amount, 0).toFixed(2));
    const totalPaid = Number(custPays.reduce((s, p) => s + p.amount, 0).toFixed(2));
    const balance = Number((totalEarnings - totalPaid).toFixed(2));

    return {
      customer_id: c.id,
      customer_code: c.customer_code,
      name: c.name,
      mobile: c.mobile,
      village: c.village,
      morning_litres: morningL,
      evening_litres: eveningL,
      total_litres: totalMilk,
      total_earnings: totalEarnings,
      total_paid: totalPaid,
      balance: balance,
      entries_count: custCols.length,
    };
  });

  res.json({
    report_type: 'Customer-wise Report',
    from_date: fDate,
    to_date: tDate,
    rows: rows.filter((r) => r.total_litres > 0 || r.total_paid > 0),
  });
});

// 3. Monthly Milk Report
reportRouter.get('/monthly', (req: AuthenticatedRequest, res: Response) => {
  const { month_year, center_id } = req.query;
  const mYear = (month_year as string) || new Date().toISOString().slice(0, 7);

  const collections = store.getCollections({
    center_id: center_id as string,
    from_date: `${mYear}-01`,
    to_date: `${mYear}-31`,
  });

  // Group by day of month
  const dailyBreakdown: Record<string, { morning: number; evening: number; total: number; amount: number }> = {};

  collections.forEach((c) => {
    if (!dailyBreakdown[c.date]) {
      dailyBreakdown[c.date] = { morning: 0, evening: 0, total: 0, amount: 0 };
    }
    if (c.session === 'morning') dailyBreakdown[c.date].morning += c.quantity;
    if (c.session === 'evening') dailyBreakdown[c.date].evening += c.quantity;
    dailyBreakdown[c.date].total += c.quantity;
    dailyBreakdown[c.date].amount += c.total_amount;
  });

  const rows = Object.entries(dailyBreakdown)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, val]) => ({
      date,
      morning_litres: Number(val.morning.toFixed(1)),
      evening_litres: Number(val.evening.toFixed(1)),
      total_litres: Number(val.total.toFixed(1)),
      total_amount: Number(val.amount.toFixed(2)),
      avg_rate: val.total > 0 ? Number((val.amount / val.total).toFixed(2)) : 0,
    }));

  const totalLitres = Number(collections.reduce((s, c) => s + c.quantity, 0).toFixed(1));
  const totalAmount = Number(collections.reduce((s, c) => s + c.total_amount, 0).toFixed(2));

  res.json({
    report_type: 'Monthly Milk Report',
    month_year: mYear,
    total_litres: totalLitres,
    total_amount: totalAmount,
    rows,
  });
});

// 4. Payment Pending Report
reportRouter.get('/pending', (req: AuthenticatedRequest, res: Response) => {
  const { center_id } = req.query;
  const customers = store.getCustomers({ center_id: center_id as string });

  const rows = customers
    .map((c) => {
      const collections = store.getCollections({ customer_id: c.id });
      const payments = store.getPayments({ customer_id: c.id });

      const totalMilk = Number(collections.reduce((s, col) => s + col.quantity, 0).toFixed(1));
      const totalPayable = Number(collections.reduce((s, col) => s + col.total_amount, 0).toFixed(2));
      const totalPaid = Number(payments.reduce((s, p) => s + p.amount, 0).toFixed(2));
      const pendingAmount = Number((totalPayable - totalPaid).toFixed(2));

      return {
        customer_id: c.id,
        customer_code: c.customer_code,
        name: c.name,
        mobile: c.mobile,
        village: c.village,
        total_milk: totalMilk,
        total_payable: totalPayable,
        total_paid: totalPaid,
        pending_amount: pendingAmount,
        last_collection_date: collections.length > 0 ? collections[0].date : '---',
      };
    })
    .filter((r) => r.pending_amount > 0)
    .sort((a, b) => b.pending_amount - a.pending_amount);

  const totalPendingSum = Number(rows.reduce((s, r) => s + r.pending_amount, 0).toFixed(2));

  res.json({
    report_type: 'Payment Pending Report',
    total_pending: totalPendingSum,
    count: rows.length,
    rows,
  });
});

// 5. Collection Summary
reportRouter.get('/collection-summary', (req: AuthenticatedRequest, res: Response) => {
  const { from_date, to_date, center_id } = req.query;
  const fDate = (from_date as string) || new Date().toISOString().slice(0, 7) + '-01';
  const tDate = (to_date as string) || new Date().toISOString().split('T')[0];

  const collections = store.getCollections({
    from_date: fDate,
    to_date: tDate,
    center_id: center_id as string,
  });

  const cowCols = collections.filter((c) => c.animal_type === 'cow');
  const buffCols = collections.filter((c) => c.animal_type === 'buffalo');

  const cowLitres = Number(cowCols.reduce((s, c) => s + c.quantity, 0).toFixed(1));
  const buffLitres = Number(buffCols.reduce((s, c) => s + c.quantity, 0).toFixed(1));
  const totalLitres = Number((cowLitres + buffLitres).toFixed(1));

  const cowAmount = Number(cowCols.reduce((s, c) => s + c.total_amount, 0).toFixed(2));
  const buffAmount = Number(buffCols.reduce((s, c) => s + c.total_amount, 0).toFixed(2));
  const totalAmount = Number((cowAmount + buffAmount).toFixed(2));

  res.json({
    report_type: 'Collection Summary',
    from_date: fDate,
    to_date: tDate,
    summary: {
      total_litres: totalLitres,
      total_amount: totalAmount,
      cow_litres: cowLitres,
      cow_amount: cowAmount,
      buffalo_litres: buffLitres,
      buffalo_amount: buffAmount,
    },
    centers: store.getCenters().map((ctr) => {
      const ctrCols = collections.filter((c) => c.collection_center_id === ctr.id);
      return {
        center_id: ctr.id,
        center_name: ctr.name,
        code: ctr.code,
        litres: Number(ctrCols.reduce((s, c) => s + c.quantity, 0).toFixed(1)),
        amount: Number(ctrCols.reduce((s, c) => s + c.total_amount, 0).toFixed(2)),
      };
    }),
  });
});

// 6. Profit & Operational Expense Report
reportRouter.get('/profit-loss', (req: AuthenticatedRequest, res: Response) => {
  const { from_date, to_date, center_id } = req.query;
  const fDate = (from_date as string) || new Date().toISOString().slice(0, 7) + '-01';
  const tDate = (to_date as string) || new Date().toISOString().split('T')[0];

  const collections = store.getCollections({
    from_date: fDate,
    to_date: tDate,
    center_id: center_id as string,
  });
  const expenses = store.getExpenses({
    from_date: fDate,
    to_date: tDate,
    center_id: center_id as string,
  });

  const milkCost = Number(collections.reduce((s, c) => s + c.total_amount, 0).toFixed(2));
  const totalExpenses = Number(expenses.reduce((s, e) => s + e.amount, 0).toFixed(2));
  const totalMilkLitres = Number(collections.reduce((s, c) => s + c.quantity, 0).toFixed(1));

  // Dairy selling revenue to apex dairy federation (e.g. Aavin/Heritage wholesale at avg ₹47.50/L)
  const estimatedWholesaleRate = 47.5;
  const wholesaleRevenue = Number((totalMilkLitres * estimatedWholesaleRate).toFixed(2));
  const grossProfit = Number((wholesaleRevenue - milkCost).toFixed(2));
  const netOperatingProfit = Number((grossProfit - totalExpenses).toFixed(2));

  res.json({
    report_type: 'Profit & Expense Report',
    from_date: fDate,
    to_date: tDate,
    total_milk_litres: totalMilkLitres,
    wholesale_revenue: wholesaleRevenue,
    farmer_milk_payout_cost: milkCost,
    gross_margin: grossProfit,
    operating_expenses: totalExpenses,
    net_operating_profit: netOperatingProfit,
    expense_breakdown: expenses,
  });
});

// 7. Center-wise Collection Report
reportRouter.get('/center-wise', (req: AuthenticatedRequest, res: Response) => {
  const { date, to_date, center_id } = req.query;
  const targetDate = (date as string) || (to_date as string) || new Date().toISOString().split('T')[0];

  const centers = store.getCenters().filter((c) => !center_id || center_id === 'all' || c.id === center_id);

  const rows = centers.map((ctr) => {
    const stats = store.getCenterBusinessStats(ctr.id, targetDate);
    return {
      center_id: ctr.id,
      center_name: ctr.name,
      code: ctr.code,
      location: ctr.location,
      morning_milk: stats.today_morning_milk,
      evening_milk: stats.today_evening_milk,
      total_milk: stats.today_total_milk,
      amount: stats.today_amount,
      registered_suppliers: stats.registered_suppliers_count,
      direct_collections: stats.direct_suppliers_today,
      pending_payments: stats.pending_payments,
    };
  });

  const totalLitres = Number(rows.reduce((s, r) => s + r.total_milk, 0).toFixed(1));
  const totalAmount = Number(rows.reduce((s, r) => s + r.amount, 0).toFixed(2));

  res.json({
    report_type: 'Center-wise Collection Report',
    date: targetDate,
    total_litres: totalLitres,
    total_amount: totalAmount,
    rows,
  });
});

// 8. Direct Collection Report
reportRouter.get('/direct-collection', (req: AuthenticatedRequest, res: Response) => {
  const { from_date, to_date, center_id } = req.query;
  const fDate = (from_date as string) || new Date().toISOString().slice(0, 7) + '-01';
  const tDate = (to_date as string) || new Date().toISOString().split('T')[0];

  const collections = store.getCollections({
    supplier_type: 'DIRECT',
    center_id: center_id as string,
    from_date: fDate,
    to_date: tDate,
  });

  const rows = collections.map((col) => {
    const center = store.getCenterById(col.collection_center_id);
    return {
      id: col.id,
      date: col.date,
      center_name: center?.name || 'Center',
      supplier_name: col.walk_in_name || 'Direct Supplier',
      mobile: col.walk_in_mobile || '---',
      session: col.session,
      litres: col.quantity,
      fat: col.fat_percentage,
      snf: col.snf_percentage,
      rate: col.calculated_rate,
      amount: col.total_amount,
      payment_status: col.payment_status || 'PAID',
    };
  });

  const totalLitres = Number(rows.reduce((s, r) => s + r.litres, 0).toFixed(1));
  const totalAmount = Number(rows.reduce((s, r) => s + r.amount, 0).toFixed(2));

  res.json({
    report_type: 'Direct Collection Report',
    from_date: fDate,
    to_date: tDate,
    total_litres: totalLitres,
    total_amount: totalAmount,
    count: rows.length,
    rows,
  });
});

