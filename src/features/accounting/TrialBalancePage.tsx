import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { Link as MuiLink, Paper, Typography } from '@mui/material';
import { accountingApi } from '@/api/accounting';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { BranchFilter, DateFilter, FilterBar } from '@/components/filters';
import { BlockSkeleton, ErrorState } from '@/components/states';
import { formatMoney } from '@/utils/decimal';
import {
  BalanceIndicator,
  EmptyBooks,
  MoneyCell,
  NatureChip,
  PrintButton,
  PrintStyles,
  ReportScopeLine,
  ReportSurface,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TotalRow,
} from './reportShell';

/**
 * Every account's net movement for the period, debits in one column and credits
 * in the other.
 *
 * An account appears on the side its balance actually falls, not the side its
 * nature suggests. Reporting gross turnover instead would always balance whether
 * or not the books do, which would make the report incapable of detecting the one
 * thing it exists to detect.
 */
export function TrialBalancePage() {
  const { params, setFilter, reset, activeFilterCount } = useListParams();

  const query = useQuery({
    queryKey: ['accounting', 'trial-balance', params.branchId, params.fromDate, params.toDate],
    queryFn: () =>
      accountingApi.trialBalance({
        branchId: params.branchId,
        fromDate: params.fromDate,
        toDate: params.toDate,
      }),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow="Financial statements"
        title="Trial Balance"
        subtitle="The closing balance of every account that moved, proving the ledger balances."
        actions={<PrintButton />}
      />

      <FilterBar
        onReset={reset}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
      >
        <BranchFilter value={params.branchId} onChange={(v) => setFilter('branchId', v)} />
        <DateFilter
          label="From"
          value={params.fromDate}
          onChange={(v) => setFilter('fromDate', v)}
        />
        <DateFilter label="To" value={params.toDate} onChange={(v) => setFilter('toDate', v)} />
      </FilterBar>

      {query.isLoading ? (
        <BlockSkeleton height={380} />
      ) : query.error || !query.data ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Paper>
      ) : (
        <>
          <ReportScopeLine scope={query.data.scope} />

          <BalanceIndicator
            isBalanced={query.data.isBalanced}
            difference={formatMoney(query.data.totals.difference)}
            balancedLabel={`Balanced — total debit ${formatMoney(
              query.data.totals.totalDebit
            )} equals total credit ${formatMoney(query.data.totals.totalCredit)}.`}
            integrityError={query.data.integrityError}
          />

          <ReportSurface>
            {query.data.rows.length === 0 ? (
              <EmptyBooks what="the trial balance" />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 100 }}>Code</TableCell>
                    <TableCell sx={{ minWidth: 240 }}>Account</TableCell>
                    <TableCell>Nature</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Head</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Credit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {query.data.rows.map((row) => (
                    <TableRow key={row.ledgerId} hover>
                      <TableCell>
                        <MuiLink
                          component={RouterLink}
                          to={`/accounting/general-ledger?ledgerId=${row.ledgerId}`}
                          underline="hover"
                          sx={{
                            fontFamily: 'ui-monospace, monospace',
                            fontWeight: 700,
                            fontSize: 12.5,
                          }}
                        >
                          {row.code}
                        </MuiLink>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {row.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <NatureChip code={row.natureCode} />
                      </TableCell>
                      <TableCell
                        sx={{ display: { xs: 'none', md: 'table-cell' }, color: 'text.secondary' }}
                      >
                        <Typography variant="caption">
                          {row.headCode} · {row.headName}
                        </Typography>
                      </TableCell>
                      <MoneyCell muted={row.debit === '0.00'}>
                        {row.debit === '0.00' ? '—' : formatMoney(row.debit)}
                      </MoneyCell>
                      <MoneyCell muted={row.credit === '0.00'}>
                        {row.credit === '0.00' ? '—' : formatMoney(row.credit)}
                      </MoneyCell>
                    </TableRow>
                  ))}

                  <TotalRow
                    label="Total"
                    emphasis
                    values={[
                      formatMoney(query.data.totals.totalDebit),
                      formatMoney(query.data.totals.totalCredit),
                    ]}
                  />
                  <TableRow>
                    <TableCell colSpan={4} sx={{ border: 0, fontWeight: 700 }}>
                      Difference
                    </TableCell>
                    <TableCell
                      colSpan={2}
                      align="right"
                      sx={{
                        border: 0,
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: query.data.isBalanced ? 'success.main' : 'error.main',
                      }}
                    >
                      {formatMoney(query.data.totals.difference)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </ReportSurface>
        </>
      )}
    </>
  );
}
