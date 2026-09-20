import {
  Box,
  Chip,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { FinancialSummary as FigureList, type FinancialLine } from '@/components/FinancialSummary';
import { EmptyState } from '@/components/states';
import { formatMoney, dec } from '@/utils/decimal';
import { documentPath, formatDate, humanise } from '@/utils/format';
import type { ChainFinancials, ChainPayment } from '@/hooks/useDocumentChain';

/**
 * Money across the chain. Every figure is a value the backend stored on a linked
 * document (purchase order, invoice, credit note) - the panel only adds the
 * documents of one kind together, it never re-derives a total, tax or balance.
 */
export function ChainFinancialSummary({
  financials,
  hasChain,
}: {
  financials: ChainFinancials;
  hasChain: boolean;
}) {
  if (!hasChain) {
    return (
      <Box>
        <Typography variant="subtitle2">Financial summary</Typography>
        <EmptyState
          dense
          title="No financial documents yet"
          description="Totals appear once a purchase order is raised against this requisition."
        />
      </Box>
    );
  }

  const lines: FinancialLine[] = [
    { label: 'Purchase order', value: financials.ordered },
    { label: 'Supplier invoice', value: financials.invoiced },
    ...(dec(financials.disputed).greaterThan(0)
      ? [{ label: 'Disputed', value: financials.disputed, negative: true } as FinancialLine]
      : []),
    { label: 'Credit note', value: financials.credited, negative: true },
    { label: 'Paid', value: financials.paid },
    { label: 'Outstanding', value: financials.outstanding, emphasis: true, ruleAbove: true },
  ];

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
        Financial summary
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Backend totals from the linked purchase order, invoice and credit note
      </Typography>
      <Box sx={{ maxWidth: 420, mt: 1.5 }}>
        <FigureList lines={lines} />
      </Box>
    </Box>
  );
}

/**
 * Payments reach a requirement through its invoice, never directly. The table
 * shows that path explicitly rather than attaching a payment to the requirement
 * itself, which no PaymentAllocation row claims.
 */
export function ChainPayments({ payments }: { payments: ChainPayment[] }) {
  if (payments.length === 0) {
    return (
      <EmptyState
        dense
        title="No payment allocations"
        description="No payments have been allocated to this requisition's invoices yet."
      />
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap" useFlexGap>
        <Chip size="small" label="Requisition" variant="outlined" />
        <Typography variant="caption" color="text.disabled">
          →
        </Typography>
        <Chip size="small" label="Invoice" variant="outlined" />
        <Typography variant="caption" color="text.disabled">
          →
        </Typography>
        <Chip size="small" label="Payment" color="primary" />
      </Stack>

      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Payment</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Allocated to</TableCell>
              <TableCell align="right">Payment amount</TableCell>
              <TableCell align="right">Allocated</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments.map(({ document, allocation }) => (
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
                <TableCell>
                  <MuiLink
                    component={RouterLink}
                    to={documentPath(document.documentType, document.id)}
                    fontWeight={600}
                    variant="body2"
                  >
                    {document.documentNumber}
                  </MuiLink>
                </TableCell>
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

      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
        Allocations belong to the invoice document; this requirement carries none of its own.
      </Typography>
    </Box>
  );
}
