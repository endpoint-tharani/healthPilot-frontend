import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Alert, Grid, Stack, TextField, Tooltip, Typography } from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import { inventoryApi } from '@/api/endpoints';
import { useProducts } from '@/hooks/useReferenceData';
import { PageHeader } from '@/components/PageHeader';
import { DataTable } from '@/components/DataTable';
import { StatCard } from '@/components/StatCard';
import {
  BranchFilter,
  EnumFilter,
  FilterBar,
  SearchFilter,
  SelectFilter,
} from '@/components/filters';
import { StockStatusChip, ToneChip } from '@/components/StatusChip';
import { dec, formatMoney, formatQuantity, sumDecimals } from '@/utils/decimal';
import { STOCK_STATUSES, formatDate } from '@/utils/format';
import type { StockRow, StockStatus } from '@/types/api';

const PAGE_SIZE = 20;

/** Windows the page offers for "expiring soon"; the user picks which one applies. */
const EXPIRY_WINDOWS = [
  { value: 'expired', label: 'Already expired' },
  { value: '30', label: 'Expiring within 30 days' },
  { value: '60', label: 'Expiring within 60 days' },
  { value: '90', label: 'Expiring within 90 days' },
] as const;

type ExpiryState = 'none' | 'expired' | 'soon';

/** Days until a batch expires, or null when the row carries no expiry date. */
function daysToExpiry(row: StockRow): number | null {
  if (!row.batch?.expiryDate) {
    return null;
  }
  const expiry = new Date(row.batch.expiryDate);
  if (Number.isNaN(expiry.getTime())) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / 86_400_000);
}

function expiryState(days: number | null, window: number): ExpiryState {
  if (days === null) {
    return 'none';
  }
  if (days < 0) {
    return 'expired';
  }
  return days <= window ? 'soon' : 'none';
}

function StockTotals({ rows }: { rows: StockRow[] }) {
  const totals = useMemo(() => {
    const byStatus = new Map<StockStatus, string[]>();
    for (const row of rows) {
      const list = byStatus.get(row.stockStatus) ?? [];
      list.push(row.quantity);
      byStatus.set(row.stockStatus, list);
    }
    return {
      usable: sumDecimals(byStatus.get('USABLE') ?? []),
      damaged: sumDecimals(byStatus.get('DAMAGED') ?? []),
      blocked: sumDecimals([
        ...(byStatus.get('QUARANTINED') ?? []),
        ...(byStatus.get('EXPIRED') ?? []),
      ]),
      value: sumDecimals(rows.map((row) => row.stockValue)),
    };
  }, [rows]);

  return (
    <Grid container spacing={1.5} sx={{ mb: 2 }}>
      <Grid item xs={6} md={3}>
        <StatCard
          label="Usable units"
          value={formatQuantity(totals.usable)}
          caption="Available to transfer and dispense"
          tone="success"
          icon={<Inventory2OutlinedIcon fontSize="small" />}
        />
      </Grid>
      <Grid item xs={6} md={3}>
        <StatCard
          label="Damaged units"
          value={formatQuantity(totals.damaged)}
          caption="Held separately, never available"
          tone={totals.damaged.greaterThan(0) ? 'danger' : 'neutral'}
          icon={<ReportProblemOutlinedIcon fontSize="small" />}
        />
      </Grid>
      <Grid item xs={6} md={3}>
        <StatCard
          label="Quarantined / expired"
          value={formatQuantity(totals.blocked)}
          caption="Blocked from issue"
          tone={totals.blocked.greaterThan(0) ? 'warning' : 'neutral'}
          icon={<EventBusyOutlinedIcon fontSize="small" />}
        />
      </Grid>
      <Grid item xs={6} md={3}>
        <StatCard
          label="Stock value at cost"
          value={formatMoney(totals.value)}
          caption="Across every row shown"
          icon={<PaidOutlinedIcon fontSize="small" />}
        />
      </Grid>
    </Grid>
  );
}

/**
 * Stock on hand grouped by branch, product, batch and stock status - exactly the
 * grouping the backend derives from InventoryTransaction. The UI never maintains a
 * second stock calculation of its own; the expiry and threshold controls only
 * filter and highlight rows the backend already returned.
 */
export function StockOverviewPage() {
  const { data: products } = useProducts();
  const [searchParams] = useSearchParams();
  // Deep link from the branch menu in the top bar.
  const [branchId, setBranchId] = useState<string | undefined>(
    searchParams.get('branch') ?? undefined
  );
  const [productId, setProductId] = useState<string | undefined>();
  const [stockStatus, setStockStatus] = useState<string | undefined>();
  const [expiry, setExpiry] = useState<string | undefined>();
  const [threshold, setThreshold] = useState('');
  const [search, setSearch] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const query = useQuery({
    queryKey: ['inventory', 'stock', { branchId, productId, stockStatus }],
    queryFn: () =>
      inventoryApi.stock({
        branchId,
        productId,
        stockStatus: stockStatus as StockStatus | undefined,
      }),
  });

  /** The window used for the "expiring soon" highlight; 90 days unless narrowed. */
  const highlightWindow = expiry && expiry !== 'expired' ? Number(expiry) : 90;
  const thresholdValue = threshold.trim() === '' ? null : dec(threshold);

  const filtered = useMemo(() => {
    let rows = query.data ?? [];

    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((row) =>
        [row.product?.name, row.product?.code, row.batch?.batchNumber, row.branch?.name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle))
      );
    }

    if (expiry) {
      rows = rows.filter((row) => {
        const days = daysToExpiry(row);
        if (days === null) {
          return false;
        }
        return expiry === 'expired' ? days < 0 : days >= 0 && days <= Number(expiry);
      });
    }

    if (thresholdValue) {
      rows = rows.filter((row) => dec(row.quantity).lessThanOrEqualTo(thresholdValue));
    }

    return rows;
    // thresholdValue is derived from `threshold`, which is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, search, expiry, threshold]);

  // The stock endpoint answers with the full grouped position, so paging is applied here.
  const paged = filtered.slice((page - 1) * limit, page * limit);
  const meta = {
    page,
    limit,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / limit) || 0,
  };

  const activeFilters = [branchId, productId, stockStatus, search, expiry, threshold || undefined]
    .filter(Boolean).length;

  const onFilterChange = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Stock Overview"
        subtitle="Live position per branch, product, batch and stock status, taken from the inventory ledger"
      />

      <FilterBar
        onReset={() => {
          setBranchId(undefined);
          setProductId(undefined);
          setStockStatus(undefined);
          setExpiry(undefined);
          setThreshold('');
          setSearch(undefined);
          setPage(1);
        }}
        showReset={activeFilters > 0}
        activeCount={activeFilters}
        search={
          <SearchFilter
            value={search}
            onChange={onFilterChange(setSearch)}
            placeholder="Search product, batch or branch"
          />
        }
      >
        <BranchFilter value={branchId} onChange={onFilterChange(setBranchId)} />
        <SelectFilter
          label="Product"
          value={productId}
          onChange={onFilterChange(setProductId)}
          options={(products ?? []).map((product) => ({ value: product.id, label: product.name }))}
          width={220}
        />
        <EnumFilter
          label="Stock status"
          value={stockStatus}
          values={STOCK_STATUSES}
          onChange={onFilterChange(setStockStatus)}
        />
        <SelectFilter
          label="Expiry"
          value={expiry}
          onChange={onFilterChange(setExpiry)}
          allLabel="Any expiry"
          width={215}
          options={EXPIRY_WINDOWS.map((window) => ({
            value: window.value,
            label: window.label,
          }))}
        />
        <TextField
          label="At or below"
          value={threshold}
          onChange={(event) => {
            setThreshold(event.target.value);
            setPage(1);
          }}
          placeholder="units"
          helperText="Your own low-stock level"
          inputProps={{ inputMode: 'decimal' }}
          sx={{ width: { xs: '100%', md: 140 } }}
        />
      </FilterBar>

      {query.data ? <StockTotals rows={filtered} /> : null}

      <Alert severity="info" sx={{ mb: 2 }}>
        Damaged stock is held in its own bucket and is never counted as available for transfer or
        dispensing. Missing quantities create no stock at all, so they never appear here.
      </Alert>

      <DataTable
        rows={paged}
        rowKey={(row) => `${row.branch?.id}-${row.product?.id}-${row.batch?.id}-${row.stockStatus}`}
        isLoading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        meta={meta}
        onPageChange={setPage}
        onRowsPerPageChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        emptyTitle="No stock matches these filters"
        emptyDescription="Adjust the branch, product or expiry filters, or post a goods receipt to bring stock in."
        columns={[
          { key: 'branch', header: 'Branch', render: (row) => row.branch?.name ?? '—' },
          {
            key: 'product',
            header: 'Product',
            render: (row) => (
              <>
                <Typography variant="body2" fontWeight={600}>
                  {row.product?.name ?? '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.product?.code}
                </Typography>
              </>
            ),
          },
          { key: 'batch', header: 'Batch', render: (row) => row.batch?.batchNumber ?? '—' },
          {
            key: 'expiry',
            header: 'Expiry',
            render: (row) => {
              const days = daysToExpiry(row);
              const state = expiryState(days, highlightWindow);
              if (days === null) {
                return '—';
              }
              return (
                <Stack spacing={0.25}>
                  <Typography
                    variant="body2"
                    fontWeight={state === 'none' ? 400 : 700}
                    color={
                      state === 'expired'
                        ? 'error.main'
                        : state === 'soon'
                          ? 'warning.main'
                          : 'text.primary'
                    }
                  >
                    {formatDate(row.batch?.expiryDate ?? null)}
                  </Typography>
                  {state === 'expired' ? (
                    <Typography variant="caption" color="error.main">
                      Expired {Math.abs(days)} day{Math.abs(days) === 1 ? '' : 's'} ago
                    </Typography>
                  ) : state === 'soon' ? (
                    <Typography variant="caption" color="warning.main">
                      In {days} day{days === 1 ? '' : 's'}
                    </Typography>
                  ) : null}
                </Stack>
              );
            },
          },
          {
            key: 'stockStatus',
            header: 'Stock status',
            render: (row) => <StockStatusChip status={row.stockStatus} />,
          },
          {
            key: 'quantity',
            header: 'Quantity',
            numeric: true,
            render: (row) => {
              const low = thresholdValue
                ? dec(row.quantity).lessThanOrEqualTo(thresholdValue)
                : false;
              return (
                <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    color={
                      row.stockStatus === 'USABLE'
                        ? low
                          ? 'warning.main'
                          : 'success.main'
                        : row.stockStatus === 'DAMAGED'
                          ? 'error.main'
                          : 'text.primary'
                    }
                  >
                    {formatQuantity(row.quantity)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.product?.unit}
                  </Typography>
                </Stack>
              );
            },
          },
          {
            key: 'value',
            header: 'Value at cost',
            numeric: true,
            render: (row) => formatMoney(row.stockValue),
            hideOnSmall: true,
          },
          {
            key: 'availability',
            header: 'Availability',
            render: (row) => {
              const days = daysToExpiry(row);
              const state = expiryState(days, highlightWindow);

              if (row.stockStatus !== 'USABLE') {
                return (
                  <Tooltip title="Only usable stock can be transferred or dispensed">
                    <span>
                      <ToneChip tone="neutral" label="Not available" />
                    </span>
                  </Tooltip>
                );
              }
              if (state === 'expired') {
                return <ToneChip tone="danger" label="Expired batch" />;
              }
              if (state === 'soon') {
                return <ToneChip tone="warning" label="Expiring soon" />;
              }
              return <ToneChip tone="success" label="Available" />;
            },
            hideOnSmall: true,
          },
        ]}
      />
    </>
  );
}
