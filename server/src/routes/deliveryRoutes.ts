import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { DeliverySession, DeliveryStatus } from '../types/index.js';

export const deliveryRouter = Router();

/**
 * GET /api/deliveries/center-totals
 * Center-wise and overall totals calculated dynamically from delivery records
 */
deliveryRouter.get('/center-totals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const totals = await tidb.getCenterTotals(date);
    res.json(totals);
  } catch (err: any) {
    console.error('[Delivery Error] GET /api/deliveries/center-totals:', err);
    res.status(500).json({ error: 'Failed to calculate center totals' });
  }
});

/**
 * GET /api/deliveries
 * Loads deliveries for selected date and session (MORNING / EVENING).
 * Pre-fills default quantities for active suppliers if not yet entered.
 */
deliveryRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const sessionInput = ((req.query.session as string) || 'MORNING').toUpperCase();
    const session: DeliverySession = sessionInput === 'EVENING' ? 'EVENING' : 'MORNING';
    const center_id = (req.query.center_id as string) || undefined;
    const search = (req.query.search as string) || undefined;

    const deliveries = await tidb.getDeliveries({
      date,
      session,
      center_id,
      search,
    });

    res.json({
      date,
      session,
      deliveries,
      count: deliveries.length,
      total_litres: Number(
        deliveries
          .filter((d) => d.status === 'DELIVERED')
          .reduce((sum, d) => sum + Number(d.actual_qty || 0), 0)
          .toFixed(2)
      ),
    });
  } catch (err: any) {
    console.error('[Delivery Error] GET /api/deliveries:', err);
    res.status(500).json({ error: 'Failed to retrieve deliveries' });
  }
});

/**
 * POST /api/deliveries
 * Save single delivery record (auto updates if duplicate customer + date + session)
 */
deliveryRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id, customer_id, center_id, date, session, actual_qty, status } = req.body;

    if (!customer_id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Delivery date is required' });
    }

    // Check customer existence and status
    const customer = await tidb.getCustomerById(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    if (customer.status === 'inactive') {
      return res.status(400).json({ error: 'Cannot record delivery for an inactive customer' });
    }

    // Check center existence
    const targetCenterId = center_id || customer.center_id;
    if (targetCenterId) {
      const center = await tidb.getCenterById(targetCenterId);
      if (!center) {
        return res.status(404).json({ error: 'Collection center not found' });
      }
    }

    // Negative quantity check
    const rawQty = Number(actual_qty);
    if (!isNaN(rawQty) && rawQty < 0) {
      return res.status(400).json({ error: 'Delivery quantity cannot be negative' });
    }

    const deliverySession: DeliverySession =
      String(session).toUpperCase() === 'EVENING' ? 'EVENING' : 'MORNING';
    const deliveryStatus: DeliveryStatus =
      String(status).toUpperCase() === 'NO_MILK' ? 'NO_MILK' : 'DELIVERED';

    let qty = isNaN(rawQty) ? 0 : rawQty;
    if (deliveryStatus === 'NO_MILK') {
      qty = 0;
    }

    const saved = await tidb.saveDelivery({
      id,
      customer_id,
      center_id: targetCenterId,
      date,
      session: deliverySession,
      actual_qty: qty,
      status: deliveryStatus,
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('[Delivery Error] POST /api/deliveries:', err);
    res.status(500).json({ error: 'Failed to record delivery' });
  }
});

/**
 * POST /api/deliveries/bulk
 * Save multiple rows in one operation ("Save All")
 */
deliveryRouter.post('/bulk', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deliveriesInput = req.body.deliveries;
    if (!Array.isArray(deliveriesInput) || deliveriesInput.length === 0) {
      return res.status(400).json({ error: 'Deliveries array is required' });
    }

    const cleaned = deliveriesInput.map((item: any) => {
      const deliverySession: DeliverySession =
        String(item.session).toUpperCase() === 'EVENING' ? 'EVENING' : 'MORNING';
      const deliveryStatus: DeliveryStatus =
        String(item.status).toUpperCase() === 'NO_MILK' ? 'NO_MILK' : 'DELIVERED';

      let qty = Number(item.actual_qty);
      if (isNaN(qty) || qty < 0 || deliveryStatus === 'NO_MILK') {
        qty = 0;
      }

      return {
        id: item.id,
        customer_id: item.customer_id,
        center_id: item.center_id,
        date: item.date,
        session: deliverySession,
        actual_qty: qty,
        status: deliveryStatus,
      };
    });

    const results = await tidb.saveBulkDeliveries(cleaned);
    res.json({
      message: `Successfully saved ${results.length} delivery records`,
      saved: results,
    });
  } catch (err: any) {
    console.error('[Delivery Error] POST /api/deliveries/bulk:', err);
    res.status(500).json({ error: 'Failed to bulk-save deliveries' });
  }
});

/**
 * PATCH /api/deliveries/:id
 * Update an existing delivery record
 */
deliveryRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { actual_qty, status } = req.body;
    const deliveryStatus: DeliveryStatus =
      String(status).toUpperCase() === 'NO_MILK' ? 'NO_MILK' : 'DELIVERED';
    let qty = Number(actual_qty);
    if (isNaN(qty) || qty < 0 || deliveryStatus === 'NO_MILK') {
      qty = 0;
    }

    const existing = await tidb.getDeliveries({
      date: req.body.date || new Date().toISOString().split('T')[0],
      session: req.body.session || 'MORNING',
    });
    const found = existing.find((d) => d.id === req.params.id);

    if (!found) {
      return res.status(404).json({ error: 'Delivery record not found' });
    }

    const saved = await tidb.saveDelivery({
      id: req.params.id,
      customer_id: found.customer_id,
      center_id: found.center_id,
      date: found.date,
      session: found.session,
      actual_qty: qty,
      status: deliveryStatus,
    });

    res.json(saved);
  } catch (err: any) {
    console.error('[Delivery Error] PATCH /api/deliveries/:id:', err);
    res.status(500).json({ error: 'Failed to update delivery' });
  }
});
