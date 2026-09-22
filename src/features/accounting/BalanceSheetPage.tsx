import { useQuery } from '@tanstack/react-query';
import { Paper, Typography } from '@mui/material';
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
 * Assets against liabilities and equity, on the Ind AS balance sheet captions.
 *
 * The period's own result is shown inside equity. Income and expense accounts do
 * not appear on a balance sheet, so a sheet built from asset, liability and
 * equity accounts alone is out by exactly the profit for the period - it would
 * report as unbalanced on a perfectly sound set of books. Closing the result into
 * retained earnings is what a year-end close does in the ledger; showing it here
 * does the same for a report run mid-period, without writing anything.
 */
export function BalanceSheetPage() {
  const { params, setFilter, reset, activeFilterCount } = useListParams();

  const query = useQuery({
    queryKey: ['accounting', 'balance-sheet', params.branchId, params.fromDate, params.toDate],
    queryFn: () =>
      accountingApi.balanceSheet({
        branchId: params.branchId,
        fromDate: params.fromDate,
        toDate: params.toDate,
      }),
    placeholderData: (previous) => previous,
  });

  const report = query.data;
  const isEmpty =
    report &&
    report.assets.sections.length === 0 &&
    report.liabilities.sections.length === 0 &&
    report.equity.sections.length === 0;

  return (
    <>
      <PrintStyles />
      <PageHeader
        eyebrow="Financial statements"
        title="Balance Sheet"
        subtitle="What the company owns and owes, under the Schedule III / Ind AS balance sheet captions."
        actions={<PrintButton />}
      />

      <FilterBar onReset={reset} showReset={activeFilterCount > 0} activeCount={activeFilterCount}>
        <BranchFilter value={params.branchId} onChange={(v) => setFilter('branchId', v)} />
        <DateFilter label="From" value={params.fromDate} onChange={(v) => setFilter('fromDate', v)} />
        <DateFilter label="As at" value={params.toDate} onChange={(v) => setFilter('toDate', v)} />
      </FilterBar>

      {query.isLoading ? (
        <BlockSkeleton height={420} />
      ) : query.error || !report ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        </Paper>
      ) : (
        <>
          <ReportScopeLine scope={report.scope} />

          <BalanceIndicator
            isBalanced={report.isBalanced}
            difference={formatMoney(report.totals.difference)}
            balancedLabel={`Balanced — assets ${formatMoney(
              report.totals.totalAssets
            )} equal liabilities and equity ${formatMoney(
              report.totals.totalLiabilitiesAndEquity
            )}.`}
            integrityError={report.integrityError}
          />

          <ReportSurface>
            {isEmpty ? (
              <EmptyBooks what="the balance sheet" />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 300 }}>Caption</TableCell>
                    <TableCell align="right" sx={{ width: 200 }}>
                      Amount
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <SectionHeadingRow label="Assets" colSpan={2} />
                  <StatementSections sections={report.assets.sections} />
                  <TotalRow label="Total assets" values={[formatMoney(report.totals.totalAssets)]} />

                  <SectionHeadingRow label="Liabilities" colSpan={2} />
                  <StatementSections sections={report.liabilities.sections} />
                  <TotalRow
                    label="Total liabilities"
                    values={[formatMoney(report.totals.totalLiabilities)]}
                  />

                  <SectionHeadingRow label="Equity" colSpan={2} />
                  <StatementSections sections={report.equity.sections} />
                  <TableRow>
                    <TableCell sx={{ pl: 3 }}>
                      <Typography variant="body2" fontWeight={600}>
                        Retained result for the period
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Income less expenses. Carried into equity for presentation; closing entries
                        post it to retained earnings at year end.
                      </Typography>
                    </TableCell>
                    <MoneyCell bold>
                      {formatMoney(report.equity.retainedResultForPeriod)}
                    </MoneyCell>
                  </TableRow>
                  <TotalRow label="Total equity" values={[formatMoney(report.totals.totalEquity)]} />

                  <TotalRow
                    emphasis
                    label="TOTAL LIABILITIES AND EQUITY"
                    values={[formatMoney(report.totals.totalLiabilitiesAndEquity)]}
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
