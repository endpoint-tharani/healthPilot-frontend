import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requirementApi, stockTransferApi } from '@/api/endpoints';
import { StatCard } from '@/components/StatCard';
import { useToast } from '@/components/Toast';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { dec, formatMoney, formatQuantity } from '@/utils/decimal';
import { formatDate } from '@/utils/format';
import {
  SourcingOpportunityBanner,
  opportunityFromAnalysis,
  opportunityFromLine,
} from './SourcingOpportunity';
import type {
  DocumentDetail,
  RequirementSourcingAnalysis,
  SourcingBranch,
  SourcingProductLine,
  SupplierOption,
} from '@/types/api';

/**
 * How this requirement could be sourced: what the company already holds
 * elsewhere, and what the rest would cost from each supplier.
 *
 * Every figure is the backend answer, rendered. The page works out no
 * availability, no shortfall and no allocation of its own, and it ranks no
 * supplier - the rows are laid side by side so a buyer can decide, which is a
 * judgement the ERP has no business making.
 *
 * Opening this panel reserves nothing. Two people can be shown the same 40 vials,
 * and the transfer that reaches the ledger first wins; the backend re-checks
 * under lock and refuses the loser, which is what the stale-plan path reports.
 *
 * Two quantities are kept apart throughout, because conflating them is what makes
 * internal sourcing dangerous. AVAILABLE is what is on the shelf once other
 * transfers have taken their share; SURPLUS is what that branch could genuinely
 * spare once its own approved requirements are met. The proposal only ever draws
 * on surplus, and the surplus column is shown beside the available one so the
 * difference is visible rather than implied.
 */

/** One chosen source and the quantity the user wants from it. */
interface Selection {
  productId: string;
  batchId: string;
  branchId: string;
  quantity: string;
}

function selectionKey(productId: string, branchId: string, batchId: string): string {
  return `${productId}:${branchId}:${batchId}`;
}

export function InternalSourcing({
  detail,
  canCreateTransfer,
}: {
  detail: DocumentDetail;
  /** The caller's own permission; the backend still decides for itself. */
  canCreateTransfer: boolean;
}) {
  const query = useQuery({
    queryKey: ['stock-requirements', detail.id, 'sourcing-analysis'],
    queryFn: () => requirementApi.sourcingAnalysis(detail.id),
    // A sourcing answer goes stale as soon as another branch moves stock, so it
    // is never served from cache on a revisit.
    staleTime: 0,
  });

  if (query.isLoading) {
    return <LoadingState label="Checking stock across your branches…" />;
  }
  if (query.error) {
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (!query.data) {
    return null;
  }

  return (
    <SourcingPlan
      // Remounting on a changed proposal is what keeps the editable plan honest:
      // edits survive ordinary re-renders, but once the real position moves the
      // plan is reseeded from the new answer rather than left describing the old.
      key={proposalSignature(query.data)}
      requirementId={detail.id}
      analysis={query.data}
      canCreateTransfer={canCreateTransfer && query.data.canCreateTransfer}
      onRefresh={() => void query.refetch()}
    />
  );
}

/** Changes exactly when the sourcing answer changes, and not on every refetch. */
function proposalSignature(analysis: RequirementSourcingAnalysis): string {
  return analysis.productLines
    .map(
      (line) =>
        `${line.product.id}@${line.remainingQty}:` +
        line.internal.sources
          .flatMap((branch) =>
            branch.batches.map(
              (batch) =>
                `${branch.branchId}/${batch.batchId}/${batch.availableQty}/` +
                `${batch.surplusQty}/${batch.suggestedQty}`
            )
          )
          .join(',')
    )
    .join('|');
}

function SourcingPlan({
  requirementId,
  analysis,
  canCreateTransfer,
  onRefresh,
}: {
  requirementId: string;
  analysis: RequirementSourcingAnalysis;
  canCreateTransfer: boolean;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // Seeded from the backend's own proposal, so the plan on screen starts as the
  // plan it described, and every later edit is the user's.
  const [selected, setSelected] = useState<Map<string, Selection>>(() => {
    const initial = new Map<string, Selection>();
    for (const line of analysis.productLines) {
      for (const branch of line.internal.sources) {
        for (const batch of branch.batches) {
          if (dec(batch.suggestedQty).greaterThan(0)) {
            initial.set(selectionKey(line.product.id, branch.branchId, batch.batchId), {
              productId: line.product.id,
              branchId: branch.branchId,
              batchId: batch.batchId,
              quantity: batch.suggestedQty,
            });
          }
        }
      }
    }
    return initial;
  });

  const totals = analysis.totals;
  const hasInternal = dec(totals.internalAvailable).greaterThan(0);
  const outstanding = dec(totals.outstanding);

  const chosen = useMemo(() => [...selected.values()], [selected]);
  const chosenTotal = useMemo(
    () => chosen.reduce((acc, item) => acc.plus(dec(item.quantity || '0')), dec(0)),
    [chosen]
  );

  /**
   * A transfer moves stock out of exactly one branch, so a plan drawing on two
   * branches is two transfers. They are raised one after another and each is
   * validated on its own, which is also why a failure part-way leaves the earlier
   * transfers standing rather than silently rolling them back.
   */
  const byBranch = useMemo(() => {
    const groups = new Map<string, Selection[]>();
    for (const item of chosen) {
      if (!dec(item.quantity || '0').greaterThan(0)) {
        continue;
      }
      groups.set(item.branchId, [...(groups.get(item.branchId) ?? []), item]);
    }
    return groups;
  }, [chosen]);

  const destinationBranchId = analysis.requirement.branch?.id ?? '';

  const mutation = useMutation({
    mutationFn: async () => {
      const created: string[] = [];
      for (const [sourceBranchId, items] of byBranch) {
        const document = await stockTransferApi.create({
          sourceBranchId,
          destinationBranchId,
          requirementId,
          notes: `Internal sourcing for ${analysis.requirement.documentNumber}`,
          lines: items.map((item) => ({
            productId: item.productId,
            batchId: item.batchId,
            quantity: item.quantity,
          })),
        });
        created.push(document.id);
      }
      return created;
    },
    onSuccess: (created) => {
      for (const key of [
        ['stock-requirements'],
        ['stock-transfers'],
        ['documents'],
        ['inventory'],
        ['action-queue'],
      ]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      toast.success(
        created.length === 1
          ? 'Stock transfer raised. Dispatch it to move the stock.'
          : `${created.length} stock transfers raised, one per source branch.`
      );
      if (created.length === 1) {
        navigate(`/stock-transfers/${created[0]}`);
      } else {
        onRefresh();
      }
    },
    onError: (error) => {
      // The commonest failure here is a real one: somebody else took the stock
      // between the screen being drawn and this click. Re-reading is the fix.
      toast.fromError(error, 'Unable to raise this transfer');
      onRefresh();
    },
  });

  const showSearch =
    analysis.productLines.length > 1 ||
    analysis.productLines.some((line) => line.internal.sources.length > 2);

  return (
    <Box>
      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Requested"
            value={formatQuantity(totals.requested)}
            caption={`${formatQuantity(totals.fulfilled)} received so far`}
            icon={<Inventory2OutlinedIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Still outstanding"
            value={formatQuantity(totals.outstanding)}
            caption="Not yet received or committed"
            tone={outstanding.greaterThan(0) ? 'warning' : 'success'}
            icon={<Inventory2OutlinedIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Sourceable surplus"
            value={formatQuantity(totals.internalAvailable)}
            caption={
              dec(totals.reservedBySourceBranches).greaterThan(0)
                ? `Spare at other branches; ${formatQuantity(
                    totals.reservedBySourceBranches
                  )} held for their own requirements`
                : 'Spare usable stock at other branches'
            }
            tone={hasInternal ? 'success' : 'neutral'}
            icon={<WarehouseOutlinedIcon fontSize="small" />}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            label="Supplier needed"
            value={formatQuantity(totals.procurementShortfall)}
            caption={
              dec(totals.procurementShortfall).greaterThan(0)
                ? 'Only a purchase order can cover this'
                : 'Nothing needs procuring'
            }
            tone={dec(totals.procurementShortfall).greaterThan(0) ? 'warning' : 'success'}
            icon={<ShoppingCartOutlinedIcon fontSize="small" />}
          />
        </Grid>
      </Grid>

      {/* The guardrail, before any of the detail: could this have come from our
          own shelves? It suggests; nothing here blocks a purchase order. */}
      {outstanding.greaterThan(0) ? (
        <SourcingOpportunityBanner opportunity={opportunityFromAnalysis(analysis)} />
      ) : null}

      {analysis.detailRestricted ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Some of this stock is held at branches outside your access, so it is counted in the total
          but not listed. Central procurement can see where it is and raise the transfer.
        </Alert>
      ) : null}

      {outstanding.isZero() ? (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleOutlineIcon />}>
          Nothing is outstanding on this requisition, so there is nothing left to source.
        </Alert>
      ) : null}

      {showSearch ? (
        <TextField
          size="small"
          fullWidth
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by medicine, batch number or branch…"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2.5 }}
        />
      ) : null}

      {analysis.productLines.map((line) => (
        <ProductSourcing
          key={line.product.id}
          line={line}
          search={search}
          selected={selected}
          editable={canCreateTransfer}
          onChange={setSelected}
          requirementId={requirementId}
          canCreatePurchaseOrder={analysis.canCreatePurchaseOrder}
          showOwnOpportunity={analysis.productLines.length > 1}
        />
      ))}

      {canCreateTransfer && hasInternal && outstanding.greaterThan(0) ? (
        <Box sx={{ mt: 3 }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            Raising a transfer does not move stock. It records the allocation; the source branch
            dispatches it and the destination receives it, and only that receipt counts towards this
            requisition.
          </Alert>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Typography variant="body2" sx={{ flex: 1 }}>
              <strong>{formatQuantity(chosenTotal)}</strong> selected from{' '}
              <strong>{byBranch.size}</strong> branch(es).{' '}
              {byBranch.size > 1 ? 'One transfer will be raised per source branch.' : null}
            </Typography>
            <Button size="small" onClick={onRefresh} disabled={mutation.isPending}>
              Refresh availability
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<LocalShippingOutlinedIcon />}
              disabled={mutation.isPending || !chosenTotal.greaterThan(0) || !destinationBranchId}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending
                ? 'Raising…'
                : byBranch.size > 1
                  ? `Create ${byBranch.size} transfers`
                  : 'Create transfer'}
            </Button>
          </Stack>
        </Box>
      ) : null}

      {!canCreateTransfer && hasInternal ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          {formatQuantity(totals.internalAvailable)} units could be spared by other branches.
          Raising the transfer is done by central procurement.
        </Alert>
      ) : null}
    </Box>
  );
}

/** One requirement line: where it could come from, and what is left to buy. */
function ProductSourcing({
  line,
  search,
  selected,
  editable,
  onChange,
  requirementId,
  canCreatePurchaseOrder,
  showOwnOpportunity,
}: {
  line: SourcingProductLine;
  search: string;
  selected: Map<string, Selection>;
  editable: boolean;
  onChange: (update: (current: Map<string, Selection>) => Map<string, Selection>) => void;
  requirementId: string;
  canCreatePurchaseOrder: boolean;
  /**
   * The line's own surplus position. Suppressed on a single-product
   * requirement, where the banner at the top of the section is already saying
   * exactly this and repeating it teaches the reader to skip both.
   */
  showOwnOpportunity: boolean;
}) {
  const needle = search.trim().toLowerCase();
  const matchesProduct =
    !needle ||
    line.product.name.toLowerCase().includes(needle) ||
    line.product.code.toLowerCase().includes(needle);

  const branches = line.internal.sources
    .map((branch) => ({
      ...branch,
      batches: branch.batches.filter(
        (batch) =>
          matchesProduct ||
          batch.batchNumber.toLowerCase().includes(needle) ||
          branch.branchName.toLowerCase().includes(needle)
      ),
    }))
    .filter((branch) => branch.batches.length > 0);

  // A filter that matches nothing on this line hides the line rather than
  // leaving an empty heading behind.
  if (needle && !matchesProduct && branches.length === 0) {
    return null;
  }

  const summary = line.sourcingSummary;

  return (
    <Box sx={{ mb: 4.5 }}>
      <Typography variant="subtitle2">{line.product.name}</Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25 }}>
        {line.product.code} · {line.product.unit}
      </Typography>

      {/* The sourcing position in one row, in the order the business reads it. */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          variant="outlined"
          label={`Requested ${formatQuantity(line.requestedQty)}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={dec(line.fulfilledQty).greaterThan(0) ? 'success' : 'default'}
          label={`Fulfilled ${formatQuantity(line.fulfilledQty)}`}
        />
        {dec(summary.onTransferQty).greaterThan(0) ? (
          <Chip
            size="small"
            variant="outlined"
            label={`In transit ${formatQuantity(summary.onTransferQty)}`}
          />
        ) : null}
        {dec(summary.onOrderQty).greaterThan(0) ? (
          <Chip
            size="small"
            variant="outlined"
            label={`On order ${formatQuantity(summary.onOrderQty)}`}
          />
        ) : null}
        <Chip
          size="small"
          color={dec(line.remainingQty).greaterThan(0) ? 'warning' : 'success'}
          variant="outlined"
          label={`Remaining ${formatQuantity(line.remainingQty)}`}
        />
        <Chip
          size="small"
          variant="outlined"
          color={dec(line.internal.totalSurplusQty).greaterThan(0) ? 'success' : 'default'}
          label={`Sourceable surplus ${formatQuantity(line.internal.totalSurplusQty)}`}
        />
      </Stack>

      {/* Per line, because a requirement covering four products can be fully
          internal on one and entirely a supplier question on the next. */}
      {showOwnOpportunity && dec(line.remainingQty).greaterThan(0) ? (
        <SourcingOpportunityBanner opportunity={opportunityFromLine(line)} />
      ) : null}

      <Typography variant="overline" color="text.secondary">
        Internal stock
      </Typography>
      {line.internal.withheldBranchCount > 0 ? (
        <Alert severity="info" sx={{ my: 1 }}>
          {formatQuantity(line.internal.withheldQty)} units sit at{' '}
          {line.internal.withheldBranchCount} branch(es) you cannot view. They are counted in the
          total above but not listed here.
        </Alert>
      ) : null}

      {branches.length === 0 ? (
        <EmptyState
          title="No internal stock"
          description={
            dec(line.remainingQty).greaterThan(0)
              ? 'No other branch holds usable, unexpired stock of this product. It has to be procured from a supplier.'
              : 'Nothing is outstanding for this product.'
          }
        />
      ) : (
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          {branches.map((branch) => (
            <BranchSourceCard
              key={branch.branchId}
              productId={line.product.id}
              branch={branch}
              selected={selected}
              editable={editable && dec(line.remainingQty).greaterThan(0)}
              onChange={onChange}
            />
          ))}
        </Stack>
      )}

      <Box sx={{ mt: 3 }}>
        <Typography variant="overline" color="text.secondary">
          Supplier procurement
        </Typography>
        <SupplierComparison
          line={line}
          requirementId={requirementId}
          canCreatePurchaseOrder={canCreatePurchaseOrder}
        />
      </Box>
    </Box>
  );
}

/** One branch holding this product, and how much to take from each of its batches. */
function BranchSourceCard({
  productId,
  branch,
  selected,
  editable,
  onChange,
}: {
  productId: string;
  branch: SourcingBranch;
  selected: Map<string, Selection>;
  editable: boolean;
  onChange: (update: (current: Map<string, Selection>) => Map<string, Selection>) => void;
}) {
  const setQuantity = (batchId: string, quantity: string | null) => {
    const key = selectionKey(productId, branch.branchId, batchId);
    onChange((current) => {
      const next = new Map(current);
      if (quantity === null) {
        next.delete(key);
      } else {
        next.set(key, { productId, branchId: branch.branchId, batchId, quantity });
      }
      return next;
    });
  };

  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={0.5}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="body2" fontWeight={700}>
            {branch.branchName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {branch.branchCode} ·{' '}
            {branch.branchType === 'CENTRAL_WAREHOUSE' ? 'Central warehouse' : 'Branch'}
          </Typography>
        </Box>
        <Box sx={{ textAlign: { sm: 'right' } }}>
          <Typography variant="caption" color="text.secondary" display="block">
            {formatQuantity(branch.sourceableSurplusQty)} sourceable surplus of{' '}
            {formatQuantity(branch.totalAvailableQty)} available
          </Typography>
          {dec(branch.reservedQty).greaterThan(0) ? (
            <Typography variant="caption" color="text.secondary">
              {formatQuantity(branch.reservedQty)} held for this branch&apos;s own requirements
            </Typography>
          ) : null}
        </Box>
      </Stack>

      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {editable ? <TableCell sx={{ width: 44 }} padding="checkbox" /> : null}
              <TableCell sx={{ fontWeight: 600, minWidth: 150 }}>Batch</TableCell>
              <TableCell sx={{ fontWeight: 600, minWidth: 110 }}>Expiry</TableCell>
              <TableCell sx={{ fontWeight: 600, width: 110 }} align="right">
                Available
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 120 }} align="right">
                Sourceable surplus
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 110 }} align="right">
                Unit cost
              </TableCell>
              <TableCell sx={{ fontWeight: 600, width: 130 }} align="right">
                {editable ? 'Transfer qty' : 'Suggested'}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {branch.batches.map((batch) => {
              const key = selectionKey(productId, branch.branchId, batch.batchId);
              const selection = selected.get(key);
              const quantity = selection?.quantity ?? '';
              const exceeds = dec(quantity || '0').greaterThan(dec(batch.availableQty));
              // Above the surplus is a judgement, not an error: the stock is
              // there and the backend will allow it, but the holding branch is
              // then sending stock it may need itself, so it is said plainly.
              const aboveSurplus =
                !exceeds && dec(quantity || '0').greaterThan(dec(batch.surplusQty));

              return (
                <TableRow key={batch.batchId}>
                  {editable ? (
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={Boolean(selection)}
                        inputProps={{
                          'aria-label': `Source batch ${batch.batchNumber} from ${branch.branchName}`,
                        }}
                        onChange={(event) =>
                          setQuantity(
                            batch.batchId,
                            event.target.checked ? batch.suggestedQty : null
                          )
                        }
                      />
                    </TableCell>
                  ) : null}
                  <TableCell>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      alignItems="center"
                      flexWrap="wrap"
                      useFlexGap
                    >
                      <span>{batch.batchNumber}</span>
                      {/* Factual, not a rule: the user still chooses the batch. */}
                      {batch.expiresSoonest ? (
                        <Tooltip title="Earliest expiry offered for this product">
                          <Chip size="small" variant="outlined" label="Expires sooner" />
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>{formatDate(batch.expiryDate)}</TableCell>
                  <TableCell align="right">{formatQuantity(batch.availableQty)}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>
                      {formatQuantity(batch.surplusQty)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{formatMoney(batch.unitCost)}</TableCell>
                  <TableCell align="right">
                    {editable ? (
                      <TextField
                        size="small"
                        value={quantity}
                        disabled={!selection}
                        error={exceeds}
                        helperText={
                          exceeds
                            ? 'More than available'
                            : aboveSurplus
                              ? 'Beyond this branch\u2019s surplus'
                              : undefined
                        }
                        inputProps={{
                          inputMode: 'decimal',
                          'aria-label': `Quantity from ${branch.branchName}, batch ${batch.batchNumber}`,
                          style: { textAlign: 'right' },
                        }}
                        onChange={(event) => setQuantity(batch.batchId, event.target.value)}
                        sx={{ width: 110 }}
                      />
                    ) : (
                      formatQuantity(batch.suggestedQty)
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

type SupplierSortKey = 'supplierName' | 'unitPrice' | 'leadTimeDays' | 'estimatedTotal';

/**
 * What the shortfall would cost from each supplier.
 *
 * The default order is alphabetical, deliberately: any other default would be the
 * screen nominating a winner. The user may sort by price or by lead time, and the
 * trade-off between the two is theirs to weigh.
 */
function SupplierComparison({
  line,
  requirementId,
  canCreatePurchaseOrder,
}: {
  line: SourcingProductLine;
  requirementId: string;
  canCreatePurchaseOrder: boolean;
}) {
  const [sortBy, setSortBy] = useState<SupplierSortKey>('supplierName');
  const [ascending, setAscending] = useState(true);

  const suppliers = line.procurement.suppliers;

  const sorted = useMemo(() => {
    const rows = [...suppliers];
    rows.sort((a, b) => {
      if (sortBy === 'supplierName') {
        return a.supplierName.localeCompare(b.supplierName);
      }
      if (sortBy === 'leadTimeDays') {
        // Unknown lead time sorts last either way: it is missing information,
        // not a fast supplier and not a slow one.
        if (a.leadTimeDays === null) return 1;
        if (b.leadTimeDays === null) return -1;
        return a.leadTimeDays - b.leadTimeDays;
      }
      return Number(a[sortBy]) - Number(b[sortBy]);
    });
    return ascending ? rows : rows.reverse();
  }, [suppliers, sortBy, ascending]);

  if (dec(line.procurement.requiredQty).isZero()) {
    return (
      <Alert severity="success" sx={{ mt: 1 }}>
        Internal stock covers this line in full, so no purchase order is needed.
      </Alert>
    );
  }

  if (line.procurement.comparisonRestricted) {
    return (
      <Alert severity="info" sx={{ mt: 1 }}>
        {formatQuantity(line.procurement.requiredQty)} units cannot be covered internally and need a
        supplier. Prices and lead times are handled by central procurement.
      </Alert>
    );
  }

  const sortHeader = (key: SupplierSortKey, label: string, align: 'left' | 'right' = 'left') => (
    <TableCell
      sx={{ fontWeight: 600 }}
      align={align}
      sortDirection={sortBy === key ? (ascending ? 'asc' : 'desc') : false}
    >
      <TableSortLabel
        active={sortBy === key}
        direction={sortBy === key && !ascending ? 'desc' : 'asc'}
        onClick={() => {
          if (sortBy === key) {
            setAscending((current) => !current);
          } else {
            setSortBy(key);
            setAscending(true);
          }
        }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>
        <strong>{formatQuantity(line.procurement.requiredQty)}</strong> units need a supplier. Prices
        below are what each supplier last charged, or the product list price where they have not
        supplied this item before.
      </Typography>

      {suppliers.length === 0 ? (
        <EmptyState
          title="No suppliers on file"
          description="Add a supplier before raising a purchase order for this product."
        />
      ) : (
        <>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {sortHeader('supplierName', 'Supplier')}
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Qty
                  </TableCell>
                  {sortHeader('unitPrice', 'Unit price', 'right')}
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Tax
                  </TableCell>
                  {sortHeader('leadTimeDays', 'Lead time', 'right')}
                  {sortHeader('estimatedTotal', 'Estimated total', 'right')}
                </TableRow>
              </TableHead>
              <TableBody>
                {sorted.map((supplier) => (
                  <SupplierRow
                    key={supplier.supplierId}
                    supplier={supplier}
                    quantity={line.procurement.requiredQty}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            Lead time is the average gap between past orders to that supplier for this product and
            the goods actually arriving. The ERP does not know what any supplier currently holds in
            stock, and does not recommend one.
          </Typography>
        </>
      )}

      {canCreatePurchaseOrder ? (
        <Button
          component={RouterLink}
          to={`/purchase-orders/new?requirementId=${requirementId}`}
          size="small"
          variant="outlined"
          startIcon={<ShoppingCartOutlinedIcon />}
          sx={{ mt: 1.5 }}
        >
          Create purchase order
        </Button>
      ) : null}
    </Box>
  );
}

function SupplierRow({ supplier, quantity }: { supplier: SupplierOption; quantity: string }) {
  return (
    <TableRow>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          {supplier.supplierName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {supplier.supplierCode}
          {supplier.priceSource === 'LAST_PURCHASE' && supplier.lastPurchasedAt
            ? ` · last bought ${formatDate(supplier.lastPurchasedAt)}`
            : ' · not supplied before'}
        </Typography>
      </TableCell>
      <TableCell align="right">{formatQuantity(quantity)}</TableCell>
      <TableCell align="right">
        {formatMoney(supplier.unitPrice)}
        {supplier.priceSource === 'PRODUCT_MASTER' ? (
          <Typography variant="caption" color="text.secondary" display="block">
            list price
          </Typography>
        ) : null}
      </TableCell>
      <TableCell align="right">
        {supplier.taxRate}%
        <Typography variant="caption" color="text.secondary" display="block">
          {formatMoney(supplier.estimatedTax)}
        </Typography>
      </TableCell>
      <TableCell align="right">
        {supplier.leadTimeDays === null ? (
          <Typography variant="caption" color="text.secondary">
            No history
          </Typography>
        ) : (
          <>
            {supplier.leadTimeDays} day{supplier.leadTimeDays === 1 ? '' : 's'}
            <Typography variant="caption" color="text.secondary" display="block">
              over {supplier.leadTimeSampleSize} order{supplier.leadTimeSampleSize === 1 ? '' : 's'}
            </Typography>
          </>
        )}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight={700}>
          {formatMoney(supplier.estimatedTotal)}
        </Typography>
      </TableCell>
    </TableRow>
  );
}
