import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requireRole } from '../middleware/auth.js';

export const settingRouter = Router();

// Get settings
settingRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const settings = store.getSettings();
  res.json(settings);
});

// Update settings (Admin only)
settingRouter.put('/', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const updated = store.updateSettings(req.body);
  res.json(updated);
});
