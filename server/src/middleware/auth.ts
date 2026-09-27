import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../utils/security.js';
import { tidb } from '../db/tidb.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'owner';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Strict authentication middleware for Milk Business CRM.
 * Owner is the primary system user (Customer has NO login).
 * Verifies HMAC-SHA256 JWT tokens from Authorization header: Bearer <token>.
 */
export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Allow public endpoints to pass through if accessed
  const publicPaths = ['/auth/login', '/health', '/db/status'];
  if (publicPaths.some((p) => req.path === p || req.path === `/api${p}`)) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized: Authentication token is required',
    });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : authHeader.trim();

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Authentication token is missing',
    });
  }

  // Verify token
  const payload = verifyAuthToken(token);

  if (!payload) {
    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired authentication token',
    });
  }

  // Verify user still exists in TiDB users table
  const user = await tidb.findUserById(payload.id);
  if (!user || user.status !== 'active') {
    return res.status(401).json({
      error: 'Unauthorized: Owner account is inactive or not found',
    });
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: 'owner',
  };

  next();
}
