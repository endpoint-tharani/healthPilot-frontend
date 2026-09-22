import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { accountingApi } from '@/api/accounting';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { formatMoney } from '@/utils/decimal';
import { formatDate, humanise } from '@/utils/format';
import { JournalStatusChip } from './JournalListPage';

/**
 * The journals one payment raised.
 *
 * The counterpart of `DocumentJournals`, and a separate component because a
 * payment is not a Document: it carries its own link on the journal entry, and
 * without this the settlement of a supplier liability would be reachable only
 * through whichever invoices the payment happened to clear.
 *
 * A payment usually has one entry. It can have more than one when it was
 * allocated again after it was already booked - posted accounting is history, so
 * the increment is raised as its own dated entry rather than by editing the first.
 */
export function PaymentJournals({
  paymentId,
  paymentNumber,
}: {
  paymentId: string;
  paymentNumber: string;
}) {
  const query = useQuery({
    queryKey: ['accounting', 'payment-journals', paymentId],
    queryFn: () => accountingApi.journalsForPayment(paymentId),
    enabled: Boolean(paymentId),
  });

  const rows = query.data ?? [];

  return (
    <Paper variant="outlined">
      <Box sx={{ px: 2.25, py: 1.5 }}>
        <Typography variant="subtitle2">Accounting entries</Typography>
        <Typography variant="caption" color="text.secondary">
          Double-entry postings raised for {paymentNumber}
        </Typography>
      </Box>

      {query.error ? (
        <Box sx={{ p: 2 }}>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Box>
      ) : query.isLoading ? (
        <Box sx={{ p: 2 }}>
          <TableSkeleton columns={5} rows={2} />
        </Box>
      ) : rows.length === 0 ? (
        <EmptyState
          dense
          title="No accounting entries yet"
          description="No journal has been raised for this payment."
        />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Journal</TableCell>
              <TableCell>Date</TableCell>
              <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Description</TableCell>
              <TableCell align="right">Debit</TableCell>
              <TableCell align="right">Credit</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((journal) => (
              <TableRow key={journal.id} hover>
                <TableCell>
                  <MuiLink
                    component={RouterLink}
                    to={`/accounting/journals/${journal.id}`}
                    underline="hover"
                    sx={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontWeight: 700,
                      fontSize: 12.5,
                    }}
                  >
                    {journal.journalNumber}
                  </MuiLink>
                </TableCell>
                <TableCell>{formatDate(journal.documentDate)}</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  <Typography variant="body2" sx={{ maxWidth: 420 }} noWrap>
                    {journal.description}
                  </Typography>
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(journal.totalDebit)}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(journal.totalCredit)}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary" sx={{ mr: 0.75 }}>
                    {humanise(journal.event)}
                  </Typography>
                  <JournalStatusChip status={journal.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
