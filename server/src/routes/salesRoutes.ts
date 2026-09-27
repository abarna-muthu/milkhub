import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Protect all sales routes with Owner auth middleware
router.use(authMiddleware);

/**
 * GET /api/sales
 * Automatic Sales Calculation & Day-wise Sales Display
 * Business calculation handled strictly by Node.js backend:
 *   Morning Actual Qty + Evening Actual Qty = Total Litres
 *   Total Litres * Milk Rate/Litre = Daily Sale
 *   Due = Sale - (Advance Used + Paid)
 * Day-wise columns: Date, Customer, Morning, Evening, Total, Rate, Sale, Advance Used, Paid, Due
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const date = (req.query.date as string) || today;
    const customerId = req.query.customer_id as string | undefined;

    const result = await tidb.getDayWiseSales(date, customerId);

    res.json(result);
  } catch (err: any) {
    console.error('Error calculating day-wise sales:', err);
    res.status(500).json({ error: 'Failed to calculate day-wise sales' });
  }
});

export const salesRouter = router;
