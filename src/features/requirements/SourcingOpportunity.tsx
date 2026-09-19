import { Alert, AlertTitle, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { dec, formatQuantity } from '@/utils/decimal';
import type {
  RequirementAvailability,
  RequirementSourcingAnalysis,
  SourcingProductLine,
  SurplusStatus,
} from '@/types/api';

/**
 * The procurement guardrail: before anybody raises a purchase order, whether the
 * company could have covered the shortfall from its own shelves.
 *
 * It states a position and offers a way to look at it. It never blocks the
 * purchase order, never raises a transfer and never picks a branch - the user
 * decides, and every figure shown here is one the backend calculated.
 *
 * "Sourceable surplus" is deliberately not "stock on hand": it is what a branch
 * could genuinely spare once the transfers already promised out of its shelves
 * and its own approved requirements are taken off. That distinction is the whole
 * point of the panel, so the wording keeps saying it.
 */

/** One branch's spare stock, as the backend reported it. */
export interface SurplusSource {
  branchId: string;
  branchName: string;
  surplusQty: string;
}

export interface SourcingOpportunity {
  status: SurplusStatus;
  /** What the requirement still needs from anywhere. */
  remainingQty: string;
  /** What internal surplus could cover of that. */
  suggestedInternalQty: string;
  /** What only a supplier can cover. */
  suggestedProcurementQty: string;
  /** Named branches, empty when the caller may not see where the stock is. */
  sources: SurplusSource[];
  /** Spare stock counted in the total but held at branches the caller cannot see. */
  withheldQty: string;
  withheldBranchCount: number;
}

const HEADING: Record<SurplusStatus, string> = {
  HIGH_SURPLUS: 'Internal stock opportunity',
  PARTIAL_SURPLUS: 'Partial internal stock available',
  NO_SURPLUS: 'No sourceable internal surplus',
};

/** Neutral for the no-surplus case: needing a supplier is normal, not a fault. */
const SEVERITY = {
  HIGH_SURPLUS: 'success',
  PARTIAL_SURPLUS: 'info',
  NO_SURPLUS: 'info',
} as const;

/** "Branch B 50, Branch C 10" - facts in branch-name order, never ranked. */
function SourceList({ sources, withheldQty, withheldBranchCount }: SourcingOpportunity) {
  const named = [...sources].sort((a, b) => a.branchName.localeCompare(b.branchName));

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {named.map((source) => (
        <Chip
          key={source.branchId}
          size="small"
          variant="outlined"
          icon={<WarehouseOutlinedIcon fontSize="small" />}
          label={`${source.branchName} — ${formatQuantity(source.surplusQty)} spare`}
        />
      ))}
      {withheldBranchCount > 0 ? (
        <Chip
          size="small"
          variant="outlined"
          label={`${formatQuantity(withheldQty)} at ${withheldBranchCount} branch(es) you cannot view`}
        />
      ) : null}
    </Stack>
  );
}

/** Requirement remaining / internal / procurement, in the order the business reads it. */
function Split({ opportunity }: { opportunity: SourcingOpportunity }) {
  return (
    <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
      <Figure label="Requirement remaining" value={opportunity.remainingQty} />
      <Figure label="Suggested internal" value={opportunity.suggestedInternalQty} />
      <Figure label="Supplier procurement needed" value={opportunity.suggestedProcurementQty} />
    </Stack>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="subtitle2">{formatQuantity(value)}</Typography>
    </Box>
  );
}

/**
 * The full-width banner at the top of the Internal sourcing section.
 *
 * `reviewHref` is omitted when the reader is already looking at the internal
 * sourcing detail; a button that scrolls to where they already are is noise.
 */
export function SourcingOpportunityBanner({
  opportunity,
  reviewHref,
}: {
  opportunity: SourcingOpportunity;
  reviewHref?: string;
}) {
  const { status, suggestedProcurementQty } = opportunity;

  if (status === 'NO_SURPLUS') {
    return (
      <Alert severity={SEVERITY.NO_SURPLUS} sx={{ mb: 2.5 }}>
        <AlertTitle sx={{ mb: 0.25 }}>{HEADING.NO_SURPLUS}</AlertTitle>
        <Typography variant="body2">
          No other branch holds usable stock it could spare for this requirement, so supplier
          procurement is required for the{' '}
          <strong>{formatQuantity(suggestedProcurementQty)}</strong> still outstanding.
        </Typography>
      </Alert>
    );
  }

  return (
    <Alert
      severity={SEVERITY[status]}
      icon={<WarehouseOutlinedIcon fontSize="inherit" />}
      sx={{ mb: 2.5 }}
      action={
        reviewHref ? (
          <Button component={RouterLink} to={reviewHref} size="small" color="inherit">
            Review internal stock
          </Button>
        ) : undefined
      }
    >
      <AlertTitle sx={{ mb: 0.25 }}>{HEADING[status]}</AlertTitle>
      <Typography variant="body2">
        {status === 'HIGH_SURPLUS'
          ? 'Internal stock could cover this requirement in full. An internal transfer is an alternative to buying it.'
          : 'Internal stock could cover part of this requirement. The rest needs a supplier.'}
      </Typography>
      <Split opportunity={opportunity} />
      <SourceList {...opportunity} />
    </Alert>
  );
}

/**
 * The compact version for the purchase order screen: context beside the form,
 * not a gate in front of it. The order can always be raised.
 */
export function SourcingContextPanel({
  opportunity,
  requirementNumber,
  reviewHref,
}: {
  opportunity: SourcingOpportunity;
  requirementNumber: string;
  reviewHref: string;
}) {
  const { status } = opportunity;
  const hasSurplus = status !== 'NO_SURPLUS';

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75,
        mb: 2,
        borderColor: hasSurplus ? 'primary.main' : 'divider',
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        fontWeight={700}
        sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 10.5 }}
      >
        Requirement sourcing
      </Typography>
      <Typography variant="subtitle2" sx={{ mt: 0.25 }}>
        {requirementNumber} · {formatQuantity(opportunity.remainingQty)} remaining
      </Typography>

      {hasSurplus ? (
        <>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {HEADING[status]}. Internal stock could cover{' '}
            <strong>{formatQuantity(opportunity.suggestedInternalQty)}</strong> of what is left, so
            this order is prepared for the{' '}
            <strong>{formatQuantity(opportunity.suggestedProcurementQty)}</strong> a supplier would
            need to fill. You can change any quantity below and continue with the order either way.
          </Typography>
          <SourceList {...opportunity} />
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            <Button
              component={RouterLink}
              to={reviewHref}
              size="small"
              variant="outlined"
              startIcon={<WarehouseOutlinedIcon />}
            >
              Review internal stock
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              Or carry on below to continue with the purchase order.
            </Typography>
          </Stack>
        </>
      ) : (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
          <ShoppingCartOutlinedIcon fontSize="small" color="disabled" />
          <Typography variant="body2" color="text.secondary">
            No sourceable internal surplus. Supplier procurement is required for the{' '}
            {formatQuantity(opportunity.suggestedProcurementQty)} outstanding.
          </Typography>
        </Stack>
      )}
    </Paper>
  );
}

/** True when there is a live decision to present: something is still owed. */
export function hasOpenSourcingDecision(opportunity: SourcingOpportunity | null): boolean {
  return Boolean(opportunity && dec(opportunity.remainingQty).greaterThan(0));
}

/* ------------------------------------------------------------- adapters ---- */

/**
 * Both sourcing endpoints answer the same question in slightly different shapes,
 * so the panel is fed through these rather than being taught two schemas. They
 * only regroup what the backend sent: no quantity is added up that the backend
 * did not already decide, beyond summing named branches for display.
 */

function collectSources(
  rows: { branchId: string; branchName: string; surplusQty: string }[]
): SurplusSource[] {
  const byBranch = new Map<string, SurplusSource>();
  for (const row of rows) {
    if (!dec(row.surplusQty).greaterThan(0)) {
      continue;
    }
    const existing = byBranch.get(row.branchId);
    byBranch.set(row.branchId, {
      branchId: row.branchId,
      branchName: row.branchName,
      surplusQty: dec(existing?.surplusQty ?? '0')
        .plus(dec(row.surplusQty))
        .toFixed(2),
    });
  }
  return [...byBranch.values()];
}

/** From the full sourcing analysis, aggregated across the requirement's lines. */
export function opportunityFromAnalysis(
  analysis: RequirementSourcingAnalysis
): SourcingOpportunity {
  return {
    status: analysis.surplusStatus,
    remainingQty: analysis.totals.outstanding,
    suggestedInternalQty: analysis.totals.suggestedInternalQty,
    suggestedProcurementQty: analysis.totals.suggestedProcurementQty,
    sources: collectSources(
      analysis.productLines.flatMap((line) =>
        line.internal.sources.map((branch) => ({
          branchId: branch.branchId,
          branchName: branch.branchName,
          surplusQty: branch.sourceableSurplusQty,
        }))
      )
    ),
    withheldQty: analysis.productLines
      .reduce((acc, line) => acc.plus(dec(line.internal.withheldQty)), dec(0))
      .toFixed(2),
    withheldBranchCount: analysis.productLines.reduce(
      (acc, line) => Math.max(acc, line.internal.withheldBranchCount),
      0
    ),
  };
}

/**
 * From the cheaper availability read, which the purchase order screen already
 * makes for its own fulfilment figures - so the guardrail costs it no extra call.
 */
export function opportunityFromAvailability(
  availability: RequirementAvailability
): SourcingOpportunity {
  return {
    status: availability.surplusStatus,
    remainingQty: availability.totals.outstanding,
    suggestedInternalQty: availability.totals.suggestedInternalQty,
    suggestedProcurementQty: availability.totals.suggestedProcurementQty,
    sources: collectSources(
      availability.lines.flatMap((line) =>
        line.sources.map((source) => ({
          branchId: source.branch.id,
          branchName: source.branch.name,
          surplusQty: source.surplus,
        }))
      )
    ),
    withheldQty: availability.lines
      .reduce((acc, line) => acc.plus(dec(line.withheldQuantity)), dec(0))
      .toFixed(2),
    withheldBranchCount: availability.lines.reduce(
      (acc, line) => Math.max(acc, line.withheldBranchCount),
      0
    ),
  };
}

/** One requirement line's own position, for the per-product sourcing block. */
export function opportunityFromLine(line: SourcingProductLine): SourcingOpportunity {
  return {
    status: line.internal.surplusStatus,
    remainingQty: line.remainingQty,
    suggestedInternalQty: line.internal.suggestedInternalQty,
    suggestedProcurementQty: line.internal.suggestedProcurementQty,
    sources: collectSources(
      line.internal.sources.map((branch) => ({
        branchId: branch.branchId,
        branchName: branch.branchName,
        surplusQty: branch.sourceableSurplusQty,
      }))
    ),
    withheldQty: line.internal.withheldQty,
    withheldBranchCount: line.internal.withheldBranchCount,
  };
}
