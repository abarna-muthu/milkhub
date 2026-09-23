import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { User } from '../types/index.js';

export const staffRouter = Router();

// List all staff (Admin only)
staffRouter.get('/', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const users = store.getUsers();
  const enriched = users.map((u) => {
    const center = store.getCenterById(u.collection_center_id);
    const { password, ...safeUser } = u;
    return {
      ...safeUser,
      collection_center_name: center?.name || 'All Centers',
    };
  });
  res.json(enriched);
});

// Add Staff (Admin only)
staffRouter.post('/', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const { name, mobile, email, password, role = 'staff', collection_center_id, status = 'active' } = req.body;

  if (!name || !mobile || !email) {
    return res.status(400).json({ error: 'Name, Mobile, and Email are required' });
  }

  const existingEmail = store.getUserByEmail(email);
  if (existingEmail) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  const newUser: User = {
    id: `u_${Date.now()}`,
    name: name.trim(),
    mobile: mobile.trim(),
    email: email.trim().toLowerCase(),
    password: password || 'staff123',
    role,
    collection_center_id: collection_center_id || 'c1',
    status,
    created_at: new Date().toISOString(),
  };

  const saved = store.addUser(newUser);
  const { password: _, ...safeUser } = saved;
  res.status(201).json(safeUser);
});

// Update Staff (Admin only)
staffRouter.put('/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const updated = store.updateUser(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Staff member not found' });
  }
  const { password: _, ...safeUser } = updated;
  res.json(safeUser);
});

// Delete Staff (Admin only)
staffRouter.delete('/:id', requireRole(['admin']), (req: AuthenticatedRequest, res: Response) => {
  const success = store.deleteUser(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Staff member not found' });
  }
  res.json({ message: 'Staff deleted successfully' });
});
