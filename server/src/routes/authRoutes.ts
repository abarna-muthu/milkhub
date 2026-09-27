import { Router, Request, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { store } from '../db/store.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import {
  isValidEmail,
  verifyPassword,
  generateAuthToken,
} from '../utils/security.js';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Owner Login with Email, Password validation, password verification against TiDB, and JWT issue.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const emailInput = req.body.email || req.body.identifier || req.body.username;
    const passwordInput = req.body.password;

    // 1. Validate Email Presence & Format
    if (!emailInput || typeof emailInput !== 'string') {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const cleanEmail = emailInput.trim();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // 2. Validate Password Presence
    if (!passwordInput || typeof passwordInput !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (passwordInput.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // 3. Find User in TiDB Users Table (or local fallback)
    let user = await tidb.findUserByEmail(cleanEmail);

    // Fallback to store if not found in TiDB
    if (!user) {
      const sUser = store.getUserByEmail(cleanEmail);
      if (sUser) {
        user = {
          id: sUser.id,
          email: sUser.email,
          password_hash: sUser.password || '',
          status: (sUser.status as any) || 'active',
          created_at: sUser.created_at,
          updated_at: sUser.created_at,
        };
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 4. Verify Password Hash using scrypt/crypto
    const isMatch = verifyPassword(passwordInput, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 5. Verify User Status
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated. Please contact support.' });
    }

    // 6. Update user timestamp
    await tidb.touchUserLogin(user.id);

    // 7. Generate cryptographically signed JWT Token
    const token = generateAuthToken({
      id: user.id,
      email: user.email,
      role: 'owner',
    });

    // Cross-reference store center if available
    const storeUser = store.getUserByEmail(user.email);
    const center = storeUser ? store.getCenterById(storeUser.collection_center_id) : store.getCenters()[0];

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: storeUser?.name || 'Owner Administrator',
        role: 'owner',
        status: user.status,
        collection_center_id: center?.id || 'c1',
        collection_center_name: center?.name || 'All Centers',
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (err: any) {
    console.error('[Auth Error] /api/auth/login:', err);
    return res.status(500).json({ error: 'Authentication service temporarily unavailable' });
  }
});

/**
 * POST /api/auth/logout
 * Client-side token invalidation / logout acknowledgment
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Owner logged out successfully' });
});

/**
 * GET /api/auth/me
 * Return currently authenticated owner information
 */
authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  const user = await tidb.findUserById(req.user.id);
  const storeUser = store.getUserByEmail(req.user.email);
  const center = storeUser ? store.getCenterById(storeUser.collection_center_id) : store.getCenters()[0];

  return res.json({
    id: req.user.id,
    email: req.user.email,
    name: storeUser?.name || 'Owner Administrator',
    role: 'owner',
    status: user?.status || 'active',
    collection_center_id: center?.id || 'c1',
    collection_center_name: center?.name || 'All Centers',
    created_at: user?.created_at,
    updated_at: user?.updated_at,
  });
});
