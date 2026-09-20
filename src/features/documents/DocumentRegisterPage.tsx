import { useQuery } from '@tanstack/react-query';
import { Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { documentApi } from '@/api/endpoints';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import {
  BranchFilter,
  DateFilter,
  EnumFilter,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from '@/components/filters';
import {
  createdByColumn,
  dateColumn,
  numberColumn,
  statusColumn,
  supplierColumn,
  totalColumn,
  typeColumn,
} from './documentColumns';
import { DOCUMENT_STATUSES, DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, documentPath } from '@/utils/format';
import type { DocumentType } from '@/types/api';

/**
 * Cross-type register over the shared Document table: one place to find any
 * document of any type, from which its full traceability view is one click away.
 */
export function DocumentRegisterPage() {
  const navigate = useNavigate();
  // `search` and `documentType` arrive from the top-bar search box; useListParams
  // seeds them from the query string and re-applies them if it changes.
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams();

  const query = useQuery({
    queryKey: ['documents', 'register', params],
    queryFn: () =>
      documentApi.list({
        ...params,
        documentType: params.documentType as DocumentType | undefined,
      }),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader
        title="Document Register"
        subtitle="Every business document in the common document model, with full traceability"
      />

      <FilterBar
        onReset={reset}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
        search={
          <SearchFilter
            value={params.search}
            onChange={(value) => setFilter('search', value)}
            placeholder="Search number, reference or notes"
          />
        }
      >
        <SelectFilter
          label="Document type"
          value={params.documentType}
          onChange={(value) => setFilter('documentType', value)}
          options={DOCUMENT_TYPES.map((type) => ({
            value: type,
            label: DOCUMENT_TYPE_LABELS[type],
          }))}
          width={210}
        />
        <EnumFilter
          label="Status"
          value={params.status}
          values={DOCUMENT_STATUSES}
          onChange={(value) => setFilter('status', value)}
        />
        <BranchFilter value={params.branchId} onChange={(value) => setFilter('branchId', value)} />
        <DateFilter
          label="From"
          value={params.fromDate}
          onChange={(value) => setFilter('fromDate', value)}
        />
        <DateFilter
          label="To"
          value={params.toDate}
          onChange={(value) => setFilter('toDate', value)}
        />
      </FilterBar>

      <Alert severity="info" sx={{ mb: 2 }}>
        Requisitions, purchase orders, receipts, corrections, invoices, credit notes, transfers and
        dispensing are all rows in one Document table, linked to each other through DocumentLink.
      </Alert>

      <DataTable
        rows={query.data?.data}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={(row) => navigate(documentPath(row.documentType, row.id))}
        meta={query.data?.meta}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        emptyDescription="No documents match the current filters."
        columns={[
          numberColumn,
          typeColumn,
          statusColumn,
          {
            key: 'branch',
            header: 'Branch',
            render: (row) =>
              row.documentType === 'STOCK_TRANSFER'
                ? `${row.sourceBranch?.name ?? '—'} → ${row.destinationBranch?.name ?? '—'}`
                : (row.branch?.name ?? '—'),
          },
          supplierColumn,
          dateColumn,
          totalColumn,
          createdByColumn,
        ]}
      />
    </>
  );
}
