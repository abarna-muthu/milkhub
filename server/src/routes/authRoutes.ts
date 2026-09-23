import { Router, Request, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const authRouter = Router();

// Login
authRouter.post('/login', (req: Request, res: Response) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Mobile / Email and Password are required' });
  }

  const clean = identifier.trim();
  const cleanLower = clean.toLowerCase();
  const user =
    store.getUserByEmail(clean) ||
    store.getUserByMobile(clean) ||
    store.getUsers().find((u) => u.email.toLowerCase() === cleanLower);

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Strict password verification
  if (user.password !== password) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Update last login
  store.updateUser(user.id, { last_login: new Date().toISOString() });

  const center = store.getCenterById(user.collection_center_id);

  res.json({
    token: user.id,
    user: {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      collection_center_id: user.collection_center_id,
      collection_center_name: center?.name || 'All Centers',
      status: user.status,
    },
  });
});

// Current user
authRouter.get('/me', (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const center = store.getCenterById(req.user.collection_center_id);
  res.json({
    id: req.user.id,
    name: req.user.name,
    mobile: req.user.mobile,
    email: req.user.email,
    role: req.user.role,
    collection_center_id: req.user.collection_center_id,
    collection_center_name: center?.name || 'All Centers',
    status: req.user.status,
  });
});
