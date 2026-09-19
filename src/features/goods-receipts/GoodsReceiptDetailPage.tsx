import { useQuery } from '@tanstack/react-query';
import { Button, Grid } from '@mui/material';
import PublishedWithChangesIcon from '@mui/icons-material/PublishedWithChanges';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { goodsReceiptApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useDocumentChain } from '@/hooks/useDocumentChain';
import { useToast } from '@/components/Toast';
import { WorkflowActionButton } from '@/components/WorkflowActionButton';
import { StatCard } from '@/components/StatCard';
import { DocumentPageFrame } from '@/features/documents/DetailShell';
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace';
import { ReceiptSplitPanel, receiptTotals } from './ReceiptSplit';
import { formatQuantity } from '@/utils/decimal';

export function GoodsReceiptDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const toast = useToast();

  const query = useQuery({
    queryKey: ['goods-receipts', id],
    queryFn: () => goodsReceiptApi.get(id),
    enabled: Boolean(id),
  });

  const detail = query.data;
  const chain = useDocumentChain(detail);
  const totals = detail ? receiptTotals(detail) : null;

  const actions = detail ? (
    <>
      <WorkflowActionButton
        label="Post receipt"
        permitted={can('GOODS_RECEIPT_POST')}
        enabled={detail.status === 'DRAFT'}
        disabledHint="Only a draft receipt can be posted"
        icon={<PublishedWithChangesIcon />}
        color="success"
        confirmTitle="Post goods receipt"
        confirmDescription={`Posting ${detail.documentNumber} writes the accepted quantity to usable stock and the damaged quantity to damaged stock. It cannot be edited afterwards — only corrected.`}
        reason="optional"
        action={(reason) => goodsReceiptApi.post(id, reason)}
        invalidateKeys={[
          ['goods-receipts'],
          ['documents'],
          ['inventory'],
          ['stock-requirements'],
          ['action-queue'],
        ]}
        onSuccess={() => toast.success(`${detail.documentNumber} posted to the stock ledger`)}
      />
      {can('RECEIPT_CORRECTION_CREATE') &&
      (detail.status === 'POSTED' || detail.status === 'CORRECTED') ? (
        <Button
          component={RouterLink}
          to={`/receipt-corrections/new?goodsReceiptId=${detail.id}`}
          size="small"
          variant="outlined"
          startIcon={<EditNoteIcon />}
        >
          Correct receipt
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <DocumentPageFrame
      backTo="/goods-receipts"
      backLabel="All goods receipts"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {detail && totals ? (
        <DocumentWorkspace
          detail={detail}
          chain={chain}
          actions={actions}
          quantityLabel="Claimed"
          overview={<ReceiptSplitPanel detail={detail} />}
          summary={
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Supplier claimed"
                  value={formatQuantity(totals.claimed)}
                  caption="Quantity on the supplier note"
                  icon={<LocalShippingOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Accepted"
                  value={formatQuantity(totals.accepted)}
                  caption="Usable stock"
                  tone="success"
                  icon={<CheckCircleOutlineIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Damaged"
                  value={formatQuantity(totals.damaged)}
                  caption="Held separately, never available"
                  tone={totals.damaged.greaterThan(0) ? 'danger' : 'neutral'}
                  icon={<ReportProblemOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Missing"
                  value={formatQuantity(totals.missing)}
                  caption="No stock created"
                  tone={totals.missing.greaterThan(0) ? 'warning' : 'neutral'}
                  icon={<HelpOutlineIcon fontSize="small" />}
                />
              </Grid>
            </Grid>
          }
        />
      ) : null}
    </DocumentPageFrame>
  );
}
