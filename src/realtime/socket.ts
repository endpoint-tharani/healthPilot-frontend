import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '@/api/client';
import { getAccessToken } from '@/api/tokenStorage';

/**
 * The realtime connection to the ERP backend.
 *
 * It is a delivery channel, never a source of truth: everything it carries also
 * exists in PostgreSQL, so a user who was offline, on a flaky connection, or in a
 * browser that blocked websockets loses nothing but immediacy.
 */

/** The API lives at <origin>/api; the socket is served from the same origin. */
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

export const SOCKET_EVENT = {
  NEW: 'notification:new',
  READ: 'notification:read',
  READ_ALL: 'notification:read-all',
} as const;

let socket: Socket | null = null;

/**
 * Opens the authenticated connection, reusing the existing one if it is already
 * open for this session.
 *
 * The access token is read at connect time rather than captured, so a reconnect
 * after a token refresh presents the current token. The server verifies it and
 * rebuilds the identity itself - nothing here asserts who the user is.
 */
export function connectSocket(): Socket | null {
  const token = getAccessToken();
  if (!token) {
    return null;
  }
  if (socket) {
    return socket;
  }

  socket = io(SOCKET_URL, {
    // Polling first, then upgrade: a proxy that blocks websockets still works.
    transports: ['polling', 'websocket'],
    auth: (callback) => callback({ token: getAccessToken() ?? '' }),
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket(): void {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export function getSocket(): Socket | null {
  return socket;
}
