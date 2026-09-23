import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { MilkRate } from '../types/index.js';
import { calculateMilkRate } from '../utils/rateCalculator.js';

export const rateRouter = Router();

// Get active rate
rateRouter.get('/active', (req: AuthenticatedRequest, res: Response) => {
  const activeRate = store.getActiveRate();
  res.json(activeRate);
});

// List all rates (history)
rateRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const rates = store.getRates();
  res.json(rates);
});

// Live calculation preview endpoint
rateRouter.post('/calculate', (req: AuthenticatedRequest, res: Response) => {
  const { quantity, fat_percentage, snf_percentage, animal_type = 'cow', rate_override } = req.body;

  const activeRate = rate_override || store.getActiveRate();
  const result = calculateMilkRate(
    Number(quantity || 1),
    Number(fat_percentage || 4.0),
    Number(snf_percentage || 8.5),
    activeRate,
    animal_type
  );

  res.json({
    quantity: Number(quantity || 1),
    fat_percentage: Number(fat_percentage || 4.0),
    snf_percentage: Number(snf_percentage || 8.5),
    calculated_rate: result.ratePerLitre,
    total_amount: result.totalAmount,
    pricing_type: activeRate.pricing_type,
    base_rate: activeRate.base_rate,
    formula:
      activeRate.pricing_type === 'fat_snf'
        ? `Base ₹${activeRate.base_rate} + (Fat - ${activeRate.standard_fat})*₹${activeRate.fat_rate} + (SNF - ${activeRate.standard_snf})*₹${activeRate.snf_rate}`
        : `Fixed Rate ₹${activeRate.base_rate} / Litre`,
  });
});

// Add Rate (Admin only)
rateRouter.post('/', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const {
    pricing_type = 'fat_snf',
    base_rate,
    standard_fat = 4.2,
    standard_snf = 8.5,
    fat_rate = 3.5,
    snf_rate = 2.0,
    effective_date,
    notes,
  } = req.body;

  if (!base_rate) {
    return res.status(400).json({ error: 'Base rate is required' });
  }

  const newRate: MilkRate = {
    id: `rate_${Date.now()}`,
    pricing_type,
    base_rate: Number(base_rate),
    standard_fat: Number(standard_fat),
    standard_snf: Number(standard_snf),
    fat_rate: Number(fat_rate),
    snf_rate: Number(snf_rate),
    effective_date: effective_date || new Date().toISOString().split('T')[0],
    updated_by: req.user?.name || 'Administrator',
    is_active: true,
    notes: notes?.trim() || '',
  };

  const saved = store.addRate(newRate);
  res.status(201).json(saved);
});

// Update Rate (Admin only)
rateRouter.put('/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const updated = store.updateRate(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Rate record not found' });
  }
  res.json(updated);
});
