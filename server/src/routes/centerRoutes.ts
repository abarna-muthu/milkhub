import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { CollectionCenter } from '../types/index.js';

export const centerRouter = Router();

// List collection centers with live business statistics (single source of truth)
centerRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const centers = store.getCenters();
  const today = (req.query.date as string) || new Date().toISOString().split('T')[0];

  const enriched = centers.map((c) => {
    const stats = store.getCenterBusinessStats(c.id, today);

    return {
      ...c,
      today_morning_milk: stats.today_morning_milk,
      today_evening_milk: stats.today_evening_milk,
      today_total_milk: stats.today_total_milk,
      supplier_count: stats.registered_suppliers_count,
      today_amount: stats.today_amount,
      monthly_total_milk: stats.monthly_total_milk,
      monthly_amount: stats.monthly_amount,
      pending_amount: stats.pending_payments,
      direct_suppliers_today: stats.direct_suppliers_today,
      // Backward compatibility aliases
      today_milk: stats.today_total_milk,
      total_collections_amount: stats.monthly_amount,
    };
  });

  res.json(enriched);
});

// Add Center (Admin only)
centerRouter.post('/', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { name, location, code, phone } = req.body;

  if (!name || !location || !code) {
    return res.status(400).json({ error: 'Center Name, Location, and Code are required' });
  }

  const newCenter: CollectionCenter = {
    id: `c_${Date.now()}`,
    name: name.trim(),
    location: location.trim(),
    code: code.trim().toUpperCase(),
    phone: phone?.trim() || '',
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const saved = store.addCenter(newCenter);
  res.status(201).json(saved);
});

// Update Center (Admin only)
centerRouter.put('/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const updated = store.updateCenter(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Center not found' });
  }
  res.json(updated);
});
