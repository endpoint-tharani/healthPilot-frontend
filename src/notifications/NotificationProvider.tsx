import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/components/Toast';
import { connectSocket, disconnectSocket, SOCKET_EVENT } from '@/realtime/socket';
import type { AppNotification, NotificationEvent, NotificationPage } from '@/types/api';
import { NotificationContext, notificationKeys, type NotificationsApi } from './NotificationContext';
import { shouldToast } from './notificationDisplay';

/** How many notifications the bell panel holds. History has its own paging. */
const RECENT_LIMIT = 20;

/**
 * Owns the signed-in user's notification state.
 *
 * React Query holds the data and the database is what it reads from; the socket
 * only tells it when to change. That ordering is what makes an offline user, a
 * dropped connection and a second browser tab all behave: the socket may be
 * missed, the query cannot be, and a reconnect re-reads rather than replays.
 *
 * There is no polling interval here. The one refetch that is not socket-driven
 * happens on reconnect, which is exactly the window a socket cannot cover.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  const enabled = Boolean(user);

  const recentQuery = useQuery({
    queryKey: notificationKeys.recent,
    queryFn: () => notificationApi.list({ limit: RECENT_LIMIT, page: 1 }),
    enabled,
    staleTime: 30_000,
  });

  const unreadQuery = useQuery({
    queryKey: notificationKeys.unreadCount,
    queryFn: () => notificationApi.unreadCount(),
    enabled,
    staleTime: 30_000,
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  }, [queryClient]);

  /**
   * Realtime wiring. The socket is opened once per session and torn down on
   * logout, so a signed-out tab holds no connection and the next user's session
   * authenticates from scratch.
   */
  useEffect(() => {
    if (!user) {
      disconnectSocket();
      setIsConnected(false);
      return;
    }

    const socket = connectSocket();
    if (!socket) {
      return;
    }

    const onConnect = () => {
      setIsConnected(true);
      // Anything that happened while this tab was away is in the database, so
      // the cache is re-read rather than the missed events being replayed.
      void invalidate();
    };
    const onDisconnect = () => setIsConnected(false);

    const onNew = (event: NotificationEvent) => {
      // The event is the trigger; the list relations come from the refetch, so
      // the panel never renders a half-populated row.
      void invalidate();
      if (shouldToast(event.type)) {
        toast.info(`${event.title}: ${event.message}`);
      }
    };

    // Another tab of this same user marked something read.
    const onRead = () => void invalidate();

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(SOCKET_EVENT.NEW, onNew);
    socket.on(SOCKET_EVENT.READ, onRead);
    socket.on(SOCKET_EVENT.READ_ALL, onRead);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(SOCKET_EVENT.NEW, onNew);
      socket.off(SOCKET_EVENT.READ, onRead);
      socket.off(SOCKET_EVENT.READ_ALL, onRead);
    };
  }, [user, invalidate, toast]);

  // A signed-out session must not leave a socket behind when the tab closes.
  useEffect(() => () => disconnectSocket(), []);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    /**
     * The row is flipped in place first so the panel responds immediately, then
     * the server answer is taken as final. A failure rolls the cache back rather
     * than leaving the badge disagreeing with the database.
     */
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const previous = queryClient.getQueriesData({ queryKey: notificationKeys.all });

      queryClient.setQueriesData<NotificationPage>(
        { queryKey: ['notifications', 'list'] },
        (page) =>
          page
            ? {
                ...page,
                data: page.data.map((row) =>
                  row.id === id && !row.isRead
                    ? { ...row, isRead: true, readAt: new Date().toISOString() }
                    : row
                ),
                meta: { ...page.meta, unread: Math.max(0, page.meta.unread - 1) },
              }
            : page
      );
      queryClient.setQueryData<{ unread: number }>(notificationKeys.unreadCount, (current) =>
        current ? { unread: Math.max(0, current.unread - 1) } : current
      );

      return { previous };
    },
    onError: (_error, _id, context) => {
      for (const [key, value] of context?.previous ?? []) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: () => void invalidate(),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSettled: () => void invalidate(),
  });

  const markAsRead = useCallback(
    async (id: string) => {
      // A row already known to be read costs no request. A row this cache has
      // not loaded - an older page of the history - is sent through, and the
      // server decides whether it is the caller's to mark at all.
      const known = (recentQuery.data?.data ?? []).find((row) => row.id === id);
      if (known?.isRead) {
        return;
      }
      await markReadMutation.mutateAsync(id);
    },
    [markReadMutation, recentQuery.data]
  );

  const markAllAsRead = useCallback(async () => {
    await markAllMutation.mutateAsync();
  }, [markAllMutation]);

  const value = useMemo<NotificationsApi>(
    () => ({
      notifications: (recentQuery.data?.data ?? []) as AppNotification[],
      unreadCount: unreadQuery.data?.unread ?? recentQuery.data?.meta.unread ?? 0,
      isLoading: recentQuery.isLoading,
      isConnected,
      markAsRead,
      markAllAsRead,
      refreshNotifications: invalidate,
    }),
    [
      recentQuery.data,
      recentQuery.isLoading,
      unreadQuery.data,
      isConnected,
      markAsRead,
      markAllAsRead,
      invalidate,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}
