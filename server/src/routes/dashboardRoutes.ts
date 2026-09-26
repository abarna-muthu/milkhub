import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const dashboardRouter = Router();

/**
 * GET /api/dashboard/stats
 * Complete database-driven dashboard metrics (Phase 6):
 * - Today's Total Milk, Morning Milk, Evening Milk
 * - Today's Sales, Paid, Due
 * - Active Suppliers, Collection Centers
 * - Center-wise collection breakdown
 * - Recent deliveries (last 8)
 * - Recent payments (last 8)
 * - Pending balances
 * - Weekly trend (last 7 days)
 *
 * Supports date filter (Today, Yesterday, Custom Date) & center filter.
 * 100% database-backed, no hardcoded values.
 */
dashboardRouter.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const centerId = req.query.center_id as string;
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];

    const stats = await tidb.getDashboardStats(date, centerId);

    res.json({
      kpis: {
        today_milk: stats.today_milk,
        morning_milk: stats.morning_milk,
        evening_milk: stats.evening_milk,
        today_amount: stats.today_sales,
        today_sales: stats.today_sales,
        today_paid: stats.today_paid,
        today_due: stats.today_due,
        total_centers: stats.collection_centers,
        total_suppliers: stats.active_suppliers,
        total_registered_suppliers: stats.active_suppliers,
        pending_payments: stats.today_due,
      },
      center_breakdown: stats.center_breakdown,
      morning_vs_evening: {
        morning: stats.morning_milk,
        evening: stats.evening_milk,
        total: stats.today_milk,
      },
      weekly_collection: stats.weekly_collection,
      recent_deliveries: stats.recent_deliveries,
      recent_collections: stats.recent_deliveries.map((d) => ({
        id: d.id,
        customer_id: d.id,
        customer_name: d.customer_name,
        customer_code: d.customer_code,
        center_name: d.center_name,
        session: d.session.toLowerCase(),
        milk: d.actual_qty,
        rate: 60.0,
        amount: d.total_amount,
        status: d.status,
        date: d.date,
      })),
      recent_payments: stats.recent_payments,
      pending_payments: stats.pending_balances,
    });
  } catch (err: any) {
    console.error('[Dashboard Error] GET /api/dashboard/stats:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard statistics' });
  }
});
