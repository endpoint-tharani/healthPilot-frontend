import { useQuery } from '@tanstack/react-query';
import { Button, Link as MuiLink, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { paymentApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useSuppliers } from '@/hooks/useReferenceData';
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
import { formatMoney } from '@/utils/decimal';
import { PAYMENT_METHODS, formatDate, humanise } from '@/utils/format';
import type { PaymentMethod } from '@/types/api';

export function PaymentListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: suppliers } = useSuppliers();
  const { params, setPage, setLimit, setFilter, reset, activeFilterCount } = useListParams();

  const query = useQuery({
    queryKey: ['payments', params],
    queryFn: () =>
      paymentApi.list({
        ...params,
        method: params.method as PaymentMethod | undefined,
      }),
    placeholderData: (previous) => previous,
  });

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Supplier payments and their allocation against invoices"
        actions={
          can('PAYMENT_CREATE') ? (
            <Button
              component={RouterLink}
              to="/payments/new"
              variant="contained"
              startIcon={<AddIcon />}
              size="small"
            >
              New Payment
            </Button>
          ) : null
        }
      />

      <FilterBar
        onReset={reset}
        showReset={activeFilterCount > 0}
        activeCount={activeFilterCount}
        search={
          <SearchFilter
            value={params.search}
            onChange={(value) => setFilter('search', value)}
            placeholder="Search payment number or reference"
          />
        }
      >
        <SelectFilter
          label="Supplier"
          value={params.supplierId}
          onChange={(value) => setFilter('supplierId', value)}
          options={(suppliers ?? []).map((supplier) => ({
            value: supplier.id,
            label: supplier.name,
          }))}
        />
        <EnumFilter
          label="Method"
          value={params.method}
          values={PAYMENT_METHODS}
          onChange={(value) => setFilter('method', value)}
          width={150}
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
        rows={query.data?.data}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRowClick={(row) => navigate(`/payments/${row.id}`)}
        meta={query.data?.meta}
        onPageChange={setPage}
        onRowsPerPageChange={setLimit}
        emptyDescription="Payments recorded against supplier invoices appear here. Dispensing payments are created automatically."
        columns={[
          {
            key: 'paymentNumber',
            header: 'Payment',
            render: (row) => (
              <MuiLink
                component={RouterLink}
                to={`/payments/${row.id}`}
                variant="body2"
                fontWeight={700}
                onClick={(event) => event.stopPropagation()}
              >
                {row.paymentNumber}
              </MuiLink>
            ),
          },
          {
            key: 'supplier',
            header: 'Supplier',
            render: (row) => row.supplier?.name ?? 'Patient / counter sale',
          },
          { key: 'branch', header: 'Branch', render: (row) => row.branch?.name ?? '—' },
          { key: 'date', header: 'Date', render: (row) => formatDate(row.paymentDate) },
          { key: 'method', header: 'Method', render: (row) => humanise(row.method) },
          {
            key: 'reference',
            header: 'Reference',
            render: (row) => row.reference ?? '—',
            hideOnSmall: true,
          },
          {
            key: 'amount',
            header: 'Amount',
            numeric: true,
            render: (row) => (
              <Typography variant="body2" fontWeight={600}>
                {formatMoney(row.amount)}
              </Typography>
            ),
          },
          {
            key: 'allocated',
            header: 'Allocated',
            numeric: true,
            render: (row) => formatMoney(row.allocatedAmount),
            hideOnSmall: true,
          },
          {
            key: 'unallocated',
            header: 'Unallocated',
            numeric: true,
            render: (row) => (
              <Typography
                variant="body2"
                fontWeight={row.unallocatedAmount === '0.00' ? 400 : 700}
                color={row.unallocatedAmount === '0.00' ? 'text.secondary' : 'warning.main'}
              >
                {formatMoney(row.unallocatedAmount)}
              </Typography>
            ),
          },
        ]}
      />
    </>
  );
}
