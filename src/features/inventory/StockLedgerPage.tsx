import { useQuery } from '@tanstack/react-query';
import { Alert, Link as MuiLink, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { inventoryApi } from '@/api/endpoints';
import { useProducts } from '@/hooks/useReferenceData';
import { useListParams } from '@/hooks/useListParams';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import {
  BranchFilter,
  DateFilter,
  EnumFilter,
  FilterBar,
  SelectFilter,
} from '@/components/filters';
import { StockStatusChip } from '@/components/StatusChip';
import { formatMoney, formatQuantity } from '@/utils/decimal';
import {
  INVENTORY_TRANSACTION_TYPES,
  STOCK_STATUSES,
  documentPath,
  formatDateTime,
  humanise,
} from '@/utils/format';
import type { InventoryTransactionType, StockStatus } from '@/types/api';

/**
 * The append-only inventory ledger exactly as InventoryTransaction stores it. Every
 * row names the document that caused it, so stock is always traceable to a document.
 */
export function StockLedgerPage() {
  const { data: products } = useProducts();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams({
    limit: 25,
  });

  const query = useQuery({
    queryKey: ['inventory', 'ledger', params],
    queryFn: () =>
      inventoryApi.ledger({
        ...params,
        stockStatus: params.stockStatus as StockStatus | undefined,
        transactionType: params.transactionType as InventoryTransactionType | undefined,
      }),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader
        title="Stock Ledger"
        subtitle="Every stock movement, in order, with the document that created it"
      />

      {/* The ledger endpoint filters by branch, product, status, type and date;
          it has no free-text search, so the bar does not offer one. */}
      <FilterBar
        onReset={reset}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
      >
        <BranchFilter value={params.branchId} onChange={(value) => setFilter('branchId', value)} />
        <SelectFilter
          label="Product"
          value={params.productId}
          onChange={(value) => setFilter('productId', value)}
          options={(products ?? []).map((product) => ({ value: product.id, label: product.name }))}
          width={240}
        />
        <EnumFilter
          label="Stock status"
          value={params.stockStatus}
          values={STOCK_STATUSES}
          onChange={(value) => setFilter('stockStatus', value)}
        />
        <EnumFilter
          label="Movement type"
          value={params.transactionType}
          values={INVENTORY_TRANSACTION_TYPES}
          onChange={(value) => setFilter('transactionType', value)}
        />
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
        Stock on hand is the sum of these movements. A positive quantity adds stock to the bucket, a
        negative quantity removes it.
      </Alert>

      <DataTable
        rows={query.data?.data}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        meta={query.data?.meta}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        emptyDescription="No stock movements match the current filters."
        columns={[
          {
            key: 'date',
            header: 'Date / time',
            render: (row) => formatDateTime(row.transactionDate),
          },
          {
            key: 'document',
            header: 'Document',
            render: (row) =>
              row.document ? (
                <MuiLink
                  component={RouterLink}
                  to={documentPath(row.document.documentType, row.document.id)}
                  underline="hover"
                  fontWeight={600}
                >
                  {row.document.documentNumber}
                </MuiLink>
              ) : (
                '—'
              ),
          },
          {
            key: 'type',
            header: 'Movement',
            render: (row) => humanise(row.transactionType),
          },
          { key: 'branch', header: 'Branch', render: (row) => row.branch?.name ?? '—' },
          {
            key: 'product',
            header: 'Product',
            render: (row) => row.product?.name ?? '—',
          },
          {
            key: 'batch',
            header: 'Batch',
            render: (row) => row.batch?.batchNumber ?? '—',
            hideOnSmall: true,
          },
          {
            key: 'stockStatus',
            header: 'Stock status',
            render: (row) => <StockStatusChip status={row.stockStatus} />,
          },
          {
            key: 'quantity',
            header: 'Quantity',
            align: 'right',
            render: (row) => {
              const inbound = !row.quantity.startsWith('-');
              return (
                <Typography
                  variant="body2"
                  fontWeight={700}
                  color={inbound ? 'success.main' : 'error.main'}
                >
                  {inbound ? '+' : ''}
                  {formatQuantity(row.quantity)}
                </Typography>
              );
            },
          },
          {
            key: 'value',
            header: 'Value',
            align: 'right',
            render: (row) => formatMoney(row.totalCost),
            hideOnSmall: true,
          },
          {
            key: 'user',
            header: 'User',
            render: (row) => row.createdBy?.name ?? '—',
            hideOnSmall: true,
          },
          {
            key: 'notes',
            header: 'Notes',
            render: (row) => row.notes ?? '—',
            hideOnSmall: true,
          },
        ]}
      />
    </>
  );
}
