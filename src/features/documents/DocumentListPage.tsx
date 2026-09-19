import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { DocumentStatus, DocumentSummary, Paginated } from '@/types/api';
import type { DocumentListQuery } from '@/api/endpoints';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import {
  BranchFilter,
  DateFilter,
  EnumFilter,
  FilterBar,
  SearchFilter,
} from '@/components/filters';
import { useListParams } from '@/hooks/useListParams';
import { DOCUMENT_STATUSES } from '@/utils/format';

export interface DocumentListPageProps {
  title: string;
  subtitle?: string;
  queryKey: string;
  fetcher: (query: DocumentListQuery) => Promise<Paginated<DocumentSummary>>;
  columns: Column<DocumentSummary>[];
  basePath: string;
  actions?: React.ReactNode;
  /** Restricts the status filter to the statuses this document type can hold. */
  statuses?: DocumentStatus[];
  emptyDescription?: string;
}

/**
 * One list implementation for every document module: server-side pagination,
 * search and filters, with the four table states handled centrally.
 */
export function DocumentListPage({
  title,
  subtitle,
  queryKey,
  fetcher,
  columns,
  basePath,
  actions,
  statuses = DOCUMENT_STATUSES,
  emptyDescription,
}: DocumentListPageProps) {
  const navigate = useNavigate();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams();

  const query = useQuery({
    queryKey: [queryKey, params],
    queryFn: () => fetcher(params as DocumentListQuery),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={actions} />

      <FilterBar
        onReset={reset}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
        search={
          <SearchFilter
            value={params.search}
            onChange={(value) => setFilter('search', value)}
            placeholder="Search number, reference, notes"
          />
        }
      >
        <EnumFilter
          label="Status"
          value={params.status}
          values={statuses}
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

      <DataTable
        columns={columns}
        rows={query.data?.data}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={(row) => navigate(`${basePath}/${row.id}`)}
        meta={query.data?.meta}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        emptyDescription={emptyDescription}
      />
    </>
  );
}
