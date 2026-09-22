import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertTitle, Box, Button, Chip, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import { accountingApi } from '@/api/accounting';
import { useAuth } from '@/auth/useAuth';
import { useToast } from '@/components/Toast';
import { formatDateTime } from '@/utils/format';
import type { AccountingStatus, DocumentAccountingState } from '@/types/accounting';

/**
 * Where a document or payment stands with the books, and the way back when it
 * stands badly.
 *
 * Business documents now raise their own accounting inside the transaction that
 * finalises them, so the ordinary answer here is POSTED and there is nothing to
 * do. The panel exists for the two cases where that did not happen - a tenant
 * whose chart of accounts had not been initialised yet, or a posting that was
 * attempted and refused - and for the two cases where nothing was supposed to
 * happen, which it says out loud rather than leaving as an empty table a reviewer
 * has to interpret.
 *
 * Retry is idempotent at the database level: the journal carries a unique key per
 * accounting event, so repeated clicks return the entry the first one raised
 * rather than booking the liability twice.
 */

const PRESENTATION: Record<
  AccountingStatus,
  {
    label: string;
    severity: 'success' | 'info' | 'warning' | 'error';
    icon: JSX.Element;
    retryable: boolean;
  }
> = {
  POSTED: {
    label: 'Posted',
    severity: 'success',
    icon: <CheckCircleOutlineIcon fontSize="small" />,
    retryable: false,
  },
  SKIPPED: {
    label: 'No entry required',
    severity: 'info',
    icon: <RemoveCircleOutlineIcon fontSize="small" />,
    retryable: false,
  },
  NOT_REQUIRED: {
    label: 'Not required',
    severity: 'info',
    icon: <RemoveCircleOutlineIcon fontSize="small" />,
    retryable: false,
  },
  PENDING: {
    label: 'Pending',
    severity: 'warning',
    icon: <HourglassEmptyIcon fontSize="small" />,
    retryable: true,
  },
  FAILED: {
    label: 'Failed',
    severity: 'error',
    icon: <ErrorOutlineIcon fontSize="small" />,
    retryable: true,
  },
};

export function AccountingStatusChip({ status }: { status: AccountingStatus }) {
  const presentation = PRESENTATION[status];
  return (
    <Chip
      size="small"
      icon={presentation.icon}
      label={presentation.label}
      color={presentation.severity === 'info' ? 'default' : presentation.severity}
      variant={presentation.severity === 'success' ? 'filled' : 'outlined'}
      sx={{ fontWeight: 600 }}
    />
  );
}

export function AccountingStatusPanel({
  accounting,
  target,
  targetId,
  invalidateKeys = [],
}: {
  accounting: DocumentAccountingState;
  /** Documents and payments post through different routes; both are idempotent. */
  target: 'document' | 'payment';
  targetId: string;
  /** Query keys to refresh once a retry succeeds. */
  invalidateKeys?: unknown[][];
}) {
  const { can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const presentation = PRESENTATION[accounting.status];

  const retry = useMutation<void>({
    mutationFn: async () => {
      // A payment is not a Document and posts through its own route. Both return a
      // journal; neither result is shown here, because the refreshed record below
      // is what the reader actually wants to see.
      if (target === 'document') {
        await accountingApi.postDocumentAccounting(targetId);
      } else {
        await accountingApi.postPaymentAccounting(targetId);
      }
    },
    onSuccess: () => {
      toast.success('Accounting posted');
      for (const key of invalidateKeys) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      void queryClient.invalidateQueries({ queryKey: ['accounting'] });
    },
    // The backend's own sentence when it has one: "No accounting mapping is
    // configured for VENDOR" is the whole answer, and paraphrasing it would hide
    // the fix.
    onError: (error) => toast.fromError(error, 'Could not post accounting'),
  });

  // ACCOUNTING_POST is the permission that raises entries. The backend enforces it
  // on the route regardless; hiding the button only keeps it out of the way of
  // people who could not use it.
  const canPost = can('ACCOUNTING_POST');

  return (
    <Alert
      severity={presentation.severity}
      icon={presentation.icon}
      sx={{ mb: 2, alignItems: 'flex-start' }}
      action={
        presentation.retryable && canPost ? (
          <Button
            size="small"
            color="inherit"
            startIcon={<ReplayIcon fontSize="small" />}
            onClick={() => retry.mutate()}
            disabled={retry.isPending}
          >
            {retry.isPending ? 'Posting…' : 'Retry accounting'}
          </Button>
        ) : null
      }
    >
      <AlertTitle sx={{ mb: 0.5 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box component="span" sx={{ fontWeight: 700 }}>
            Accounting status: {presentation.label}
          </Box>
          {accounting.postedAt ? (
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(accounting.postedAt)}
            </Typography>
          ) : null}
        </Stack>
      </AlertTitle>
      {accounting.message ? (
        <Typography variant="body2">{accounting.message}</Typography>
      ) : accounting.status === 'POSTED' ? (
        <Typography variant="body2">
          The journals below were raised by the transaction that finalised this record.
        </Typography>
      ) : null}
      {presentation.retryable && !canPost ? (
        <Typography variant="caption" color="text.secondary">
          Raising accounting entries needs the ACCOUNTING_POST permission.
        </Typography>
      ) : null}
    </Alert>
  );
}
