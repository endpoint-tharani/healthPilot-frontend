import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
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
import { accountingApi } from '@/api/accounting';
import { AccountingStatusPanel } from './AccountingStatusPanel';
import { DetailSection } from '@/components/DocumentDetailLayout';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { formatMoney } from '@/utils/decimal';
import { formatDate, humanise } from '@/utils/format';
import { JournalStatusChip } from './JournalListPage';
import type { DocumentType } from '@/types/api';
import type { DocumentAccountingState } from '@/types/accounting';

/**
 * Why a document type raises no accounting entry.
 *
 * Shown in place of an empty table, because "no journals" on a stock transfer is
 * a deliberate accounting decision rather than something nobody got round to -
 * and a reviewer looking for the entry deserves to be told which it is.
 */
const NO_JOURNAL_REASON: Partial<Record<DocumentType, string>> = {
  STOCK_TRANSFER:
    'An internal stock transfer moves the same stock, at the same cost, between two branches of the same company. No revenue is earned and no expense incurred, so no journal is raised — recognising a sale here would let the company book profit by moving stock between its own shelves, and would double-count against the real sale when the stock is dispensed. The movement itself is recorded in the stock ledger.',
  GOODS_RECEIPT:
    'The payable and the inventory debit are recognised at supplier invoice stage under this deployment’s accounting policy, so the receipt raises no journal of its own. Booking it here as well would double the asset.',
  RECEIPT_CORRECTION:
    'A receipt correction restates the accepted quantity behind a goods receipt. It re-values any supplier invoice raised against that order, and the accounting follows from the invoice rather than from the correction.',
  STOCK_REQUIREMENT: 'A stock requisition is a request, not a transaction, so it has no accounting effect.',
  PURCHASE_ORDER:
    'A purchase order is a commitment to buy, not a liability. Nothing is owed until the supplier invoices for goods that were accepted.',
};

/**
 * The journals one business document raised.
 *
 * This is the middle link of the audit trail the accounting module exists to
 * provide: business document to journal entry to journal lines to ledger to
 * financial report. Every row opens the posting it names.
 */
export function DocumentJournals({
  documentId,
  documentType,
  documentNumber,
  accounting,
}: {
  documentId: string;
  documentType: DocumentType;
  documentNumber: string;
  /** Where the document stands with the books, from the document itself. */
  accounting: DocumentAccountingState;
}) {
  const query = useQuery({
    queryKey: ['accounting', 'document-journals', documentId],
    queryFn: () => accountingApi.journalsForDocument(documentId),
    enabled: Boolean(documentId),
  });

  const reason = NO_JOURNAL_REASON[documentType];

  return (
    <DetailSection
      first
      title="Accounting entries"
      subtitle={`Double-entry postings raised for ${documentNumber}`}
    >
      {/*
        The status comes first, and comes from the document rather than from the
        table below it. An empty table cannot distinguish "this document raises no
        entry by design" from "the posting never happened", and those are the two
        things a reviewer opening this tab most needs told apart.
      */}
      <AccountingStatusPanel
        accounting={accounting}
        target="document"
        targetId={documentId}
        invalidateKeys={[
          ['document', documentId],
          ['accounting', 'document-journals', documentId],
        ]}
      />

      {query.error ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <TableSkeleton columns={5} rows={3} />
      ) : (query.data ?? []).length === 0 ? (
        reason ? (
          <Alert severity="info">
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
              This document type raises no accounting entry
            </Typography>
            <Typography variant="body2">{reason}</Typography>
          </Alert>
        ) : (
          <EmptyState
            dense
            title="No accounting entries yet"
            description="No journal has been raised for this document."
          />
        )
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Journal</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Event</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                  Description
                </TableCell>
                <TableCell align="right">Debit</TableCell>
                <TableCell align="right">Credit</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(query.data ?? []).map((journal) => (
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
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {humanise(journal.event)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                    <Typography variant="body2" sx={{ maxWidth: 360 }} noWrap>
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
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <JournalStatusChip status={journal.status} />
                      {!journal.isBalanced ? (
                        <Box component="span" sx={{ color: 'error.main', fontSize: 11 }}>
                          unbalanced
                        </Box>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </DetailSection>
  );
}
