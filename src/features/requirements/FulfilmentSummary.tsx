import { Alert, Box, Grid, LinearProgress, Skeleton, Stack, Typography } from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import type { DocumentDetail } from '@/types/api';
import { StatCard } from '@/components/StatCard';
import { DocumentStatusChip } from '@/components/StatusChip';
import { formatQuantity, sumDecimals, type Decimal } from '@/utils/decimal';
import { lineProgress } from './useRequirementFulfilment';

export interface FulfilmentTotals {
  requested: Decimal;
  fulfilled: Decimal;
  remaining: Decimal;
  percent: number;
}

/**
 * Requested / fulfilled / remaining, straight from backend quantities: the
 * requirement's own line quantities and the fulfilment figure the backend
 * computed from everything it has received - supplier receipts and internal
 * transfers alike. The status chip always renders `detail.status` as the backend
 * set it; the page never derives a business status of its own.
 */
export function fulfilmentTotals(
  detail: DocumentDetail,
  fulfilledByProduct: Map<string, Decimal>
): FulfilmentTotals {
  const perLine = detail.lineItems.map((line) => lineProgress(line, fulfilledByProduct));
  const requested = sumDecimals(perLine.map((line) => line.requested));
  const fulfilled = sumDecimals(perLine.map((line) => line.fulfilled));
  const remaining = sumDecimals(perLine.map((line) => line.remaining));
  const percent = requested.greaterThan(0)
    ? Math.min(100, Math.max(0, Number(fulfilled.dividedBy(requested).times(100).toFixed(2))))
    : 0;
  return { requested, fulfilled, remaining, percent };
}

/** The KPI row that sits under the requirement header. */
export function FulfilmentStats({
  detail,
  totals,
  isLoading,
}: {
  detail: DocumentDetail;
  totals: FulfilmentTotals;
  isLoading: boolean;
}) {
  const unit = detail.lineItems[0]?.unitOfMeasure ?? 'units';
  const singleProduct = detail.lineItems.length === 1;

  return (
    <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
      <Grid item xs={12} sm={4}>
        <StatCard
          label="Requested"
          value={formatQuantity(totals.requested)}
          caption={singleProduct ? unit : `${detail.lineItems.length} line(s)`}
          icon={<ListAltOutlinedIcon fontSize="small" />}
        />
      </Grid>
      <Grid item xs={6} sm={4}>
        <StatCard
          label="Fulfilled"
          value={formatQuantity(totals.fulfilled)}
          caption="Received: supplier + internal"
          tone="success"
          icon={<Inventory2OutlinedIcon fontSize="small" />}
          loading={isLoading}
        />
      </Grid>
      <Grid item xs={6} sm={4}>
        <StatCard
          label="Remaining"
          value={formatQuantity(totals.remaining)}
          caption={totals.remaining.greaterThan(0) ? 'Still to be sourced' : 'Nothing outstanding'}
          tone={totals.remaining.greaterThan(0) ? 'warning' : 'success'}
          icon={<PendingActionsOutlinedIcon fontSize="small" />}
          loading={isLoading}
        />
      </Grid>
    </Grid>
  );
}

/** The progress bar and its legend, for the overview panel. */
export function FulfilmentProgress({
  detail,
  totals,
  isLoading,
  partial,
}: {
  detail: DocumentDetail;
  totals: FulfilmentTotals;
  isLoading: boolean;
  partial: boolean;
}) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
        Fulfilment
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Usable stock actually received against this requirement, from supplier receipts and
        internal branch transfers
      </Typography>

      {partial ? (
        <Alert severity="info" sx={{ my: 1.5 }}>
          Part of the document chain is outside your branch scope, so the figures count only the
          documents you may read.
        </Alert>
      ) : null}

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
        sx={{ mt: 2, mb: 0.75 }}
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="body2" fontWeight={700}>
          {formatQuantity(totals.fulfilled)} / {formatQuantity(totals.requested)} fulfilled
        </Typography>
        <Typography variant="body2" color="text.secondary" fontWeight={700}>
          {totals.percent}%
        </Typography>
      </Stack>

      {isLoading ? (
        <Skeleton variant="rounded" height={8} sx={{ borderRadius: 999 }} />
      ) : (
        <LinearProgress
          variant="determinate"
          value={totals.percent}
          color={totals.remaining.greaterThan(0) ? 'warning' : 'success'}
          aria-label="Fulfilment progress"
        />
      )}

      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{ mt: 1.5 }}
        flexWrap="wrap"
        useFlexGap
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'success.main' }} />
          <Typography variant="caption" color="text.secondary">
            {formatQuantity(totals.fulfilled)} fulfilled
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'warning.main' }} />
          <Typography variant="caption" color="text.secondary">
            {formatQuantity(totals.remaining)} remaining
          </Typography>
        </Stack>
        <Box sx={{ flex: 1 }} />
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">
            Status
          </Typography>
          <DocumentStatusChip status={detail.status} />
        </Stack>
      </Stack>

      {totals.remaining.greaterThan(0) ? (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
          The backend is the authority for what may still be sourced. Internal sourcing shows which
          branches could cover this, and a purchase order is capped at whatever they cannot.
        </Typography>
      ) : null}
    </Box>
  );
}
