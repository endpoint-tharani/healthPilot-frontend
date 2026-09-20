import { useMemo } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { requirementApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useDocumentChain } from '@/hooks/useDocumentChain';
import { useToast } from '@/components/Toast';
import { WorkflowActionButton } from '@/components/WorkflowActionButton';
import { DocumentPageFrame } from '@/features/documents/DetailShell';
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace';
import { formatQuantity } from '@/utils/decimal';
import { formatDate, formatDateTime } from '@/utils/format';
import { useAuthoritativeFulfilment } from './useRequirementFulfilment';
import { FulfilmentProgress, FulfilmentStats, fulfilmentTotals } from './FulfilmentSummary';
import { RequirementItems } from './RequirementItems';
import { InternalSourcing } from './InternalSourcing';
import { opportunityFromAvailability } from './SourcingOpportunity';
import { ChainFinancialSummary, ChainPayments } from './FinancialSummary';

/** The tab another screen can deep-link to, e.g. "Review internal stock". */
const SOURCING_TAB = 'internal-sourcing';

export function RequirementDetailPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const { can } = useAuth();
  const toast = useToast();

  const query = useQuery({
    queryKey: ['stock-requirements', id],
    queryFn: () => requirementApi.get(id),
    enabled: Boolean(id),
  });

  const detail = query.data;
  const chain = useDocumentChain(detail);
  const invalidateKeys = [['stock-requirements'], ['documents'], ['action-queue']];

  // The backend owns fulfilment. These are the very figures it decided the status
  // from, so the progress bar and the status chip cannot tell different stories.
  const fulfilment = useAuthoritativeFulfilment(detail);
  const fulfilledByProduct = fulfilment.fulfilledByProduct;
  const totals = detail ? fulfilmentTotals(detail, fulfilledByProduct) : null;

  /** Batch each product actually arrived under, taken from the linked receipts. */
  const batchByProduct = useMemo(() => {
    const map = new Map<string, { batchNumber: string; expiryDate?: string }>();
    for (const receipt of chain.byType('GOODS_RECEIPT')) {
      for (const line of receipt.lineItems) {
        if (line.batch && !map.has(line.product.id)) {
          map.set(line.product.id, {
            batchNumber: line.batch.batchNumber,
            expiryDate: line.batch.expiryDate,
          });
        }
      }
    }
    return map;
    // byType is derived fresh each render; the documents array is the real input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.documents]);

  const isSourceable =
    detail !== undefined &&
    (detail.status === 'APPROVED' || detail.status === 'PARTIALLY_FULFILLED');
  const canOrder = can('PURCHASE_ORDER_CREATE') && isSourceable;
  const isFollowUp = detail?.status === 'PARTIALLY_FULFILLED';
  const remaining = totals?.remaining;

  /**
   * The procurement guardrail in one line, from the availability read this page
   * already makes. Shown only when internal stock could genuinely cover part of
   * what is left; the full picture, and the transfer itself, live in the
   * Internal sourcing tab.
   */
  const opportunity = fulfilment.availability
    ? opportunityFromAvailability(fulfilment.availability)
    : null;
  const sourcingHint =
    opportunity && opportunity.status !== 'NO_SURPLUS' && isSourceable ? opportunity : null;

  // Sourcing is only a question while the requirement is still owed stock. The
  // tab is offered to anyone who may read the requirement, because knowing that
  // internal stock exists is useful even to someone who cannot raise the
  // transfer - the backend decides how much of the detail they actually see.
  const sourcingTabs = detail && isSourceable
    ? [
        {
          key: SOURCING_TAB,
          label: 'Internal sourcing',
          content: (
            <InternalSourcing
              detail={detail}
              canCreateTransfer={can('STOCK_TRANSFER_CREATE')}
            />
          ),
        },
      ]
    : [];

  const actions = detail ? (
    <>
      <WorkflowActionButton
        label="Submit"
        permitted={can('STOCK_REQUIREMENT_CREATE')}
        enabled={detail.status === 'DRAFT'}
        disabledHint="Only a draft requisition can be submitted"
        icon={<SendIcon />}
        variant="outlined"
        confirmTitle="Submit requisition for approval"
        confirmDescription={`Requisition ${detail.documentNumber} will be sent for approval.`}
        reason="optional"
        action={(reason) => requirementApi.submit(id, reason)}
        invalidateKeys={invalidateKeys}
        onSuccess={() => toast.success(`${detail.documentNumber} submitted for approval`)}
      />
      <WorkflowActionButton
        label="Approve"
        permitted={can('STOCK_REQUIREMENT_APPROVE')}
        enabled={detail.status === 'SUBMITTED'}
        disabledHint="Only a submitted requisition can be approved"
        icon={<CheckCircleOutlineIcon />}
        color="success"
        confirmTitle="Approve requisition"
        confirmDescription={`Approving ${detail.documentNumber} allows a purchase order to be raised against it.`}
        reason="optional"
        action={(reason) => requirementApi.approve(id, reason)}
        invalidateKeys={invalidateKeys}
        onSuccess={() => toast.success(`${detail.documentNumber} approved`)}
      />
      <WorkflowActionButton
        label="Reject"
        permitted={can('STOCK_REQUIREMENT_APPROVE')}
        enabled={detail.status === 'SUBMITTED'}
        disabledHint="Only a submitted requisition can be rejected"
        icon={<BlockIcon />}
        color="error"
        variant="outlined"
        confirmTitle="Reject requisition"
        confirmDescription={`${detail.documentNumber} will be rejected. The reason is stored on the document history.`}
        reason="required"
        reasonLabel="Rejection reason"
        action={(reason) => requirementApi.reject(id, reason ?? '')}
        invalidateKeys={invalidateKeys}
        onSuccess={() => toast.info(`${detail.documentNumber} rejected`)}
      />
      {/* A partially fulfilled requirement may still be ordered against, for
          whatever a receipt correction left short; the backend caps the
          quantity at what is actually outstanding. */}
      {canOrder ? (
        <Stack alignItems="flex-end" spacing={0.25}>
          <Button
            component={RouterLink}
            to={`/purchase-orders/new?requirementId=${detail.id}`}
            size="small"
            variant="contained"
            startIcon={<ShoppingCartOutlinedIcon />}
          >
            {isFollowUp ? 'Create follow-up PO' : 'Create purchase order'}
          </Button>
          {isFollowUp && remaining && remaining.greaterThan(0) ? (
            <Typography variant="caption" color="warning.main" fontWeight={700}>
              {formatQuantity(remaining)} units remaining
            </Typography>
          ) : null}
          {/* Said here, where the decision is actually taken, and said once: the
              order is never blocked, only informed. */}
          {sourcingHint ? (
            <Typography variant="caption" color="success.main" fontWeight={700}>
              {formatQuantity(sourcingHint.suggestedInternalQty)} of this could come from another
              branch
            </Typography>
          ) : null}
        </Stack>
      ) : null}
    </>
  ) : null;

  return (
    <DocumentPageFrame
      backTo="/requirements"
      backLabel="All requisitions"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {detail && totals ? (
        <DocumentWorkspace
          detail={detail}
          chain={chain}
          actions={actions}
          extraTabs={sourcingTabs}
          initialTabKey={searchParams.get('tab') ?? undefined}
          noteLabel="Reason"
          totals={null}
          movements={chain.movements}
          paymentsCount={chain.payments.length}
          paymentsContent={<ChainPayments payments={chain.payments} />}
          facts={[
            {
              icon: <StorefrontOutlinedIcon fontSize="small" />,
              label: 'Branch',
              value: detail.branch?.name ?? '—',
            },
            {
              icon: <PersonOutlineIcon fontSize="small" />,
              label: 'Requested by',
              value: (
                <>
                  {detail.createdBy?.name ?? '—'}
                  {detail.createdBy?.email ? (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {detail.createdBy.email}
                    </Typography>
                  ) : null}
                </>
              ),
            },
            {
              icon: <ScheduleOutlinedIcon fontSize="small" />,
              label: 'Created',
              value: formatDateTime(detail.createdAt),
            },
            {
              icon: <EventOutlinedIcon fontSize="small" />,
              label: 'Required by',
              value: formatDate(detail.expectedDeliveryDate),
            },
          ]}
          summary={
            <FulfilmentStats detail={detail} totals={totals} isLoading={fulfilment.isLoading} />
          }
          overview={
            <Box>
              <FulfilmentProgress
                detail={detail}
                totals={totals}
                isLoading={fulfilment.isLoading}
                partial={fulfilment.partial}
              />
              <Box sx={{ mt: 3 }}>
                <ChainFinancialSummary
                  financials={chain.financials}
                  hasChain={chain.byType('PURCHASE_ORDER').length > 0}
                />
              </Box>
            </Box>
          }
          linesContent={
            <RequirementItems
              detail={detail}
              fulfilledByProduct={fulfilledByProduct}
              batchByProduct={batchByProduct}
            />
          }
        />
      ) : null}
    </DocumentPageFrame>
  );
}
