import { Box, Paper, Stack, Typography, useTheme } from '@mui/material';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { formatQuantity, sumDecimals } from '@/utils/decimal';
import { formatDateTime } from '@/utils/format';
import { paletteTokens, type ColorMode } from '@/app/theme';
import type { BranchRef, DocumentDetail } from '@/types/api';

function BranchCard({
  branch,
  role,
  state,
}: {
  branch: BranchRef | null;
  role: string;
  state: string;
}) {
  const central = branch?.type === 'CENTRAL_WAREHOUSE';
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 190 }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'action.hover',
            color: 'primary.main',
            flexShrink: 0,
          }}
        >
          {central ? (
            <WarehouseOutlinedIcon fontSize="small" />
          ) : (
            <StorefrontOutlinedIcon fontSize="small" />
          )}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={700}
            sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10 }}
          >
            {role}
          </Typography>
          <Typography variant="body2" fontWeight={700} noWrap>
            {branch?.name ?? '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {state}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

/**
 * Where the stock is going and how far it has got. The two legs are read from
 * the ledger rows the transfer actually wrote - TRANSFER_OUT leaves the source,
 * TRANSFER_IN arrives at the destination - rather than inferred from the status,
 * so the picture can only say what the stock ledger says.
 */
export function TransferRoute({ detail }: { detail: DocumentDetail }) {
  const theme = useTheme();
  const t = paletteTokens(theme.palette.mode as ColorMode);

  const dispatchMovement = detail.inventoryTransactions.find(
    (movement) => movement.transactionType === 'TRANSFER_OUT'
  );
  const receiptMovement = detail.inventoryTransactions.find(
    (movement) => movement.transactionType === 'TRANSFER_IN'
  );

  const units = sumDecimals(detail.lineItems.map((line) => line.quantity));
  const unit = detail.lineItems[0]?.unitOfMeasure ?? 'units';

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
        Transfer route
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Created → dispatched (stock leaves the source) → received (stock arrives at the destination)
      </Typography>

      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'center' }}
        spacing={1.5}
        sx={{ mt: 2 }}
      >
        <BranchCard
          branch={detail.sourceBranch}
          role="Source branch"
          state={
            dispatchMovement
              ? `Issued ${formatDateTime(dispatchMovement.transactionDate)}`
              : 'Stock still held here'
          }
        />

        <Stack alignItems="center" spacing={0.5} sx={{ px: 1, flexShrink: 0 }}>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 999,
              bgcolor: t.accentSoft,
              color: 'primary.dark',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <LocalShippingOutlinedIcon sx={{ fontSize: 15 }} />
            <Typography variant="body2" fontWeight={800} sx={{ whiteSpace: 'nowrap' }}>
              {formatQuantity(units)} {unit}
            </Typography>
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, color: 'text.disabled' }}>
            <ArrowForwardIcon fontSize="small" />
          </Box>
          <Box sx={{ display: { xs: 'block', md: 'none' }, color: 'text.disabled' }}>
            <ArrowDownwardIcon fontSize="small" />
          </Box>
        </Stack>

        <BranchCard
          branch={detail.destinationBranch}
          role="Destination branch"
          state={
            receiptMovement
              ? `Received ${formatDateTime(receiptMovement.transactionDate)}`
              : dispatchMovement
                ? 'In transit — not yet received'
                : 'Waiting for dispatch'
          }
        />
      </Stack>
    </Box>
  );
}
