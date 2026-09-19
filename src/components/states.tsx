import { Alert, AlertTitle, Box, Button, Skeleton, Stack, Typography } from '@mui/material';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { ApiError, describeFieldErrors } from '@/api/errors';

/**
 * Skeletons rather than a spinner: the page keeps its shape while the request is
 * in flight, so nothing jumps when the data lands and "no data" is never shown
 * for something that is still loading.
 */
export function LoadingState({ label, rows = 4 }: { label?: string; rows?: number }) {
  return (
    <Stack spacing={1.1} sx={{ py: 1.5 }} aria-busy="true" aria-live="polite">
      {label ? (
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      ) : null}
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} variant="rounded" height={22} width={`${100 - index * 7}%`} />
      ))}
    </Stack>
  );
}

/** Skeleton shaped like the table it replaces, so the column rhythm is kept. */
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <Box sx={{ px: 1.5, py: 1 }} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <Stack key={rowIndex} direction="row" spacing={2} sx={{ py: 0.9 }}>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              variant="rounded"
              height={16}
              sx={{ flex: columnIndex === 0 ? 1.6 : 1, minWidth: 0 }}
            />
          ))}
        </Stack>
      ))}
    </Box>
  );
}

/** Card-shaped skeleton for KPI rows and panels. */
export function BlockSkeleton({ height = 120 }: { height?: number | string }) {
  return <Skeleton variant="rounded" height={height} />;
}

/**
 * Compact empty state: a quiet glyph, a sentence that says what would put
 * something here, and an optional action. Kept small so an empty panel does not
 * dominate a document that is otherwise full.
 */
export function EmptyState({
  title = 'Nothing to show',
  description,
  action,
  icon,
  dense,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  dense?: boolean;
}) {
  return (
    <Box sx={{ textAlign: 'center', py: dense ? 2.5 : 4, px: 2 }}>
      <Box sx={{ color: 'text.disabled', display: 'flex', justifyContent: 'center', mb: 0.75 }}>
        {icon ?? <InboxOutlinedIcon sx={{ fontSize: dense ? 22 : 28 }} />}
      </Box>
      <Typography variant="subtitle2" color="text.primary">
        {title}
      </Typography>
      {description ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: 'block', maxWidth: 420, mx: 'auto' }}
        >
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ mt: 1.5 }}>{action}</Box> : null}
    </Box>
  );
}

/** Renders any thrown error consistently, including field-level validation detail. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  const detail = apiError ? describeFieldErrors(apiError) : null;

  return (
    <Alert
      severity={apiError?.isPermissionDenied ? 'warning' : 'error'}
      icon={apiError?.isPermissionDenied ? <LockOutlinedIcon /> : undefined}
      sx={{ my: 2, alignItems: 'flex-start' }}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      <AlertTitle sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
        {apiError?.isPermissionDenied ? 'Not permitted' : 'Request failed'}
      </AlertTitle>
      {apiError?.message ?? (error instanceof Error ? error.message : 'Unexpected error')}
      {detail ? (
        <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
          {detail}
        </Typography>
      ) : null}
    </Alert>
  );
}
