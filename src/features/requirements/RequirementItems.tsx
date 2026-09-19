import {
  Box,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { DocumentDetail } from '@/types/api';
import { EmptyState } from '@/components/states';
import { formatMoney, formatQuantity, type Decimal } from '@/utils/decimal';
import { formatDate } from '@/utils/format';
import { lineProgress } from './useRequirementFulfilment';

/**
 * Requirement lines with their fulfilment position. Requested, unit price and
 * tax come from the requirement line; fulfilled comes from the ledger; remaining
 * is the difference between those two backend figures.
 */
export function RequirementItems({
  detail,
  fulfilledByProduct,
  batchByProduct,
}: {
  detail: DocumentDetail;
  fulfilledByProduct: Map<string, Decimal>;
  /** Batch a product was actually received under, from the linked receipts. */
  batchByProduct: Map<string, { batchNumber: string; expiryDate?: string }>;
}) {
  if (detail.lineItems.length === 0) {
    return (
      <EmptyState
        dense
        title="No line items"
        description="This requirement does not list any products."
      />
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        Fulfilment is shown per product, from the usable stock the linked receipts accepted.
      </Typography>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Product</TableCell>
              <TableCell>Batch received</TableCell>
              <TableCell align="right">Requested</TableCell>
              <TableCell align="right">Fulfilled</TableCell>
              <TableCell align="right">Remaining</TableCell>
              <TableCell align="right">Purchase price</TableCell>
              <TableCell align="right">Tax</TableCell>
              <TableCell align="right">Line total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {detail.lineItems.map((line) => {
              const progress = lineProgress(line, fulfilledByProduct);
              const batch = batchByProduct.get(line.product.id);
              return (
                <TableRow key={line.id} hover>
                  <TableCell sx={{ minWidth: 200 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {line.product?.name ?? line.product.id}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {line.product?.code}
                      {line.unitOfMeasure ? ` · ${line.unitOfMeasure}` : ''}
                    </Typography>
                    <Box sx={{ mt: 0.75, maxWidth: 200 }}>
                      <LinearProgress
                        variant="determinate"
                        value={progress.percent}
                        color={progress.remaining.greaterThan(0) ? 'warning' : 'success'}
                        sx={{ height: 5 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    {batch ? (
                      <>
                        <Typography variant="body2">{batch.batchNumber}</Typography>
                        {batch.expiryDate ? (
                          <Typography variant="caption" color="text.secondary">
                            Exp. {formatDate(batch.expiryDate)}
                          </Typography>
                        ) : null}
                      </>
                    ) : (
                      <Typography variant="caption" color="text.disabled">
                        Not received yet
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatQuantity(progress.requested)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, color: 'success.main', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatQuantity(progress.fulfilled)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: progress.remaining.greaterThan(0) ? 'warning.main' : 'text.secondary',
                    }}
                  >
                    {formatQuantity(progress.remaining)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatMoney(line.unitPrice)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatQuantity(line.taxRate)}%
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatMoney(line.taxAmount)}
                    </Typography>
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatMoney(line.total)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
