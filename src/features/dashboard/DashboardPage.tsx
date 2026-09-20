import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  Box,
  Button,
  Divider,
  Grid,
  Link as MuiLink,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { Link as RouterLink } from 'react-router-dom';
import { documentApi, inventoryApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { paletteTokens, type StatusTone } from '@/app/theme';
import { StatCard } from '@/components/StatCard';
import { DocumentStatusChip, DocumentTypeChip, StockStatusChip } from '@/components/StatusChip';
import { EmptyState, ErrorState } from '@/components/states';
import { dec, formatMoney, formatQuantity, sumDecimals } from '@/utils/decimal';
import { documentPath, formatDate, formatDateTime, humanise } from '@/utils/format';
import type {
  DocumentStatus,
  DocumentSummary,
  DocumentType,
  Paginated,
  Permission,
  StockRow,
} from '@/types/api';

/** Ranges map to a real `fromDate` filter on the document register. */
const RANGES = [
  { key: '24h', label: '24 hours', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '12m', label: '12 months', days: 365 },
] as const;

type RangeKey = (typeof RANGES)[number]['key'];

function fromDateFor(range: RangeKey): string {
  const days = RANGES.find((item) => item.key === range)?.days ?? 30;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

interface MetricDefinition {
  key: string;
  label: string;
  caption: string;
  to: string;
  documentType: DocumentType;
  statuses: DocumentStatus[];
  permission: Permission;
  tone: StatusTone;
  icon: React.ReactNode;
}

/**
 * Every tile is a real count from the document register, filtered by type, status
 * and the selected date range. Nothing on this page is estimated or hard-coded.
 */
const METRICS: MetricDefinition[] = [
  {
    key: 'requirements',
    label: 'Pending requisitions',
    caption: 'Submitted, awaiting approval',
    to: '/requirements?status=SUBMITTED',
    documentType: 'STOCK_REQUIREMENT',
    statuses: ['SUBMITTED'],
    permission: 'STOCK_REQUIREMENT_VIEW',
    tone: 'warning',
    icon: <ListAltOutlinedIcon fontSize="small" />,
  },
  {
    key: 'purchase-orders',
    label: 'Open purchase orders',
    caption: 'Raised but not yet closed',
    to: '/purchase-orders',
    documentType: 'PURCHASE_ORDER',
    statuses: ['DRAFT', 'SUBMITTED', 'APPROVED'],
    permission: 'PURCHASE_ORDER_VIEW',
    tone: 'info',
    icon: <ShoppingCartOutlinedIcon fontSize="small" />,
  },
  {
    key: 'receipts',
    label: 'Receipts to post',
    caption: 'Drafted — no stock moved yet',
    to: '/goods-receipts?status=DRAFT',
    documentType: 'GOODS_RECEIPT',
    statuses: ['DRAFT'],
    permission: 'GOODS_RECEIPT_VIEW',
    tone: 'warning',
    icon: <LocalShippingOutlinedIcon fontSize="small" />,
  },
  {
    key: 'invoices',
    label: 'Invoice disputes',
    caption: 'Carrying value the receipts rejected',
    to: '/supplier-invoices?status=DISCREPANT',
    documentType: 'SUPPLIER_INVOICE',
    statuses: ['DISCREPANT'],
    permission: 'SUPPLIER_INVOICE_VIEW',
    tone: 'danger',
    icon: <ReceiptLongOutlinedIcon fontSize="small" />,
  },
  {
    key: 'transfers',
    label: 'Pending transfers',
    caption: 'Created or dispatched, not received',
    to: '/stock-transfers',
    documentType: 'STOCK_TRANSFER',
    statuses: ['DRAFT', 'DISPATCHED'],
    permission: 'STOCK_TRANSFER_VIEW',
    tone: 'info',
    icon: <SwapHorizOutlinedIcon fontSize="small" />,
  },
  {
    key: 'requirements-open',
    label: 'In fulfilment',
    caption: 'Approved or partially fulfilled',
    to: '/requirements',
    documentType: 'STOCK_REQUIREMENT',
    statuses: ['APPROVED', 'PARTIALLY_FULFILLED'],
    permission: 'STOCK_REQUIREMENT_VIEW',
    tone: 'primary',
    icon: <PendingActionsOutlinedIcon fontSize="small" />,
  },
];

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

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        sx={{ px: 2.25, py: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2">{title}</Typography>
          {subtitle ? (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        {action}
      </Stack>
      <Divider />
      <Box sx={{ flex: 1, minWidth: 0 }}>{children}</Box>
    </Paper>
  );
}

/**
 * Stock worth looking at today: batches past their expiry date or close to it,
 * and stock held as damaged or quarantined. Every row is a real position from
 * `/inventory` - the only judgement the page makes is the 90-day window it
 * labels on screen.
 */
function StockAlerts({ rows, isLoading }: { rows: StockRow[]; isLoading: boolean }) {
  const alerts = useMemo(() => {
    const expired: StockRow[] = [];
    const expiring: StockRow[] = [];
    const blocked: StockRow[] = [];

    for (const row of rows) {
      if (!dec(row.quantity).greaterThan(0)) {
        continue;
      }
      if (row.stockStatus !== 'USABLE') {
        blocked.push(row);
        continue;
      }
      const days = daysToExpiry(row);
      if (days === null) {
        continue;
      }
      if (days < 0) {
        expired.push(row);
      } else if (days <= 90) {
        expiring.push(row);
      }
    }
    return { expired, expiring, blocked };
  }, [rows]);

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton height={26} />
        <Skeleton height={26} width="80%" />
        <Skeleton height={26} width="60%" />
      </Box>
    );
  }

  const groups = [
    {
      key: 'expired',
      label: 'Expired batches still on hand',
      rows: alerts.expired,
      tone: 'danger' as const,
      icon: <EventBusyOutlinedIcon fontSize="small" />,
    },
    {
      key: 'expiring',
      label: 'Usable stock expiring within 90 days',
      rows: alerts.expiring,
      tone: 'warning' as const,
      icon: <PendingActionsOutlinedIcon fontSize="small" />,
    },
    {
      key: 'blocked',
      label: 'Damaged or quarantined, never dispensable',
      rows: alerts.blocked,
      tone: 'danger' as const,
      icon: <ReportProblemOutlinedIcon fontSize="small" />,
    },
  ].filter((group) => group.rows.length > 0);

  if (groups.length === 0) {
    return (
      <EmptyState
        dense
        icon={<Inventory2OutlinedIcon sx={{ fontSize: 24 }} />}
        title="No stock alerts"
        description="Nothing on hand is expired, close to expiry, damaged or quarantined."
      />
    );
  }

  return (
    <Table size="small">
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group.key} hover>
            <TableCell sx={{ width: 34, color: `${group.tone === 'danger' ? 'error' : 'warning'}.main` }}>
              {group.icon}
            </TableCell>
            <TableCell>
              <Typography variant="body2" fontWeight={600}>
                {group.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {group.rows
                  .slice(0, 2)
                  .map((row) => `${row.product?.name ?? '—'}${row.batch ? ` · ${row.batch.batchNumber}` : ''}`)
                  .join(', ')}
                {group.rows.length > 2 ? ` and ${group.rows.length - 2} more` : ''}
              </Typography>
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
              <Typography
                variant="body2"
                fontWeight={800}
                color={group.tone === 'danger' ? 'error.main' : 'warning.main'}
              >
                {formatQuantity(sumDecimals(group.rows.map((row) => row.quantity)))}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {group.rows.length} batch{group.rows.length === 1 ? '' : 'es'}
              </Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function StockPosition({ rows, isLoading }: { rows: StockRow[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Skeleton height={26} />
        <Skeleton height={26} width="80%" />
        <Skeleton height={26} width="70%" />
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        dense
        title="No stock on hand"
        description="Post a goods receipt to bring stock into a branch."
      />
    );
  }

  const usable = rows.filter((row) => row.stockStatus === 'USABLE');
  const unusable = rows.filter((row) => row.stockStatus !== 'USABLE');

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Branch</TableCell>
          <TableCell>Product / batch</TableCell>
          <TableCell align="right">Quantity</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {usable.slice(0, 6).map((row) => (
          <TableRow key={`u-${row.branch?.id}-${row.batch?.id}`} hover>
            <TableCell sx={{ fontWeight: 600 }}>{row.branch?.name}</TableCell>
            <TableCell sx={{ color: 'text.secondary' }}>
              {row.product?.name}
              {row.batch ? ` · ${row.batch.batchNumber}` : ''}
            </TableCell>
            <TableCell
              align="right"
              sx={{ fontWeight: 700, color: 'success.main', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatQuantity(row.quantity)} {row.product?.unit}
            </TableCell>
          </TableRow>
        ))}
        {unusable.slice(0, 3).map((row) => (
          <TableRow key={`x-${row.branch?.id}-${row.batch?.id}-${row.stockStatus}`} hover>
            <TableCell sx={{ fontWeight: 600 }}>{row.branch?.name}</TableCell>
            <TableCell>
              <StockStatusChip status={row.stockStatus} />
            </TableCell>
            <TableCell
              align="right"
              sx={{ fontWeight: 700, color: 'error.main', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatQuantity(row.quantity)} {row.product?.unit}
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={2} sx={{ fontWeight: 700, border: 0 }}>
            Stock value at cost
          </TableCell>
          <TableCell
            align="right"
            sx={{ fontWeight: 800, border: 0, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMoney(sumDecimals(rows.map((row) => row.stockValue)))}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function DashboardPage() {
  const { user, can } = useAuth();
  const theme = useTheme();
  const tokens = paletteTokens(theme.palette.mode as 'light' | 'dark');
  const [range, setRange] = useState<RangeKey>('30d');
  const fromDate = useMemo(() => fromDateFor(range), [range]);

  const visibleMetrics = METRICS.filter((metric) => can(metric.permission));

  const metricQueries = useQueries({
    queries: visibleMetrics.map((metric) => ({
      queryKey: ['dashboard', 'metric', metric.key, range],
      queryFn: async () => {
        const result: Paginated<DocumentSummary> = await documentApi.list({
          documentType: metric.documentType,
          status: metric.statuses.join(','),
          fromDate,
          limit: 1,
        });
        return result.meta.total;
      },
    })),
  });

  const stock = useQuery({
    queryKey: ['inventory', 'stock', {}],
    queryFn: () => inventoryApi.stock({}),
    enabled: can('INVENTORY_VIEW'),
  });

  const recentDocuments = useQuery({
    queryKey: ['dashboard', 'recent-documents', range],
    queryFn: () => documentApi.list({ limit: 8, fromDate, sortBy: 'createdAt', sortOrder: 'desc' }),
    enabled: can('DOCUMENT_VIEW'),
  });

  const recentMovements = useQuery({
    queryKey: ['dashboard', 'recent-movements', range],
    queryFn: () => inventoryApi.ledger({ limit: 8, fromDate, sortOrder: 'desc' }),
    enabled: can('INVENTORY_VIEW'),
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, mb: 2.5 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
        >
          <Box>
            <Typography variant="h5" component="h1">
              {greeting}, {user?.name?.split(' ')[0] ?? 'there'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
              {user?.scopeType === 'ALL_BRANCHES'
                ? 'Company-wide operations across every branch'
                : `Scoped to ${user?.branch?.name ?? 'your assigned branches'}`}
              {' · '}
              {formatDate(new Date().toISOString())}
            </Typography>
          </Box>

          <ToggleButtonGroup
            exclusive
            size="small"
            value={range}
            onChange={(_event, value) => value && setRange(value as RangeKey)}
            aria-label="Reporting period"
            sx={{
              bgcolor: tokens.tableHead,
              p: 0.5,
              borderRadius: 2,
              '& .MuiToggleButton-root': {
                border: 0,
                borderRadius: '6px !important',
                px: 1.75,
                py: 0.5,
                color: 'text.secondary',
                fontWeight: 600,
              },
              '& .Mui-selected': {
                bgcolor: 'background.paper',
                color: 'text.primary',
                boxShadow: '0 1px 2px rgba(15,31,51,0.12)',
              },
            }}
          >
            {RANGES.map((item) => (
              <ToggleButton key={item.key} value={item.key}>
                {item.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>
      </Paper>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        {visibleMetrics.map((metric, index) => (
          <Grid item xs={6} sm={4} lg={2} key={metric.key}>
            <StatCard
              label={metric.label}
              caption={metric.caption}
              to={metric.to}
              tone={metricQueries[index]?.data ? metric.tone : 'neutral'}
              icon={metric.icon}
              loading={metricQueries[index]?.isLoading ?? false}
              value={metricQueries[index]?.data ?? 0}
            />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2.5} alignItems="stretch">
        {can('INVENTORY_VIEW') ? (
          <Grid item xs={12} lg={6}>
            <Panel
              title="Stock alerts"
              subtitle="Batches that need attention before they cost money"
              action={
                <Button component={RouterLink} to="/inventory" size="small" variant="outlined">
                  Stock overview
                </Button>
              }
            >
              {stock.isError ? (
                <Box sx={{ px: 2 }}>
                  <ErrorState error={stock.error} onRetry={() => void stock.refetch()} />
                </Box>
              ) : (
                <StockAlerts rows={stock.data ?? []} isLoading={stock.isLoading} />
              )}
            </Panel>
          </Grid>
        ) : null}

        {can('DOCUMENT_VIEW') ? (
          <Grid item xs={12} lg={6}>
            <Panel
              title="Recent documents"
              subtitle="Latest activity in your scope"
              action={
                <Button component={RouterLink} to="/documents" size="small" variant="outlined">
                  Document register
                </Button>
              }
            >
              {recentDocuments.isError ? (
                <Box sx={{ px: 2 }}>
                  <ErrorState
                    error={recentDocuments.error}
                    onRetry={() => void recentDocuments.refetch()}
                  />
                </Box>
              ) : recentDocuments.isLoading ? (
                <Box sx={{ p: 2 }}>
                  <Skeleton height={26} />
                  <Skeleton height={26} width="85%" />
                  <Skeleton height={26} width="70%" />
                </Box>
              ) : (recentDocuments.data?.data.length ?? 0) === 0 ? (
                <EmptyState dense title="No documents in this period" />
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Document</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Created</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentDocuments.data?.data.map((document) => (
                      <TableRow key={document.id} hover>
                        <TableCell>
                          <MuiLink
                            component={RouterLink}
                            to={documentPath(document.documentType, document.id)}
                            fontWeight={700}
                          >
                            {document.documentNumber}
                          </MuiLink>
                        </TableCell>
                        <TableCell>
                          <DocumentTypeChip documentType={document.documentType} />
                        </TableCell>
                        <TableCell>
                          <DocumentStatusChip status={document.status} />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(document.createdAt)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
          </Grid>
        ) : null}

        {can('INVENTORY_VIEW') ? (
          <>
            <Grid item xs={12} lg={5}>
              <Panel title="Stock position" subtitle="Largest positions on hand">
                {stock.isError ? null : (
                  <StockPosition rows={stock.data ?? []} isLoading={stock.isLoading} />
                )}
              </Panel>
            </Grid>

            <Grid item xs={12} lg={7}>
              <Panel
                title="Recent stock movements"
                subtitle="Latest rows in the append-only ledger"
                action={
                  <Button
                    component={RouterLink}
                    to="/inventory/ledger"
                    size="small"
                    variant="outlined"
                  >
                    Stock ledger
                  </Button>
                }
              >
                {recentMovements.isError ? (
                  <Box sx={{ px: 2 }}>
                    <ErrorState
                      error={recentMovements.error}
                      onRetry={() => void recentMovements.refetch()}
                    />
                  </Box>
                ) : recentMovements.isLoading ? (
                  <Box sx={{ p: 2 }}>
                    <Skeleton height={26} />
                    <Skeleton height={26} width="80%" />
                  </Box>
                ) : (recentMovements.data?.data.length ?? 0) === 0 ? (
                  <EmptyState dense title="No stock movements in this period" />
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Movement</TableCell>
                          <TableCell>Branch</TableCell>
                          <TableCell>Product</TableCell>
                          <TableCell>Stock status</TableCell>
                          <TableCell align="right">Quantity</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {recentMovements.data?.data.map((movement) => {
                          const inbound = !movement.quantity.startsWith('-');
                          return (
                            <TableRow key={movement.id} hover>
                              <TableCell>
                                <Stack spacing={0.25}>
                                  <Typography variant="body2" fontWeight={600}>
                                    {humanise(movement.transactionType)}
                                  </Typography>
                                  {movement.document ? (
                                    <MuiLink
                                      component={RouterLink}
                                      to={documentPath(
                                        movement.document.documentType,
                                        movement.document.id
                                      )}
                                      variant="caption"
                                    >
                                      {movement.document.documentNumber}
                                    </MuiLink>
                                  ) : null}
                                </Stack>
                              </TableCell>
                              <TableCell>{movement.branch?.name ?? '—'}</TableCell>
                              <TableCell>{movement.product?.name ?? '—'}</TableCell>
                              <TableCell>
                                <StockStatusChip status={movement.stockStatus} />
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 800,
                                  fontVariantNumeric: 'tabular-nums',
                                  color: inbound ? 'success.main' : 'error.main',
                                }}
                              >
                                {inbound ? '+' : ''}
                                {formatQuantity(dec(movement.quantity))}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </Panel>
            </Grid>
          </>
        ) : null}
      </Grid>
    </>
  );
}
