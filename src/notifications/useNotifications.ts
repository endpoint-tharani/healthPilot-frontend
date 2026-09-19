import { useContext } from 'react';
import { NotificationContext, type NotificationsApi } from './NotificationContext';

/**
 * The notification state for the signed-in user. Safe to call anywhere: outside
 * the provider it returns the inert default rather than throwing, so the login
 * screen and the render smoke test mount without a session.
 */
export function useNotifications(): NotificationsApi {
  return useContext(NotificationContext);
}
