import { Router, Response } from 'express';
import { store } from '../db/store.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const notificationRouter = Router();

// List notifications
notificationRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const notifications = store.getNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;
  res.json({
    unread_count: unreadCount,
    notifications,
  });
});

// Mark single as read
notificationRouter.put('/:id/read', (req: AuthenticatedRequest, res: Response) => {
  const success = store.markNotificationAsRead(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Notification not found' });
  }
  res.json({ success: true });
});

// Mark all as read
notificationRouter.post('/mark-all-read', (req: AuthenticatedRequest, res: Response) => {
  store.markAllNotificationsAsRead();
  res.json({ success: true, message: 'All notifications marked as read' });
});
