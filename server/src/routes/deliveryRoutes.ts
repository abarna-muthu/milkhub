import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { SaveDeliveryDTO } from '../types/index.js';

const router = Router();

// Protect all delivery routes with Owner auth middleware
router.use(authMiddleware);

/**
 * Validate a single delivery payload
 */
function validateDeliveryItem(
  item: any
): { valid: boolean; error?: string; field?: string } {
  if (!item || typeof item !== 'object') {
    return { valid: false, error: 'Delivery item must be a valid JSON object' };
  }

  if (!item.customer_id || typeof item.customer_id !== 'string') {
    return { valid: false, error: 'customer_id is required', field: 'customer_id' };
  }

  if (!item.date || isNaN(Date.parse(item.date))) {
    return { valid: false, error: 'Valid date (YYYY-MM-DD) is required', field: 'date' };
  }

  if (!item.session || typeof item.session !== 'string') {
    return { valid: false, error: "session is required ('morning' or 'evening')", field: 'session' };
  }

  const normSession = item.session.toLowerCase();
  if (!normSession.includes('morn') && !normSession.includes('eve')) {
    return { valid: false, error: "session must be 'morning' or 'evening'", field: 'session' };
  }

  if (item.actual_qty !== undefined) {
    const qty = Number(item.actual_qty);
    if (isNaN(qty) || qty < 0) {
      return { valid: false, error: 'actual_qty must be a non-negative number (0 or greater)', field: 'actual_qty' };
    }
  }

  if (item.status !== undefined && typeof item.status === 'string') {
    const normStatus = item.status.toLowerCase();
    if (!normStatus.includes('deliv') && !normStatus.includes('no')) {
      return { valid: false, error: "status must be 'delivered' or 'no_milk'", field: 'status' };
    }
  }

  return { valid: true };
}

/**
 * GET /api/deliveries
 * Query params: ?date=YYYY-MM-DD&session=morning|evening
 * Loads active customers, pre-fills default quantity, merges saved delivery records
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const date = (req.query.date as string) || today;
    const rawSession = (req.query.session as string) || 'morning';

    const result = await tidb.getDeliveriesForSession(date, rawSession);

    res.json(result);
  } catch (err: any) {
    console.error('Error fetching deliveries:', err);
    res.status(500).json({ error: 'Failed to retrieve deliveries' });
  }
});

/**
 * POST /api/deliveries
 * Save a single delivery record or multiple delivery records
 * CRITICAL BUSINESS RULE:
 * Customer default quantity is NEVER changed when today's actual quantity is edited.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Check if bulk delivery array
    if (Array.isArray(req.body.deliveries)) {
      const deliveriesToSave: SaveDeliveryDTO[] = [];
      for (let i = 0; i < req.body.deliveries.length; i++) {
        const item = req.body.deliveries[i];
        const val = validateDeliveryItem(item);
        if (!val.valid) {
          return res.status(400).json({
            error: `Item ${i}: ${val.error}`,
            field: val.field,
          });
        }
        deliveriesToSave.push({
          customer_id: item.customer_id,
          date: String(item.date).split('T')[0],
          session: item.session,
          actual_qty: Number(item.actual_qty) >= 0 ? Number(item.actual_qty) : 0,
          status: item.status || 'delivered',
        });
      }

      const saved = await tidb.saveDeliveriesBulk(deliveriesToSave);
      return res.status(201).json({
        message: 'Deliveries saved successfully',
        count: saved.length,
        deliveries: saved,
      });
    }

    // Single delivery save
    const val = validateDeliveryItem(req.body);
    if (!val.valid) {
      return res.status(400).json({
        error: val.error,
        field: val.field,
      });
    }

    // Verify customer exists
    const customer = await tidb.getCustomerById(req.body.customer_id);
    if (!customer) {
      return res.status(404).json({ error: `Customer '${req.body.customer_id}' not found` });
    }

    const payload: SaveDeliveryDTO = {
      customer_id: req.body.customer_id,
      date: String(req.body.date).split('T')[0],
      session: req.body.session,
      actual_qty: Number(req.body.actual_qty) >= 0 ? Number(req.body.actual_qty) : 0,
      status: req.body.status || 'delivered',
    };

    const saved = await tidb.saveDelivery(payload);

    res.status(201).json({
      message: 'Delivery recorded successfully',
      delivery: saved,
      ...saved,
    });
  } catch (err: any) {
    console.error('Error saving delivery:', err);
    res.status(500).json({ error: 'Failed to save delivery' });
  }
});

/**
 * POST /api/deliveries/bulk
 * Explicit bulk saving endpoint
 */
router.post('/bulk', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = Array.isArray(req.body.deliveries) ? req.body.deliveries : req.body;
    if (!Array.isArray(list)) {
      return res.status(400).json({ error: 'Payload must include deliveries array' });
    }

    const deliveriesToSave: SaveDeliveryDTO[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const val = validateDeliveryItem(item);
      if (!val.valid) {
        return res.status(400).json({
          error: `Item ${i}: ${val.error}`,
          field: val.field,
        });
      }
      deliveriesToSave.push({
        customer_id: item.customer_id,
        date: String(item.date).split('T')[0],
        session: item.session,
        actual_qty: Number(item.actual_qty) >= 0 ? Number(item.actual_qty) : 0,
        status: item.status || 'delivered',
      });
    }

    const saved = await tidb.saveDeliveriesBulk(deliveriesToSave);
    res.status(200).json({
      message: 'Deliveries saved successfully',
      count: saved.length,
      deliveries: saved,
    });
  } catch (err: any) {
    console.error('Error bulk saving deliveries:', err);
    res.status(500).json({ error: 'Failed to bulk save deliveries' });
  }
});

export const deliveryRouter = router;
