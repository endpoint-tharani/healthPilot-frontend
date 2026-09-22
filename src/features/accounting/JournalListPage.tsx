import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Chip, Link as MuiLink, Typography } from '@mui/material';
import { accountingApi } from '@/api/accounting';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import {
  BranchFilter,
  DateFilter,
  EnumFilter,
  FilterBar,
  SearchFilter,
} from '@/components/filters';
import { formatMoney } from '@/utils/decimal';
import { documentPath, formatDate, humanise } from '@/utils/format';
import type { AccountingEvent, JournalStatus } from '@/types/accounting';

const JOURNAL_STATUSES = ['DRAFT', 'POSTED', 'REVERSED'] as const;
const ACCOUNTING_EVENTS = [
  'SUPPLIER_INVOICE',
  'SUPPLIER_PAYMENT',
  'CREDIT_NOTE',
  'SALES',
  'COGS',
  'MANUAL',
  'REVERSAL',
] as const;

/** POSTED is the state that counts; the other two are called out in their own colour. */
export function JournalStatusChip({ status }: { status: JournalStatus }) {
  const colour =
    status === 'POSTED' ? 'success' : status === 'REVERSED' ? 'warning' : 'default';
  return (
    <Chip
      size="small"
      color={colour}
      variant={status === 'POSTED' ? 'filled' : 'outlined'}
      label={status}
      sx={{ height: 21, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em' }}
    />
  );
}

/**
 * Every journal the company has raised, newest first. Only POSTED entries reach
 * the reports, so the status column is the first thing a reviewer reads.
 */
export function JournalListPage() {
  const navigate = useNavigate();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams({
    limit: 25,
  });

  const query = useQuery({
    queryKey: ['accounting', 'journals', params],
    queryFn: () =>
      accountingApi.journals({
        ...params,
        status: params.status as JournalStatus | undefined,
        event: params.event as AccountingEvent | undefined,
      }),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Journal Entries"
        subtitle="Every double-entry posting, with the business document that caused it."
      />

      <FilterBar
        search={
          <SearchFilter
            value={params.search}
            onChange={(value) => setFilter('search', value)}
            placeholder="Journal number, description…"
          />
        }
        onReset={reset}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
      >
        <BranchFilter value={params.branchId} onChange={(v) => setFilter('branchId', v)} />
        <EnumFilter
          label="Status"
          value={params.status as string | undefined}
          values={JOURNAL_STATUSES}
          onChange={(v) => setFilter('status', v)}
        />
        <EnumFilter
          label="Event"
          value={params.event as string | undefined}
          values={ACCOUNTING_EVENTS}
          onChange={(v) => setFilter('event', v)}
        />
        <DateFilter
          label="From"
          value={params.fromDate}
          onChange={(v) => setFilter('fromDate', v)}
        />
        <DateFilter label="To" value={params.toDate} onChange={(v) => setFilter('toDate', v)} />
      </FilterBar>

      <DataTable
        rows={query.data?.data}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        onRowClick={(row) => navigate(`/accounting/journals/${row.id}`)}
        emptyDescription="No journal entries match the current filters."
        columns={[
          {
            key: 'journalNumber',
            header: 'Journal',
            render: (row) => (
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
              >
                {row.journalNumber}
              </Typography>
            ),
          },
          { key: 'date', header: 'Date', render: (row) => formatDate(row.documentDate) },
          {
            key: 'source',
            header: 'Source document',
            render: (row) =>
              row.sourceDocument ? (
                <MuiLink
                  component={RouterLink}
                  to={documentPath(row.sourceDocument.documentType, row.sourceDocument.id)}
                  underline="hover"
                  fontWeight={600}
                  onClick={(event) => event.stopPropagation()}
                >
                  {row.sourceDocument.documentNumber}
                </MuiLink>
              ) : row.sourcePayment ? (
                <Typography variant="body2" fontWeight={600}>
                  {row.sourcePayment.paymentNumber}
                </Typography>
              ) : (
                '—'
              ),
          },
          {
            key: 'event',
            header: 'Event',
            render: (row) => (
              <Typography variant="caption" color="text.secondary">
                {humanise(row.event)}
              </Typography>
            ),
            hideOnSmall: true,
          },
          {
            key: 'description',
            header: 'Description',
            render: (row) => (
              <Typography variant="body2" sx={{ maxWidth: 380 }} noWrap title={row.description}>
                {row.description}
              </Typography>
            ),
            hideOnSmall: true,
          },
          {
            key: 'branch',
            header: 'Branch',
            render: (row) => row.branch?.name ?? '—',
            hideOnSmall: true,
          },
          {
            key: 'debit',
            header: 'Debit',
            numeric: true,
            render: (row) => formatMoney(row.totalDebit),
          },
          {
            key: 'credit',
            header: 'Credit',
            numeric: true,
            render: (row) => formatMoney(row.totalCredit),
          },
          {
            key: 'status',
            header: 'Status',
            render: (row) => <JournalStatusChip status={row.status} />,
          },
        ]}
      />
    </>
  );
}
