import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  Popover,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { useNavigate } from 'react-router-dom';
import { paletteTokens, statusTone, type ColorMode } from '@/app/theme';
import { useNotifications } from '@/notifications/useNotifications';
import {
  notificationIcon,
  notificationTarget,
  relativeTime,
  SEVERITY_TONE,
} from '@/notifications/notificationDisplay';
import type { AppNotification } from '@/types/api';

/**
 * One row of the panel. Unread rows carry a blue wash, a blue dot and a bolder
 * title; read rows sit on plain paper, so the difference is legible at a glance
 * without reading a word.
 */
function NotificationRow({
  notification,
  onSelect,
}: {
  notification: AppNotification;
  onSelect: (notification: AppNotification) => void;
}) {
  const theme = useTheme();
  const mode = theme.palette.mode as ColorMode;
  const tokens = paletteTokens(mode);
  const tone = statusTone(mode, SEVERITY_TONE[notification.severity]);
  const Icon = notificationIcon(notification.type);
  const navigable = notificationTarget(notification) !== null;

  return (
    <Box
      component="button"
      type="button"
      onClick={() => onSelect(notification)}
      sx={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        border: 0,
        borderBottom: `1px solid ${tokens.divider}`,
        px: 1.75,
        py: 1.5,
        cursor: navigable ? 'pointer' : 'default',
        font: 'inherit',
        color: 'inherit',
        bgcolor: notification.isRead ? 'background.paper' : tokens.navActive,
        '&:hover': { bgcolor: notification.isRead ? tokens.rowHover : tokens.navActive },
        '&:last-of-type': { borderBottom: 0 },
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            mt: 0.25,
            width: 28,
            height: 28,
            borderRadius: 1.5,
            display: 'grid',
            placeItems: 'center',
            bgcolor: tone.bg,
            color: tone.fg,
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 16 }} />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography
              variant="body2"
              fontWeight={notification.isRead ? 600 : 700}
              sx={{ minWidth: 0, flex: 1 }}
              noWrap
            >
              {notification.title}
            </Typography>
            {notification.isRead ? null : (
              <Box
                aria-label="Unread"
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  flexShrink: 0,
                }}
              />
            )}
          </Stack>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', whiteSpace: 'normal', mt: 0.25 }}
          >
            {notification.message}
          </Typography>

          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
            {notification.document ? (
              <Typography variant="caption" color="primary.main" fontWeight={700}>
                {notification.document.documentNumber}
              </Typography>
            ) : null}
            {notification.document ? (
              <Typography variant="caption" color="text.disabled">
                ·
              </Typography>
            ) : null}
            <Typography variant="caption" color="text.disabled">
              {relativeTime(notification.createdAt)}
            </Typography>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

/**
 * The top-bar bell: unread count, and a panel of what actually happened.
 *
 * Every row is a real notification row from PostgreSQL addressed to this user -
 * nothing here is inferred from a document count, and nothing is shown that the
 * server did not decide this user should see.
 */
export function NotificationsMenu({ buttonSx }: { buttonSx?: object }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const tokens = paletteTokens(theme.palette.mode as ColorMode);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();

  const visible = useMemo(
    () => (tab === 'unread' ? notifications.filter((row) => !row.isRead) : notifications),
    [notifications, tab]
  );

  /**
   * Read first, then navigate - and only once the row has been identified, so a
   * notification whose document has gone is never silently marked read on a
   * click that goes nowhere.
   */
  const open = async (notification: AppNotification) => {
    const target = notificationTarget(notification);
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    if (target) {
      setAnchor(null);
      navigate(target);
    }
  };

  return (
    <>
      <Tooltip
        title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'No unread notifications'}
      >
        <IconButton
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label={`Notifications: ${unreadCount} unread`}
          sx={buttonSx}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsNoneOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              width: 400,
              maxWidth: 'calc(100vw - 24px)',
              border: `1px solid ${tokens.divider}`,
              boxShadow: tokens.shadow,
              borderRadius: 2.5,
              overflow: 'hidden',
            },
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1.75, pt: 1.5, pb: 0.5 }}
        >
          <Typography variant="subtitle2">Notifications</Typography>
          <Button
            size="small"
            disabled={unreadCount === 0}
            onClick={() => void markAllAsRead()}
            sx={{ fontSize: '0.75rem' }}
          >
            Mark all as read
          </Button>
        </Stack>

        <Tabs
          value={tab}
          onChange={(_event, value) => setTab(value as 'all' | 'unread')}
          sx={{ px: 1.75, minHeight: 36, borderBottom: `1px solid ${tokens.divider}` }}
        >
          <Tab value="all" label="All" sx={{ minHeight: 36, py: 0 }} />
          <Tab
            value="unread"
            label={unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread'}
            sx={{ minHeight: 36, py: 0 }}
          />
        </Tabs>

        <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
          {isLoading ? (
            <Box sx={{ px: 1.75, py: 1.5 }}>
              <Skeleton height={22} />
              <Skeleton height={22} width="75%" />
              <Skeleton height={22} width="55%" />
            </Box>
          ) : visible.length === 0 ? (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {tab === 'unread'
                  ? 'Nothing unread. You are all caught up.'
                  : 'No notifications yet.'}
              </Typography>
            </Box>
          ) : (
            visible.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onSelect={(row) => void open(row)}
              />
            ))
          )}
        </Box>

        <Divider />
        <Button
          fullWidth
          size="small"
          onClick={() => {
            setAnchor(null);
            navigate('/notifications');
          }}
          sx={{ borderRadius: 0, py: 1.1 }}
        >
          View all notifications
        </Button>
      </Popover>
    </>
  );
}
