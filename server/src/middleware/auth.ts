import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../utils/security.js';
import { store } from '../db/store.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  collection_center_id?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Strict authentication middleware.
 * Verifies HMAC-SHA256 JWT tokens from Authorization header: Bearer <token>.
 * Rejects unauthenticated requests with 401 Unauthorized.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Allow public endpoints to pass through if mounted under /api
  const publicPaths = ['/auth/login', '/auth/logout', '/health', '/db/status', '/reset-data'];
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

  // Resolve store details (for center/name if available)
  const storeUser = store.getUserByEmail(payload.email) || store.getUserById(payload.id);
  const defaultCenter = store.getCenters()[0]?.id || 'c1';

  req.user = {
    id: payload.id,
    email: payload.email,
    name: payload.name || storeUser?.name || 'Owner Administrator',
    role: payload.role || storeUser?.role || 'owner',
    collection_center_id: storeUser?.collection_center_id || defaultCenter,
  };

  next();
}

/**
 * Role-based authorization guard
 */
export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    const userRole = req.user.role || 'owner';
    // Admin / Owner has access to all roles
    if (userRole === 'owner' || userRole === 'admin') {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: `Forbidden: Only ${allowedRoles.join(', ')} can access this resource`,
      });
    }

    next();
  };
}
