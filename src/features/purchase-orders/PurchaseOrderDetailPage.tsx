import { useQuery } from '@tanstack/react-query';
import { Button, Grid } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import BlockIcon from '@mui/icons-material/Block';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { purchaseOrderApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useDocumentChain } from '@/hooks/useDocumentChain';
import { useToast } from '@/components/Toast';
import { WorkflowActionButton } from '@/components/WorkflowActionButton';
import { StatCard } from '@/components/StatCard';
import { DocumentPageFrame } from '@/features/documents/DetailShell';
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace';
import { formatMoney, formatQuantity, sumDecimals } from '@/utils/decimal';

export function PurchaseOrderDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const toast = useToast();

  const query = useQuery({
    queryKey: ['purchase-orders', id],
    queryFn: () => purchaseOrderApi.get(id),
    enabled: Boolean(id),
  });

  const detail = query.data;
  const chain = useDocumentChain(detail);
  const invalidateKeys = [['purchase-orders'], ['documents'], ['action-queue']];

  const orderedUnits = detail
    ? sumDecimals(detail.lineItems.map((line) => line.quantity))
    : undefined;
  const receipts = chain.byType('GOODS_RECEIPT');
  const invoices = chain.byType('SUPPLIER_INVOICE');

  const actions = detail ? (
    <>
      <WorkflowActionButton
        label="Approve"
        permitted={can('PURCHASE_ORDER_APPROVE')}
        enabled={detail.status === 'DRAFT' || detail.status === 'SUBMITTED'}
        disabledHint="Only a draft or submitted order can be approved"
        icon={<CheckCircleOutlineIcon />}
        color="success"
        confirmTitle="Approve purchase order"
        confirmDescription={`${detail.documentNumber} will be approved and goods can then be received against it.`}
        reason="optional"
        action={(reason) => purchaseOrderApi.approve(id, reason)}
        invalidateKeys={invalidateKeys}
        onSuccess={() => toast.success(`${detail.documentNumber} approved`)}
      />
      <WorkflowActionButton
        label="Cancel order"
        permitted={can('PURCHASE_ORDER_APPROVE')}
        enabled={['DRAFT', 'SUBMITTED', 'APPROVED'].includes(detail.status)}
        disabledHint="This order can no longer be cancelled"
        icon={<BlockIcon />}
        color="error"
        variant="outlined"
        confirmTitle="Cancel purchase order"
        confirmDescription={`${detail.documentNumber} will be cancelled. Orders that already have goods receipts cannot be cancelled.`}
        reason="required"
        reasonLabel="Cancellation reason"
        action={(reason) => purchaseOrderApi.cancel(id, reason ?? '')}
        invalidateKeys={invalidateKeys}
        onSuccess={() => toast.success(`${detail.documentNumber} cancelled`)}
      />
      {can('GOODS_RECEIPT_CREATE') && detail.status === 'APPROVED' ? (
        <Button
          component={RouterLink}
          to={`/goods-receipts/new?purchaseOrderId=${detail.id}`}
          size="small"
          variant="contained"
          startIcon={<LocalShippingOutlinedIcon />}
        >
          Receive goods
        </Button>
      ) : null}
      {can('SUPPLIER_INVOICE_CREATE') ? (
        <Button
          component={RouterLink}
          to={`/supplier-invoices/new?purchaseOrderId=${detail.id}`}
          size="small"
          variant="outlined"
          startIcon={<ReceiptLongOutlinedIcon />}
        >
          Record invoice
        </Button>
      ) : null}
    </>
  ) : null;

  return (
    <DocumentPageFrame
      backTo="/purchase-orders"
      backLabel="All purchase orders"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {detail ? (
        <DocumentWorkspace
          detail={detail}
          chain={chain}
          actions={actions}
          quantityLabel="Ordered"
          summary={
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Order value"
                  value={formatMoney(detail.totalAmount)}
                  caption={`${detail.lineItems.length} line(s)`}
                  icon={<PaymentsOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Units ordered"
                  value={formatQuantity(orderedUnits)}
                  caption="Across all lines"
                  icon={<Inventory2OutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Goods receipts"
                  value={receipts.length}
                  caption={receipts.length === 0 ? 'Nothing received yet' : 'Raised against this order'}
                  tone={receipts.length > 0 ? 'success' : 'neutral'}
                  loading={chain.isLoading}
                  icon={<LocalShippingOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Supplier invoices"
                  value={invoices.length}
                  caption={invoices.length === 0 ? 'Not invoiced yet' : 'Billed against this order'}
                  tone={invoices.length > 0 ? 'info' : 'neutral'}
                  loading={chain.isLoading}
                  icon={<ReceiptLongOutlinedIcon fontSize="small" />}
                />
              </Grid>
            </Grid>
          }
        />
      ) : null}
    </DocumentPageFrame>
  );
}
