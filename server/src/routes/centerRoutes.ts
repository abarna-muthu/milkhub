import { Router, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { store } from '../db/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const centerRouter = Router();

/**
 * GET /api/centers
 * List all collection centers with supplier counts and status
 */
centerRouter.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const centers = await tidb.getCenters();

    // Map enriched centers with dynamic metrics
    const today = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const enriched = centers.map((c) => {
      const stats = store.getCenterBusinessStats(c.id, today);
      return {
        ...c,
        today_morning_milk: stats.today_morning_milk,
        today_evening_milk: stats.today_evening_milk,
        today_total_milk: stats.today_total_milk,
        supplier_count: c.supplier_count !== undefined ? c.supplier_count : stats.registered_suppliers_count,
        today_amount: stats.today_amount,
        monthly_total_milk: stats.monthly_total_milk,
        monthly_amount: stats.monthly_amount,
        pending_amount: stats.pending_payments,
        direct_suppliers_today: stats.direct_suppliers_today,
      };
    });

    res.json(enriched);
  } catch (err: any) {
    console.error('[Center Error] GET /api/centers:', err);
    res.status(500).json({ error: 'Failed to retrieve collection centers' });
  }
});

/**
 * GET /api/centers/:id
 * Retrieve a single collection center
 */
centerRouter.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const center = await tidb.getCenterById(req.params.id);
    if (!center) {
      return res.status(404).json({ error: 'Collection center not found' });
    }
    res.json(center);
  } catch (err: any) {
    console.error('[Center Error] GET /api/centers/:id:', err);
    res.status(500).json({ error: 'Failed to retrieve collection center' });
  }
});

/**
 * POST /api/centers
 * Create a new collection center (Owner/Admin)
 */
centerRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const centerName = req.body.center_name || req.body.name;
    const location = req.body.location;
    const status = req.body.status || 'active';
    const code = req.body.code;
    const phone = req.body.phone;

    if (!centerName || !centerName.trim()) {
      return res.status(400).json({ error: 'Center Name is required' });
    }
    if (!location || !location.trim()) {
      return res.status(400).json({ error: 'Location / Area is required' });
    }

    const saved = await tidb.createCenter({
      center_name: centerName.trim(),
      location: location.trim(),
      status,
      code,
      phone,
    });

    // Mirror to store for full local sync
    store.addCenter({
      id: saved.id,
      name: saved.center_name,
      location: saved.location,
      code: saved.code || `C${Date.now().toString().slice(-3)}`,
      phone: saved.phone || '',
      is_active: saved.status === 'active',
      created_at: saved.created_at,
    });

    res.status(201).json(saved);
  } catch (err: any) {
    console.error('[Center Error] POST /api/centers:', err);
    res.status(500).json({ error: 'Failed to create collection center' });
  }
});

/**
 * PATCH /api/centers/:id
 * Edit collection center or activate/deactivate
 */
centerRouter.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await tidb.updateCenter(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Collection center not found' });
    }

    // Mirror to store
    store.updateCenter(req.params.id, {
      name: updated.center_name,
      location: updated.location,
      is_active: updated.status === 'active',
      phone: updated.phone,
    });

    res.json(updated);
  } catch (err: any) {
    console.error('[Center Error] PATCH /api/centers/:id:', err);
    res.status(500).json({ error: 'Failed to update collection center' });
  }
});

/**
 * PUT /api/centers/:id (backward compatibility alias for PATCH)
 */
centerRouter.put('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await tidb.updateCenter(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Collection center not found' });
    }
    store.updateCenter(req.params.id, {
      name: updated.center_name,
      location: updated.location,
      is_active: updated.status === 'active',
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update collection center' });
  }
});
