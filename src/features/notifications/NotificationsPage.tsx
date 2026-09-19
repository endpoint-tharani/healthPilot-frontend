import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Stack,
  Tab,
  TablePagination,
  Tabs,
  Typography,
  useTheme,
} from '@mui/material';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '@/api/endpoints';
import { paletteTokens, statusTone, type ColorMode } from '@/app/theme';
import { PageHeader } from '@/components/PageHeader';
import { DateFilter, FilterBar, SearchFilter, SelectFilter } from '@/components/filters';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { useListParams } from '@/hooks/useListParams';
import { notificationKeys } from '@/notifications/NotificationContext';
import { useNotifications } from '@/notifications/useNotifications';
import {
  notificationIcon,
  notificationTarget,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPES,
  relativeTime,
  SEVERITY_TONE,
} from '@/notifications/notificationDisplay';
import { formatDateTime } from '@/utils/format';
import type { AppNotification, NotificationType } from '@/types/api';

/**
 * The full notification history for the signed-in user.
 *
 * This is not the audit trail. Document Activity records what happened to a
 * document and who did it; this records what this user was told about and
 * whether they have looked at it. Both are kept, and a notification links to the
 * document whose activity explains it.
 */
export function NotificationsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const mode = theme.palette.mode as ColorMode;
  const tokens = paletteTokens(mode);
  const { markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams();
  const [tab, setTab] = useState<'all' | 'unread'>('all');

  const filters = {
    page: params.page,
    limit: params.limit,
    search: params.search,
    unreadOnly: tab === 'unread' ? true : undefined,
    type: params.type as NotificationType | undefined,
    fromDate: params.fromDate,
    toDate: params.toDate,
  };

  const query = useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: () => notificationApi.list(filters),
  });

  const open = async (notification: AppNotification) => {
    const target = notificationTarget(notification);
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    if (target) {
      navigate(target);
    }
  };

  const rows = query.data?.data ?? [];

  return (
    <Box>
      <PageHeader
        eyebrow="Notifications"
        title="Your notifications"
        subtitle="Everything the system has raised for you, newest first. Separate from a document's activity trail, which records what happened rather than who needed to know."
        actions={
          <Button
            size="small"
            variant="outlined"
            startIcon={<DoneAllIcon />}
            disabled={unreadCount === 0}
            onClick={() => void markAllAsRead()}
          >
            Mark all as read
          </Button>
        }
      />

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_event, value) => {
            setTab(value as 'all' | 'unread');
            setPage(1);
          }}
          sx={{ px: 1.5 }}
        >
          <Tab value="all" label="All" />
          <Tab value="unread" label={unreadCount > 0 ? `Unread (${unreadCount})` : 'Unread'} />
        </Tabs>
      </Paper>

      <FilterBar
        activeCount={activeFilterCount}
        showReset={activeFilterCount > 0}
        onReset={reset}
        search={
          <SearchFilter
            value={params.search}
            onChange={(value) => setFilter('search', value)}
            placeholder="Search notifications or document number"
            width={300}
          />
        }
      >
        <SelectFilter
          label="Type"
          value={params.type}
          onChange={(value) => setFilter('type', value)}
          width={230}
          allLabel="All types"
          options={NOTIFICATION_TYPES.map((type) => ({
            value: type,
            label: NOTIFICATION_TYPE_LABELS[type],
          }))}
        />
        <DateFilter
          label="From"
          value={params.fromDate}
          onChange={(value) => setFilter('fromDate', value)}
        />
        <DateFilter
          label="To"
          value={params.toDate}
          onChange={(value) => setFilter('toDate', value)}
        />
      </FilterBar>

      <Paper variant="outlined">
        {query.isLoading ? (
          <TableSkeleton columns={3} rows={8} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<NotificationsNoneOutlinedIcon sx={{ fontSize: 28 }} />}
            title={tab === 'unread' ? 'Nothing unread' : 'No notifications'}
            description={
              activeFilterCount > 0
                ? 'No notifications match these filters.'
                : 'Notifications appear here as documents you are involved with move through the workflow.'
            }
          />
        ) : (
          rows.map((notification) => {
            const tone = statusTone(mode, SEVERITY_TONE[notification.severity]);
            const Icon = notificationIcon(notification.type);
            const navigable = notificationTarget(notification) !== null;

            return (
              <Box
                key={notification.id}
                component="button"
                type="button"
                onClick={() => void open(notification)}
                sx={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  borderBottom: `1px solid ${tokens.divider}`,
                  px: 2,
                  py: 1.5,
                  font: 'inherit',
                  color: 'inherit',
                  cursor: navigable ? 'pointer' : 'default',
                  bgcolor: notification.isRead ? 'background.paper' : tokens.navActive,
                  '&:hover': {
                    bgcolor: notification.isRead ? tokens.rowHover : tokens.navActive,
                  },
                  '&:last-of-type': { borderBottom: 0 },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      mt: 0.25,
                      width: 30,
                      height: 30,
                      borderRadius: 1.5,
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: tone.bg,
                      color: tone.fg,
                      flexShrink: 0,
                    }}
                  >
                    <Icon sx={{ fontSize: 17 }} />
                  </Box>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography
                        variant="body2"
                        fontWeight={notification.isRead ? 600 : 700}
                        sx={{ minWidth: 0 }}
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
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.25, whiteSpace: 'normal' }}
                    >
                      {notification.message}
                    </Typography>

                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                      sx={{ mt: 0.6 }}
                    >
                      {notification.document ? (
                        <Typography variant="caption" color="primary.main" fontWeight={700}>
                          {notification.document.documentNumber}
                        </Typography>
                      ) : null}
                      {notification.branch ? (
                        <Typography variant="caption" color="text.secondary">
                          {notification.branch.name}
                        </Typography>
                      ) : null}
                      <Typography variant="caption" color="text.disabled">
                        {relativeTime(notification.createdAt)} ·{' '}
                        {formatDateTime(notification.createdAt)}
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
              </Box>
            );
          })
        )}

        {query.data ? (
          <TablePagination
            component="div"
            count={query.data.meta.total}
            page={Math.max(0, query.data.meta.page - 1)}
            onPageChange={(_event, page) => setPage(page + 1)}
            rowsPerPage={query.data.meta.limit}
            onRowsPerPageChange={(event) => setLimit(Number(event.target.value))}
            rowsPerPageOptions={[10, 20, 50, 100]}
          />
        ) : null}
      </Paper>
    </Box>
  );
}
