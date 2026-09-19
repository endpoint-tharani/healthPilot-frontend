import { useQuery } from '@tanstack/react-query';
import { Box, Grid, Stack, Typography } from '@mui/material';
import MedicationLiquidOutlinedIcon from '@mui/icons-material/MedicationLiquidOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { useParams } from 'react-router-dom';
import { dispensingApi } from '@/api/endpoints';
import { useDocumentChain } from '@/hooks/useDocumentChain';
import { FinancialSummary } from '@/components/FinancialSummary';
import { StatCard } from '@/components/StatCard';
import { ToneChip } from '@/components/StatusChip';
import { DocumentPageFrame } from '@/features/documents/DetailShell';
import { DocumentWorkspace } from '@/features/documents/DocumentWorkspace';
import { dec, formatMoney, formatQuantity, sumDecimals } from '@/utils/decimal';
import { formatDateTime, humanise } from '@/utils/format';
import type { DocumentDetail } from '@/types/api';

/**
 * The counter view of a dispensing: what was charged, and what left the shelf.
 * Sale value is the document's own figure, the cost of the stock issued comes
 * from the ledger rows the dispensing wrote - both are backend values.
 */
function DispensingSummaryPanel({ detail }: { detail: DocumentDetail }) {
  const issued = detail.inventoryTransactions.filter(
    (movement) => movement.transactionType === 'DISPENSING'
  );
  const costIssued = sumDecimals(issued.map((movement) => dec(movement.totalCost).abs()));
  const unitsIssued = sumDecimals(issued.map((movement) => dec(movement.quantity).abs()));
  const payment = detail.paymentAllocations[0]?.payment;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
          Amount charged
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Patient billed at selling price, as recorded on this document
        </Typography>
        <Box sx={{ mt: 1.5 }}>
          <FinancialSummary
            lines={[
              { label: 'Subtotal', value: detail.subtotal },
              { label: 'Tax', value: detail.taxAmount },
              { label: 'Total charged', value: detail.totalAmount, emphasis: true, ruleAbove: true },
              ...(payment
                ? [
                    {
                      label: `Paid by ${humanise(payment.method).toLowerCase()}`,
                      value: payment.amount,
                      caption: payment.paymentNumber,
                    },
                  ]
                : []),
            ]}
          />
        </Box>
      </Grid>

      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" sx={{ mb: 0.25 }}>
          Stock impact
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Usable stock issued from the branch, at cost
        </Typography>
        <Stack spacing={1} sx={{ mt: 1.5 }}>
          {issued.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No stock movement has been posted for this dispensing.
            </Typography>
          ) : (
            issued.map((movement) => (
              <Stack
                key={movement.id}
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent="space-between"
                sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {movement.product?.name ?? '—'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {movement.batch?.batchNumber
                      ? `Batch ${movement.batch.batchNumber} · `
                      : ''}
                    {movement.branch?.name ?? ''}
                  </Typography>
                </Box>
                <ToneChip
                  tone="danger"
                  label={`−${formatQuantity(dec(movement.quantity).abs())} usable`}
                />
              </Stack>
            ))
          )}
          <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Cost of stock issued
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatMoney(costIssued)}
            </Typography>
          </Stack>
          <Stack direction="row" justifyContent="space-between">
            <Typography variant="body2" color="text.secondary">
              Units issued
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {formatQuantity(unitsIssued)}
            </Typography>
          </Stack>
        </Stack>
      </Grid>
    </Grid>
  );
}

export function DispensingDetailPage() {
  const { id = '' } = useParams();

  const query = useQuery({
    queryKey: ['dispensing', id],
    queryFn: () => dispensingApi.get(id),
    enabled: Boolean(id),
  });

  const detail = query.data;
  const chain = useDocumentChain(detail);

  const issued = detail
    ? detail.inventoryTransactions.filter((movement) => movement.transactionType === 'DISPENSING')
    : [];
  const unitsIssued = sumDecimals(issued.map((movement) => dec(movement.quantity).abs()));
  const payment = detail?.paymentAllocations[0]?.payment;

  return (
    <DocumentPageFrame
      backTo="/dispensing"
      backLabel="All dispensing"
      isLoading={query.isLoading}
      error={query.error}
      onRetry={() => void query.refetch()}
    >
      {detail ? (
        <DocumentWorkspace
          detail={detail}
          chain={chain}
          quantityLabel="Dispensed"
          totals={null}
          overview={<DispensingSummaryPanel detail={detail} />}
          facts={[
            {
              icon: <StorefrontOutlinedIcon fontSize="small" />,
              label: 'Branch',
              value: detail.branch?.name ?? '—',
            },
            {
              icon: <PersonOutlineIcon fontSize="small" />,
              label: 'Patient reference',
              value: detail.patientRef ?? '—',
            },
            {
              icon: <DescriptionOutlinedIcon fontSize="small" />,
              label: 'Prescription reference',
              value: detail.prescriptionRef ?? '—',
            },
            {
              icon: <ScheduleOutlinedIcon fontSize="small" />,
              label: 'Dispensed',
              value: formatDateTime(detail.documentDate),
            },
          ]}
          summary={
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Total charged"
                  value={formatMoney(detail.totalAmount)}
                  caption={`Tax ${formatMoney(detail.taxAmount)}`}
                  icon={<PaymentsOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Units issued"
                  value={formatQuantity(unitsIssued)}
                  caption="Out of usable stock"
                  tone={unitsIssued.greaterThan(0) ? 'danger' : 'neutral'}
                  icon={<Inventory2OutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Products"
                  value={detail.lineItems.length}
                  caption="Lines on this dispensing"
                  icon={<MedicationLiquidOutlinedIcon fontSize="small" />}
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <StatCard
                  label="Payment"
                  value={payment ? humanise(payment.method) : '—'}
                  caption={payment ? payment.paymentNumber : 'No payment recorded'}
                  tone={payment ? 'success' : 'neutral'}
                  icon={<PaymentsOutlinedIcon fontSize="small" />}
                />
              </Grid>
            </Grid>
          }
        />
      ) : null}
    </DocumentPageFrame>
  );
}
