import { useQuery } from '@tanstack/react-query';
import { Alert, Paper, Typography } from '@mui/material';
import { accountingApi } from '@/api/accounting';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { BranchFilter, DateFilter, FilterBar } from '@/components/filters';
import { BlockSkeleton, ErrorState } from '@/components/states';
import { formatMoney } from '@/utils/decimal';
import {
  EmptyBooks,
  PrintButton,
  PrintStyles,
  ReportScopeLine,
  ReportSurface,
  SectionHeadingRow,
  StatementSections,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TotalRow,
} from './reportShell';

/**
 * Income less expenses for the period, on the reporting format's own hierarchy.
 *
 * Every figure is derived from posted journal lines on each request. Nothing is
 * stored, cached or carried forward, so a mis-posting shows up as a wrong number
 * here rather than being hidden behind a total that was written once and never
 * recomputed.
 */
export function ProfitLossPage() {
  const { params, setFilter, reset, activeFilterCount } = useListParams();

  const query = useQuery({
    queryKey: ['accounting', 'profit-loss', params.branchId, params.fromDate, params.toDate],
    queryFn: () =>
      accountingApi.profitLoss({
        branchId: params.branchId,
        fromDate: params.fromDate,
        toDate: params.toDate,
      }),
    placeholderData: (previous) => previous,
  });

  const report = query.data;
  const isEmpty =
    report && report.income.sections.length === 0 && report.expenses.sections.length === 0;

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow="Financial statements"
        title="Profit & Loss"
        subtitle="Revenue and expenses for the period, under the Ind AS statement of profit and loss captions."
        actions={<PrintButton />}
      />

      <FilterBar onReset={reset} showReset={activeFilterCount > 0} activeCount={activeFilterCount}>
        <BranchFilter value={params.branchId} onChange={(v) => setFilter('branchId', v)} />
        <DateFilter label="From" value={params.fromDate} onChange={(v) => setFilter('fromDate', v)} />
        <DateFilter label="To" value={params.toDate} onChange={(v) => setFilter('toDate', v)} />
      </FilterBar>

      {query.isLoading ? (
        <BlockSkeleton height={380} />
      ) : query.error || !report ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Paper>
      ) : (
        <>
          <ReportScopeLine scope={report.scope} />

          <Alert severity={report.isProfit ? 'success' : 'warning'} sx={{ mb: 2 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {report.isProfit ? 'Net profit' : 'Net loss'} for the period:{' '}
              {formatMoney(report.netProfit)}
            </Typography>
            <Typography variant="body2">
              Income {formatMoney(report.totalIncome)} less expenses{' '}
              {formatMoney(report.totalExpenses)}. Tax collected on sales is a liability, not
              income, and is excluded.
            </Typography>
          </Alert>

          <ReportSurface>
            {isEmpty ? (
              <EmptyBooks what="the profit and loss statement" />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 300 }}>Account</TableCell>
                    <TableCell align="right" sx={{ width: 200 }}>
                      Amount
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <SectionHeadingRow label="Income" colSpan={2} />
                  <StatementSections sections={report.income.sections} />
                  <TotalRow label="Total income" values={[formatMoney(report.totalIncome)]} />

                  <SectionHeadingRow label="Expenses" colSpan={2} />
                  <StatementSections sections={report.expenses.sections} />
                  <TotalRow label="Total expenses" values={[formatMoney(report.totalExpenses)]} />

                  <TotalRow
                    emphasis
                    label={report.isProfit ? 'NET PROFIT' : 'NET LOSS'}
                    values={[formatMoney(report.netProfit)]}
                  />
                </TableBody>
              </Table>
            )}
          </ReportSurface>
        </>
      )}
    </>
  );
}
