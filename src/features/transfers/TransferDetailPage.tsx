import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Grid } from '@mui/material';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SwapHorizOutlinedIcon from '@mui/icons-material/SwapHorizOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { useParams } from 'react-router-dom';
import { stockTransferApi } from '@/api/endpoints';
import { useAuth } from '@/auth/useAuth';
import { useDocumentChain } from '@/hooks/useDocumentChain';
import { useToast } from '@/components/Toast';
import { WorkflowActionButton } from '@/components/WorkflowActionButton';
import { StatCard } from '@/components/StatCard';
import { DocumentPageFrame } from '@/features/documents/DetailShell';
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace';
import { TransferRoute } from './TransferRoute';
import { formatQuantity, sumDecimals } from '@/utils/decimal';
import { formatDateTime } from '@/utils/format';

export function TransferDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const toast = useToast();

  const query = useQuery({
    queryKey: ['stock-transfers', id],
    queryFn: () => stockTransferApi.get(id),
    enabled: Boolean(id),
  });

  const detail = query.data;
  const chain = useDocumentChain(detail);
  const invalidateKeys = [
    ['stock-transfers'],
    ['documents'],
    ['inventory'],
    ['action-queue'],
  ];

  const dispatchMovement = detail?.inventoryTransactions.find(
    (movement) => movement.transactionType === 'TRANSFER_OUT'
  );
  const receiptMovement = detail?.inventoryTransactions.find(
    (movement) => movement.transactionType === 'TRANSFER_IN'
  );
  // Who acted comes from the audit trail, which records the actor per transition.
  const dispatchLog = detail?.history?.find((entry) => entry.action === 'DISPATCH');
  const receiveLog = detail?.history?.find((entry) => entry.action === 'RECEIVE');
  const units = detail ? sumDecimals(detail.lineItems.map((line) => line.quantity)) : undefined;

  const actions = detail ? (
    <>
      <WorkflowActionButton
        label="Dispatch"
        permitted={can('STOCK_TRANSFER_DISPATCH')}
        enabled={detail.status === 'DRAFT'}
        disabledHint="Only a draft transfer can be dispatched"
        icon={<LocalShippingOutlinedIcon />}
        confirmTitle="Dispatch transfer"
        confirmDescription={`Usable stock will be issued from ${detail.sourceBranch?.name ?? 'the source branch'}. The destination gains nothing until it records receipt.`}
        reason="optional"
        action={(reason) => stockTransferApi.dispatch(id, reason)}
        invalidateKeys={invalidateKeys}
        onSuccess={() =>
          toast.success(`${detail.documentNumber} dispatched from ${detail.sourceBranch?.name ?? 'source'}`)
        }
      />
      <WorkflowActionButton
        label="Receive"
        permitted={can('STOCK_TRANSFER_RECEIVE')}
        enabled={detail.status === 'DISPATCHED'}
        disabledHint="Only a dispatched transfer can be received"
        icon={<MoveToInboxIcon />}
        color="success"
        confirmTitle="Receive transfer"
        confirmDescription={`Stock will be booked into ${detail.destinationBranch?.name ?? 'the destination branch'} as usable stock.`}
        reason="optional"
        action={(reason) => stockTransferApi.receive(id, reason)}
        invalidateKeys={invalidateKeys}
        onSuccess={() =>
          toast.success(`${detail.documentNumber} received at ${detail.destinationBranch?.name ?? 'destination'}`)
        }
      />
    </>
  ) : null;

  return (
    <DocumentPageFrame
      backTo="/stock-transfers"
      backLabel="All transfers"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {detail ? (
        <DocumentWorkspace
          detail={detail}
          chain={chain}
          actions={actions}
          quantityLabel="Transferred"
          totals={null}
          facts={[
            {
              icon: <WarehouseOutlinedIcon fontSize="small" />,
              label: 'Source branch',
              value: detail.sourceBranch?.name ?? '—',
            },
            {
              icon: <StorefrontOutlinedIcon fontSize="small" />,
              label: 'Destination branch',
              value: detail.destinationBranch?.name ?? '—',
            },
            {
              icon: <PersonOutlineIcon fontSize="small" />,
              label: 'Raised by',
              value: detail.createdBy?.name ?? '—',
            },
            {
              icon: <ScheduleOutlinedIcon fontSize="small" />,
              label: 'Created',
              value: formatDateTime(detail.createdAt),
            },
          ]}
          overview={
            <Box>
              <TransferRoute detail={detail} />
              {detail.status === 'DISPATCHED' ? (
                <Alert severity="info" sx={{ mt: 2 }}>
                  Stock has left the source branch and is in transit. The destination branch gains
                  stock only when it records receipt.
                </Alert>
              ) : null}
            </Box>
          }
          summary={
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Units in transfer"
                  value={formatQuantity(units)}
                  caption={`${detail.lineItems.length} line(s)`}
                  icon={<Inventory2OutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Dispatched"
                  value={dispatchMovement ? 'Yes' : 'Not yet'}
                  caption={
                    dispatchMovement
                      ? formatDateTime(dispatchMovement.transactionDate)
                      : 'Stock still at the source branch'
                  }
                  tone={dispatchMovement ? 'info' : 'neutral'}
                  icon={<LocalShippingOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Received"
                  value={receiptMovement ? 'Yes' : 'Not yet'}
                  caption={
                    receiptMovement
                      ? formatDateTime(receiptMovement.transactionDate)
                      : 'Destination has gained nothing yet'
                  }
                  tone={receiptMovement ? 'success' : 'neutral'}
                  icon={<MoveToInboxIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Handled by"
                  value={receiveLog?.user?.name ?? dispatchLog?.user?.name ?? '—'}
                  caption={
                    receiveLog
                      ? 'Recorded the receipt'
                      : dispatchLog
                        ? 'Dispatched the stock'
                        : 'No transition recorded yet'
                  }
                  icon={<SwapHorizOutlinedIcon fontSize="small" />}
                />
              </Grid>
            </Grid>
          }
        />
      ) : null}
    </DocumentPageFrame>
  );
}
