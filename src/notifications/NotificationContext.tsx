import { createContext } from 'react';
import type { AppNotification, NotificationType } from '@/types/api';

export interface NotificationFilters {
  unreadOnly?: boolean;
  type?: NotificationType;
  search?: string;
  page?: number;
  limit?: number;
}

export interface NotificationsApi {
  /** The most recent notifications, newest first, for the bell panel. */
  notifications: AppNotification[];
  /** Unread across the whole inbox, not just the loaded page. */
  unreadCount: number;
  isLoading: boolean;
  /** True while the realtime channel is connected; false falls back to refetch. */
  isConnected: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NOOP: NotificationsApi = {
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isConnected: false,
  markAsRead: async () => undefined,
  markAllAsRead: async () => undefined,
  refreshNotifications: async () => undefined,
};

/**
 * Defaults to an inert implementation so anything rendered outside the provider
 * - the login screen, the render smoke test - still mounts.
 */
export const NotificationContext = createContext<NotificationsApi>(NOOP);

/** Query keys the provider owns, shared with the history page. */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters: NotificationFilters) => ['notifications', 'list', filters] as const,
  recent: ['notifications', 'list', { recent: true }] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};
