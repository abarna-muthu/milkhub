import { Request, Response, NextFunction } from 'express';
import { store } from '../db/store.js';
import { User, UserRole } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Support Authorization header or x-user-id for rapid development & testing
  const authHeader = req.headers['authorization'];
  const userIdHeader = req.headers['x-user-id'] as string;

  let user: User | undefined;

  if (userIdHeader) {
    user = store.getUserById(userIdHeader);
  } else if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    // Token can be the user id or email in demo mode
    user = store.getUserById(token) || store.getUserByEmail(token);
  }

  // If no auth header provided, fallback to admin user by default for easy API testing
  if (!user) {
    user = store.getUsers().find((u) => u.role === 'admin') || store.getUsers()[0];
  }

  req.user = user;
  next();
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Only ${allowedRoles.join(', ')} can perform this action`,
      });
    }

    next();
  };
}
