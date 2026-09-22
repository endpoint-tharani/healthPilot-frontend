import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Alert, Box, Grid, Link as MuiLink, Paper, Stack, Typography } from '@mui/material';
import { accountingApi } from '@/api/accounting';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { BranchFilter, DateFilter, FilterBar, SelectFilter } from '@/components/filters';
import { KeyValue } from '@/components/KeyValue';
import { formatMoney } from '@/utils/decimal';
import { formatDate } from '@/utils/format';
import { PrintButton, PrintStyles } from './reportShell';

/**
 * Every movement on one account, in date order, with a running balance.
 *
 * The balance is computed by the server from the journal lines on each request
 * rather than read from a stored figure on the ledger, so it cannot drift from
 * the postings that determine it. Only POSTED journals appear.
 */
export function GeneralLedgerPage() {
  const [searchParams] = useSearchParams();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams({
    limit: 50,
    ledgerId: searchParams.get('ledgerId') ?? undefined,
  });

  const ledgers = useQuery({
    queryKey: ['accounting', 'ledgers', 'picker'],
    queryFn: () => accountingApi.ledgers(),
  });

  const ledgerId = params.ledgerId as string | undefined;

  const query = useQuery({
    queryKey: ['accounting', 'general-ledger', params],
    queryFn: () =>
      accountingApi.generalLedger({
        ledgerId: ledgerId!,
        branchId: params.branchId,
        fromDate: params.fromDate,
        toDate: params.toDate,
        page: params.page,
        limit: params.limit,
      }),
    enabled: Boolean(ledgerId),
    placeholderData: (previous) => previous,
  });

  const meta = query.data?.meta;

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow="Accounting"
        title="General Ledger"
        subtitle="Every posted movement on one account, with its running balance."
        actions={<PrintButton />}
      />

      <FilterBar
        onReset={reset}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
      >
        <SelectFilter
          label="Ledger account"
          value={ledgerId}
          onChange={(value) => setFilter('ledgerId', value)}
          allLabel="Choose an account"
          width={300}
          options={(ledgers.data ?? []).map((ledger) => ({
            value: ledger.id,
            label: `${ledger.code} · ${ledger.name}`,
          }))}
        />
        <BranchFilter value={params.branchId} onChange={(v) => setFilter('branchId', v)} />
        <DateFilter
          label="From"
          value={params.fromDate}
          onChange={(v) => setFilter('fromDate', v)}
        />
        <DateFilter label="To" value={params.toDate} onChange={(v) => setFilter('toDate', v)} />
      </FilterBar>

      {!ledgerId ? (
        <Alert severity="info">
          Choose a ledger account to see its movements. Every account in the chart is listed in the
          filter.
        </Alert>
      ) : (
        <>
          {meta ? (
            <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <KeyValue
                    label="Account"
                    value={
                      <Stack direction="row" spacing={1} alignItems="baseline">
                        <Typography
                          component="span"
                          sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}
                        >
                          {meta.ledger.code}
                        </Typography>
                        <Typography component="span" fontWeight={600}>
                          {meta.ledger.name}
                        </Typography>
                      </Stack>
                    }
                  />
                  <Typography variant="caption" color="text.secondary">
                    {meta.ledger.head.code} · {meta.ledger.head.name} ({meta.ledger.nature.name})
                  </Typography>
                </Grid>
                <Grid item xs={6} md={2}>
                  <KeyValue label="Opening balance" value={formatMoney(meta.openingBalance)} />
                </Grid>
                <Grid item xs={6} md={2}>
                  <KeyValue label="Period debit" value={formatMoney(meta.periodDebit)} />
                </Grid>
                <Grid item xs={6} md={2}>
                  <KeyValue label="Period credit" value={formatMoney(meta.periodCredit)} />
                </Grid>
                <Grid item xs={6} md={2}>
                  <KeyValue
                    label="Closing balance"
                    value={formatMoney(meta.closingBalance)}
                    emphasis
                  />
                </Grid>
              </Grid>
            </Paper>
          ) : null}

          <DataTable
            rows={query.data?.data}
            rowKey={(row) => row.journalLineId}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
            meta={meta}
            onPageChange={setPage}
            onRowsPerPageChange={setLimit}
            emptyDescription="No posted movements on this account in the selected period."
            columns={[
              { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
              {
                key: 'journal',
                header: 'Journal',
                render: (row) => (
                  <MuiLink
                    component={RouterLink}
                    to={`/accounting/journals/${row.journalEntryId}`}
                    underline="hover"
                    sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 12.5 }}
                  >
                    {row.journalNumber}
                  </MuiLink>
                ),
              },
              {
                key: 'source',
                header: 'Source',
                render: (row) => row.sourceDocument ?? '—',
              },
              {
                key: 'branch',
                header: 'Branch',
                render: (row) => row.branch?.name ?? '—',
                hideOnSmall: true,
              },
              {
                key: 'description',
                header: 'Description',
                render: (row) => (
                  <Typography variant="body2" sx={{ maxWidth: 420 }} noWrap title={row.description}>
                    {row.description}
                  </Typography>
                ),
              },
              {
                key: 'debit',
                header: 'Debit',
                numeric: true,
                render: (row) => (row.debit === '0.00' ? '—' : formatMoney(row.debit)),
              },
              {
                key: 'credit',
                header: 'Credit',
                numeric: true,
                render: (row) => (row.credit === '0.00' ? '—' : formatMoney(row.credit)),
              },
              {
                key: 'balance',
                header: 'Balance',
                numeric: true,
                render: (row) => (
                  <Box component="span" sx={{ fontWeight: 700 }}>
                    {formatMoney(row.runningBalance)}
                  </Box>
                ),
              },
            ]}
          />
        </>
      )}
    </>
  );
}
