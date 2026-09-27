import { Router, Request, Response } from 'express';
import { tidb } from '../db/tidb.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import {
  isValidEmail,
  verifyPassword,
  generateAuthToken,
} from '../utils/security.js';

export const authRouter = Router();

/**
 * POST /api/auth/login
 * Strictly implements Phase 1 Owner Authentication:
 * - Queries TiDB `users` table (id, email, password_hash, status)
 * - Verifies credentials
 * - Generates secure Bearer JWT token
 * - Customer has NO login; Owner is the primary system user
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Validate Email Input
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // 2. Validate Password Input
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    // 3. Find User in TiDB Users Table
    const user = await tidb.findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 4. Verify Password Hash using scrypt/crypto
    const isMatch = verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 5. Verify User Status
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Owner account is inactive. Please contact support.' });
    }

    // 6. Generate cryptographically signed JWT Token
    const token = generateAuthToken({
      id: user.id,
      email: user.email,
      role: 'owner',
    });

    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: 'owner',
        status: user.status,
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
 * GET /api/auth/me
 * Return currently authenticated owner profile
 */
authRouter.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  const user = await tidb.findUserById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'Owner user record not found' });
  }

  return res.json({
    id: user.id,
    email: user.email,
    role: 'owner',
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  });
});

/**
 * POST /api/auth/logout
 * Acknowledge owner logout
 */
authRouter.post('/logout', (req: Request, res: Response) => {
  return res.json({ success: true, message: 'Owner logged out successfully' });
});
