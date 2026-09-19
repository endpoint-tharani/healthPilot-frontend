import {
  Link as MuiLink,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { DocumentPaymentAllocation } from '@/types/api';
import { formatMoney } from '@/utils/decimal';
import { formatDate, humanise } from '@/utils/format';

/**
 * Payments allocated to a document, exactly as PaymentAllocation recorded them.
 * The allocated figure is the one that settles this document; the payment's own
 * amount may cover several invoices, so both are shown.
 */
export function PaymentAllocationsTable({
  allocations,
}: {
  allocations: DocumentPaymentAllocation[];
}) {
  return (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Payment</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Method</TableCell>
            <TableCell align="right">Payment amount</TableCell>
            <TableCell align="right">Allocated here</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {allocations.map((allocation) => (
            <TableRow key={allocation.id} hover>
              <TableCell>
                <MuiLink
                  component={RouterLink}
                  to={`/payments/${allocation.payment.id}`}
                  fontWeight={700}
                  variant="body2"
                >
                  {allocation.payment.paymentNumber}
                </MuiLink>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatDate(allocation.payment.paymentDate)}
              </TableCell>
              <TableCell>{humanise(allocation.payment.method)}</TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(allocation.payment.amount)}
              </TableCell>
              <TableCell
                align="right"
                sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
              >
                {formatMoney(allocation.allocatedAmount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
