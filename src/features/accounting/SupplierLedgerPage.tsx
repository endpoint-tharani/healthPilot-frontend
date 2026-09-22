import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Chip,
  Grid,
  Link as MuiLink,
  Paper,
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
import { supplierApi } from '@/api/endpoints';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { BranchFilter, DateFilter, FilterBar, SelectFilter } from '@/components/filters';
import { KeyValue } from '@/components/KeyValue';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states';
import { formatMoney } from '@/utils/decimal';
import { formatDate, humanise } from '@/utils/format';
import { PrintButton, PrintStyles } from './reportShell';

/**
 * The accounts payable subledger: one control account, read per supplier.
 *
 * There is a single Trade Payables account in the chart, and every supplier's
 * liability runs through it. The alternative - an account per vendor - would put
 * a row in the Trial Balance for every trading partner and make "what do we owe"
 * a pattern-match over account codes.
 *
 * So this page is a filter over that one account's journal lines, using the
 * supplier each payable line carries. The reconciliation strip below is the point
 * of it: the documented position and the posted position are computed from
 * different sources and have to agree. When they do not, a business event
 * happened that the books never recorded.
 */
export function SupplierLedgerPage() {
  const { params, setFilter, reset, activeFilterCount } = useListParams({ limit: 100 });

  const suppliers = useQuery({
    queryKey: ['suppliers', 'picker'],
    queryFn: () => supplierApi.list({ page: 1, limit: 100 }),
  });

  const supplierId = params.supplierId as string | undefined;

  const ledger = useQuery({
    queryKey: ['accounting', 'supplier-ledger', params],
    queryFn: () =>
      accountingApi.supplierLedger({
        supplierId,
        branchId: params.branchId,
        fromDate: params.fromDate,
        toDate: params.toDate,
      }),
    placeholderData: (previous) => previous,
  });

  const outstanding = useQuery({
    queryKey: ['accounting', 'supplier-outstanding', supplierId, params.branchId],
    queryFn: () =>
      accountingApi.supplierOutstanding({ supplierId, branchId: params.branchId }),
    placeholderData: (previous) => previous,
  });

  const rows = ledger.data?.rows ?? [];

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow="Accounting"
        title="Supplier Ledger"
        subtitle="Every supplier's movement through the trade payables control account, with the balance still owed."
        actions={<PrintButton />}
      />

      <FilterBar onReset={reset} showReset={activeFilterCount > 0} activeCount={activeFilterCount}>
        <SelectFilter
          label="Supplier"
          value={supplierId}
          onChange={(value) => setFilter('supplierId', value)}
          allLabel="Every supplier"
          width={300}
          options={(suppliers.data?.data ?? []).map((supplier) => ({
            value: supplier.id,
            label: `${supplier.code} · ${supplier.name}`,
          }))}
        />
        <BranchFilter value={params.branchId} onChange={(v) => setFilter('branchId', v)} />
        <DateFilter label="From" value={params.fromDate} onChange={(v) => setFilter('fromDate', v)} />
        <DateFilter label="To" value={params.toDate} onChange={(v) => setFilter('toDate', v)} />
      </FilterBar>

      {ledger.data ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <KeyValue
                label="Control account"
                value={
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <MuiLink
                      component={RouterLink}
                      to={`/accounting/general-ledger?ledgerId=${ledger.data.controlAccount.ledgerId}`}
                      underline="hover"
                      sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
                    >
                      {ledger.data.controlAccount.code}
                    </MuiLink>
                    <Typography component="span" fontWeight={600}>
                      {ledger.data.controlAccount.name}
                    </Typography>
                  </Stack>
                }
              />
              <Typography variant="caption" color="text.secondary">
                {ledger.data.supplier
                  ? ledger.data.supplier.name
                  : 'Every supplier, as the control account sees them'}
              </Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <KeyValue label="Opening owed" value={formatMoney(ledger.data.openingBalance)} />
            </Grid>
            <Grid item xs={6} md={2}>
              <KeyValue label="Settled (Dr)" value={formatMoney(ledger.data.periodDebit)} />
            </Grid>
            <Grid item xs={6} md={2}>
              <KeyValue label="Invoiced (Cr)" value={formatMoney(ledger.data.periodCredit)} />
            </Grid>
            <Grid item xs={6} md={2}>
              <KeyValue label="Still owed" value={formatMoney(ledger.data.closingBalance)} emphasis />
            </Grid>
          </Grid>
        </Paper>
      ) : null}

      {/*
        Two independently computed answers to the same question. The documents say
        what was invoiced, credited and paid; the ledger says what was booked. A
        difference means one of them is missing an event.
      */}
      {outstanding.data ? (
        <Paper variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
          <Box sx={{ px: 2.25, py: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="subtitle2">Outstanding, and whether it reconciles</Typography>
                <Typography variant="caption" color="text.secondary">
                  Invoiced less credit notes less payments, against the same supplier's balance on{' '}
                  {outstanding.data.controlAccount.code}
                </Typography>
              </Box>
              <Chip
                size="small"
                color={outstanding.data.reconciled ? 'success' : 'warning'}
                variant={outstanding.data.reconciled ? 'filled' : 'outlined'}
                label={outstanding.data.reconciled ? 'Reconciled' : 'Difference found'}
                sx={{ fontWeight: 700 }}
              />
            </Stack>
          </Box>

          {outstanding.data.rows.length === 0 ? (
            <EmptyState dense title="No supplier balances" description="Nothing is owed." />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Supplier</TableCell>
                    <TableCell align="right">Invoiced</TableCell>
                    <TableCell align="right">Credit notes</TableCell>
                    <TableCell align="right">Paid</TableCell>
                    <TableCell align="right">Outstanding</TableCell>
                    <TableCell align="right">Ledger balance</TableCell>
                    <TableCell align="right">Difference</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {outstanding.data.rows.map((row) => (
                    <TableRow key={row.supplier.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {row.supplier.name}
                        </Typography>
                        {row.disputed !== '0.00' ? (
                          <Typography variant="caption" color="text.secondary">
                            {formatMoney(row.disputed)} disputed and never booked as a liability
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(row.invoiced)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(row.credited)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(row.paid)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {formatMoney(row.outstanding)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatMoney(row.ledgerBalance)}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{
                          fontVariantNumeric: 'tabular-nums',
                          color: row.reconciled ? 'text.secondary' : 'warning.main',
                          fontWeight: row.reconciled ? 400 : 700,
                        }}
                      >
                        {formatMoney(row.difference)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      ) : null}

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 2.25, py: 1.5 }}>
          <Typography variant="subtitle2">Movements</Typography>
          <Typography variant="caption" color="text.secondary">
            Posted journal lines on the control account, oldest first. A credit raises what is
            owed; a debit settles it.
          </Typography>
        </Box>

        {ledger.error ? (
          <Box sx={{ p: 2 }}>
            <ErrorState error={ledger.error} onRetry={() => void ledger.refetch()} />
          </Box>
        ) : ledger.isLoading ? (
          <Box sx={{ p: 2 }}>
            <TableSkeleton columns={6} rows={4} />
          </Box>
        ) : rows.length === 0 ? (
          <EmptyState
            dense
            title="No movements"
            description="Nothing has been posted to the payables control account in this period."
          />
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Document</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Supplier</TableCell>
                  <TableCell>Journal</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell align="right">Running balance</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.journalLineId} hover>
                    <TableCell>{formatDate(row.date)}</TableCell>
                    <TableCell>
                      {row.sourceDocumentId ? (
                        <MuiLink
                          component={RouterLink}
                          to={`/documents?search=${row.document ?? ''}`}
                          underline="hover"
                          sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 12.5 }}
                        >
                          {row.document ?? '—'}
                        </MuiLink>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
                        >
                          {row.document ?? '—'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {humanise(row.event)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      {row.supplier?.name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <MuiLink
                        component={RouterLink}
                        to={`/accounting/journals/${row.journalEntryId}`}
                        underline="hover"
                        sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 12.5 }}
                      >
                        {row.journalNumber}
                      </MuiLink>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.debit === '0.00' ? '—' : formatMoney(row.debit)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {row.credit === '0.00' ? '—' : formatMoney(row.credit)}
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatMoney(row.runningBalance)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {!supplierId && rows.length > 0 ? (
        <Alert severity="info" sx={{ mt: 2 }} className="no-print">
          Showing every supplier together. Pick one above to read its own account — the balances
          add up to the control account either way, because they are the same journal lines.
        </Alert>
      ) : null}
    </>
  );
}
