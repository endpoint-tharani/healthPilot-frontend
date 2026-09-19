import { Alert, Box, Grid, Stack, Tooltip, Typography, useTheme } from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { StatCard } from '@/components/StatCard';
import { dec, formatQuantity, type Decimal } from '@/utils/decimal';
import type { DocumentDetail } from '@/types/api';

export interface ReceiptTotals {
  claimed: Decimal;
  physical: Decimal;
  accepted: Decimal;
  damaged: Decimal;
  missing: Decimal;
}

/**
 * The three quantities a receipt splits the supplier's claim into, summed over
 * its lines. Accepted, damaged and missing are the figures the receipt itself
 * stores; physical is accepted + damaged, which is what actually arrived.
 */
export function receiptTotals(detail: DocumentDetail): ReceiptTotals {
  const totals = detail.lineItems.reduce(
    (acc, line) => ({
      claimed: acc.claimed.plus(dec(line.quantity)),
      accepted: acc.accepted.plus(dec(line.acceptedQuantity)),
      damaged: acc.damaged.plus(dec(line.damagedQuantity)),
      missing: acc.missing.plus(dec(line.missingQuantity)),
    }),
    { claimed: dec(0), accepted: dec(0), damaged: dec(0), missing: dec(0) }
  );
  return { ...totals, physical: totals.accepted.plus(totals.damaged) };
}

/**
 * The split as one bar. Usable stock is green, damaged is red and missing is a
 * hatched grey - damaged must never read as stock anyone can dispense, and
 * missing is nothing at all, so it is drawn as absence rather than as a bucket.
 */
function SplitBar({ totals }: { totals: ReceiptTotals }) {
  const theme = useTheme();
  const base = totals.claimed.greaterThan(0) ? totals.claimed : totals.physical;

  if (!base.greaterThan(0)) {
    return null;
  }

  const share = (value: Decimal) => Number(value.dividedBy(base).times(100).toFixed(2));
  const segments = [
    {
      key: 'accepted',
      label: 'Usable',
      value: totals.accepted,
      sx: { bgcolor: 'success.main' },
    },
    {
      key: 'damaged',
      label: 'Damaged',
      value: totals.damaged,
      sx: { bgcolor: 'error.main' },
    },
    {
      key: 'missing',
      label: 'Missing',
      value: totals.missing,
      sx: {
        backgroundImage: `repeating-linear-gradient(45deg, ${theme.palette.divider}, ${theme.palette.divider} 4px, transparent 4px, transparent 8px)`,
        border: 1,
        borderColor: 'divider',
      },
    },
  ].filter((segment) => segment.value.greaterThan(0));

  return (
    <Box sx={{ mt: 2 }}>
      <Stack
        direction="row"
        sx={{ height: 12, borderRadius: 999, overflow: 'hidden', bgcolor: 'action.hover' }}
      >
        {segments.map((segment) => (
          <Tooltip
            key={segment.key}
            title={`${segment.label}: ${formatQuantity(segment.value)}`}
          >
            <Box sx={{ width: `${share(segment.value)}%`, ...segment.sx }} />
          </Tooltip>
        ))}
      </Stack>
      <Stack direction="row" spacing={2} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
        {segments.map((segment) => (
          <Stack key={segment.key} direction="row" spacing={0.75} alignItems="center">
            <Box sx={{ width: 9, height: 9, borderRadius: '2px', ...segment.sx }} />
            <Typography variant="caption" color="text.secondary">
              {segment.label} {formatQuantity(segment.value)} ({share(segment.value)}%)
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

/**
 * What the supplier claimed, what physically arrived, and how the receipt split
 * it. Every figure is a quantity stored on the receipt's own lines.
 */
export function ReceiptSplitPanel({ detail }: { detail: DocumentDetail }) {
  const totals = receiptTotals(detail);
  const shortfall = totals.claimed.minus(totals.physical);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
        Receipt position
      </Typography>
      <Typography variant="caption" color="text.secondary">
        As posted on this receipt. A correction is a separate document and does not rewrite these
        figures.
      </Typography>

      <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
        <Grid item xs={6} md={2.4}>
          <StatCard
            label="Supplier claimed"
            value={formatQuantity(totals.claimed)}
            caption="On the supplier's note"
            icon={<LocalShippingOutlinedIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatCard
            label="Physically received"
            value={formatQuantity(totals.physical)}
            caption="Usable + damaged"
            icon={<Inventory2OutlinedIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatCard
            label="Accepted"
            value={formatQuantity(totals.accepted)}
            caption="Into usable stock"
            tone="success"
            icon={<CheckCircleOutlineIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatCard
            label="Damaged"
            value={formatQuantity(totals.damaged)}
            caption="Never dispensable"
            tone={totals.damaged.greaterThan(0) ? 'danger' : 'neutral'}
            icon={<ReportProblemOutlinedIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={6} md={2.4}>
          <StatCard
            label="Missing"
            value={formatQuantity(totals.missing)}
            caption="Never arrived — no stock created"
            tone={totals.missing.greaterThan(0) ? 'warning' : 'neutral'}
            icon={<HelpOutlineIcon fontSize="small" />}
          />
        </Grid>
      </Grid>

      <SplitBar totals={totals} />

      {shortfall.greaterThan(0) ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {formatQuantity(shortfall)} of the supplier's claimed quantity did not arrive. The
          supplier invoice for this delivery will carry that value as disputed until a credit note
          clears it.
        </Alert>
      ) : null}

      {detail.status === 'DRAFT' ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          This receipt is still a draft: no stock has moved yet. Posting writes the usable and
          damaged movements into the inventory ledger.
        </Alert>
      ) : null}

      {detail.status === 'CORRECTED' ? (
        <Alert severity="warning" sx={{ mt: 2 }}>
          This receipt has been corrected. The figures above are preserved exactly as posted; the
          correction document carries the delta.
        </Alert>
      ) : null}
    </Box>
  );
}
